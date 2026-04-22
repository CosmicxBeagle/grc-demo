"""Add scf_weight to controls

Revision ID: 014
Revises: 013
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("controls", sa.Column("scf_weight", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("controls", "scf_weight")
