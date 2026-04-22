"""005 deficiency risk linkage

Revision ID: 005
Revises: 004
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "deficiencies",
        sa.Column("linked_risk_id", sa.Integer(), sa.ForeignKey("risks.id"), nullable=True),
    )
    op.create_index("ix_deficiencies_linked_risk_id", "deficiencies", ["linked_risk_id"])


def downgrade():
    op.drop_index("ix_deficiencies_linked_risk_id", "deficiencies")
    op.drop_column("deficiencies", "linked_risk_id")
