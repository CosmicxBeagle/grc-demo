"""Add GRC approval fields to risk_review_updates and deactivation fields to users.

Revision ID: 011
Revises: 010
"""
from alembic import op
import sqlalchemy as sa

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    # RiskReviewUpdate GRC approval fields
    op.add_column("risk_review_updates", sa.Column("grc_review_status", sa.String(30), nullable=False, server_default="pending_review"))
    op.add_column("risk_review_updates", sa.Column("grc_reviewer_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True))
    op.add_column("risk_review_updates", sa.Column("grc_challenge_reason", sa.Text, nullable=True))
    op.add_column("risk_review_updates", sa.Column("grc_reviewed_at", sa.DateTime, nullable=True))
    op.add_column("risk_review_updates", sa.Column("owner_challenge_response", sa.Text, nullable=True))
    op.add_column("risk_review_updates", sa.Column("owner_responded_at", sa.DateTime, nullable=True))

    # User deactivation fields
    op.add_column("users", sa.Column("deactivated_at", sa.DateTime, nullable=True))
    op.add_column("users", sa.Column("deactivated_by_user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=True))
    op.add_column("users", sa.Column("deactivation_reason", sa.Text, nullable=True))


def downgrade():
    op.drop_column("users", "deactivation_reason")
    op.drop_column("users", "deactivated_by_user_id")
    op.drop_column("users", "deactivated_at")
    op.drop_column("risk_review_updates", "owner_responded_at")
    op.drop_column("risk_review_updates", "owner_challenge_response")
    op.drop_column("risk_review_updates", "grc_reviewed_at")
    op.drop_column("risk_review_updates", "grc_challenge_reason")
    op.drop_column("risk_review_updates", "grc_reviewer_user_id")
    op.drop_column("risk_review_updates", "grc_review_status")
