"""Add workpaper/signoff fields to test_assignments, remediation fields to deficiencies,
and new deficiency_milestones table.

Revision ID: 008
Revises: 007
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    # ── test_assignments: workpaper fields ────────────────────────────────────
    op.add_column("test_assignments", sa.Column("testing_steps",            sa.Text(),        nullable=True))
    op.add_column("test_assignments", sa.Column("sample_details",           sa.Text(),        nullable=True))
    op.add_column("test_assignments", sa.Column("walkthrough_notes",        sa.Text(),        nullable=True))
    op.add_column("test_assignments", sa.Column("conclusion",               sa.Text(),        nullable=True))
    op.add_column("test_assignments", sa.Column("evidence_request_text",    sa.Text(),        nullable=True))
    op.add_column("test_assignments", sa.Column("evidence_request_due_date",sa.Date(),        nullable=True))

    # ── test_assignments: signoff fields ─────────────────────────────────────
    op.add_column("test_assignments", sa.Column("tester_submitted_at",       sa.DateTime(),   nullable=True))
    op.add_column("test_assignments", sa.Column("tester_submitted_by_id",    sa.Integer(),    sa.ForeignKey("users.id"), nullable=True))
    op.add_column("test_assignments", sa.Column("tester_signoff_note",       sa.Text(),       nullable=True))
    op.add_column("test_assignments", sa.Column("reviewer_decided_at",       sa.DateTime(),   nullable=True))
    op.add_column("test_assignments", sa.Column("reviewer_decided_by_id",    sa.Integer(),    sa.ForeignKey("users.id"), nullable=True))
    op.add_column("test_assignments", sa.Column("reviewer_outcome",          sa.String(30),   nullable=True))

    # ── deficiencies: remediation detail fields ───────────────────────────────
    op.add_column("deficiencies", sa.Column("root_cause",         sa.Text(),      nullable=True))
    op.add_column("deficiencies", sa.Column("business_impact",    sa.Text(),      nullable=True))
    op.add_column("deficiencies", sa.Column("remediation_owner",  sa.String(100), nullable=True))
    op.add_column("deficiencies", sa.Column("validation_notes",   sa.Text(),      nullable=True))
    op.add_column("deficiencies", sa.Column("closure_evidence",   sa.Text(),      nullable=True))
    op.add_column("deficiencies", sa.Column("closed_at",          sa.DateTime(),  nullable=True))

    # ── deficiency_milestones: new table ──────────────────────────────────────
    op.create_table(
        "deficiency_milestones",
        sa.Column("id",            sa.Integer(),    primary_key=True),
        sa.Column("deficiency_id", sa.Integer(),    sa.ForeignKey("deficiencies.id"), nullable=False),
        sa.Column("title",         sa.String(200),  nullable=False),
        sa.Column("due_date",      sa.Date(),       nullable=True),
        sa.Column("assignee_id",   sa.Integer(),    sa.ForeignKey("users.id"), nullable=True),
        sa.Column("status",        sa.String(30),   nullable=False, server_default="open"),
        sa.Column("completed_at",  sa.DateTime(),   nullable=True),
        sa.Column("notes",         sa.Text(),       nullable=True),
        sa.Column("created_at",    sa.DateTime(),   nullable=True),
    )
    op.create_index("ix_deficiency_milestones_deficiency_id", "deficiency_milestones", ["deficiency_id"])


def downgrade():
    op.drop_table("deficiency_milestones")
    for col in ["root_cause", "business_impact", "remediation_owner",
                "validation_notes", "closure_evidence", "closed_at"]:
        op.drop_column("deficiencies", col)
    for col in ["testing_steps", "sample_details", "walkthrough_notes", "conclusion",
                "evidence_request_text", "evidence_request_due_date",
                "tester_submitted_at", "tester_submitted_by_id", "tester_signoff_note",
                "reviewer_decided_at", "reviewer_decided_by_id", "reviewer_outcome"]:
        op.drop_column("test_assignments", col)
