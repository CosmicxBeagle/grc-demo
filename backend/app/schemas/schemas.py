from pydantic import BaseModel, Field, model_validator
from typing import Optional
from datetime import datetime, date


# ── Users ──────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    username: str
    display_name: str
    email: str
    role: str  # admin | grc_manager | grc_analyst | tester | reviewer | risk_owner | viewer

class UserCreate(UserBase):
    pass

class UserOut(UserBase):
    id: int
    identity_provider: Optional[str] = "local"
    department:        Optional[str] = None
    job_title:         Optional[str] = None
    status:            Optional[str] = "active"
    last_login_at:     Optional[datetime] = None
    model_config = {"from_attributes": True}

class UserRoleUpdate(BaseModel):
    role: str

class UserStatusUpdate(BaseModel):
    status: str   # active | inactive

class UserCreateManual(BaseModel):
    display_name: str
    email:        str
    role:         str = "viewer"
    department:   Optional[str] = None
    job_title:    Optional[str] = None


# ── Controls ───────────────────────────────────────────────────────────────

class ControlMappingBase(BaseModel):
    framework: str
    framework_version: Optional[str] = None
    framework_ref: str
    framework_description: Optional[str] = None

class ControlMappingCreate(ControlMappingBase):
    pass

class ControlMappingOut(ControlMappingBase):
    id: int
    control_id: int
    model_config = {"from_attributes": True}


class ControlBase(BaseModel):
    control_id: str
    title: str
    description: Optional[str] = None
    control_type: Optional[str] = None
    frequency: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = "active"
    # SOX ITGC scoping
    sox_in_scope: bool = False
    sox_itgc_domain: Optional[str] = None
    sox_systems: Optional[str] = None     # comma-separated
    sox_assertions: Optional[str] = None  # comma-separated

class ControlCreate(ControlBase):
    mappings: Optional[list[ControlMappingCreate]] = []

class ControlUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    control_type: Optional[str] = None
    frequency: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = None
    sox_in_scope: Optional[bool] = None
    sox_itgc_domain: Optional[str] = None
    sox_systems: Optional[str] = None
    sox_assertions: Optional[str] = None

class ControlOut(ControlBase):
    id: int
    created_at: datetime
    updated_at: datetime
    mappings: list[ControlMappingOut] = []
    model_config = {"from_attributes": True}

class ControlSummary(BaseModel):
    id: int
    control_id: str
    title: str
    status: str
    control_type: Optional[str]
    frequency: Optional[str]
    owner: Optional[str]
    sox_in_scope: bool = False
    sox_itgc_domain: Optional[str] = None
    sox_systems: Optional[str] = None
    sox_assertions: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Test Cycles ────────────────────────────────────────────────────────────

class TestAssignmentBase(BaseModel):
    control_id: int
    tester_id: Optional[int] = None
    reviewer_id: Optional[int] = None

class TestAssignmentCreate(TestAssignmentBase):
    pass

class TestAssignmentUpdate(BaseModel):
    tester_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    status: Optional[str] = None
    tester_notes: Optional[str] = None
    reviewer_comments: Optional[str] = None

class EvidenceSummary(BaseModel):
    id: int
    original_filename: str
    description: Optional[str]
    uploaded_at: datetime
    uploaded_by: int
    model_config = {"from_attributes": True}


# ── Deficiencies ────────────────────────────────────────────────────────────

class DeficiencyCreate(BaseModel):
    assignment_id: int
    title: str
    description: Optional[str] = None
    severity: str = "high"  # critical/high/medium/low
    remediation_plan: Optional[str] = None
    due_date: Optional[date] = None

class DeficiencyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None
    remediation_plan: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None

class DeficiencyOut(BaseModel):
    id: int
    assignment_id: int
    title: str
    description: Optional[str]
    severity: str
    remediation_plan: Optional[str]
    status: str
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class TestAssignmentOut(BaseModel):
    id: int
    test_cycle_id: int
    control_id: int
    tester_id: Optional[int]
    reviewer_id: Optional[int]
    status: str
    tester_notes: Optional[str]
    reviewer_comments: Optional[str]
    created_at: datetime
    updated_at: datetime
    control: Optional[ControlSummary] = None
    tester: Optional[UserOut] = None
    reviewer: Optional[UserOut] = None
    evidence: list[EvidenceSummary] = []
    deficiencies: list[DeficiencyOut] = []
    model_config = {"from_attributes": True}


BRANDS = ["Inspire", "BWW", "DD", "BR", "JJ", "SON", "ARB"]

class TestCycleBase(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    brand: Optional[str] = None

class TestCycleCreate(TestCycleBase):
    created_by: int
    assignments: Optional[list[TestAssignmentCreate]] = []

class TestCycleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    brand: Optional[str] = None

class TestCycleOut(TestCycleBase):
    id: int
    status: str
    created_by: int
    created_at: datetime
    assignments: list[TestAssignmentOut] = []
    creator: Optional[UserOut] = None
    model_config = {"from_attributes": True}

class TestCycleSummary(BaseModel):
    id: int
    name: str
    status: str
    brand: Optional[str] = None
    start_date: Optional[date]
    end_date: Optional[date]
    total_assignments: int = 0
    complete_count: int = 0
    in_progress_count: int = 0
    model_config = {"from_attributes": True}


# ── Evidence ───────────────────────────────────────────────────────────────

class EvidenceOut(BaseModel):
    id: int
    assignment_id: int
    filename: str
    original_filename: str
    description: Optional[str]
    uploaded_by: int
    uploaded_at: datetime
    uploader: Optional[UserOut] = None
    model_config = {"from_attributes": True}


# ── Dashboard ──────────────────────────────────────────────────────────────

class PciTestingBreakdown(BaseModel):
    total: int = 0
    never_tested: int = 0
    not_started: int = 0
    in_progress: int = 0
    needs_review: int = 0
    complete: int = 0
    failed: int = 0

class RiskAgingBuckets(BaseModel):
    field_0_30:    int = Field(0, alias="0_30")
    field_30_60:   int = Field(0, alias="30_60")
    field_60_90:   int = Field(0, alias="60_90")
    field_90_180:  int = Field(0, alias="90_180")
    field_180_365: int = Field(0, alias="180_365")
    field_365_plus: int = Field(0, alias="365_plus")
    model_config = {"populate_by_name": True}

class DashboardStats(BaseModel):
    total_controls: int
    active_controls: int
    total_test_cycles: int
    active_test_cycles: int
    total_assignments: int
    not_started: int
    in_progress: int
    needs_review: int
    complete: int
    failed: int
    total_evidence: int
    framework_coverage: dict[str, int]
    deficiency_open: int
    deficiency_in_remediation: int
    deficiency_remediated: int
    deficiency_risk_accepted: int
    pci_testing: PciTestingBreakdown = PciTestingBreakdown()
    exception_pending: int = 0
    exception_approved: int = 0
    exception_expiring_soon: int = 0
    risk_aging: RiskAgingBuckets = RiskAgingBuckets()


# ── Control Exceptions ─────────────────────────────────────────────────────

EXCEPTION_TYPES   = ["exception", "risk_acceptance", "compensating_control"]
EXCEPTION_STATUSES = ["draft", "pending_approval", "approved", "rejected", "expired"]
EXCEPTION_RISK_LEVELS = ["critical", "high", "medium", "low"]

class ControlExceptionBase(BaseModel):
    title: str
    exception_type: str = "exception"
    justification: str
    compensating_control: Optional[str] = None
    risk_level: str = "high"
    expiry_date: Optional[date] = None

class ControlExceptionCreate(ControlExceptionBase):
    control_id: int
    requested_by: Optional[int] = None

class ApproverNotesRequest(BaseModel):
    notes: Optional[str] = None


class ControlExceptionUpdate(BaseModel):
    title: Optional[str] = None
    exception_type: Optional[str] = None
    justification: Optional[str] = None
    compensating_control: Optional[str] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None
    approved_by: Optional[int] = None
    approver_notes: Optional[str] = None
    expiry_date: Optional[date] = None

class ControlExceptionOut(ControlExceptionBase):
    id: int
    control_id: int
    status: str
    requested_by: Optional[int] = None
    approved_by: Optional[int] = None
    approver_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    requester: Optional[UserOut] = None
    approver: Optional[UserOut] = None
    control: Optional["ControlSummary"] = None
    model_config = {"from_attributes": True}


# ── Control Cycle History ───────────────────────────────────────────────────

class ControlCycleHistoryOut(BaseModel):
    cycle_id: int
    cycle_name: str
    cycle_status: str
    start_date: Optional[date]
    end_date: Optional[date]
    assignment_id: int
    assignment_status: str
    tester: Optional[UserOut]
    reviewer: Optional[UserOut]
    tester_notes: Optional[str]
    reviewer_comments: Optional[str]
    evidence_count: int
    model_config = {"from_attributes": True}


# ── Assets ─────────────────────────────────────────────────────────────────

class AssetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    asset_type: Optional[str] = None
    criticality: Optional[str] = "medium"
    owner: Optional[str] = None
    status: Optional[str] = "active"

class AssetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    asset_type: Optional[str] = None
    criticality: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = None

class AssetOut(AssetCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Threats ────────────────────────────────────────────────────────────────

class ThreatCreate(BaseModel):
    name: str
    description: Optional[str] = None
    threat_category: Optional[str] = None
    source: Optional[str] = None

class ThreatUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    threat_category: Optional[str] = None
    source: Optional[str] = None

class ThreatOut(ThreatCreate):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Risks ──────────────────────────────────────────────────────────────────

class RiskControlOut(BaseModel):
    id: int
    risk_id: int
    control_id: int
    notes: Optional[str]
    control: Optional[ControlSummary] = None
    model_config = {"from_attributes": True}

class RiskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    asset_id: Optional[int] = None
    threat_id: Optional[int] = None
    likelihood: int = 3
    impact: int = 3
    treatment: Optional[str] = "mitigate"
    status: Optional[str] = "open"
    owner: Optional[str] = None
    owner_id: Optional[int] = None   # FK to users — used for review email routing

class RiskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    asset_id: Optional[int] = None
    threat_id: Optional[int] = None
    likelihood: Optional[int] = None
    impact: Optional[int] = None
    treatment: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None
    owner_id: Optional[int] = None

class RiskOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    asset_id: Optional[int] = None
    threat_id: Optional[int] = None
    likelihood: int
    impact: int
    inherent_score: int = 0
    treatment: Optional[str] = None
    status: str
    owner: Optional[str] = None
    owner_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    asset: Optional[AssetOut] = None
    threat: Optional[ThreatOut] = None
    days_open: int = 0
    controls: list[RiskControlOut] = []
    model_config = {"from_attributes": True}

    @model_validator(mode='after')
    def compute_fields(self):
        self.inherent_score = self.likelihood * self.impact
        if self.created_at:
            from datetime import datetime as _dt
            self.days_open = (_dt.utcnow() - self.created_at).days
        return self

class RiskControlCreate(BaseModel):
    control_id: int
    notes: Optional[str] = None


# ── Approval Workflow Engine ────────────────────────────────────────────────

class ApprovalEscalationRuleBase(BaseModel):
    condition_field:  str
    condition_value:  str
    add_step_label:   str
    add_step_user_id: Optional[int] = None
    add_step_role:    Optional[str] = None

class ApprovalEscalationRuleOut(ApprovalEscalationRuleBase):
    id: int
    add_step_user: Optional[UserOut] = None
    model_config = {"from_attributes": True}

class ApprovalPolicyStepBase(BaseModel):
    step_order:       int
    label:            str
    approver_user_id: Optional[int] = None
    approver_role:    Optional[str] = None

class ApprovalPolicyStepOut(ApprovalPolicyStepBase):
    id: int
    approver: Optional[UserOut] = None
    model_config = {"from_attributes": True}

class ApprovalPolicyCreate(BaseModel):
    name:        str
    description: Optional[str] = None
    entity_type: str                    # exception | control_test
    is_default:  bool = False
    steps:            list[ApprovalPolicyStepBase] = []
    escalation_rules: list[ApprovalEscalationRuleBase] = []

class ApprovalPolicyUpdate(BaseModel):
    name:        Optional[str] = None
    description: Optional[str] = None
    is_default:  Optional[bool] = None
    steps:            Optional[list[ApprovalPolicyStepBase]] = None
    escalation_rules: Optional[list[ApprovalEscalationRuleBase]] = None

class ApprovalPolicyOut(BaseModel):
    id:          int
    name:        str
    description: Optional[str] = None
    entity_type: str
    is_default:  bool
    created_at:  datetime
    steps:            list[ApprovalPolicyStepOut] = []
    escalation_rules: list[ApprovalEscalationRuleOut] = []
    model_config = {"from_attributes": True}


class ApprovalWorkflowStepOut(BaseModel):
    id:               int
    step_order:       int
    label:            str
    approver_user_id: Optional[int] = None
    approver_role:    Optional[str] = None
    is_escalation:    bool
    status:           str   # pending | approved | rejected
    decided_by_id:    Optional[int] = None
    decided_at:       Optional[datetime] = None
    notes:            Optional[str] = None
    approver:         Optional[UserOut] = None
    decider:          Optional[UserOut] = None
    model_config = {"from_attributes": True}

class ApprovalWorkflowOut(BaseModel):
    id:           int
    entity_type:  str
    entity_id:    int
    status:       str        # pending | approved | rejected
    current_step: int
    created_at:   datetime
    completed_at: Optional[datetime] = None
    creator:      Optional[UserOut] = None
    steps:        list[ApprovalWorkflowStepOut] = []
    model_config = {"from_attributes": True}

class ApprovalDecisionRequest(BaseModel):
    decision: str            # approved | rejected
    notes:    Optional[str] = None

class ApprovalWorkflowCreate(BaseModel):
    policy_id:   int
    entity_type: str
    entity_id:   int


# ── Risk Review System ────────────────────────────────────────────────────────

class RiskReviewCycleCreate(BaseModel):
    label:      str
    cycle_type: str               # label only: jan | jul | quarterly | monthly | ad_hoc
    year:       Optional[int] = None
    scope_note: Optional[str] = None
    min_score:  int = 0           # 0=all, 4=medium+, 12=high+, 20=critical only

class RiskReviewCycleOut(BaseModel):
    id:           int
    label:        str
    cycle_type:   str
    year:         Optional[int]     = None
    min_score:    int               = 0
    status:       str               # draft | active | closed
    scope_note:   Optional[str]     = None
    created_by:   Optional[int]     = None
    launched_at:  Optional[datetime] = None
    closed_at:    Optional[datetime] = None
    created_at:   datetime
    # Computed counts (populated by the router)
    request_count: int = 0
    pending_count:  int = 0
    updated_count:  int = 0
    model_config = {"from_attributes": True}

class RiskReviewUpdateCreate(BaseModel):
    status_confirmed:    Optional[str] = None
    mitigation_progress: Optional[str] = None
    notes:               Optional[str] = None

class RiskReviewUpdateOut(BaseModel):
    id:                  int
    request_id:          int
    risk_id:             int
    cycle_id:            int
    submitted_by:        int
    status_confirmed:    Optional[str] = None
    mitigation_progress: Optional[str] = None
    notes:               Optional[str] = None
    submitted_at:        datetime
    submitter:           Optional[UserOut] = None
    model_config = {"from_attributes": True}

class RiskReviewRequestOut(BaseModel):
    id:               int
    cycle_id:         int
    risk_id:          int
    owner_id:         int
    status:           str   # pending | updated | overdue
    email_sent_at:    Optional[datetime] = None
    last_reminded_at: Optional[datetime] = None
    reminder_count:   int = 0
    created_at:       datetime
    owner:            Optional[UserOut] = None
    updates:          list[RiskReviewUpdateOut] = []
    model_config = {"from_attributes": True}

class RiskReviewCycleDetail(RiskReviewCycleOut):
    """Cycle with full request list (used on the detail page)."""
    requests: list[RiskReviewRequestOut] = []


# ── Treatment Plans ────────────────────────────────────────────────────────

class TreatmentMilestoneCreate(BaseModel):
    title:          str
    description:    Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date:       Optional[date] = None
    status:         str = "open"
    sort_order:     int = 0

class TreatmentMilestoneUpdate(BaseModel):
    title:          Optional[str] = None
    description:    Optional[str] = None
    assigned_to_id: Optional[int] = None
    due_date:       Optional[date] = None
    status:         Optional[str] = None
    sort_order:     Optional[int] = None

class TreatmentMilestoneOut(BaseModel):
    id:             int
    plan_id:        int
    title:          str
    description:    Optional[str]
    assigned_to_id: Optional[int]
    assigned_to:    Optional[UserOut] = None
    due_date:       Optional[date]
    status:         str
    completed_at:   Optional[datetime] = None
    sort_order:     int
    model_config = {"from_attributes": True}

class TreatmentPlanCreate(BaseModel):
    risk_id:     int
    strategy:    str = "mitigate"
    description: Optional[str] = None
    owner_id:    Optional[int] = None
    target_date: Optional[date] = None

class TreatmentPlanUpdate(BaseModel):
    strategy:    Optional[str] = None
    description: Optional[str] = None
    owner_id:    Optional[int] = None
    target_date: Optional[date] = None
    status:      Optional[str] = None

class TreatmentPlanOut(BaseModel):
    id:          int
    risk_id:     int
    strategy:    str
    description: Optional[str]
    owner_id:    Optional[int]
    owner:       Optional[UserOut] = None
    target_date: Optional[date]
    status:      str
    created_at:  datetime
    updated_at:  datetime
    milestones:  list[TreatmentMilestoneOut] = []
    model_config = {"from_attributes": True}


# ── Auth ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class AzureLoginRequest(BaseModel):
    access_token: str
