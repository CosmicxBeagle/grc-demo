"""
Microsoft To Do Tasks Sync
Creates tasks in Microsoft To Do for each deadline.

CRITICAL: To Do API does NOT support Application permissions.
Must use delegated (user sign-in) auth. The stored MSAL refresh token
handles this silently after initial login.

Graph endpoint: POST /me/todo/lists/{listId}/tasks
Scope required: Tasks.ReadWrite (delegated only)

NOTE: The old Outlook Tasks API (/beta/me/outlook/tasks) is fully
deprecated since August 2022. Always use the To Do API.
"""

import httpx
from datetime import date, datetime, timezone
from typing import Optional
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from auth.msal_client import get_access_token
from config import get_settings

settings = get_settings()
GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _get_headers() -> dict:
    token = get_access_token()
    if not token:
        raise RuntimeError("Not authenticated. Visit /auth/login to connect Microsoft 365.")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


# ---------------------------------------------------------------------------
# Task List Management
# ---------------------------------------------------------------------------

def get_or_create_task_list(list_name: Optional[str] = None) -> str:
    """
    Find the 'Legal Deadlines' task list (or create it) and return its ID.
    Caches the result in memory after first call.
    """
    list_name = list_name or settings.todo_list_name

    with httpx.Client() as client:
        # List all task lists
        response = client.get(f"{GRAPH_BASE}/me/todo/lists", headers=_get_headers(), timeout=30)
        response.raise_for_status()
        lists = response.json().get("value", [])

        for task_list in lists:
            if task_list.get("displayName") == list_name:
                logger.debug(f"Found existing task list: {list_name} (id={task_list['id']})")
                return task_list["id"]

        # Create the list
        payload = {"displayName": list_name}
        create_response = client.post(
            f"{GRAPH_BASE}/me/todo/lists",
            headers=_get_headers(),
            json=payload,
            timeout=30,
        )
        create_response.raise_for_status()
        new_list = create_response.json()
        logger.info(f"Created task list: {list_name} (id={new_list['id']})")
        return new_list["id"]


# ---------------------------------------------------------------------------
# Task Creation
# ---------------------------------------------------------------------------

def create_deadline_task(
    case_name: str,
    case_number: str,
    court: str,
    label: str,
    deadline_date: date,
    description: str,
    task_list_id: Optional[str] = None,
) -> Optional[str]:
    """
    Create a To Do task for a deadline. Returns the Graph task ID.

    The task will appear in Microsoft To Do and Outlook Tasks pane.
    Due date is set to the deadline date.
    """
    task_list_id = task_list_id or get_or_create_task_list()

    # Graph API requires ISO 8601 with timezone for dueDateTime
    due_datetime = datetime.combine(deadline_date, datetime.min.time()).replace(
        tzinfo=timezone.utc
    )

    body_text = (
        f"Case: {case_name} ({case_number})\n"
        f"Court: {court}\n"
        f"Deadline: {label}\n\n"
        f"{description or ''}"
    )

    payload = {
        "title": f"{label} — {case_name} ({case_number})",
        "body": {
            "contentType": "text",
            "content": body_text,
        },
        "dueDateTime": {
            "dateTime": due_datetime.strftime("%Y-%m-%dT%H:%M:%S.0000000"),
            "timeZone": "UTC",
        },
        "importance": "high",
        "status": "notStarted",
        # linkedResources can link back to our app (optional, requires app registration)
    }

    try:
        with httpx.Client() as client:
            response = client.post(
                f"{GRAPH_BASE}/me/todo/lists/{task_list_id}/tasks",
                headers=_get_headers(),
                json=payload,
                timeout=30,
            )
            response.raise_for_status()
            task = response.json()
            task_id = task.get("id")
            logger.info(f"Created To Do task for {label} due {deadline_date}: {task_id}")
            return task_id

    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to create To Do task: {e.response.status_code} {e.response.text}")
        return None


def complete_task(task_id: str, task_list_id: str) -> bool:
    """Mark a task as completed in Microsoft To Do."""
    try:
        with httpx.Client() as client:
            response = client.patch(
                f"{GRAPH_BASE}/me/todo/lists/{task_list_id}/tasks/{task_id}",
                headers=_get_headers(),
                json={"status": "completed"},
                timeout=30,
            )
            response.raise_for_status()
            logger.info(f"Marked task {task_id} as completed.")
            return True
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to complete task {task_id}: {e.response.text}")
        return False


def delete_task(task_id: str, task_list_id: str) -> bool:
    """Delete a To Do task."""
    try:
        with httpx.Client() as client:
            response = client.delete(
                f"{GRAPH_BASE}/me/todo/lists/{task_list_id}/tasks/{task_id}",
                headers=_get_headers(),
                timeout=30,
            )
            if response.status_code not in (200, 204, 404):
                response.raise_for_status()
            logger.info(f"Deleted task {task_id}.")
            return True
    except httpx.HTTPStatusError as e:
        logger.error(f"Failed to delete task {task_id}: {e.response.text}")
        return False
