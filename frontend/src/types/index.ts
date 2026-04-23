export type Role =
  | "admin"
  | "grc_manager"
  | "grc_analyst"
  | "tester"
  | "reviewer"
  | "risk_owner"
  | "viewer";

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: Role;
  identity_provider?: string;
  department?: string;
  job_title?: string;
  status?: string;
  last_login_at?: string;
  deactivated_at?: string;
  deactivated_by_user_id?: number;
  deactivation_reason?: string;
}

export interface ControlMapping {
  id: number;
  control_id: number;
  framework: "PCI" | "NIST" | "CIS" | "SOX";
  framework_version?: string;
  framework_ref: string;
  framework_description?: string;
}

export type SoxItgcDomain =
  | "Access Controls"
  | "Change Management"
  | "Computer Operations"
  | "Program Development";

export type SoxAssertion =
  | "Completeness"
  | "Accuracy"
  | "Existence"
  | "Authorization"
  | "Valuation"
  | "Presentation & Disclosure";

export interface Control {
  id: number;
  control_id: string;
  title: string;
  description?: string;
  scf_question?: string;
  scf_domain?: string;
  scf_weight?: number;
  control_type?: string;
  frequency?: string;
  owner?: string;
  status: string;
  sox_in_scope: boolean;
  sox_itgc_domain?: SoxItgcDomain;
  sox_systems?: string;    // comma-separated
  sox_assertions?: string; // comma-separated
  created_at: string;
  updated_at: string;
  mappings: ControlMapping[];
}

export type AssignmentStatus =
  | "not_started"
  | "in_progress"
  | "needs_review"
  | "complete"
  | "failed";

export type DeficiencyStatus = "open" | "in_remediation" | "remediated" | "risk_accepted";
export type DeficiencySeverity = "critical" | "high" | "medium" | "low";

export interface RiskSummary {
  id: number;
  name: string;
  status: string;
  likelihood: number;
  impact: number;
}

export interface DeficiencyMilestone {
  id: number;
  deficiency_id: number;
  title: string;
  due_date?: string;
  assignee_id?: number;
  assignee?: User;
  status: "open" | "completed" | "overdue";
  completed_at?: string;
  notes?: string;
  created_at?: string;
  // Loop 3: escalation
  escalated_at?: string;
  escalation_level: number;
  // Loop 3: extension
  extension_requested: boolean;
  extension_request_reason?: string;
  extension_requested_at?: string;
  extension_approved?: boolean | null;
  extension_approved_by_user_id?: number;
  original_due_date?: string;
  new_due_date?: string;
}

export interface Deficiency {
  id: number;
  assignment_id: number;
  title: string;
  description?: string;
  severity: DeficiencySeverity;
  remediation_plan?: string;
  status: DeficiencyStatus;
  due_date?: string;
  linked_risk_id?: number;
  linked_risk?: RiskSummary;
  // remediation detail
  root_cause?: string;
  business_impact?: string;
  remediation_owner?: string;
  validation_notes?: string;
  closure_evidence?: string;
  closed_at?: string;
  milestones: DeficiencyMilestone[];
  created_at: string;
  updated_at: string;
  // 4A: retest
  retest_required: boolean;
  retest_assignment_id?: number;
  retest_waived: boolean;
  retest_waived_by_user_id?: number;
  retest_waived_reason?: string;
}

export interface EvidenceSummary {
  id: number;
  original_filename: string;
  description?: string;
  uploaded_at: string;
  uploaded_by: number;
}

export interface EvidenceListItem {
  id: number;
  original_filename: string;
  description?: string;
  file_size?: number;
  uploaded_at: string;
  uploaded_by?: number;
  uploader_name?: string;
  uploader_email?: string;
  assignment_id: number;
  control_id?: string;
  control_title?: string;
  test_cycle_id?: number;
  test_cycle_name?: string;
}

export interface PaginatedEvidenceResponse {
  items: EvidenceListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface EvidenceListParams {
  q?: string;
  test_cycle_id?: number[];
  control_prefix?: string[];
  date_from?: string;
  date_to?: string;
  sort_by?: "original_filename" | "uploaded_at" | "control" | "cycle";
  sort_dir?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface ChecklistItem {
  id: number;
  assignment_id: number;
  title: string;
  completed: boolean;
  completed_at?: string;
  sort_order: number;
  created_at?: string;
}

export interface AssignmentReworkLogEntry {
  id: number;
  assignment_id: number;
  returned_by_user_id: number;
  returned_by?: User;
  return_reason: string;
  returned_at: string;
  rework_number: number;
}

export interface EvidenceRequestHistoryEntry {
  id: number;
  assignment_id: number;
  action: "opened" | "fulfilled" | "reopened" | "cancelled";
  actor_user_id?: number;
  actor?: User;
  reason?: string;
  file_snapshot_reference?: string;
  occurred_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  message: string;
  entity_type?: string;
  entity_id?: number;
  is_read: boolean;
  created_at: string;
}

export interface TestAssignment {
  id: number;
  test_cycle_id: number;
  control_id: number;
  tester_id?: number;
  reviewer_id?: number;
  status: AssignmentStatus;
  tester_notes?: string;
  reviewer_comments?: string;
  // workpaper
  testing_steps?: string;
  sample_details?: string;
  walkthrough_notes?: string;
  conclusion?: string;
  evidence_request_text?: string;
  evidence_request_due_date?: string;
  // signoff
  tester_submitted_at?: string;
  tester_submitted_by_id?: number;
  tester_signoff_note?: string;
  reviewer_decided_at?: string;
  reviewer_decided_by_id?: number;
  reviewer_outcome?: string;
  tester_submitter?: User;
  reviewer_decider?: User;
  created_at: string;
  updated_at: string;
  control?: Control;
  tester?: User;
  reviewer?: User;
  evidence: EvidenceSummary[];
  deficiencies: Deficiency[];
  checklist_items: ChecklistItem[];
  // Loop 1: rework tracking
  rework_count: number;
  last_returned_at?: string;
  last_return_reason?: string;
  rework_log: AssignmentReworkLogEntry[];
  // Loop 2: evidence reopen tracking
  reopen_count: number;
  last_reopened_at?: string;
  last_reopen_reason?: string;
  evidence_history: EvidenceRequestHistoryEntry[];
}

export const BRANDS = ["Inspire", "BWW", "DD", "BR", "JJ", "SON", "ARB"] as const;
export type Brand = typeof BRANDS[number];

export interface TestCycleSummary {
  id: number;
  name: string;
  status: string;
  brand?: string;
  start_date?: string;
  end_date?: string;
  total_assignments: number;
  complete_count: number;
  in_progress_count: number;
}

export interface TestCycle extends TestCycleSummary {
  description?: string;
  created_by: number;
  created_at: string;
  closed_at?: string;
  assignments: TestAssignment[];
  creator?: User;
}

export interface ControlCycleHistory {
  cycle_id: number;
  cycle_name: string;
  cycle_status: string;
  start_date?: string;
  end_date?: string;
  assignment_id: number;
  assignment_status: AssignmentStatus;
  tester?: User;
  reviewer?: User;
  tester_notes?: string;
  reviewer_comments?: string;
  evidence_count: number;
}

// ── Risk Management Types ───────────────────────────────────────────────────

export type AssetType = "application" | "database" | "infrastructure" | "network" | "data" | "physical" | "process" | "people" | "cloud";
export type Criticality = "critical" | "high" | "medium" | "low";

export interface Asset {
  id: number;
  name: string;
  description?: string;
  asset_type?: AssetType;
  criticality?: Criticality;
  owner?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export type ThreatCategory = "cyber" | "access" | "data-breach" | "insider" | "physical" | "natural" | "compliance" | "operational";

export interface Threat {
  id: number;
  name: string;
  description?: string;
  threat_category?: ThreatCategory;
  source?: string;
  created_at: string;
  updated_at: string;
}

export type RiskTreatment = "mitigate" | "accept" | "transfer" | "avoid";
export type RiskStatus = "new" | "closed" | "managed_with_dates" | "managed_without_dates" | "unmanaged";

export interface RiskControl {
  id: number;
  risk_id: number;
  control_id: number;
  notes?: string;
  control?: { id: number; control_id: string; title: string; status: string; control_type?: string; frequency?: string; owner?: string; };
}

export interface Risk {
  id: number;
  name: string;
  description?: string;
  asset_id?: number;
  threat_id?: number;
  likelihood: number;
  impact: number;
  inherent_score: number;
  residual_likelihood?: number;
  residual_impact?: number;
  residual_score?: number;
  days_open: number;
  treatment?: RiskTreatment;
  status: RiskStatus;
  managed_start_date?: string;
  managed_end_date?: string;
  owner?: string;
  owner_id?: number;
  owner_user?: User;
  parent_risk_id?: number;
  parent_risk?: { id: number; name: string; status: string; likelihood: number; impact: number };
  child_count: number;
  created_at: string;
  updated_at: string;
  asset?: Asset;
  threat?: Threat;
  controls: RiskControl[];
  // Extended fields
  category?:              string;
  risk_type?:             string;
  risk_theme?:            string;
  source?:                string;
  department?:            string;
  owning_vp?:             string;
  stage?:                 string;
  target_likelihood?:     number;
  target_impact?:         number;
  target_score?:          number;
  date_identified?:       string;
  date_closed?:           string;
  closing_justification?: string;
  regulatory_compliance?: string;
}

export interface RiskListParams {
  status?: string;
  statuses?: string[];
  sort_by?: "name" | "likelihood" | "impact" | "status" | "created_at" | "updated_at";
  sort_dir?: "asc" | "desc";
  skip?: number;
  limit?: number;
}

export interface PaginatedRisks {
  items: Risk[];
  total: number;
  skip: number;
  limit: number;
}


export interface PciTestingBreakdown {
  total: number;
  never_tested: number;
  not_started: number;
  in_progress: number;
  needs_review: number;
  complete: number;
  failed: number;
}

export type ExceptionType   = "exception" | "risk_acceptance" | "compensating_control";
export type ExceptionStatus = "draft" | "pending_approval" | "approved" | "rejected" | "expired";
export type ExceptionRiskLevel = "critical" | "high" | "medium" | "low";

export interface ControlException {
  id: number;
  control_id: number;
  title: string;
  exception_type: ExceptionType;
  justification: string;
  compensating_control?: string;
  risk_level: ExceptionRiskLevel;
  status: ExceptionStatus;
  requested_by?: number;
  approved_by?: number;
  approver_notes?: string;
  expiry_date?: string;
  created_at: string;
  updated_at: string;
  requester?: { id: number; display_name: string; email: string; role: string };
  approver?:  { id: number; display_name: string; email: string; role: string };
  control?: { id: number; control_id: string; title: string; status: string };
  // 4B: lifecycle
  expires_at?: string;
  expiry_notified_at?: string;
  expired_at?: string;
  rejection_reason?: string;
  resubmission_count?: number;
  parent_exception_id?: number;
  decision_notified_at?: string;
}

// ── Approval Workflow Engine ─────────────────────────────────────────────────

export interface ApprovalPolicyStep {
  id: number;
  step_order: number;
  label: string;
  approver_user_id?: number;
  approver_role?: string;
  approver?: User;
}

export interface ApprovalEscalationRule {
  id: number;
  condition_field: string;
  condition_value: string;
  add_step_label: string;
  add_step_user_id?: number;
  add_step_role?: string;
  add_step_user?: User;
}

export interface ApprovalPolicy {
  id: number;
  name: string;
  description?: string;
  entity_type: string;
  is_default: boolean;
  created_at: string;
  steps: ApprovalPolicyStep[];
  escalation_rules: ApprovalEscalationRule[];
}

export type WorkflowStepStatus = "pending" | "approved" | "rejected";
export type WorkflowStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface ApprovalWorkflowStep {
  id: number;
  step_order: number;
  label: string;
  approver_user_id?: number;
  approver_role?: string;
  is_escalation: boolean;
  status: WorkflowStepStatus;
  decided_by_id?: number;
  decided_at?: string;
  notes?: string;
  approver?: User;
  decider?: User;
}

export interface ApprovalWorkflow {
  id: number;
  entity_type: string;
  entity_id: number;
  status: WorkflowStatus;
  current_step: number;
  created_at: string;
  completed_at?: string;
  creator?: User;
  steps: ApprovalWorkflowStep[];
}

// ─────────────────────────────────────────────────────────────────────────────

export interface RiskAgingBuckets {
  "0_30":    number;
  "30_60":   number;
  "60_90":   number;
  "90_180":  number;
  "180_365": number;
  "365_plus": number;
}

export interface DashboardStats {
  total_controls: number;
  active_controls: number;
  total_test_cycles: number;
  active_test_cycles: number;
  total_assignments: number;
  not_started: number;
  in_progress: number;
  needs_review: number;
  complete: number;
  failed: number;
  total_evidence: number;
  framework_coverage: Record<string, number>;
  deficiency_open: number;
  deficiency_in_remediation: number;
  deficiency_remediated: number;
  deficiency_risk_accepted: number;
  pci_testing: PciTestingBreakdown;
  exception_pending: number;
  exception_approved: number;
  exception_expiring_soon: number;
  risk_aging: RiskAgingBuckets;
}

// ── Risk Reviews ──────────────────────────────────────────────────────────────

export type ReviewCycleType   = "monthly" | "quarterly" | "yearly" | "ad_hoc";
export type ReviewCycleStatus = "draft" | "active" | "closed";
export type ReviewRequestStatus = "pending" | "updated" | "overdue";
export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface RiskReviewCycle {
  id:            number;
  label:         string;
  cycle_type:    ReviewCycleType;
  year?:         number;
  min_score:     number;
  severities?:   string;   // comma-sep: low,medium,high,critical
  status:        ReviewCycleStatus;
  scope_note?:   string;
  created_by?:   number;
  launched_at?:  string;
  closed_at?:    string;
  created_at:    string;
  // computed
  request_count: number;
  pending_count: number;
  updated_count: number;
}

export interface RiskReviewCycleDetail extends RiskReviewCycle {
  requests: RiskReviewRequest[];
}

export interface RiskReviewRequest {
  id:               number;
  cycle_id:         number;
  risk_id:          number;
  owner_id:         number;
  status:           ReviewRequestStatus;
  email_sent_at?:   string;
  last_reminded_at?: string;
  reminder_count:   number;
  created_at:       string;
  owner?:           User;
  updates:          RiskReviewUpdate[];
}

// ── Treatment Plans ──────────────────────────────────────────────────────────

export type TreatmentPlanStatus = "in_progress" | "completed" | "on_hold" | "cancelled";
export type MilestoneStatus = "open" | "in_progress" | "completed" | "overdue";

export interface TreatmentMilestone {
  id:             number;
  plan_id:        number;
  title:          string;
  description?:   string;
  assigned_to_id?: number;
  assigned_to?:   User;
  due_date?:      string;
  status:         MilestoneStatus;
  completed_at?:  string;
  sort_order:     number;
}

export interface TreatmentPlan {
  id:          number;
  risk_id:     number;
  strategy:    string;
  description?: string;
  owner_id?:   number;
  owner?:      User;
  target_date?: string;
  status:      TreatmentPlanStatus;
  created_at:  string;
  updated_at:  string;
  milestones:  TreatmentMilestone[];
}


export interface RiskReviewUpdate {
  id:                   number;
  request_id:           number;
  risk_id:              number;
  cycle_id:             number;
  submitted_by:         number;
  status_confirmed?:    string;
  mitigation_progress?: string;
  notes?:               string;
  submitted_at:         string;
  submitter?:           User;
  // 4C: GRC approval
  grc_review_status?: "pending_review" | "accepted" | "challenged";
  grc_reviewer_user_id?: number;
  grc_challenge_reason?: string;
  grc_reviewed_at?: string;
  owner_challenge_response?: string;
  owner_responded_at?: string;
}

export interface WorkItem {
  item_type: string;
  entity_id: number;
  entity_type: string;
  title: string;
  due_date?: string;
  days_overdue?: number;
  urgency: "critical" | "high" | "medium" | "low";
  url: string;
}

export interface AuditLogEntry {
  id:            number;
  timestamp:     string;
  action:        string;
  actor_email:   string | null;
  actor_role:    string | null;
  resource_type: string | null;
  resource_id:   number | null;
  resource_name: string | null;
  changes:       Record<string, { from: unknown; to: unknown }> | null;
  ip_address:    string | null;
  request_id:    string | null;
}
