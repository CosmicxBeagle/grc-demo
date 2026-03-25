export type Role = "admin" | "tester" | "reviewer";

export interface User {
  id: number;
  username: string;
  display_name: string;
  email: string;
  role: Role;
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
  treatment?: RiskTreatment;
  status: RiskStatus;
  owner?: string;
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
}
