"""
Risk History Service — unified event log.

Call log_event() from any write path (risk CRUD, review submissions,
GRC decisions) to append a timestamped entry to risk_history.

get_unified_history(db, risk_id) merges legacy RiskReviewUpdate rows
with new RiskHistoryEntry rows so the history page always shows a
complete picture regardless of which table an event came from.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload

from app.models.models import RiskHistoryEntry, RiskReviewUpdate, User

# ── Field display names (for human-readable summaries) ────────────────────────

_FIELD_LABELS: dict[str, str] = {
    "name":                 "Name",
    "description":          "Description",
    "likelihood":           "Likelihood",
    "impact":               "Impact",
    "residual_likelihood":  "Residual Likelihood",
    "residual_impact":      "Residual Impact",
    "status":               "Status",
    "treatment":            "Treatment",
    "owner":                "Owner",
    "owner_id":             "Owner (user)",
    "managed_start_date":   "Managed Start Date",
    "managed_end_date":     "Managed End Date",
    "asset_id":             "Asset",
    "threat_id":            "Threat",
    "parent_risk_id":       "Parent Risk",
}


# ── Public writer ─────────────────────────────────────────────────────────────

def log_event(
    db:             Session,
    risk_id:        int,
    event_type:     str,
    actor:          Optional[User],
    summary:        str,
    old_status:     Optional[str] = None,
    new_status:     Optional[str] = None,
    changed_fields: Optional[dict] = None,
    notes:          Optional[str] = None,
) -> RiskHistoryEntry:
    """
    Append one entry to risk_history. Does NOT commit — caller must commit.

    event_type values:
      created | field_changed | review_submitted | review_accepted |
      review_challenged | challenge_responded
    """
    entry = RiskHistoryEntry(
        risk_id        = risk_id,
        event_type     = event_type,
        actor_id       = actor.id if actor else None,
        actor_name     = actor.display_name if actor else None,
        summary        = summary,
        old_status     = old_status,
        new_status     = new_status,
        changed_fields = json.dumps(changed_fields) if changed_fields else None,
        notes          = notes,
        created_at     = datetime.utcnow(),
    )
    db.add(entry)
    return entry


def diff_snaps(before: dict, after: dict) -> dict[str, dict]:
    """
    Return {field: {before: x, after: y}} for every field that changed,
    using only the fields in _FIELD_LABELS.
    """
    changes: dict[str, dict] = {}
    for field in _FIELD_LABELS:
        b = before.get(field)
        a = after.get(field)
        if b != a:
            changes[field] = {"before": b, "after": a}
    return changes


def make_summary(actor_name: str, changes: dict[str, dict]) -> str:
    """Generate a short human-readable summary of what changed."""
    if not changes:
        return f"{actor_name} updated the risk"

    labels = [_FIELD_LABELS.get(f, f) for f in changes]

    # Special-case status-only change to be more descriptive
    if list(changes.keys()) == ["status"]:
        old = changes["status"]["before"] or "—"
        new = changes["status"]["after"] or "—"
        return f"Status changed from '{old}' to '{new}'"

    # Score changes
    score_fields = {"likelihood", "impact", "residual_likelihood", "residual_impact"}
    if set(changes.keys()).issubset(score_fields):
        return f"Risk score updated ({', '.join(labels)})"

    if len(labels) == 1:
        return f"{labels[0]} updated"
    if len(labels) <= 3:
        return f"{', '.join(labels[:-1])} and {labels[-1]} updated"
    return f"{len(labels)} fields updated"


# ── Public reader ─────────────────────────────────────────────────────────────

def get_unified_history(db: Session, risk_id: int) -> list[dict]:
    """
    Return a merged, date-sorted list of history events for a risk,
    combining new RiskHistoryEntry rows with legacy RiskReviewUpdate rows.

    Each item in the returned list is a plain dict with a stable shape:
      id, source, event_type, actor_name, summary, old_status, new_status,
      changed_fields (dict|None), notes, created_at (ISO string)
    """
    results: list[dict] = []

    # ── New history entries ───────────────────────────────────────────────────
    entries = (
        db.query(RiskHistoryEntry)
        .options(joinedload(RiskHistoryEntry.actor))
        .filter(RiskHistoryEntry.risk_id == risk_id)
        .all()
    )
    for e in entries:
        results.append({
            "id":             e.id,
            "source":         "history",
            "event_type":     e.event_type,
            "actor_name":     e.actor_name or (e.actor.display_name if e.actor else "System"),
            "summary":        e.summary or "",
            "old_status":     e.old_status,
            "new_status":     e.new_status,
            "changed_fields": json.loads(e.changed_fields) if e.changed_fields else None,
            "notes":          e.notes,
            "created_at":     e.created_at.isoformat() if e.created_at else None,
        })

    # ── Legacy review updates (backward compat) ───────────────────────────────
    updates = (
        db.query(RiskReviewUpdate)
        .options(
            joinedload(RiskReviewUpdate.submitter),
            joinedload(RiskReviewUpdate.grc_reviewer),
        )
        .filter(RiskReviewUpdate.risk_id == risk_id)
        .all()
    )
    for u in updates:
        actor = u.submitter.display_name if u.submitter else "Unknown"
        summary = f"Review update submitted — status: {u.status_confirmed or '(not changed)'}"
        results.append({
            "id":             f"rev_{u.id}",
            "source":         "review",
            "event_type":     "review_submitted",
            "actor_name":     actor,
            "summary":        summary,
            "old_status":     None,
            "new_status":     u.status_confirmed,
            "changed_fields": None,
            "notes":          u.notes,
            "mitigation_progress": u.mitigation_progress,
            "grc_review_status":   u.grc_review_status,
            "grc_challenge_reason": u.grc_challenge_reason,
            "owner_challenge_response": u.owner_challenge_response,
            "created_at":     u.submitted_at.isoformat() if u.submitted_at else None,
        })

    # Sort newest first
    results.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return results
