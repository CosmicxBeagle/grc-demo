"""Add severities column to risk_review_cycles

Revision ID: 015
Revises: 014
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade():
    # Comma-separated severity list, e.g. "low,medium,high,critical"
    # NULL means "use legacy min_score behaviour" (backward-compat)
    op.add_column(
        "risk_review_cycles",
        sa.Column("severities", sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_column("risk_review_cycles", "severities")
