"""004 audit log

Revision ID: 004
Revises: 003
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audit_logs",
        sa.Column("id",            sa.Integer(),     primary_key=True),
        sa.Column("timestamp",     sa.DateTime(),    nullable=False),
        sa.Column("actor_id",      sa.Integer(),     sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_email",   sa.String(255)),
        sa.Column("actor_role",    sa.String(50)),
        sa.Column("action",        sa.String(100),   nullable=False),
        sa.Column("resource_type", sa.String(50)),
        sa.Column("resource_id",   sa.Integer()),
        sa.Column("resource_name", sa.String(500)),
        sa.Column("before_state",  sa.Text()),
        sa.Column("after_state",   sa.Text()),
        sa.Column("changes",       sa.Text()),
        sa.Column("ip_address",    sa.String(45)),
        sa.Column("user_agent",    sa.String(500)),
        sa.Column("request_id",    sa.String(36)),
    )
    op.create_index("ix_audit_logs_timestamp",    "audit_logs", ["timestamp"])
    op.create_index("ix_audit_logs_action",       "audit_logs", ["action"])
    op.create_index("ix_audit_logs_resource_type","audit_logs", ["resource_type"])
    op.create_index("ix_audit_logs_resource_id",  "audit_logs", ["resource_id"])
    op.create_index("ix_audit_logs_actor_id",     "audit_logs", ["actor_id"])


def downgrade():
    op.drop_table("audit_logs")
