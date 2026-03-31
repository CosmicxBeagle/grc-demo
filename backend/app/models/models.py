from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Date, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    asset_type = Column(String(50))   # application / database / infrastructure / network / data / physical / process / people
    criticality = Column(String(20))  # critical / high / medium / low
    owner = Column(String(100))
    status = Column(String(20), default="active")  # active / decommissioned
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    risks = relationship("Risk", back_populates="asset")


class Threat(Base):
    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    threat_category = Column(String(50))  # cyber / access / data-breach / insider / physical / natural / compliance / operational
    source = Column(String(20))           # internal / external / environmental
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    risks = relationship("Risk", back_populates="threat")


class User(Base):
    __tablename__ = "users"

    id           = Column(Integer, primary_key=True, index=True)
    username     = Column(String(200), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    email        = Column(String(200), unique=True, nullable=False)

    # Role — managed in the app, never synced from IdP
    # admin | grc_manager | grc_analyst | tester | reviewer | risk_owner | viewer
    role = Column(String(30), nullable=False, default="viewer")

    # Identity provider info
    identity_provider = Column(String(20), default="local")  # local | entra | okta
    external_id       = Column(String(200), nullable=True, index=True)  # oid (Entra) or sub (Okta)

    # Profile fields synced from IdP
    department    = Column(String(100), nullable=True)
    job_title     = Column(String(100), nullable=True)

    # Lifecycle
    status        = Column(String(20), default="active")   # active | inactive | pending
    last_login_at = Column(DateTime, nullable=True)


class Control(Base):
    __tablename__ = "controls"

    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    control_type = Column(String(50))   # preventive, detective, corrective
    frequency = Column(String(50))      # annual, quarterly, monthly, continuous
    owner = Column(String(100))
    status = Column(String(20), default="active")
    # SOX ITGC scoping
    sox_in_scope   = Column(Boolean, default=False, nullable=False)
    sox_itgc_domain = Column(String(50))   # Access Controls / Change Management / Computer Operations / Program Development
    sox_systems    = Column(Text)          # comma-separated system names, e.g. "SAP, Oracle, Active Directory"
    sox_assertions = Column(Text)          # comma-separated assertions, e.g. "Completeness, Accuracy"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    mappings = relationship("ControlMapping", back_populates="control", cascade="all, delete-orphan")
    assignments = relationship("TestAssignment", back_populates="control")
    risk_controls = relationship("RiskControl", back_populates="control", cascade="all, delete-orphan")
    exceptions = relationship("ControlException", back_populates="control", cascade="all, delete-orphan")


class ControlMapping(Base):
    __tablename__ = "control_mappings"

    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)
    framework = Column(String(20), nullable=False)  # PCI, NIST, CIS, SOX
    framework_version = Column(String(20))           # e.g. v4.0.1, v2.0, v8.1
    framework_ref = Column(String(100), nullable=False)
    framework_description = Column(Text)

    control = relationship("Control", back_populates="mappings")


class TestCycle(Base):
    __tablename__ = "test_cycles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(20), default="planned")  # planned, active, completed
    brand = Column(String(50))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User", foreign_keys=[created_by])
    assignments = relationship("TestAssignment", back_populates="test_cycle", cascade="all, delete-orphan")


class TestAssignment(Base):
    __tablename__ = "test_assignments"

    id = Column(Integer, primary_key=True, index=True)
    test_cycle_id = Column(Integer, ForeignKey("test_cycles.id"), nullable=False)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)
    tester_id = Column(Integer, ForeignKey("users.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(30), default="not_started")
    # not_started | in_progress | needs_review | complete
    tester_notes = Column(Text)
    reviewer_comments = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    test_cycle = relationship("TestCycle", back_populates="assignments")
    control = relationship("Control", back_populates="assignments")
    tester = relationship("User", foreign_keys=[tester_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    evidence = relationship("Evidence", back_populates="assignment", cascade="all, delete-orphan")
    deficiencies = relationship("Deficiency", back_populates="assignment", cascade="all, delete-orphan")


class Deficiency(Base):
    __tablename__ = "deficiencies"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("test_assignments.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    severity = Column(String(20), nullable=False, default="high")  # critical/high/medium/low
    remediation_plan = Column(Text)
    status = Column(String(30), nullable=False, default="open")  # open/in_remediation/remediated/risk_accepted
    due_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assignment = relationship("TestAssignment", back_populates="deficiencies")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("test_assignments.id"), nullable=False)
    filename = Column(String(255), nullable=False)          # stored filename (uuid-based)
    original_filename = Column(String(255), nullable=False) # original upload name
    file_path = Column(String(500), nullable=False)
    description = Column(Text)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    assignment = relationship("TestAssignment", back_populates="evidence")
    uploader = relationship("User", foreign_keys=[uploaded_by])


class Risk(Base):
    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    threat_id = Column(Integer, ForeignKey("threats.id"), nullable=True)
    likelihood = Column(Integer, default=3)            # 1-5 inherent
    impact = Column(Integer, default=3)                # 1-5 inherent
    # inherent_score = likelihood * impact (computed)
    residual_likelihood = Column(Integer, nullable=True)  # 1-5 after controls
    residual_impact     = Column(Integer, nullable=True)  # 1-5 after controls
    # residual_score = residual_likelihood * residual_impact (computed)
    treatment = Column(String(20), default="mitigate")  # mitigate / accept / transfer / avoid
    status = Column(String(20), default="open")         # open / mitigated / accepted / transferred / closed
    owner = Column(String(100))
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # linked user (director/risk_owner)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    asset = relationship("Asset", back_populates="risks")
    threat = relationship("Threat", back_populates="risks")
    controls = relationship("RiskControl", back_populates="risk", cascade="all, delete-orphan")
    owner_user = relationship("User", foreign_keys=[owner_id])
    treatment_plan = relationship("TreatmentPlan", back_populates="risk", uselist=False)


class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"

    id          = Column(Integer, primary_key=True, index=True)
    risk_id     = Column(Integer, ForeignKey("risks.id"), nullable=False, unique=True)
    strategy    = Column(String(20), nullable=False, default="mitigate")  # mitigate | accept | transfer | avoid
    description = Column(Text, nullable=True)
    owner_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    target_date = Column(Date, nullable=True)
    status      = Column(String(20), default="in_progress")  # in_progress | completed | on_hold | cancelled
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    milestones = relationship("TreatmentMilestone", back_populates="plan",
                              cascade="all, delete-orphan", order_by="TreatmentMilestone.sort_order")
    owner = relationship("User", foreign_keys=[owner_id])
    risk  = relationship("Risk", back_populates="treatment_plan")


class TreatmentMilestone(Base):
    __tablename__ = "treatment_milestones"

    id             = Column(Integer, primary_key=True, index=True)
    plan_id        = Column(Integer, ForeignKey("treatment_plans.id"), nullable=False)
    title          = Column(String(200), nullable=False)
    description    = Column(Text, nullable=True)
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_date       = Column(Date, nullable=True)
    status         = Column(String(20), default="open")  # open | in_progress | completed | overdue
    completed_at   = Column(DateTime, nullable=True)
    sort_order     = Column(Integer, default=0)

    plan        = relationship("TreatmentPlan", back_populates="milestones")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])


class RiskControl(Base):
    __tablename__ = "risk_controls"

    id = Column(Integer, primary_key=True, index=True)
    risk_id = Column(Integer, ForeignKey("risks.id"), nullable=False)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)
    notes = Column(Text)

    risk = relationship("Risk", back_populates="controls")
    control = relationship("Control", back_populates="risk_controls")


# ── Approval Workflow Engine ──────────────────────────────────────────────────

class ApprovalPolicy(Base):
    """Named, reusable approval workflow template."""
    __tablename__ = "approval_policies"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(200), nullable=False)
    description = Column(Text)
    entity_type = Column(String(50), nullable=False)  # exception | control_test
    is_default  = Column(Boolean, default=False)       # auto-applied to this entity type
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    steps            = relationship("ApprovalPolicyStep",      back_populates="policy",
                                    cascade="all, delete-orphan", order_by="ApprovalPolicyStep.step_order")
    escalation_rules = relationship("ApprovalEscalationRule",  back_populates="policy",
                                    cascade="all, delete-orphan")


class ApprovalPolicyStep(Base):
    """One step in an approval policy template."""
    __tablename__ = "approval_policy_steps"

    id               = Column(Integer, primary_key=True, index=True)
    policy_id        = Column(Integer, ForeignKey("approval_policies.id"), nullable=False)
    step_order       = Column(Integer, nullable=False)
    label            = Column(String(100), nullable=False)   # e.g. "GRC Manager Review"
    approver_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # specific person
    approver_role    = Column(String(50), nullable=True)                        # role fallback

    policy   = relationship("ApprovalPolicy", back_populates="steps")
    approver = relationship("User", foreign_keys=[approver_user_id])


class ApprovalEscalationRule(Base):
    """Adds an extra step when a field on the entity matches a value."""
    __tablename__ = "approval_escalation_rules"

    id                = Column(Integer, primary_key=True, index=True)
    policy_id         = Column(Integer, ForeignKey("approval_policies.id"), nullable=False)
    condition_field   = Column(String(50), nullable=False)  # e.g. "risk_level"
    condition_value   = Column(String(50), nullable=False)  # e.g. "critical"
    add_step_label    = Column(String(100), nullable=False)  # e.g. "CISO Review"
    add_step_user_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    add_step_role     = Column(String(50), nullable=True)

    policy        = relationship("ApprovalPolicy", back_populates="escalation_rules")
    add_step_user = relationship("User", foreign_keys=[add_step_user_id])


class ApprovalWorkflow(Base):
    """
    Active approval workflow instance attached to a specific record.
    Steps are snapshotted from the policy at creation time so policy edits
    don't affect in-flight workflows.
    """
    __tablename__ = "approval_workflows"

    id           = Column(Integer, primary_key=True, index=True)
    policy_id    = Column(Integer, ForeignKey("approval_policies.id"), nullable=True)
    entity_type  = Column(String(50), nullable=False)   # exception | control_test
    entity_id    = Column(Integer, nullable=False)
    status       = Column(String(30), default="pending")  # pending | approved | rejected
    current_step = Column(Integer, default=1)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    policy   = relationship("ApprovalPolicy")
    steps    = relationship("ApprovalWorkflowStep", back_populates="workflow",
                            cascade="all, delete-orphan", order_by="ApprovalWorkflowStep.step_order")
    creator  = relationship("User", foreign_keys=[created_by])


class ApprovalWorkflowStep(Base):
    """
    Concrete step within an active workflow.
    Snapshotted from the policy; escalation steps are flagged.
    """
    __tablename__ = "approval_workflow_steps"

    id               = Column(Integer, primary_key=True, index=True)
    workflow_id      = Column(Integer, ForeignKey("approval_workflows.id"), nullable=False)
    step_order       = Column(Integer, nullable=False)
    label            = Column(String(100), nullable=False)
    approver_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approver_role    = Column(String(50), nullable=True)
    is_escalation    = Column(Boolean, default=False)
    status           = Column(String(30), default="pending")  # pending | approved | rejected
    decided_by_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    decided_at       = Column(DateTime, nullable=True)
    notes            = Column(Text, nullable=True)

    workflow  = relationship("ApprovalWorkflow", back_populates="steps")
    approver  = relationship("User", foreign_keys=[approver_user_id])
    decider   = relationship("User", foreign_keys=[decided_by_id])


# ─────────────────────────────────────────────────────────────────────────────

class ControlException(Base):
    __tablename__ = "control_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    control_id = Column(Integer, ForeignKey("controls.id"), nullable=False)

    title          = Column(String(200), nullable=False)
    exception_type = Column(String(30), nullable=False, default="exception")
    # exception | risk_acceptance | compensating_control

    justification        = Column(Text, nullable=False)
    compensating_control = Column(Text)   # what alternative mitigates the risk
    risk_level           = Column(String(20), default="high")
    # critical / high / medium / low  — residual risk while exception is active

    status       = Column(String(30), nullable=False, default="pending_approval")
    # draft | pending_approval | approved | rejected | expired

    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    approver_notes = Column(Text)

    expiry_date  = Column(Date, nullable=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    control   = relationship("Control", back_populates="exceptions")
    requester = relationship("User", foreign_keys=[requested_by])
    approver  = relationship("User", foreign_keys=[approved_by])


# ── Risk Review System ────────────────────────────────────────────────────────

class RiskReviewCycle(Base):
    """
    A named review cycle (ad hoc, monthly, quarterly, etc.).
    Once launched, RiskReviewRequests are created for each in-scope risk.

    min_score controls which risks are included:
      0  = all risks (default)
      4  = medium and above  (score >= 4)
      12 = high and critical (score >= 12)
      20 = critical only     (score >= 20)
    """
    __tablename__ = "risk_review_cycles"

    id          = Column(Integer, primary_key=True, index=True)
    label       = Column(String(200), nullable=False)
    cycle_type  = Column(String(20), nullable=False)     # label only: jan | jul | quarterly | monthly | ad_hoc
    year        = Column(Integer, nullable=True)
    min_score   = Column(Integer, default=0, nullable=False)  # minimum inherent score to include
    status      = Column(String(20), default="draft")    # draft | active | closed
    scope_note  = Column(Text, nullable=True)
    created_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    launched_at = Column(DateTime, nullable=True)
    closed_at   = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    creator  = relationship("User", foreign_keys=[created_by])
    requests = relationship("RiskReviewRequest", back_populates="cycle",
                            cascade="all, delete-orphan")


class RiskReviewRequest(Base):
    """
    Per-risk, per-owner review request within a cycle.
    One row per risk per owner.  Grouped by owner for email delivery.
    """
    __tablename__ = "risk_review_requests"

    id               = Column(Integer, primary_key=True, index=True)
    cycle_id         = Column(Integer, ForeignKey("risk_review_cycles.id"), nullable=False)
    risk_id          = Column(Integer, ForeignKey("risks.id"), nullable=False)
    owner_id         = Column(Integer, ForeignKey("users.id"), nullable=False)
    status           = Column(String(20), default="pending")  # pending | updated | overdue
    email_sent_at    = Column(DateTime, nullable=True)
    last_reminded_at = Column(DateTime, nullable=True)
    reminder_count   = Column(Integer, default=0)
    created_at       = Column(DateTime, default=datetime.utcnow)

    cycle   = relationship("RiskReviewCycle", back_populates="requests")
    risk    = relationship("Risk")
    owner   = relationship("User", foreign_keys=[owner_id])
    updates = relationship("RiskReviewUpdate", back_populates="request",
                           cascade="all, delete-orphan")


class RiskReviewUpdate(Base):
    """
    A director's status update for one risk in one cycle.
    Multiple updates per request are allowed (audit trail).
    """
    __tablename__ = "risk_review_updates"

    id                  = Column(Integer, primary_key=True, index=True)
    request_id          = Column(Integer, ForeignKey("risk_review_requests.id"), nullable=False)
    risk_id             = Column(Integer, ForeignKey("risks.id"), nullable=False)
    cycle_id            = Column(Integer, ForeignKey("risk_review_cycles.id"), nullable=False)
    submitted_by        = Column(Integer, ForeignKey("users.id"), nullable=False)
    status_confirmed    = Column(String(50), nullable=True)   # risk status per owner
    mitigation_progress = Column(Text, nullable=True)
    notes               = Column(Text, nullable=True)
    submitted_at        = Column(DateTime, default=datetime.utcnow)

    request   = relationship("RiskReviewRequest", back_populates="updates")
    submitter = relationship("User", foreign_keys=[submitted_by])


class AuditLog(Base):
    """
    Append-only audit trail.  Never updated or deleted after creation.

    Every significant write operation (create / update / delete / auth /
    export) writes one row here AND emits a structured JSON line to the
    'audit' Python logger so Azure Monitor / any SIEM can pick it up via
    the Container Apps log drain without additional infrastructure.

    Columns
    -------
    action        : verb in SCREAMING_SNAKE format  e.g. RISK_UPDATED
    resource_type : entity class name               e.g. Risk
    resource_id   : primary key of the affected row
    resource_name : human-readable name for display
    before_state  : JSON snapshot before the change (null for creates)
    after_state   : JSON snapshot after  the change (null for deletes)
    changes       : JSON field-level diff  {"field": {"from": x, "to": y}}
    actor_*       : denormalised — user record may be deleted later
    request_id    : UUID per HTTP request for cross-row correlation
    """
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True, index=True)
    timestamp     = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    actor_id      = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_email   = Column(String(255))
    actor_role    = Column(String(50))
    action        = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(50), index=True)
    resource_id   = Column(Integer, index=True)
    resource_name = Column(String(500))
    before_state  = Column(Text)
    after_state   = Column(Text)
    changes       = Column(Text)
    ip_address    = Column(String(45))
    user_agent    = Column(String(500))
    request_id    = Column(String(36))

    actor = relationship("User", foreign_keys=[actor_id])
