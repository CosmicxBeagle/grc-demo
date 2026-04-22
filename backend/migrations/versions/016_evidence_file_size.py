"""Add file_size column to evidence table.

Revision ID: 016
Revises: 015
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("evidence", sa.Column("file_size", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("evidence", "file_size")
