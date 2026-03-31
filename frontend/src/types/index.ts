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

export interface Deficiency {
  id: number;
  assignment_id: number;
  title: string;
  description?: string;
  severity: DeficiencySeverity;
  remediation_plan?: string;
  status: DeficiencyStatus;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceSummary {
  id: number;
  original_filename: string;
  description?: string;
  uploaded_at: string;
  uploaded_by: number;
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
  created_at: string;
  updated_at: string;
  control?: Control;
  tester?: User;
  reviewer?: User;
  evidence: EvidenceSummary[];
  deficiencies: Deficiency[];
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

export type AssetType = "application" | "database" | "infrastructure" | "network" | "data" | "physical" | "process" | "people";
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
export type RiskStatus = "open" | "mitigated" | "accepted" | "transferred" | "closed";

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
  owner?: string;
  owner_id?: number;
  owner_user?: User;
  created_at: string;
  updated_at: string;
  asset?: Asset;
  threat?: Threat;
  controls: RiskControl[];
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

export type ReviewCycleType   = "jan" | "jul" | "quarterly" | "monthly" | "ad_hoc";
export type ReviewCycleStatus = "draft" | "active" | "closed";
export type ReviewRequestStatus = "pending" | "updated" | "overdue";

export interface RiskReviewCycle {
  id:            number;
  label:         string;
  cycle_type:    ReviewCycleType;
  year?:         number;
  min_score:     number;
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
