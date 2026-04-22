import axios from "axios";
import { getToken, clearSession } from "./auth";
import { SESSION_ID, trackError } from "./telemetry";
import type {
  User, Control, TestCycle, TestCycleSummary,
  TestAssignment, DashboardStats, ControlCycleHistory, Deficiency,
  DeficiencyMilestone, Asset, Threat, Risk, TreatmentPlan, TreatmentMilestone,
  AuditLogEntry, ChecklistItem, Notification,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

const client = axios.create({
  baseURL: BASE,
  // withCredentials sends HttpOnly session cookies on every request.
  // In demo/token mode this is a no-op. In Okta/cookie mode it's required.
  withCredentials: true,
});

// ── Request interceptor ───────────────────────────────────────────────────────
// Attaches two headers to every outbound request:
//
//  X-Auth-Token   — demo mode session token (no-op in cookie/Okta mode)
//  X-Request-ID   — unique ID for this specific request, generated client-side.
//                   The backend echoes it in logs so you can find the exact
//                   server-side log entry for any frontend error report.
//                   Format: {session_id_prefix}-{timestamp}-{random}
client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["X-Auth-Token"] = token;

  // Correlation ID: session prefix + timestamp + random suffix
  const requestId = `${SESSION_ID.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  config.headers["X-Request-ID"] = requestId;
  // Store on config so the response interceptor can read it
  (config as any)._requestId = requestId;

  return config;
});

// ── Response interceptor ──────────────────────────────────────────────────────
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const requestId = (err.config as any)?._requestId;

    if (status === 401) {
      // Session expired or not authenticated — redirect to login
      clearSession();
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      const expired = err.response?.data?.detail === "session_expired";
      const base = `/login?redirect=${redirect}`;
      window.location.href = expired ? `${base}&reason=expired` : base;
    } else if (status >= 500) {
      // 5xx = server error — report to telemetry so we know about it
      // without waiting for a user to complain
      trackError(
        new Error(`API ${status}: ${err.config?.method?.toUpperCase()} ${err.config?.url} — ${err.response?.data?.detail ?? "server error"}`),
        { component: "api-client", request_id: requestId, severity: "error" }
      );
    }

    return Promise.reject(err);
  }
);

// ── Auth ───────────────────────────────────────────────────────────────────
type TokenResponse = { access_token: string; token_type: string; user: User };
export type AuthConfigResponse = {
  mode: "demo" | "idp" | "disabled";
  entra_enabled: boolean;
  okta_enabled: boolean;
  demo_enabled?: boolean;
  azure_client_id?: string;
  azure_tenant_id?: string;
  okta_domain?: string;
  okta_client_id?: string;
};

export const authApi = {
  login:      (username: string) =>
                client.post<TokenResponse>("/auth/login", { username }),
  azureLogin: (accessToken: string) =>
                client.post<TokenResponse>("/auth/azure-login", { access_token: accessToken }),
  oktaLogin:  (accessToken: string) =>
                client.post<TokenResponse>("/auth/okta-login", { access_token: accessToken }),
  config:     () =>
                client.get<AuthConfigResponse>("/auth/config"),
  // Verify the session cookie is still valid and return the current user.
  // Backend endpoint: GET /users/me (works for both token and cookie auth).
  me:         () =>
                client.get<User>("/users/me"),
  // Clears the server-side session cookie. In demo/token mode also
  // clears local sessionStorage via the interceptor chain.
  logout:     () =>
                client.post<void>("/auth/logout"),
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
  // 5A: deactivation
  openWork:     (id: number) =>
                  client.get<{ open_assignments: number; open_milestones: number; pending_risk_reviews: number; total: number }>(`/users/${id}/open-work`),
  deactivate:   (id: number, data: { reason: string; reassign_to_user_id?: number }) =>
                  client.post<{ deactivated: boolean; reassigned: Record<string, number>; open_work_summary: Record<string, number> }>(`/users/${id}/deactivate`, data),
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
  close:  (id: number) => client.post<TestCycle>(`/test-cycles/${id}/close`),
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
  submitForReview: (cycleId: number, assignmentId: number, signoffNote?: string) =>
    client.post<TestAssignment>(
      `/test-cycles/${cycleId}/assignments/${assignmentId}/submit`,
      { signoff_note: signoffNote ?? null }
    ),
  reviewerDecide: (
    cycleId: number,
    assignmentId: number,
    outcome: "approved" | "returned" | "failed",
    notes?: string,
    returnReason?: string,
  ) =>
    client.post<TestAssignment>(
      `/test-cycles/${cycleId}/assignments/${assignmentId}/decide`,
      { outcome, notes: notes ?? null, return_reason: returnReason ?? null }
    ),
  reopenEvidence: (cycleId: number, assignmentId: number, reason: string) =>
    client.post<TestAssignment>(
      `/test-cycles/${cycleId}/assignments/${assignmentId}/reopen-evidence`,
      { reason }
    ),
};

// ── Evidence ───────────────────────────────────────────────────────────────
export const evidenceApi = {
  list: (params?: import("@/types").EvidenceListParams) =>
    client.get<import("@/types").PaginatedEvidenceResponse>("/evidence", { params }),
  upload: (assignmentId: number, file: File, description: string, onProgress?: (pct: number) => void) => {
    const form = new FormData();
    form.append("assignment_id", String(assignmentId));
    form.append("description", description);
    form.append("file", file);
    return client.post("/evidence", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress
        ? (e) => { if (e.total) onProgress(Math.round((e.loaded * 100) / e.total)); }
        : undefined,
    });
  },
  download: (id: number) =>
    client.get(`/evidence/${id}/download`, { responseType: "blob" }),
  delete: (id: number) => client.delete(`/evidence/${id}`),
};

// ── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => client.get<DashboardStats>("/dashboard/stats"),
};

// ── Deficiencies ───────────────────────────────────────────────────────────
export const deficiencyApi = {
  list:          (status?: string)       => client.get<Deficiency[]>("/deficiencies", { params: { status } }),
  create:        (data: unknown)         => client.post<Deficiency>("/deficiencies", data),
  update:        (id: number, data: unknown) => client.patch<Deficiency>(`/deficiencies/${id}`, data),
  delete:        (id: number)            => client.delete(`/deficiencies/${id}`),
  promoteToRisk: (id: number, data: unknown) => client.post<Deficiency>(`/deficiencies/${id}/promote-to-risk`, data),
  linkRisk:      (id: number, riskId: number) => client.post<Deficiency>(`/deficiencies/${id}/link-risk`, { risk_id: riskId }),
  unlinkRisk:    (id: number)            => client.delete<Deficiency>(`/deficiencies/${id}/link-risk`),
  // 4A: retest
  createRetest:  (id: number, data: { cycle_id: number; assigned_to_user_id: number }) =>
                   client.post<import("@/types").TestAssignment>(`/deficiencies/${id}/create-retest`, data),
  waiveRetest:   (id: number, reason: string) =>
                   client.post<Deficiency>(`/deficiencies/${id}/waive-retest`, { reason }),
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
  list:          (params?: import("@/types").RiskListParams) =>
                   client.get<import("@/types").PaginatedRisks>("/risks", {
                     params: params
                       ? { ...params, statuses: params.statuses?.join(",") }
                       : undefined,
                   }),
  get:           (id: number)                => client.get<Risk>(`/risks/${id}`),
  create:        (data: unknown)             => client.post<Risk>("/risks", data),
  update:        (id: number, data: unknown) => client.patch<Risk>(`/risks/${id}`, data),
  delete:        (id: number)                => client.delete(`/risks/${id}`),
  linkControl:   (riskId: number, data: unknown) => client.post(`/risks/${riskId}/controls`, data),
  unlinkControl: (riskId: number, controlId: number) => client.delete(`/risks/${riskId}/controls/${controlId}`),
  forControl:    (controlId: number)         => client.get<Risk[]>(`/risks/by-control/${controlId}`),
  bulkImport:    (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return client.post<{ created: number; errors: { row: number; name: string; error: string }[]; created_items: { row: number; id: number; name: string }[] }>(
      "/risks/bulk-import", fd, { headers: { "Content-Type": "multipart/form-data" } }
    );
  },
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
  approve:    (id: number, notes?: string) =>
                client.post<import("@/types").ControlException>(`/exceptions/${id}/approve`, notes ? { notes } : null),
  reject:     (id: number, rejectionReason: string) =>
                client.post<import("@/types").ControlException>(`/exceptions/${id}/reject`, { rejection_reason: rejectionReason }),
  resubmit:   (id: number) =>
                client.post<import("@/types").ControlException>(`/exceptions/${id}/resubmit`),
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

  createCycle:    (data: { label: string; cycle_type: string; year?: number; scope_note?: string; min_score?: number; severities?: string }) =>
    client.post<RiskReviewCycle>("/risk-reviews/cycles", data),

  getCycle:       (id: number) =>
    client.get<RiskReviewCycleDetail>(`/risk-reviews/cycles/${id}`),

  closeCycle:     (id: number) =>
    client.patch<RiskReviewCycle>(`/risk-reviews/cycles/${id}/close`, {}),

  populateCycle:  (id: number) =>
    client.post<{ requests_created: number; skipped_no_owner: number }>(
      `/risk-reviews/cycles/${id}/populate`
    ),

  notifyOwner:    (cycleId: number, ownerId: number) =>
    client.post<{ email_sent: boolean; risks_count: number }>(
      `/risk-reviews/cycles/${cycleId}/notify-owner/${ownerId}`
    ),

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

  // 4C: GRC approval
  acceptUpdate:   (updateId: number) =>
    client.post<RiskReviewUpdate>(`/risk-reviews/updates/${updateId}/accept`),
  challengeUpdate: (updateId: number, reason: string) =>
    client.post<RiskReviewUpdate>(`/risk-reviews/updates/${updateId}/challenge`, { reason }),
  respondToChallenge: (updateId: number, response: string) =>
    client.post<RiskReviewUpdate>(`/risk-reviews/updates/${updateId}/respond`, { response }),
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

export const auditApi = {
  list: (params?: { resource_type?: string; action?: string; actor_email?: string; resource_id?: number; limit?: number; offset?: number }) =>
    client.get<{ total: number; items: AuditLogEntry[] }>("/audit-logs", { params }),
};

// ── Deficiency Milestones ─────────────────────────────────────────────────────
export const deficiencyMilestoneApi = {
  list:   (deficiencyId: number) =>
    client.get<DeficiencyMilestone[]>(`/deficiencies/${deficiencyId}/milestones`),
  create: (deficiencyId: number, data: { title: string; due_date?: string; assignee_id?: number; notes?: string }) =>
    client.post<DeficiencyMilestone>(`/deficiencies/${deficiencyId}/milestones`, data),
  update: (deficiencyId: number, milestoneId: number, data: { title?: string; due_date?: string; assignee_id?: number; status?: string; notes?: string }) =>
    client.patch<DeficiencyMilestone>(`/deficiencies/${deficiencyId}/milestones/${milestoneId}`, data),
  delete: (deficiencyId: number, milestoneId: number) =>
    client.delete(`/deficiencies/${deficiencyId}/milestones/${milestoneId}`),
  requestExtension: (deficiencyId: number, milestoneId: number, reason: string) =>
    client.post<DeficiencyMilestone>(
      `/deficiencies/${deficiencyId}/milestones/${milestoneId}/request-extension`,
      { reason }
    ),
  approveExtension: (deficiencyId: number, milestoneId: number, newDueDate: string) =>
    client.post<DeficiencyMilestone>(
      `/deficiencies/${deficiencyId}/milestones/${milestoneId}/approve-extension`,
      { new_due_date: newDueDate }
    ),
  rejectExtension: (deficiencyId: number, milestoneId: number) =>
    client.post<DeficiencyMilestone>(
      `/deficiencies/${deficiencyId}/milestones/${milestoneId}/reject-extension`
    ),
};

// ── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  mine:     ()           => client.get<Notification[]>("/notifications/me"),
  markRead: (id: number) => client.post(`/notifications/${id}/read`),
};

// ── My Work Queue ────────────────────────────────────────────────────────────
export const myWorkApi = {
  queue: () => client.get<import("@/types").WorkItem[]>("/my-work/queue"),
};

// ── Checklist ─────────────────────────────────────────────────────────────────
export const checklistApi = {
  list:   (assignmentId: number) =>
    client.get<ChecklistItem[]>(`/assignments/${assignmentId}/checklist`),
  create: (assignmentId: number, title: string, sortOrder = 0) =>
    client.post<ChecklistItem>(`/assignments/${assignmentId}/checklist`, { title, sort_order: sortOrder }),
  update: (assignmentId: number, itemId: number, data: { title?: string; completed?: boolean; sort_order?: number }) =>
    client.patch<ChecklistItem>(`/assignments/${assignmentId}/checklist/${itemId}`, data),
  delete: (assignmentId: number, itemId: number) =>
    client.delete(`/assignments/${assignmentId}/checklist/${itemId}`),
};
