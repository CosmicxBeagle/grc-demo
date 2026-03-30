"""Enterprise schema alignment — adds SSO user fields, treatment plans,
approval workflow engine, and risk review system.

Revision ID: 002
Revises: 001
Create Date: 2026-03-29
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users: new columns added after initial schema ──────────────────────
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("identity_provider", sa.String(20), nullable=True, server_default="local"))
        batch.add_column(sa.Column("external_id",       sa.String(200), nullable=True))
        batch.add_column(sa.Column("department",        sa.String(100), nullable=True))
        batch.add_column(sa.Column("job_title",         sa.String(100), nullable=True))
        batch.add_column(sa.Column("status",            sa.String(20), nullable=True, server_default="active"))
        batch.add_column(sa.Column("last_login_at",     sa.DateTime(), nullable=True))
    op.create_index("ix_users_external_id", "users", ["external_id"])

    # ── risks: owner_id FK to users ───────────────────────────────────────
    with op.batch_alter_table("risks") as batch:
        batch.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_risks_owner_id", "users", ["owner_id"], ["id"])

    # ── treatment_plans ───────────────────────────────────────────────────
    op.create_table(
        "treatment_plans",
        sa.Column("id",          sa.Integer(), primary_key=True),
        sa.Column("risk_id",     sa.Integer(), sa.ForeignKey("risks.id"), nullable=False, unique=True),
        sa.Column("strategy",    sa.String(20), nullable=False, server_default="mitigate"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_id",    sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status",      sa.String(20), server_default="in_progress"),
        sa.Column("created_at",  sa.DateTime(), nullable=True),
        sa.Column("updated_at",  sa.DateTime(), nullable=True),
    )
    op.create_index("ix_treatment_plans_id", "treatment_plans", ["id"])

    # ── treatment_milestones ──────────────────────────────────────────────
    op.create_table(
        "treatment_milestones",
        sa.Column("id",             sa.Integer(), primary_key=True),
        sa.Column("plan_id",        sa.Integer(), sa.ForeignKey("treatment_plans.id"), nullable=False),
        sa.Column("title",          sa.String(200), nullable=False),
        sa.Column("description",    sa.Text(), nullable=True),
        sa.Column("assigned_to_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("due_date",       sa.Date(), nullable=True),
        sa.Column("status",         sa.String(20), server_default="open"),
        sa.Column("completed_at",   sa.DateTime(), nullable=True),
        sa.Column("sort_order",     sa.Integer(), server_default="0"),
    )
    op.create_index("ix_treatment_milestones_id", "treatment_milestones", ["id"])

    # ── approval_policies ─────────────────────────────────────────────────
    op.create_table(
        "approval_policies",
        sa.Column("id",          sa.Integer(), primary_key=True),
        sa.Column("name",        sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("entity_type", sa.String(50), nullable=False),
        sa.Column("is_default",  sa.Boolean(), server_default="false"),
        sa.Column("created_at",  sa.DateTime(), nullable=True),
        sa.Column("updated_at",  sa.DateTime(), nullable=True),
    )
    op.create_index("ix_approval_policies_id", "approval_policies", ["id"])

    # ── approval_policy_steps ─────────────────────────────────────────────
    op.create_table(
        "approval_policy_steps",
        sa.Column("id",               sa.Integer(), primary_key=True),
        sa.Column("policy_id",        sa.Integer(), sa.ForeignKey("approval_policies.id"), nullable=False),
        sa.Column("step_order",       sa.Integer(), nullable=False),
        sa.Column("label",            sa.String(100), nullable=False),
        sa.Column("approver_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approver_role",    sa.String(50), nullable=True),
    )
    op.create_index("ix_approval_policy_steps_id", "approval_policy_steps", ["id"])

    # ── approval_escalation_rules ─────────────────────────────────────────
    op.create_table(
        "approval_escalation_rules",
        sa.Column("id",               sa.Integer(), primary_key=True),
        sa.Column("policy_id",        sa.Integer(), sa.ForeignKey("approval_policies.id"), nullable=False),
        sa.Column("condition_field",  sa.String(50), nullable=False),
        sa.Column("condition_value",  sa.String(50), nullable=False),
        sa.Column("add_step_label",   sa.String(100), nullable=False),
        sa.Column("add_step_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("add_step_role",    sa.String(50), nullable=True),
    )
    op.create_index("ix_approval_escalation_rules_id", "approval_escalation_rules", ["id"])

    # ── approval_workflows ────────────────────────────────────────────────
    op.create_table(
        "approval_workflows",
        sa.Column("id",           sa.Integer(), primary_key=True),
        sa.Column("policy_id",    sa.Integer(), sa.ForeignKey("approval_policies.id"), nullable=True),
        sa.Column("entity_type",  sa.String(50), nullable=False),
        sa.Column("entity_id",    sa.Integer(), nullable=False),
        sa.Column("status",       sa.String(30), server_default="pending"),
        sa.Column("current_step", sa.Integer(), server_default="1"),
        sa.Column("created_by",   sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at",   sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_approval_workflows_id", "approval_workflows", ["id"])

    # ── approval_workflow_steps ───────────────────────────────────────────
    op.create_table(
        "approval_workflow_steps",
        sa.Column("id",               sa.Integer(), primary_key=True),
        sa.Column("workflow_id",      sa.Integer(), sa.ForeignKey("approval_workflows.id"), nullable=False),
        sa.Column("step_order",       sa.Integer(), nullable=False),
        sa.Column("label",            sa.String(100), nullable=False),
        sa.Column("approver_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approver_role",    sa.String(50), nullable=True),
        sa.Column("is_escalation",    sa.Boolean(), server_default="false"),
        sa.Column("status",           sa.String(30), server_default="pending"),
        sa.Column("decided_by_id",    sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("decided_at",       sa.DateTime(), nullable=True),
        sa.Column("notes",            sa.Text(), nullable=True),
    )
    op.create_index("ix_approval_workflow_steps_id", "approval_workflow_steps", ["id"])

    # ── risk_review_cycles ────────────────────────────────────────────────
    op.create_table(
        "risk_review_cycles",
        sa.Column("id",          sa.Integer(), primary_key=True),
        sa.Column("label",       sa.String(200), nullable=False),
        sa.Column("cycle_type",  sa.String(20), nullable=False),
        sa.Column("year",        sa.Integer(), nullable=True),
        sa.Column("min_score",   sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status",      sa.String(20), server_default="draft"),
        sa.Column("scope_note",  sa.Text(), nullable=True),
        sa.Column("created_by",  sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("launched_at", sa.DateTime(), nullable=True),
        sa.Column("closed_at",   sa.DateTime(), nullable=True),
        sa.Column("created_at",  sa.DateTime(), nullable=True),
    )
    op.create_index("ix_risk_review_cycles_id", "risk_review_cycles", ["id"])

    # ── risk_review_requests ──────────────────────────────────────────────
    op.create_table(
        "risk_review_requests",
        sa.Column("id",               sa.Integer(), primary_key=True),
        sa.Column("cycle_id",         sa.Integer(), sa.ForeignKey("risk_review_cycles.id"), nullable=False),
        sa.Column("risk_id",          sa.Integer(), sa.ForeignKey("risks.id"), nullable=False),
        sa.Column("owner_id",         sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status",           sa.String(20), server_default="pending"),
        sa.Column("email_sent_at",    sa.DateTime(), nullable=True),
        sa.Column("last_reminded_at", sa.DateTime(), nullable=True),
        sa.Column("reminder_count",   sa.Integer(), server_default="0"),
        sa.Column("created_at",       sa.DateTime(), nullable=True),
    )
    op.create_index("ix_risk_review_requests_id", "risk_review_requests", ["id"])

    # ── risk_review_updates ───────────────────────────────────────────────
    op.create_table(
        "risk_review_updates",
        sa.Column("id",                  sa.Integer(), primary_key=True),
        sa.Column("request_id",          sa.Integer(), sa.ForeignKey("risk_review_requests.id"), nullable=False),
        sa.Column("risk_id",             sa.Integer(), sa.ForeignKey("risks.id"), nullable=False),
        sa.Column("cycle_id",            sa.Integer(), sa.ForeignKey("risk_review_cycles.id"), nullable=False),
        sa.Column("submitted_by",        sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status_confirmed",    sa.String(50), nullable=True),
        sa.Column("mitigation_progress", sa.Text(), nullable=True),
        sa.Column("notes",               sa.Text(), nullable=True),
        sa.Column("submitted_at",        sa.DateTime(), nullable=True),
    )
    op.create_index("ix_risk_review_updates_id", "risk_review_updates", ["id"])


def downgrade() -> None:
    op.drop_table("risk_review_updates")
    op.drop_table("risk_review_requests")
    op.drop_table("risk_review_cycles")
    op.drop_table("approval_workflow_steps")
    op.drop_table("approval_workflows")
    op.drop_table("approval_escalation_rules")
    op.drop_table("approval_policy_steps")
    op.drop_table("approval_policies")
    op.drop_table("treatment_milestones")
    op.drop_table("treatment_plans")
    with op.batch_alter_table("risks") as batch:
        batch.drop_constraint("fk_risks_owner_id", type_="foreignkey")
        batch.drop_column("owner_id")
    op.drop_index("ix_users_external_id", "users")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("last_login_at")
        batch.drop_column("status")
        batch.drop_column("job_title")
        batch.drop_column("department")
        batch.drop_column("external_id")
        batch.drop_column("identity_provider")
