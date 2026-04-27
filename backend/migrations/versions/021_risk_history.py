"""Add risk_history table — unified event log for all risk write events.

Captures: created, field_changed, review_submitted, review_accepted,
review_challenged, challenge_responded.

Revision ID: 021
Revises: 020
Create Date: 2026-04-24
"""
import sqlalchemy as sa
from alembic import op

revision = "021"
down_revision = "020"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "risk_history",
        sa.Column("id",             sa.Integer(),     primary_key=True),
        sa.Column("risk_id",        sa.Integer(),     sa.ForeignKey("risks.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("event_type",     sa.String(50),    nullable=False),
        sa.Column("actor_id",       sa.Integer(),     sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_name",     sa.String(200),   nullable=True),
        sa.Column("summary",        sa.String(500),   nullable=True),
        sa.Column("old_status",     sa.String(50),    nullable=True),
        sa.Column("new_status",     sa.String(50),    nullable=True),
        sa.Column("changed_fields", sa.Text(),        nullable=True),
        sa.Column("notes",          sa.Text(),        nullable=True),
        sa.Column("created_at",     sa.DateTime(),    nullable=True),
    )


def downgrade():
    op.drop_table("risk_history")
