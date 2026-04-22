"""Add retest fields to deficiencies, is_retest to test_assignments,
and exception lifecycle fields to control_exceptions.

Revision ID: 010
Revises: 009
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    # Deficiency retest fields
    op.add_column("deficiencies", sa.Column("retest_required", sa.Boolean, nullable=False, server_default="1"))
    op.add_column("deficiencies", sa.Column("retest_assignment_id", sa.Integer, sa.ForeignKey("test_assignments.id"), nullable=True))
    op.add_column("deficiencies", sa.Column("retest_waived", sa.Boolean, nullable=False, server_default="0"))
    op.add_column("deficiencies", sa.Column("retest_waived_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True))
    op.add_column("deficiencies", sa.Column("retest_waived_reason", sa.Text, nullable=True))

    # TestAssignment retest flag
    op.add_column("test_assignments", sa.Column("is_retest", sa.Boolean, nullable=False, server_default="0"))
    op.add_column("test_assignments", sa.Column("retest_for_deficiency_id", sa.Integer, sa.ForeignKey("deficiencies.id"), nullable=True))

    # Exception lifecycle fields
    op.add_column("control_exceptions", sa.Column("expires_at", sa.DateTime, nullable=True))
    op.add_column("control_exceptions", sa.Column("expiry_notified_at", sa.DateTime, nullable=True))
    op.add_column("control_exceptions", sa.Column("expired_at", sa.DateTime, nullable=True))
    op.add_column("control_exceptions", sa.Column("rejection_reason", sa.Text, nullable=True))
    op.add_column("control_exceptions", sa.Column("resubmission_count", sa.Integer, nullable=False, server_default="0"))
    op.add_column("control_exceptions", sa.Column("parent_exception_id", sa.Integer, sa.ForeignKey("control_exceptions.id"), nullable=True))
    op.add_column("control_exceptions", sa.Column("decision_notified_at", sa.DateTime, nullable=True))


def downgrade():
    op.drop_column("control_exceptions", "decision_notified_at")
    op.drop_column("control_exceptions", "parent_exception_id")
    op.drop_column("control_exceptions", "resubmission_count")
    op.drop_column("control_exceptions", "rejection_reason")
    op.drop_column("control_exceptions", "expired_at")
    op.drop_column("control_exceptions", "expiry_notified_at")
    op.drop_column("control_exceptions", "expires_at")
    op.drop_column("test_assignments", "retest_for_deficiency_id")
    op.drop_column("test_assignments", "is_retest")
    op.drop_column("deficiencies", "retest_waived_reason")
    op.drop_column("deficiencies", "retest_waived_by_user_id")
    op.drop_column("deficiencies", "retest_waived")
    op.drop_column("deficiencies", "retest_assignment_id")
    op.drop_column("deficiencies", "retest_required")
