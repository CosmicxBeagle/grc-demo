import axios from "axios";
import { getToken, clearSession } from "./auth";
import type {
  User, Control, TestCycle, TestCycleSummary,
  TestAssignment, DashboardStats, ControlCycleHistory, Deficiency,
  Asset, Threat, Risk, TreatmentPlan, TreatmentMilestone,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

const client = axios.create({ baseURL: BASE });

// Attach token to every request
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["X-Auth-Token"] = token;
  return config;
});

// Redirect to login on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearSession();
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ───────────────────────────────────────────────────────────────────
type TokenResponse = { access_token: string; token_type: string; user: User };

export const authApi = {
  login:      (username: string) =>
                client.post<TokenResponse>("/auth/login", { username }),
  azureLogin: (accessToken: string) =>
                client.post<TokenResponse>("/auth/azure-login", { access_token: accessToken }),
  oktaLogin:  (accessToken: string) =>
                client.post<TokenResponse>("/auth/okta-login", { access_token: accessToken }),
  config:     () =>
                client.get<{
                  mode: "demo" | "idp";
                  entra_enabled: boolean;
                  okta_enabled: boolean;
                  azure_client_id?: string;
                  azure_tenant_id?: string;
                  okta_domain?: string;
                  okta_client_id?: string;
                }>("/auth/config"),
};

export const userMgmtApi = {
  list:         (status?: string) =>
                  client.get<User[]>("/users", { params: status ? { status } : {} }),
  create:       (data: { display_name: string; email: string; role: string; department?: string; job_title?: string }) =>
                  client.post<User>("/users", data),
  updateRole:   (id: number, role: string) =>
                  client.patch<User>(`/users/${id}/role`, { role }),
  updateStatus: (id: number, status: "active" | "inactive") =>
                  client.patch<User>(`/users/${id}/status`, { status }),
  delete:       (id: number) =>
                  client.delete(`/users/${id}`),
};

// ── Users ──────────────────────────────────────────────────────────────────
export const usersApi = {
  list: ()           => client.get<User[]>("/users"),
  me:   ()           => client.get<User>("/users/me"),
  get:  (id: number) => client.get<User>(`/users/${id}`),
};

// ── Controls ───────────────────────────────────────────────────────────────
export const controlsApi = {
  list:   (status?: string) => client.get<Control[]>("/controls", { params: { status } }),
  get:    (id: number)      => client.get<Control>(`/controls/${id}`),
  cycles: (id: number)      => client.get<ControlCycleHistory[]>(`/controls/${id}/cycles`),
  create: (data: unknown)   => client.post<Control>("/controls", data),
  update: (id: number, data: unknown) => client.patch<Control>(`/controls/${id}`, data),
  delete: (id: number)      => client.delete(`/controls/${id}`),
};

// ── Test Cycles ────────────────────────────────────────────────────────────
export const cyclesApi = {
  list:   ()            => client.get<TestCycleSummary[]>("/test-cycles"),
  get:    (id: number)  => client.get<TestCycle>(`/test-cycles/${id}`),
  create: (data: unknown) => client.post<TestCycle>("/test-cycles", data),
  update: (id: number, data: unknown) => client.patch<TestCycle>(`/test-cycles/${id}`, data),
  addAssignment: (cycleId: number, data: unknown) =>
    client.post<TestAssignment>(`/test-cycles/${cycleId}/assignments`, data),
  bulkAddFramework: (cycleId: number, framework: string) =>
    client.post<{ added: number; framework: string }>(
      `/test-cycles/${cycleId}/assignments/bulk-framework`,
      null,
      { params: { framework } }
    ),
  updateAssignment: (cycleId: number, assignmentId: number, data: unknown) =>
    client.patch<TestAssignment>(
      `/test-cycles/${cycleId}/assignments/${assignmentId}`,
      data
    ),
};

// ── Evidence ───────────────────────────────────────────────────────────────
export const evidenceApi = {
  upload: (assignmentId: number, file: File, description: string) => {
    const form = new FormData();
    form.append("assignment_id", String(assignmentId));
    form.append("description", description);
    form.append("file", file);
    return client.post("/evidence", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  delete: (id: number) => client.delete(`/evidence/${id}`),
};

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => client.get<DashboardStats>("/dashboard/stats"),
};

// ── Deficiencies ───────────────────────────────────────────────────────────
export const deficiencyApi = {
  list:   (status?: string) => client.get<Deficiency[]>("/deficiencies", { params: { status } }),
  create: (data: unknown)   => client.post<Deficiency>("/deficiencies", data),
  update: (id: number, data: unknown) => client.patch<Deficiency>(`/deficiencies/${id}`, data),
  delete: (id: number)      => client.delete(`/deficiencies/${id}`),
};

// ── Assets ──────────────────────────────────────────────────────────────────
export const assetsApi = {
  list:   ()                          => client.get<Asset[]>("/assets"),
  create: (data: unknown)             => client.post<Asset>("/assets", data),
  update: (id: number, data: unknown) => client.patch<Asset>(`/assets/${id}`, data),
  delete: (id: number)                => client.delete(`/assets/${id}`),
};

// ── Threats ─────────────────────────────────────────────────────────────────
export const threatsApi = {
  list:   ()                          => client.get<Threat[]>("/threats"),
  create: (data: unknown)             => client.post<Threat>("/threats", data),
  update: (id: number, data: unknown) => client.patch<Threat>(`/threats/${id}`, data),
  delete: (id: number)                => client.delete(`/threats/${id}`),
};

// ── Exports ──────────────────────────────────────────────────────────────────
// Downloads a file from a backend export endpoint and triggers browser save.
export async function downloadExport(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { "X-Auth-Token": token } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Risks ────────────────────────────────────────────────────────────────────
export const risksApi = {
  list:          ()                          => client.get<Risk[]>("/risks"),
  get:           (id: number)                => client.get<Risk>(`/risks/${id}`),
  create:        (data: unknown)             => client.post<Risk>("/risks", data),
  update:        (id: number, data: unknown) => client.patch<Risk>(`/risks/${id}`, data),
  delete:        (id: number)                => client.delete(`/risks/${id}`),
  linkControl:   (riskId: number, data: unknown) => client.post(`/risks/${riskId}/controls`, data),
  unlinkControl: (riskId: number, controlId: number) => client.delete(`/risks/${riskId}/controls/${controlId}`),
  forControl:    (controlId: number)         => client.get<Risk[]>(`/risks/by-control/${controlId}`),
};

// ── Control Exceptions ───────────────────────────────────────────────────────
export const exceptionsApi = {
  list:       (params?: { status?: string; control_id?: number }) =>
                client.get<import("@/types").ControlException[]>("/exceptions", { params }),
  get:        (id: number) =>
                client.get<import("@/types").ControlException>(`/exceptions/${id}`),
  create:     (data: unknown) =>
                client.post<import("@/types").ControlException>("/exceptions", data),
  update:     (id: number, data: unknown) =>
                client.patch<import("@/types").ControlException>(`/exceptions/${id}`, data),
  approve:    (id: number, approverId: number, notes?: string) =>
                client.post(`/exceptions/${id}/approve`, null, { params: { approver_id: approverId, approver_notes: notes } }),
  reject:     (id: number, approverId: number, notes?: string) =>
                client.post(`/exceptions/${id}/reject`, null, { params: { approver_id: approverId, approver_notes: notes } }),
  delete:     (id: number) =>
                client.delete(`/exceptions/${id}`),
};

// ── Approval Workflow Engine ──────────────────────────────────────────────────
import type {
  ApprovalPolicy, ApprovalWorkflow,
  RiskReviewCycle, RiskReviewCycleDetail, RiskReviewRequest, RiskReviewUpdate,
} from "@/types";

export const approvalsApi = {
  // Policies
  listPolicies:   (entity_type?: string) =>
                    client.get<ApprovalPolicy[]>("/approvals/policies", { params: entity_type ? { entity_type } : {} }),
  getPolicy:      (id: number) =>
                    client.get<ApprovalPolicy>(`/approvals/policies/${id}`),
  createPolicy:   (data: unknown) =>
                    client.post<ApprovalPolicy>("/approvals/policies", data),
  updatePolicy:   (id: number, data: unknown) =>
                    client.put<ApprovalPolicy>(`/approvals/policies/${id}`, data),
  deletePolicy:   (id: number) =>
                    client.delete(`/approvals/policies/${id}`),

  // Workflows
  createWorkflow: (data: { policy_id: number; entity_type: string; entity_id: number }) =>
                    client.post<ApprovalWorkflow>("/approvals/workflows", data),
  myQueue:        () =>
                    client.get<ApprovalWorkflow[]>("/approvals/workflows/queue"),
  getForEntity:   (entity_type: string, entity_id: number) =>
                    client.get<ApprovalWorkflow | null>(`/approvals/workflows/entity/${entity_type}/${entity_id}`),
  decide:         (workflow_id: number, decision: "approved" | "rejected", notes?: string) =>
                    client.post<ApprovalWorkflow>(`/approvals/workflows/${workflow_id}/decide`, { decision, notes }),
};

// ── Risk Reviews ──────────────────────────────────────────────────────────────
export const riskReviewsApi = {
  listCycles:     () =>
    client.get<RiskReviewCycle[]>("/risk-reviews/cycles"),

  createCycle:    (data: { label: string; cycle_type: string; year?: number; scope_note?: string; min_score?: number }) =>
    client.post<RiskReviewCycle>("/risk-reviews/cycles", data),

  getCycle:       (id: number) =>
    client.get<RiskReviewCycleDetail>(`/risk-reviews/cycles/${id}`),

  closeCycle:     (id: number) =>
    client.patch<RiskReviewCycle>(`/risk-reviews/cycles/${id}/close`, {}),

  launchCycle:    (id: number) =>
    client.post<{ emails_sent: number; requests_created: number; skipped_no_owner: number }>(
      `/risk-reviews/cycles/${id}/launch`
    ),

  sendReminders:  (id: number, threshold_days = 7) =>
    client.post<{ reminders_sent: number; pending_owners: number }>(
      `/risk-reviews/cycles/${id}/remind`, null, { params: { threshold_days } }
    ),

  myPending:      () =>
    client.get<RiskReviewRequest[]>("/risk-reviews/requests/my"),

  submitUpdate:   (requestId: number, data: { status_confirmed?: string; mitigation_progress?: string; notes?: string }) =>
    client.post<RiskReviewUpdate>(`/risk-reviews/requests/${requestId}/update`, data),

  riskHistory:    (riskId: number) =>
    client.get<RiskReviewUpdate[]>(`/risk-reviews/history/${riskId}`),
};

// ── Treatment Plans ────────────────────────────────────────────────────────
export const treatmentPlansApi = {
  getByRisk:       (riskId: number) =>
    client.get<TreatmentPlan | null>(`/treatment-plans/risk/${riskId}`),
  create:          (data: { risk_id: number; strategy: string; description?: string; owner_id?: number; target_date?: string }) =>
    client.post<TreatmentPlan>("/treatment-plans", data),
  update:          (planId: number, data: Partial<{ strategy: string; description: string; owner_id: number; target_date: string; status: string }>) =>
    client.put<TreatmentPlan>(`/treatment-plans/${planId}`, data),
  deletePlan:      (planId: number) =>
    client.delete(`/treatment-plans/${planId}`),
  addMilestone:    (planId: number, data: { title: string; description?: string; assigned_to_id?: number; due_date?: string; sort_order?: number }) =>
    client.post<TreatmentMilestone>(`/treatment-plans/${planId}/milestones`, data),
  updateMilestone: (milestoneId: number, data: Partial<{ title: string; description: string; assigned_to_id: number; due_date: string; status: string; sort_order: number }>) =>
    client.put<TreatmentMilestone>(`/treatment-plans/milestones/${milestoneId}`, data),
  deleteMilestone: (milestoneId: number) =>
    client.delete(`/treatment-plans/milestones/${milestoneId}`),
};
