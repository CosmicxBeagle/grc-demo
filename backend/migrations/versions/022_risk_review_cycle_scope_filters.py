"""Add risk_ids_filter and owner_ids_filter to risk_review_cycles.

Supports hand-picking individual risks or scoping by specific owners/VPs
when creating a review cycle.

Revision ID: 022
Revises: 021
Create Date: 2026-04-24
"""
import sqlalchemy as sa
from alembic import op

revision = "022"
down_revision = "021"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("risk_review_cycles") as batch_op:
        batch_op.add_column(sa.Column("risk_ids_filter",  sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("owner_ids_filter", sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table("risk_review_cycles") as batch_op:
        batch_op.drop_column("owner_ids_filter")
        batch_op.drop_column("risk_ids_filter")
