"""Replace risk status enum and add managed date columns.

New statuses: new | closed | managed_with_dates | managed_without_dates | unmanaged
Existing data cast:
  open        → new
  mitigated   → managed_without_dates
  accepted    → managed_without_dates
  transferred → managed_without_dates
  closed      → closed

Revision ID: 012
Revises: 011
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add new date columns
    op.add_column("risks", sa.Column("managed_start_date", sa.Date, nullable=True))
    op.add_column("risks", sa.Column("managed_end_date", sa.Date, nullable=True))

    # 2. Cast old status values → new ones via raw SQL (SQLite-safe)
    op.execute("UPDATE risks SET status = 'new' WHERE status = 'open'")
    op.execute("UPDATE risks SET status = 'managed_without_dates' WHERE status = 'mitigated'")
    op.execute("UPDATE risks SET status = 'managed_without_dates' WHERE status = 'accepted'")
    op.execute("UPDATE risks SET status = 'managed_without_dates' WHERE status = 'transferred'")
    # 'closed' stays 'closed' — no update needed


def downgrade():
    # Reverse: cast back to nearest old equivalent
    op.execute("UPDATE risks SET status = 'open' WHERE status = 'new'")
    op.execute("UPDATE risks SET status = 'open' WHERE status = 'unmanaged'")
    op.execute("UPDATE risks SET status = 'mitigated' WHERE status = 'managed_with_dates'")
    op.execute("UPDATE risks SET status = 'mitigated' WHERE status = 'managed_without_dates'")
    # 'closed' stays 'closed'

    op.drop_column("risks", "managed_end_date")
    op.drop_column("risks", "managed_start_date")
