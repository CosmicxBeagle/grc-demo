"""Add test_checklist_items table

Revision ID: 007
Revises: 006
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "test_checklist_items",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("test_assignments.id"), nullable=False, index=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, default=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, default=0),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade():
    op.drop_table("test_checklist_items")
