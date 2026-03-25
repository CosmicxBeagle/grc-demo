import axios from "axios";
import { getToken, clearSession } from "./auth";
import type {
  User, Control, TestCycle, TestCycleSummary,
  TestAssignment, DashboardStats, ControlCycleHistory, Deficiency,
  Asset, Threat, Risk,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
export const authApi = {
  login: (username: string) =>
    client.post<{ access_token: string; token_type: string; user: User }>(
      "/auth/login",
      { username }
    ),
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
