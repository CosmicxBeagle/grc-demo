"""Add closed_at to test_cycles

Revision ID: 018
Revises: 017
Create Date: 2026-04-13
"""
import sqlalchemy as sa
from alembic import op

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("test_cycles", sa.Column("closed_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("test_cycles", "closed_at")
