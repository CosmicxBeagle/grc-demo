"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { userMgmtApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { User } from "@/types";
import {
  PlusIcon, PencilSquareIcon, TrashIcon,
  CheckCircleIcon, XCircleIcon, ClockIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES = [
  { value: "admin",       label: "Admin",        desc: "Full system access, user management" },
  { value: "grc_manager", label: "GRC Manager",  desc: "Manage policies, approve exceptions, assign tests" },
  { value: "grc_analyst", label: "GRC Analyst",  desc: "Perform testing, manage risks and exceptions" },
  { value: "tester",      label: "Tester",       desc: "Test controls, upload evidence" },
  { value: "reviewer",    label: "Reviewer",     desc: "Review test results, approve/reject" },
  { value: "risk_owner",  label: "Risk Owner",   desc: "Update assigned risks, respond to review requests" },
  { value: "viewer",      label: "Viewer",       desc: "Read-only access (auditors, leadership)" },
] as const;

const IDP_LABELS: Record<string, string> = {
  local: "Local",
  entra: "Entra ID",
  okta:  "Okta",
};

const IDP_COLORS: Record<string, string> = {
  local: "bg-gray-100 text-gray-600",
  entra: "bg-blue-100 text-blue-700",
  okta:  "bg-sky-100 text-sky-700",
};

const ROLE_COLORS: Record<string, string> = {
  admin:       "bg-red-100 text-red-700",
  grc_manager: "bg-purple-100 text-purple-700",
  grc_analyst: "bg-indigo-100 text-indigo-700",
  tester:      "bg-blue-100 text-blue-700",
  reviewer:    "bg-teal-100 text-teal-700",
  risk_owner:  "bg-orange-100 text-orange-700",
  viewer:      "bg-gray-100 text-gray-600",
};

function StatusIcon({ status }: { status?: string }) {
  if (status === "active")   return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
  if (status === "inactive") return <XCircleIcon     className="w-4 h-4 text-red-400"   />;
  return <ClockIcon className="w-4 h-4 text-yellow-400" />;
}

// ── Invite modal ──────────────────────────────────────────────────────────────

function InviteModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const [form, setForm] = useState({ display_name: "", email: "", role: "viewer", department: "", job_title: "" });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const save = async () => {
    if (!form.display_name || !form.email) { setError("Name and email are required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await userMgmtApi.create({
        display_name: form.display_name,
        email:        form.email,
        role:         form.role,
        department:   form.department || undefined,
        job_title:    form.job_title  || undefined,
      });
      onSaved(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Add User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            This creates a placeholder. The user's account will be fully activated when they first sign in via Okta or Entra ID using this email address.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="Jane Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="jane.smith@company.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <input
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                placeholder="e.g. Security"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job Title</label>
              <input
                value={form.job_title}
                onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))}
                placeholder="e.g. GRC Analyst"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <button onClick={onClose} className="text-sm text-gray-500 px-4 py-2 hover:text-gray-700">Cancel</button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-5 py-2 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add User"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function UsersSettingsPage() {
  const [users,      setUsers]      = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [editRole,   setEditRole]   = useState<{ userId: number; current: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const currentUser = getUser();

  const load = () => {
    userMgmtApi.list()
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRoleChange = async (userId: number, role: string) => {
    await userMgmtApi.updateRole(userId, role);
    setEditRole(null);
    load();
  };

  const toggleStatus = async (user: User) => {
    const next = user.status === "active" ? "inactive" : "active";
    if (!confirm(`${next === "inactive" ? "Deactivate" : "Reactivate"} ${user.display_name}?`)) return;
    await userMgmtApi.updateStatus(user.id, next as "active" | "inactive");
    load();
  };

  const deleteUser = async (user: User) => {
    if (!confirm(`Permanently delete ${user.display_name}? This cannot be undone.`)) return;
    await userMgmtApi.delete(user.id);
    load();
  };

  const filtered = statusFilter === "all" ? users : users.filter(u => u.status === statusFilter);

  const counts = {
    active:   users.filter(u => u.status === "active").length,
    inactive: users.filter(u => u.status === "inactive").length,
    pending:  users.filter(u => u.status === "pending").length,
  };

  return (
    <AppShell>
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheckIcon className="w-6 h-6 text-brand-600" />
            User Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage who has access and what they can do
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active",   value: counts.active,   color: "green"  },
          { label: "Inactive", value: counts.inactive, color: "red"    },
          { label: "Pending",  value: counts.pending,  color: "yellow" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold text-${s.color}-600`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all", "active", "inactive", "pending"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              statusFilter === s
                ? "bg-brand-600 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {s === "all" ? `All (${users.length})` : `${s} (${counts[s as keyof typeof counts] ?? 0})`}
          </button>
        ))}
      </div>

      {/* User table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Identity</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3"/>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  {/* User info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold uppercase shrink-0">
                        {user.display_name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.display_name}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                        {(user.job_title || user.department) && (
                          <div className="text-xs text-gray-400">
                            {[user.job_title, user.department].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Role — editable */}
                  <td className="px-4 py-3">
                    {editRole?.userId === user.id ? (
                      <select
                        autoFocus
                        defaultValue={user.role}
                        onChange={e => handleRoleChange(user.id, e.target.value)}
                        onBlur={() => setEditRole(null)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      >
                        {ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditRole({ userId: user.id, current: user.role })}
                        disabled={user.id === currentUser?.id}
                        className="group flex items-center gap-1.5 disabled:cursor-default"
                        title={user.id === currentUser?.id ? "Cannot change your own role" : "Click to change role"}
                      >
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                          {ROLES.find(r => r.value === user.role)?.label ?? user.role}
                        </span>
                        {user.id !== currentUser?.id && (
                          <PencilSquareIcon className="w-3.5 h-3.5 text-gray-300 group-hover:text-brand-500 transition-colors" />
                        )}
                      </button>
                    )}
                  </td>

                  {/* Identity provider */}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${IDP_COLORS[user.identity_provider ?? "local"] ?? "bg-gray-100 text-gray-600"}`}>
                      {IDP_LABELS[user.identity_provider ?? "local"] ?? user.identity_provider}
                    </span>
                  </td>

                  {/* Last login */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleDateString()
                      : "Never"}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={user.status} />
                      <span className="text-xs text-gray-600 capitalize">{user.status ?? "active"}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {user.id !== currentUser?.id && (
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => toggleStatus(user)}
                          title={user.status === "active" ? "Deactivate" : "Activate"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            user.status === "active"
                              ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                              : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                          }`}
                        >
                          {user.status === "active"
                            ? <XCircleIcon     className="w-4 h-4" />
                            : <CheckCircleIcon className="w-4 h-4" />
                          }
                        </button>
                        <button
                          onClick={() => deleteUser(user)}
                          title="Delete user"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">No users found.</div>
          )}
        </div>
      )}

      {/* Role legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Role Reference</p>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-start gap-2">
              <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[r.value]}`}>
                {r.label}
              </span>
              <span className="text-xs text-gray-500">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onSaved={u => { setUsers(prev => [u, ...prev]); setShowInvite(false); }}
        />
      )}
    </div>
    </AppShell>
  );
}
