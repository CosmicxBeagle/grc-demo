"""Add scf_question and scf_domain to controls

Revision ID: 013
Revises: 012
Create Date: 2026-04-07
"""
from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("controls", sa.Column("scf_question", sa.Text(), nullable=True))
    op.add_column("controls", sa.Column("scf_domain", sa.String(200), nullable=True))


def downgrade():
    op.drop_column("controls", "scf_question")
    op.drop_column("controls", "scf_domain")
