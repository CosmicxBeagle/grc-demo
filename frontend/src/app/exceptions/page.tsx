"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { exceptionsApi, approvalsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { ControlException, ExceptionStatus, ExceptionType, ApprovalWorkflow, ApprovalPolicy } from "@/types";
import ApprovalTimeline from "@/components/ApprovalTimeline";
import {
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  NoSymbolIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

// ── helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ExceptionStatus, string> = {
  draft:            "bg-gray-100 text-gray-600",
  pending_approval: "bg-yellow-100 text-yellow-700",
  approved:         "bg-green-100 text-green-700",
  rejected:         "bg-red-100 text-red-700",
  expired:          "bg-slate-100 text-slate-500",
};

const STATUS_LABELS: Record<ExceptionStatus, string> = {
  draft:            "Draft",
  pending_approval: "Pending Approval",
  approved:         "Approved",
  rejected:         "Rejected",
  expired:          "Expired",
};

const TYPE_LABELS: Record<ExceptionType, string> = {
  exception:             "Exception",
  risk_acceptance:       "Risk Acceptance",
  compensating_control:  "Compensating Control",
};

const RISK_COLORS: Record<string, string> = {
  critical: "text-red-700 bg-red-50 border-red-200",
  high:     "text-orange-700 bg-orange-50 border-orange-200",
  medium:   "text-yellow-700 bg-yellow-50 border-yellow-200",
  low:      "text-green-700 bg-green-50 border-green-200",
};

const ALL_STATUSES: ExceptionStatus[] = ["pending_approval", "approved", "draft", "rejected", "expired"];

function daysTill(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  return Math.ceil((d.getTime() - today.getTime()) / 86_400_000);
}

// ── modal ────────────────────────────────────────────────────────────────────

interface FormState {
  control_id: string;
  title: string;
  exception_type: ExceptionType;
  justification: string;
  compensating_control: string;
  risk_level: string;
  expiry_date: string;
}

const BLANK: FormState = {
  control_id: "",
  title: "",
  exception_type: "exception",
  justification: "",
  compensating_control: "",
  risk_level: "high",
  expiry_date: "",
};

function ExceptionModal({
  onClose,
  onSaved,
  userId,
}: {
  onClose: () => void;
  onSaved: (e: ControlException) => void;
  userId?: number;
}) {
  const [form, setForm] = useState<FormState>(BLANK);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.control_id || !form.title || !form.justification) return;
    setSaving(true);
    try {
      const res = await exceptionsApi.create({
        control_id: Number(form.control_id),
        title: form.title,
        exception_type: form.exception_type,
        justification: form.justification,
        compensating_control: form.compensating_control || null,
        risk_level: form.risk_level,
        expiry_date: form.expiry_date || null,
        requested_by: userId ?? null,
      });
      onSaved(res.data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">New Exception / Risk Acceptance</h2>
          <button onClick={onClose}><XMarkIcon className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Control ID (numeric)</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.control_id}
                onChange={(e) => setForm({ ...form, control_id: e.target.value })}
                placeholder="e.g. 12"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.exception_type}
                onChange={(e) => setForm({ ...form, exception_type: e.target.value as ExceptionType })}
              >
                <option value="exception">Exception</option>
                <option value="risk_acceptance">Risk Acceptance</option>
                <option value="compensating_control">Compensating Control</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Brief description of the exception"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Business Justification *</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
              placeholder="Why can't this control be implemented? What is the business reason?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Compensating Control</label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              value={form.compensating_control}
              onChange={(e) => setForm({ ...form, compensating_control: e.target.value })}
              placeholder="What alternative mitigates the risk while the exception is active?"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Residual Risk Level</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.risk_level}
                onChange={(e) => setForm({ ...form, risk_level: e.target.value })}
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Expiry Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.expiry_date}
                onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving || !form.control_id || !form.title || !form.justification}
            className="px-4 py-2 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Workflow panel (loaded lazily when row is expanded) ───────────────────────

function ExceptionWorkflowPanel({
  exceptionId,
  userId,
  userRole,
  onRefresh,
}: {
  exceptionId: number;
  userId?: number;
  userRole?: string;
  onRefresh: () => void;
}) {
  const [workflow, setWorkflow] = useState<ApprovalWorkflow | null | undefined>(undefined);
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [starting, setStarting] = useState(false);
  const [selPolicy, setSelPolicy] = useState<number | "">("");

  useEffect(() => {
    Promise.all([
      approvalsApi.getForEntity("exception", exceptionId),
      approvalsApi.listPolicies("exception"),
    ]).then(([wfRes, polRes]) => {
      setWorkflow(wfRes.data ?? null);
      setPolicies(polRes.data);
      if (polRes.data.length > 0) setSelPolicy(polRes.data[0].id);
    }).catch(() => setWorkflow(null));
  }, [exceptionId]);

  const startWorkflow = async () => {
    if (!selPolicy) return;
    setStarting(true);
    try {
      const res = await approvalsApi.createWorkflow({
        policy_id: selPolicy as number,
        entity_type: "exception",
        entity_id: exceptionId,
      });
      setWorkflow(res.data);
      onRefresh();
    } finally {
      setStarting(false);
    }
  };

  if (workflow === undefined) return <p className="text-xs text-gray-400">Loading workflow…</p>;

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      {workflow ? (
        <ApprovalTimeline
          workflow={workflow}
          currentUserId={userId}
          currentUserRole={userRole}
          onDecision={() => {
            approvalsApi.getForEntity("exception", exceptionId).then(r => setWorkflow(r.data ?? null));
            onRefresh();
          }}
        />
      ) : policies.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Start Approval Workflow</p>
          <div className="flex items-center gap-2">
            <select
              value={selPolicy}
              onChange={e => setSelPolicy(e.target.value ? +e.target.value : "")}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={startWorkflow}
              disabled={starting || !selPolicy}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-1.5 disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">
          No approval policies defined.{" "}
          <a href="/settings/approvals" className="text-brand-600 hover:underline">Create one in Settings →</a>
        </p>
      )}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function ExceptionsPage() {
  const [exceptions, setExceptions] = useState<ControlException[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExceptionStatus | "all">("all");
  const [showModal, setShowModal]   = useState(false);
  const [expanded, setExpanded]     = useState<number | null>(null);
  const user = getUser();

  const load = () => {
    exceptionsApi.list().then((r) => {
      setExceptions(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = statusFilter === "all"
    ? exceptions
    : exceptions.filter((e) => e.status === statusFilter);

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = exceptions.filter((e) => e.status === s).length;
    return acc;
  }, {});

  const handleApprove = async (id: number) => {
    if (!user) return;
    await exceptionsApi.approve(id, user.id);
    load();
  };

  const handleReject = async (id: number) => {
    if (!user) return;
    const notes = prompt("Reason for rejection (optional):");
    await exceptionsApi.reject(id, user.id, notes ?? undefined);
    load();
  };

  const handleStatusChange = async (id: number, status: string) => {
    await exceptionsApi.update(id, { status });
    load();
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control Exceptions</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {exceptions.length} total · {counts["pending_approval"] ?? 0} pending approval
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            New Exception
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === "all" ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            All ({exceptions.length})
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {STATUS_LABELS[s]} {counts[s] > 0 && `(${counts[s]})`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <ExclamationCircleIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No exceptions found.</p>
            <p className="text-sm text-gray-400 mt-1">Create one when a control cannot be implemented and a formal risk acceptance is needed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((exc) => {
              const days = daysTill(exc.expiry_date);
              const isExpanded = expanded === exc.id;

              return (
                <div key={exc.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Row header */}
                  <button
                    className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : exc.id)}
                  >
                    {/* Risk level pill */}
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold uppercase ${RISK_COLORS[exc.risk_level]}`}>
                      {exc.risk_level}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{exc.title}</span>
                        <span className="text-xs text-gray-400">{TYPE_LABELS[exc.exception_type]}</span>
                      </div>
                      {exc.control && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Control:{" "}
                          <Link
                            href={`/controls/${exc.control.id}`}
                            className="text-brand-600 hover:underline font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {exc.control.control_id}
                          </Link>
                          {" — "}{exc.control.title}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Expiry */}
                      {exc.expiry_date && (
                        <span className={`text-xs flex items-center gap-1 ${days !== null && days <= 30 ? "text-red-600 font-semibold" : "text-gray-400"}`}>
                          <ClockIcon className="w-3.5 h-3.5" />
                          {days !== null && days < 0 ? "Expired" : days !== null ? `${days}d left` : exc.expiry_date}
                        </span>
                      )}

                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[exc.status]}`}>
                        {STATUS_LABELS[exc.status]}
                      </span>

                      {/* Approve / Reject quick actions */}
                      {exc.status === "pending_approval" && user?.role === "admin" && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleApprove(exc.id)}
                            title="Approve"
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReject(exc.id)}
                            title="Reject"
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <NoSymbolIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Business Justification</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{exc.justification}</p>
                        </div>
                        {exc.compensating_control && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Compensating Control</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{exc.compensating_control}</p>
                          </div>
                        )}
                      </div>

                      {exc.approver_notes && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Approver Notes</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{exc.approver_notes}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-6 text-xs text-gray-400">
                        {exc.requester && <span>Requested by <b className="text-gray-600">{exc.requester.display_name}</b></span>}
                        {exc.approver  && <span>Reviewed by <b className="text-gray-600">{exc.approver.display_name}</b></span>}
                        <span>Created {new Date(exc.created_at).toLocaleDateString()}</span>
                        {exc.expiry_date && <span>Expires {new Date(exc.expiry_date).toLocaleDateString()}</span>}
                      </div>

                      {/* Approval Workflow */}
                      <ExceptionWorkflowPanel
                        exceptionId={exc.id}
                        userId={user?.id}
                        userRole={user?.role}
                        onRefresh={load}
                      />

                      {/* Status change */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-gray-400">Change status:</span>
                        {(["draft","pending_approval","approved","rejected","expired"] as ExceptionStatus[])
                          .filter((s) => s !== exc.status)
                          .map((s) => (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(exc.id, s)}
                              className="px-2.5 py-1 rounded text-xs border border-gray-200 text-gray-600 hover:bg-white transition-colors"
                            >
                              → {STATUS_LABELS[s]}
                            </button>
                          ))
                        }
                        <button
                          onClick={async () => { await exceptionsApi.delete(exc.id); load(); }}
                          className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ExceptionModal
          userId={user?.id}
          onClose={() => setShowModal(false)}
          onSaved={(e) => { setExceptions((prev) => [e, ...prev]); setShowModal(false); }}
        />
      )}
    </AppShell>
  );
}
