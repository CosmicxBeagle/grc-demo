"""006 risk parent child

Revision ID: 006
Revises: 005
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "risks",
        sa.Column("parent_risk_id", sa.Integer(), sa.ForeignKey("risks.id"), nullable=True),
    )
    op.create_index("ix_risks_parent_risk_id", "risks", ["parent_risk_id"])


def downgrade():
    op.drop_index("ix_risks_parent_risk_id", "risks")
    op.drop_column("risks", "parent_risk_id")
