"""Add rework/evidence-reopen tracking (Loop 1+2), milestone escalation/extension (Loop 3),
and notifications table.

Revision ID: 009
Revises: 008
"""
from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.Integer, nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime, nullable=False),
    )

    # ── assignment_rework_log (Loop 1) ────────────────────────────────────────
    op.create_table(
        "assignment_rework_log",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("assignment_id", sa.Integer, sa.ForeignKey("test_assignments.id"), nullable=False, index=True),
        sa.Column("returned_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("return_reason", sa.Text, nullable=False),
        sa.Column("returned_at", sa.DateTime, nullable=False),
        sa.Column("rework_number", sa.Integer, nullable=False),
    )

    # Loop 1: rework fields on test_assignments
    op.add_column("test_assignments", sa.Column("rework_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("test_assignments", sa.Column("last_returned_at", sa.DateTime, nullable=True))
    op.add_column("test_assignments", sa.Column("last_return_reason", sa.Text, nullable=True))

    # ── evidence_request_history (Loop 2) ────────────────────────────────────
    op.create_table(
        "evidence_request_history",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("assignment_id", sa.Integer, sa.ForeignKey("test_assignments.id"), nullable=False, index=True),
        sa.Column("action", sa.String(30), nullable=False),
        sa.Column("actor_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("file_snapshot_reference", sa.Text, nullable=True),
        sa.Column("occurred_at", sa.DateTime, nullable=False),
    )

    # Loop 2: reopen fields on test_assignments
    op.add_column("test_assignments", sa.Column("reopen_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("test_assignments", sa.Column("last_reopened_at", sa.DateTime, nullable=True))
    op.add_column("test_assignments", sa.Column("last_reopen_reason", sa.Text, nullable=True))

    # ── Loop 3: escalation + extension fields on deficiency_milestones ────────
    op.add_column("deficiency_milestones", sa.Column("escalated_at", sa.DateTime, nullable=True))
    op.add_column("deficiency_milestones", sa.Column("escalation_level", sa.Integer, nullable=False, server_default="0"))
    op.add_column("deficiency_milestones", sa.Column("extension_requested", sa.Boolean, nullable=False, server_default="0"))
    op.add_column("deficiency_milestones", sa.Column("extension_request_reason", sa.Text, nullable=True))
    op.add_column("deficiency_milestones", sa.Column("extension_requested_at", sa.DateTime, nullable=True))
    op.add_column("deficiency_milestones", sa.Column("extension_approved", sa.Boolean, nullable=True))
    op.add_column("deficiency_milestones", sa.Column("extension_approved_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True))
    op.add_column("deficiency_milestones", sa.Column("original_due_date", sa.Date, nullable=True))
    op.add_column("deficiency_milestones", sa.Column("new_due_date", sa.Date, nullable=True))


def downgrade():
    # Loop 3
    op.drop_column("deficiency_milestones", "new_due_date")
    op.drop_column("deficiency_milestones", "original_due_date")
    op.drop_column("deficiency_milestones", "extension_approved_by_user_id")
    op.drop_column("deficiency_milestones", "extension_approved")
    op.drop_column("deficiency_milestones", "extension_requested_at")
    op.drop_column("deficiency_milestones", "extension_request_reason")
    op.drop_column("deficiency_milestones", "extension_requested")
    op.drop_column("deficiency_milestones", "escalation_level")
    op.drop_column("deficiency_milestones", "escalated_at")

    # Loop 2
    op.drop_column("test_assignments", "last_reopen_reason")
    op.drop_column("test_assignments", "last_reopened_at")
    op.drop_column("test_assignments", "reopen_count")
    op.drop_table("evidence_request_history")

    # Loop 1
    op.drop_column("test_assignments", "last_return_reason")
    op.drop_column("test_assignments", "last_returned_at")
    op.drop_column("test_assignments", "rework_count")
    op.drop_table("assignment_rework_log")

    # notifications
    op.drop_table("notifications")
