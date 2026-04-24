"""Add treatment milestone execution columns (Loop 3 parity) and risks.owning_vp

Mirrors the escalation + extension columns that 009_rework_evidence_escalation.py
added to deficiency_milestones, applied here to treatment_milestones so that the
treatment-plan execution lifecycle (escalation levels 0→1→2, extension request /
approve / reject loop) works identically for both milestone types.

Also adds risks.owning_vp to record the VP-level business owner of each risk.

Revision ID: 020
Revises: 019
Create Date: 2026-04-24
"""
import sqlalchemy as sa
from alembic import op

revision = "020"
down_revision = "019"
branch_labels = None
depends_on = None


def upgrade():
    # ── risks.owning_vp ───────────────────────────────────────────────────────
    op.add_column("risks", sa.Column("owning_vp", sa.String(100), nullable=True))

    # ── treatment_milestones: escalation tracking ─────────────────────────────
    op.add_column(
        "treatment_milestones",
        sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "treatment_milestones",
        sa.Column("escalated_at", sa.DateTime(), nullable=True),
    )

    # ── treatment_milestones: extension request workflow ──────────────────────
    op.add_column(
        "treatment_milestones",
        sa.Column("extension_requested", sa.Boolean(), nullable=False, server_default="0"),
    )
    op.add_column(
        "treatment_milestones",
        sa.Column("extension_request_reason", sa.Text(), nullable=True),
    )
    op.add_column(
        "treatment_milestones",
        sa.Column("extension_requested_at", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "treatment_milestones",
        sa.Column("extension_approved", sa.Boolean(), nullable=True),  # None=pending
    )
    op.add_column(
        "treatment_milestones",
        sa.Column(
            "extension_approved_by_user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )
    op.add_column(
        "treatment_milestones",
        sa.Column("new_due_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "treatment_milestones",
        sa.Column("original_due_date", sa.Date(), nullable=True),
    )


def downgrade():
    # treatment_milestones extension workflow
    op.drop_column("treatment_milestones", "original_due_date")
    op.drop_column("treatment_milestones", "new_due_date")
    op.drop_column("treatment_milestones", "extension_approved_by_user_id")
    op.drop_column("treatment_milestones", "extension_approved")
    op.drop_column("treatment_milestones", "extension_requested_at")
    op.drop_column("treatment_milestones", "extension_request_reason")
    op.drop_column("treatment_milestones", "extension_requested")

    # treatment_milestones escalation tracking
    op.drop_column("treatment_milestones", "escalated_at")
    op.drop_column("treatment_milestones", "escalation_level")

    # risks.owning_vp
    op.drop_column("risks", "owning_vp")
