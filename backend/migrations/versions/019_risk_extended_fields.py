"""Add extended fields to risks table

Revision ID: 019
Revises: 018
Create Date: 2026-04-21
"""
import sqlalchemy as sa
from alembic import op

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("risks", sa.Column("category",               sa.String(100), nullable=True))
    op.add_column("risks", sa.Column("risk_type",              sa.String(50),  nullable=True))
    op.add_column("risks", sa.Column("risk_theme",             sa.String(100), nullable=True))
    op.add_column("risks", sa.Column("source",                 sa.String(100), nullable=True))
    op.add_column("risks", sa.Column("department",             sa.String(100), nullable=True))
    op.add_column("risks", sa.Column("stage",                  sa.String(50),  nullable=True))
    op.add_column("risks", sa.Column("target_likelihood",      sa.Integer(),   nullable=True))
    op.add_column("risks", sa.Column("target_impact",         sa.Integer(),   nullable=True))
    op.add_column("risks", sa.Column("date_identified",        sa.Date(),      nullable=True))
    op.add_column("risks", sa.Column("date_closed",            sa.Date(),      nullable=True))
    op.add_column("risks", sa.Column("closing_justification",  sa.Text(),      nullable=True))
    op.add_column("risks", sa.Column("regulatory_compliance",  sa.Text(),      nullable=True))


def downgrade():
    op.drop_column("risks", "category")
    op.drop_column("risks", "risk_type")
    op.drop_column("risks", "risk_theme")
    op.drop_column("risks", "source")
    op.drop_column("risks", "department")
    op.drop_column("risks", "stage")
    op.drop_column("risks", "target_likelihood")
    op.drop_column("risks", "target_impact")
    op.drop_column("risks", "date_identified")
    op.drop_column("risks", "date_closed")
    op.drop_column("risks", "closing_justification")
    op.drop_column("risks", "regulatory_compliance")
