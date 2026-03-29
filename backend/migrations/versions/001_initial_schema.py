"""Initial schema — all tables

Revision ID: 001
Revises:
Create Date: 2026-03-26
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("asset_type", sa.String(50), nullable=True),
        sa.Column("criticality", sa.String(20), nullable=True),
        sa.Column("owner", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=True, server_default="active"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assets_id", "assets", ["id"])

    op.create_table(
        "threats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("threat_category", sa.String(50), nullable=True),
        sa.Column("source", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_threats_id", "threats", ["id"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(200), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("username"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "controls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("control_id", sa.String(50), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("control_type", sa.String(50), nullable=True),
        sa.Column("frequency", sa.String(50), nullable=True),
        sa.Column("owner", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), nullable=True, server_default="active"),
        sa.Column("sox_in_scope", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sox_itgc_domain", sa.String(50), nullable=True),
        sa.Column("sox_systems", sa.Text(), nullable=True),
        sa.Column("sox_assertions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("control_id"),
    )
    op.create_index("ix_controls_id", "controls", ["id"])
    op.create_index("ix_controls_control_id", "controls", ["control_id"])

    op.create_table(
        "control_mappings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("control_id", sa.Integer(), nullable=False),
        sa.Column("framework", sa.String(20), nullable=False),
        sa.Column("framework_version", sa.String(20), nullable=True),
        sa.Column("framework_ref", sa.String(100), nullable=False),
        sa.Column("framework_description", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["control_id"], ["controls.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_control_mappings_id", "control_mappings", ["id"])

    op.create_table(
        "risks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("asset_id", sa.Integer(), nullable=True),
        sa.Column("threat_id", sa.Integer(), nullable=True),
        sa.Column("likelihood", sa.Integer(), nullable=True, server_default="3"),
        sa.Column("impact", sa.Integer(), nullable=True, server_default="3"),
        sa.Column("treatment", sa.String(20), nullable=True, server_default="mitigate"),
        sa.Column("status", sa.String(20), nullable=True, server_default="open"),
        sa.Column("owner", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.ForeignKeyConstraint(["threat_id"], ["threats.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_risks_id", "risks", ["id"])

    op.create_table(
        "risk_controls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("risk_id", sa.Integer(), nullable=False),
        sa.Column("control_id", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["control_id"], ["controls.id"]),
        sa.ForeignKeyConstraint(["risk_id"], ["risks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_risk_controls_id", "risk_controls", ["id"])

    op.create_table(
        "test_cycles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), nullable=True, server_default="planned"),
        sa.Column("brand", sa.String(50), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_test_cycles_id", "test_cycles", ["id"])

    op.create_table(
        "test_assignments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("test_cycle_id", sa.Integer(), nullable=False),
        sa.Column("control_id", sa.Integer(), nullable=False),
        sa.Column("tester_id", sa.Integer(), nullable=True),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(30), nullable=True, server_default="not_started"),
        sa.Column("tester_notes", sa.Text(), nullable=True),
        sa.Column("reviewer_comments", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["control_id"], ["controls.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["test_cycle_id"], ["test_cycles.id"]),
        sa.ForeignKeyConstraint(["tester_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_test_assignments_id", "test_assignments", ["id"])

    op.create_table(
        "deficiencies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=False, server_default="high"),
        sa.Column("remediation_plan", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["assignment_id"], ["test_assignments.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deficiencies_id", "deficiencies", ["id"])

    op.create_table(
        "evidence",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("assignment_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_path", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("uploaded_by", sa.Integer(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["assignment_id"], ["test_assignments.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_evidence_id", "evidence", ["id"])

    op.create_table(
        "control_exceptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("control_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("exception_type", sa.String(30), nullable=False, server_default="exception"),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("compensating_control", sa.Text(), nullable=True),
        sa.Column("risk_level", sa.String(20), nullable=True, server_default="high"),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending_approval"),
        sa.Column("requested_by", sa.Integer(), nullable=True),
        sa.Column("approved_by", sa.Integer(), nullable=True),
        sa.Column("approver_notes", sa.Text(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["approved_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["control_id"], ["controls.id"]),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_control_exceptions_id", "control_exceptions", ["id"])


def downgrade() -> None:
    op.drop_table("control_exceptions")
    op.drop_table("evidence")
    op.drop_table("deficiencies")
    op.drop_table("test_assignments")
    op.drop_table("test_cycles")
    op.drop_table("risk_controls")
    op.drop_table("risks")
    op.drop_table("control_mappings")
    op.drop_table("controls")
    op.drop_table("users")
    op.drop_table("threats")
    op.drop_table("assets")
