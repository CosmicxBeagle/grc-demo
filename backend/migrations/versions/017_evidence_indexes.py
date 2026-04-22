"""Add indexes on evidence.assignment_id, evidence.uploaded_at for library queries

Revision ID: 017
Revises: 016
Create Date: 2026-04-13
"""
from alembic import op

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index("ix_evidence_assignment_id", "evidence", ["assignment_id"], unique=False)
    op.create_index("ix_evidence_uploaded_at", "evidence", ["uploaded_at"], unique=False)
    op.create_index("ix_evidence_uploaded_by", "evidence", ["uploaded_by"], unique=False)


def downgrade():
    op.drop_index("ix_evidence_uploaded_by", table_name="evidence")
    op.drop_index("ix_evidence_uploaded_at", table_name="evidence")
    op.drop_index("ix_evidence_assignment_id", table_name="evidence")
