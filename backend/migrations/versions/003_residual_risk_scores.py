"""Add residual_likelihood and residual_impact to risks table

Revision ID: 003
Revises: 002
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('risks', sa.Column('residual_likelihood', sa.Integer(), nullable=True))
    op.add_column('risks', sa.Column('residual_impact',     sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('risks', 'residual_impact')
    op.drop_column('risks', 'residual_likelihood')
