"""exception extended fields

Revision ID: 023
Revises: 022
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = "023"
down_revision = "022"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("control_exceptions", sa.Column("system_name",        sa.Text,    nullable=True))
    op.add_column("control_exceptions", sa.Column("policy_for_exception", sa.Text,  nullable=True))
    op.add_column("control_exceptions", sa.Column("risk_to_business",   sa.Text,    nullable=True))
    op.add_column("control_exceptions", sa.Column("security_poc",       sa.String(200), nullable=True))
    op.add_column("control_exceptions", sa.Column("business_owner_email", sa.String(200), nullable=True))
    op.add_column("control_exceptions", sa.Column("regulatory_scope",   sa.String(50),  nullable=True))
    # regulatory_scope values: "yes" | "no" | "partial"


def downgrade():
    op.drop_column("control_exceptions", "regulatory_scope")
    op.drop_column("control_exceptions", "business_owner_email")
    op.drop_column("control_exceptions", "security_poc")
    op.drop_column("control_exceptions", "risk_to_business")
    op.drop_column("control_exceptions", "policy_for_exception")
    op.drop_column("control_exceptions", "system_name")
