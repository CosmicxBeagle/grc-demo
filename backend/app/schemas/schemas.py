from pydantic import BaseModel, Field, model_validator
from typing import Optional, Any
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


class SCIMEmail(BaseModel):
    value: str
    primary: Optional[bool] = None


class SCIMName(BaseModel):
    formatted: Optional[str] = None
    givenName: Optional[str] = None
    familyName: Optional[str] = None


class SCIMUserCreate(BaseModel):
    userName: str
    displayName: Optional[str] = None
    name: Optional[SCIMName] = None
    emails: list[SCIMEmail] = []
    active: bool = True
    externalId: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    role: str = "viewer"


class SCIMUserOut(BaseModel):
    schemas: list[str] = ["urn:ietf:params:scim:schemas:core:2.0:User"]
    id: str
    userName: str
    displayName: str
    active: bool
    emails: list[SCIMEmail]


class SCIMPatchOperation(BaseModel):
    op: str
    path: Optional[str] = None
    value: Optional[object] = None


class SCIMPatchRequest(BaseModel):
    Operations: list[SCIMPatchOperation]


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
    scf_question: Optional[str] = None
    scf_domain: Optional[str] = None
    scf_weight: Optional[int] = None
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
    scf_question: Optional[str] = None
    scf_domain: Optional[str] = None
    scf_weight: Optional[int] = None
    control_type: Optional[str] = None
    frequency: Optional[str] = None
    owner: Optional[str] = None
    status: Optional[str] = None
    sox_in_scope: Optional[bool] = None
    sox_itgc_domain: Optional[str] = None
    sox_systems: Optional[str] = None
    sox_assertions: Optional[str] = None
    mappings: Optional[list[ControlMappingCreate]] = None  # None = don't touch; [] = clear all

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
    # workpaper fields
    testing_steps: Optional[str] = None
    sample_details: Optional[str] = None
    walkthrough_notes: Optional[str] = None
    conclusion: Optional[str] = None
    evidence_request_text: Optional[str] = None
    evidence_request_due_date: Optional[date] = None

class EvidenceSummary(BaseModel):
    id: int
    original_filename: str
    description: Optional[str]
    uploaded_at: datetime
    uploaded_by: int
    model_config = {"from_attributes": True}


# ── Deficiencies ────────────────────────────────────────────────────────────

class RiskSummaryForDeficiency(BaseModel):
    id: int
    name: str
    status: str
    likelihood: int
    impact: int
    model_config = {"from_attributes": True}

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
    root_cause: Optional[str] = None
    business_impact: Optional[str] = None
    remediation_owner: Optional[str] = None
    validation_notes: Optional[str] = None
    closure_evidence: Optional[str] = None

class PromoteToRiskRequest(BaseModel):
    name: str
    description: Optional[str] = None
    likelihood: int = 3
    impact: int = 3
    treatment: Optional[str] = "mitigate"
    owner: Optional[str] = None

class LinkRiskRequest(BaseModel):
    risk_id: int

# ── Deficiency Milestones ───────────────────────────────────────────────────

class DeficiencyMilestoneCreate(BaseModel):
    title: str
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None
    notes: Optional[str] = None

class DeficiencyMilestoneUpdate(BaseModel):
    title: Optional[str] = None
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class DeficiencyMilestoneOut(BaseModel):
    id: int
    deficiency_id: int
    title: str
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None
    assignee: Optional["UserOut"] = None
    status: str
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    # Loop 3: escalation
    escalated_at: Optional[datetime] = None
    escalation_level: int = 0
    # Loop 3: extension
    extension_requested: bool = False
    extension_request_reason: Optional[str] = None
    extension_requested_at: Optional[datetime] = None
    extension_approved: Optional[bool] = None
    extension_approved_by_user_id: Optional[int] = None
    extension_approver: Optional["UserOut"] = None
    original_due_date: Optional[date] = None
    new_due_date: Optional[date] = None
    model_config = {"from_attributes": True}

class DeficiencyOut(BaseModel):
    id: int
    assignment_id: int
    title: str
    description: Optional[str]
    severity: str
    remediation_plan: Optional[str]
    status: str
    due_date: Optional[date]
    linked_risk_id: Optional[int] = None
    linked_risk: Optional[RiskSummaryForDeficiency] = None
    # remediation detail fields
    root_cause: Optional[str] = None
    business_impact: Optional[str] = None
    remediation_owner: Optional[str] = None
    validation_notes: Optional[str] = None
    closure_evidence: Optional[str] = None
    closed_at: Optional[datetime] = None
    # retest fields (Workstream 4A)
    retest_required: bool = True
    retest_assignment_id: Optional[int] = None
    retest_waived: bool = False
    retest_waived_by_user_id: Optional[int] = None
    retest_waived_reason: Optional[str] = None
    milestones: list[DeficiencyMilestoneOut] = []
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Checklist ──────────────────────────────────────────────────────────────

class ChecklistItemCreate(BaseModel):
    title: str
    sort_order: int = 0

class ChecklistItemUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None
    sort_order: Optional[int] = None

class ChecklistItemOut(BaseModel):
    id: int
    assignment_id: int
    title: str
    completed: bool
    completed_at: Optional[datetime] = None
    sort_order: int
    created_at: Optional[datetime] = None
    model_config = {"from_attributes": True}

# ── Signoff schemas ─────────────────────────────────────────────────────────

class TesterSubmitRequest(BaseModel):
    signoff_note: Optional[str] = None

class ReviewerDecideRequest(BaseModel):
    outcome: str  # approved | returned | failed
    notes: Optional[str] = None
    return_reason: Optional[str] = None  # required when outcome == "returned" (min 10 chars enforced in router)

# ── Loop 1: Rework schemas ───────────────────────────────────────────────────

class ReturnAssignmentRequest(BaseModel):
    reason: str = Field(..., min_length=10, description="Reason for returning (min 10 chars)")

class AssignmentReworkLogEntry(BaseModel):
    id: int
    assignment_id: int
    returned_by_user_id: int
    returned_by: Optional["UserOut"] = None
    return_reason: str
    returned_at: datetime
    rework_number: int
    model_config = {"from_attributes": True}

# ── Loop 2: Evidence reopen schemas ─────────────────────────────────────────

class ReopenEvidenceRequest(BaseModel):
    reason: str = Field(..., min_length=10, description="Reason for reopening (min 10 chars)")

class EvidenceRequestHistoryEntry(BaseModel):
    id: int
    assignment_id: int
    action: str  # opened | fulfilled | reopened | cancelled
    actor_user_id: Optional[int] = None
    actor: Optional["UserOut"] = None
    reason: Optional[str] = None
    file_snapshot_reference: Optional[str] = None
    occurred_at: datetime
    model_config = {"from_attributes": True}

# ── Loop 3: Milestone extension schemas ─────────────────────────────────────

class MilestoneExtensionRequest(BaseModel):
    reason: str = Field(..., min_length=10, description="Justification for extension (min 10 chars)")

class MilestoneExtensionApprove(BaseModel):
    new_due_date: date

# ── Notifications ────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: int
    user_id: int
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    is_read: bool
    created_at: datetime
    model_config = {"from_attributes": True}

# ── Test Assignment ─────────────────────────────────────────────────────────

class TestAssignmentOut(BaseModel):
    id: int
    test_cycle_id: int
    control_id: int
    tester_id: Optional[int]
    reviewer_id: Optional[int]
    status: str
    tester_notes: Optional[str]
    reviewer_comments: Optional[str]
    # workpaper
    testing_steps: Optional[str] = None
    sample_details: Optional[str] = None
    walkthrough_notes: Optional[str] = None
    conclusion: Optional[str] = None
    evidence_request_text: Optional[str] = None
    evidence_request_due_date: Optional[date] = None
    # signoff
    tester_submitted_at: Optional[datetime] = None
    tester_submitted_by_id: Optional[int] = None
    tester_signoff_note: Optional[str] = None
    reviewer_decided_at: Optional[datetime] = None
    reviewer_decided_by_id: Optional[int] = None
    reviewer_outcome: Optional[str] = None
    tester_submitter: Optional[UserOut] = None
    reviewer_decider: Optional[UserOut] = None
    # Loop 1: rework
    rework_count: int = 0
    last_returned_at: Optional[datetime] = None
    last_return_reason: Optional[str] = None
    rework_log: list["AssignmentReworkLogEntry"] = []
    # Loop 2: evidence reopen
    reopen_count: int = 0
    last_reopened_at: Optional[datetime] = None
    last_reopen_reason: Optional[str] = None
    evidence_history: list["EvidenceRequestHistoryEntry"] = []
    created_at: datetime
    updated_at: datetime
    control: Optional[ControlSummary] = None
    tester: Optional[UserOut] = None
    reviewer: Optional[UserOut] = None
    evidence: list[EvidenceSummary] = []
    deficiencies: list[DeficiencyOut] = []
    checklist_items: list[ChecklistItemOut] = []
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
    closed_at: Optional[datetime] = None
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
    file_size: Optional[int] = None
    uploader: Optional[UserOut] = None
    model_config = {"from_attributes": True}


class EvidenceListItem(BaseModel):
    """Flattened evidence row for the library list view."""
    id: int
    original_filename: str
    description: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: datetime
    uploaded_by: Optional[int] = None
    uploader_name: Optional[str] = None
    uploader_email: Optional[str] = None
    assignment_id: int
    control_id: Optional[str] = None      # e.g. "IAC-16.1"
    control_title: Optional[str] = None
    test_cycle_id: Optional[int] = None
    test_cycle_name: Optional[str] = None
    model_config = {"from_attributes": True}


class PaginatedEvidenceResponse(BaseModel):
    items: list[EvidenceListItem]
    total: int
    page: int
    page_size: int


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
    model_config = {"populate_by_name": True, "ser_by_alias": True}

class RiskSeverityBreakdown(BaseModel):
    low:      int = 0   # inherent score 1–4
    medium:   int = 0   # 5–9
    high:     int = 0   # 10–14
    critical: int = 0   # 15–25

class RiskOwnerMetric(BaseModel):
    name:      str
    count:     int
    avg_score: float

class RiskManagedStatus(BaseModel):
    new:                    int = 0
    managed_with_dates:     int = 0
    managed_without_dates:  int = 0
    unmanaged:              int = 0
    closed:                 int = 0

class RiskTreatmentBreakdown(BaseModel):
    mitigate: int = 0
    accept:   int = 0
    transfer: int = 0
    avoid:    int = 0

class RiskRemediationMetrics(BaseModel):
    total_plans:          int = 0
    in_progress:          int = 0
    completed:            int = 0
    on_hold:              int = 0
    cancelled:            int = 0
    milestones_total:     int = 0
    milestones_completed: int = 0
    milestones_overdue:   int = 0

class RiskDepartmentMetric(BaseModel):
    name:  str
    count: int

class RiskQuarterlyBucket(BaseModel):
    quarter:  str
    high:     int = 0
    critical: int = 0
    total:    int = 0

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
    deficiency_validated: int = 0
    deficiency_risk_accepted: int
    pci_testing: PciTestingBreakdown = PciTestingBreakdown()
    exception_pending: int = 0
    exception_approved: int = 0
    exception_expiring_soon: int = 0
    risk_aging: RiskAgingBuckets = RiskAgingBuckets()
    # ── Risk analytics ────────────────────────────────────────────────────────
    total_risks:        int   = 0
    open_risks:         int   = 0
    high_critical_risks: int  = 0
    avg_risk_score:     float = 0.0
    risk_severity:      RiskSeverityBreakdown     = RiskSeverityBreakdown()
    risk_managed_status: RiskManagedStatus        = RiskManagedStatus()
    risk_treatment:     RiskTreatmentBreakdown    = RiskTreatmentBreakdown()
    risk_owners:        list[RiskOwnerMetric]     = []
    risk_vps:           list[RiskOwnerMetric]     = []
    risk_departments:   list[RiskDepartmentMetric] = []
    risk_quarterly:     list[RiskQuarterlyBucket] = []
    risk_remediation:   RiskRemediationMetrics    = RiskRemediationMetrics()


# ── Control Exceptions ─────────────────────────────────────────────────────

EXCEPTION_TYPES   = ["exception", "risk_acceptance", "compensating_control"]
EXCEPTION_STATUSES = ["draft", "pending_approval", "approved", "rejected", "expired"]
EXCEPTION_RISK_LEVELS = ["critical", "high", "medium", "low"]

class ControlExceptionBase(BaseModel):
    title: str
    exception_type: str = "exception"
    # Extended intake fields
    system_name:          Optional[str] = None
    policy_for_exception: Optional[str] = None
    risk_to_business:     Optional[str] = None
    security_poc:         Optional[str] = None
    business_owner_email: Optional[str] = None
    regulatory_scope:     Optional[str] = None  # yes | no | partial
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
    system_name:          Optional[str] = None
    policy_for_exception: Optional[str] = None
    risk_to_business:     Optional[str] = None
    security_poc:         Optional[str] = None
    business_owner_email: Optional[str] = None
    regulatory_scope:     Optional[str] = None
    justification: Optional[str] = None
    compensating_control: Optional[str] = None
    risk_level: Optional[str] = None
    status: Optional[str] = None
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
    # lifecycle fields (Workstream 4B)
    expires_at: Optional[datetime] = None
    expiry_notified_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    resubmission_count: int = 0
    parent_exception_id: Optional[int] = None
    decision_notified_at: Optional[datetime] = None
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

class RiskParentSummary(BaseModel):
    id: int
    name: str
    status: str
    likelihood: int
    impact: int
    model_config = {"from_attributes": True}

VALID_RISK_STATUSES = {
    "new", "closed", "managed_with_dates", "managed_without_dates", "unmanaged"
}


class RiskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    asset_id: Optional[int] = None
    threat_id: Optional[int] = None
    likelihood: int = 3
    impact: int = 3
    residual_likelihood: Optional[int] = None
    residual_impact: Optional[int] = None
    treatment: Optional[str] = "mitigate"
    status: Optional[str] = "new"
    managed_start_date: Optional[date] = None
    managed_end_date: Optional[date] = None
    owner: Optional[str] = None
    owner_id: Optional[int] = None
    parent_risk_id: Optional[int] = None
    # Extended fields
    category:              Optional[str]  = None
    risk_type:             Optional[str]  = None
    risk_theme:            Optional[str]  = None
    source:                Optional[str]  = None
    department:            Optional[str]  = None
    owning_vp:             Optional[str]  = None
    stage:                 Optional[str]  = None
    target_likelihood:     Optional[int]  = None
    target_impact:         Optional[int]  = None
    date_identified:       Optional[date] = None
    date_closed:           Optional[date] = None
    closing_justification: Optional[str]  = None
    regulatory_compliance: Optional[str]  = None

    @model_validator(mode="after")
    def validate_managed_dates(self):
        if self.status == "managed_with_dates":
            if not self.managed_start_date or not self.managed_end_date:
                raise ValueError(
                    "managed_start_date and managed_end_date are required when status is managed_with_dates"
                )
        return self


class RiskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    asset_id: Optional[int] = None
    threat_id: Optional[int] = None
    likelihood: Optional[int] = None
    impact: Optional[int] = None
    residual_likelihood: Optional[int] = None
    residual_impact: Optional[int] = None
    treatment: Optional[str] = None
    status: Optional[str] = None
    managed_start_date: Optional[date] = None
    managed_end_date: Optional[date] = None
    owner: Optional[str] = None
    owner_id: Optional[int] = None
    parent_risk_id: Optional[int] = None
    # Extended fields
    category:              Optional[str]  = None
    risk_type:             Optional[str]  = None
    risk_theme:            Optional[str]  = None
    source:                Optional[str]  = None
    department:            Optional[str]  = None
    owning_vp:             Optional[str]  = None
    stage:                 Optional[str]  = None
    target_likelihood:     Optional[int]  = None
    target_impact:         Optional[int]  = None
    date_identified:       Optional[date] = None
    date_closed:           Optional[date] = None
    closing_justification: Optional[str]  = None
    regulatory_compliance: Optional[str]  = None

    @model_validator(mode="after")
    def validate_managed_dates(self):
        if self.status == "managed_with_dates":
            if not self.managed_start_date or not self.managed_end_date:
                raise ValueError(
                    "managed_start_date and managed_end_date are required when status is managed_with_dates"
                )
        return self


class RiskOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    asset_id: Optional[int] = None
    threat_id: Optional[int] = None
    likelihood: int
    impact: int
    inherent_score: int = 0
    residual_likelihood: Optional[int] = None
    residual_impact: Optional[int] = None
    residual_score: Optional[int] = None
    treatment: Optional[str] = None
    status: str
    managed_start_date: Optional[date] = None
    managed_end_date: Optional[date] = None
    owner: Optional[str] = None
    owner_id: Optional[int] = None
    parent_risk_id: Optional[int] = None
    parent_risk: Optional[RiskParentSummary] = None
    child_count: int = 0
    created_at: datetime
    updated_at: datetime
    asset: Optional[AssetOut] = None
    threat: Optional[ThreatOut] = None
    days_open: int = 0
    controls: list[RiskControlOut] = []
    # Extended fields
    category:              Optional[str]  = None
    risk_type:             Optional[str]  = None
    risk_theme:            Optional[str]  = None
    source:                Optional[str]  = None
    department:            Optional[str]  = None
    owning_vp:             Optional[str]  = None
    stage:                 Optional[str]  = None
    target_likelihood:     Optional[int]  = None
    target_impact:         Optional[int]  = None
    target_score:          Optional[int]  = None
    date_identified:       Optional[date] = None
    date_closed:           Optional[date] = None
    closing_justification: Optional[str]  = None
    regulatory_compliance: Optional[str]  = None
    model_config = {"from_attributes": True}

    @model_validator(mode='after')
    def compute_fields(self):
        self.inherent_score = self.likelihood * self.impact
        if self.residual_likelihood and self.residual_impact:
            self.residual_score = self.residual_likelihood * self.residual_impact
        if self.target_likelihood and self.target_impact:
            self.target_score = self.target_likelihood * self.target_impact
        if self.created_at:
            from datetime import datetime as _dt
            self.days_open = (_dt.utcnow() - self.created_at).days
        return self


class PaginatedRiskResponse(BaseModel):
    items: list[RiskOut]
    total: int
    skip: int
    limit: int


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


# ── Risk History ──────────────────────────────────────────────────────────────

class RiskHistoryOut(BaseModel):
    """Unified shape returned by GET /risks/{id}/history."""
    id:             Any         # int for new entries, "rev_N" for legacy review updates
    source:         str         # "history" | "review"
    event_type:     str         # created | field_changed | review_submitted | review_accepted | review_challenged | challenge_responded
    actor_name:     Optional[str] = None
    summary:        str         = ""
    old_status:     Optional[str] = None
    new_status:     Optional[str] = None
    changed_fields: Optional[dict] = None
    notes:          Optional[str] = None
    # Review-specific extras (only present on source=review entries)
    mitigation_progress:        Optional[str] = None
    grc_review_status:          Optional[str] = None
    grc_challenge_reason:       Optional[str] = None
    owner_challenge_response:   Optional[str] = None
    created_at:     Optional[str] = None


# ── Risk Review System ────────────────────────────────────────────────────────

class RiskReviewCycleCreate(BaseModel):
    label:            str
    cycle_type:       str               # monthly | quarterly | yearly | ad_hoc
    year:             Optional[int] = None
    scope_note:       Optional[str] = None
    min_score:        int = 0           # legacy fallback
    severities:       Optional[str] = None  # comma-sep: low,medium,high,critical
    risk_ids_filter:  Optional[str] = None  # comma-sep risk IDs; overrides severity scope
    owner_ids_filter: Optional[str] = None  # comma-sep user IDs; scope to specific owners

class RiskReviewCycleOut(BaseModel):
    id:               int
    label:            str
    cycle_type:       str
    year:             Optional[int]     = None
    min_score:        int               = 0
    severities:       Optional[str]     = None
    risk_ids_filter:  Optional[str]     = None
    owner_ids_filter: Optional[str]     = None
    status:           str               # draft | active | closed
    scope_note:       Optional[str]     = None
    created_by:       Optional[int]     = None
    launched_at:      Optional[datetime] = None
    closed_at:        Optional[datetime] = None
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
    id:                       int
    request_id:               int
    risk_id:                  int
    cycle_id:                 int
    submitted_by:             int
    status_confirmed:         Optional[str] = None
    mitigation_progress:      Optional[str] = None
    notes:                    Optional[str] = None
    submitted_at:             datetime
    submitter:                Optional[UserOut] = None
    # GRC review fields
    grc_review_status:        Optional[str] = None
    grc_reviewer_user_id:     Optional[int] = None
    grc_challenge_reason:     Optional[str] = None
    grc_reviewed_at:          Optional[datetime] = None
    owner_challenge_response: Optional[str] = None
    owner_responded_at:       Optional[datetime] = None
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
    # Escalation tracking
    escalation_level:              int = 0
    escalated_at:                  Optional[datetime] = None
    # Extension request workflow
    extension_requested:           bool = False
    extension_request_reason:      Optional[str] = None
    extension_requested_at:        Optional[datetime] = None
    extension_approved:            Optional[bool] = None
    extension_approved_by_user_id: Optional[int] = None
    original_due_date:             Optional[date] = None
    new_due_date:                  Optional[date] = None
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


# ── Workstream 4A: Retest schemas ─────────────────────────────────────────────
class RetestCreate(BaseModel):
    cycle_id: int
    assigned_to_user_id: int

class RetestWaive(BaseModel):
    reason: str = Field(..., min_length=10)


# ── Workstream 4B: Exception lifecycle ───────────────────────────────────────
class ExceptionRejectRequest(BaseModel):
    rejection_reason: str = Field(..., min_length=20, description="Must document why the exception is rejected")

class ExceptionResubmitResponse(BaseModel):
    id: int
    status: str
    parent_exception_id: Optional[int] = None
    model_config = {"from_attributes": True}
