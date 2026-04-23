"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { exceptionsApi, approvalsApi, downloadExport } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { ControlException, ExceptionStatus, ExceptionType, ApprovalWorkflow, ApprovalPolicy } from "@/types";
import type { AxiosError } from "axios";
import ApprovalTimeline from "@/components/ApprovalTimeline";
import StatusBadge from "@/components/StatusBadge";
import SeverityBadge from "@/components/ui/SeverityBadge";
import ExpiryIndicator from "@/components/ui/ExpiryIndicator";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import {
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  NoSymbolIcon,
  ExclamationCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

// ── helpers ─────────────────────────────────────────────────────────────────

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
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {policies.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={startWorkflow}
              disabled={starting || !selPolicy}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-1.5 disabled:opacity-50"
            >
              {starting ? "Starting…" : "Start"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">
          No approval policies defined.{" "}
          <a href="/settings/approvals" className="text-blue-600 hover:underline">Create one in Settings →</a>
        </p>
      )}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

function ExceptionsPageContent() {
  const searchParams = useSearchParams();
  const [exceptions, setExceptions] = useState<ControlException[]>([]);
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState<ExceptionStatus | "all" | "expiring_soon">("all");
  const [showModal, setShowModal]   = useState(false);
  const [expanded, setExpanded]     = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const user = getUser();
  const canApprove = user?.role === "admin" || user?.role === "grc_manager";

  const load = () => {
    exceptionsApi.list().then((r) => {
      setExceptions(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Auto-expand the targeted exception when coming from My Work
  useEffect(() => {
    const targetId = searchParams.get("id");
    if (!targetId || exceptions.length === 0) return;
    const id = Number(targetId);
    setExpanded(id);
    setTimeout(() => {
      document.getElementById(`exception-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
  }, [exceptions, searchParams]);

  const expiringSoon = exceptions.filter(e => {
    const effectiveExpiry = e.expires_at ?? e.expiry_date;
    if (!effectiveExpiry || e.status !== "approved") return false;
    const days = daysTill(effectiveExpiry);
    return days !== null && days <= 60 && days >= 0;
  });

  const filtered = statusFilter === "expiring_soon"
    ? expiringSoon
    : statusFilter === "all"
      ? exceptions
      : exceptions.filter((e) => e.status === statusFilter);

  // Pagination
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  useEffect(() => { setPage(1); }, [statusFilter]);
  const pagedFiltered = filtered.slice((page - 1) * pageSize, page * pageSize);

  const counts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = exceptions.filter((e) => e.status === s).length;
    return acc;
  }, {});

  const handleApprove = async (id: number) => {
    if (!user) return;
    await exceptionsApi.approve(id);
    load();
  };

  const openRejectModal = (id: number) => {
    setRejectReason("");
    setActionError(null);
    setRejectModal(id);
  };

  const handleRejectWithReason = async () => {
    if (!rejectModal) return;
    if (rejectReason.trim().length < 20) {
      setActionError("Please provide at least 20 characters explaining the rejection reason.");
      return;
    }
    try {
      await exceptionsApi.reject(rejectModal, rejectReason.trim());
      setRejectModal(null);
      load();
    } catch (err: unknown) {
      const axErr = err as AxiosError<{ detail: string }>;
      setActionError(axErr.response?.data?.detail ?? "Failed to reject exception.");
    }
  };

  const handleResubmit = async (id: number) => {
    try {
      await exceptionsApi.resubmit(id);
      load();
    } catch (err: unknown) {
      const axErr = err as AxiosError<{ detail: string }>;
      alert(axErr.response?.data?.detail ?? "Failed to resubmit.");
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    await exceptionsApi.update(id, { status });
    load();
  };

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">

        <PageHeader
          title="Control Exceptions"
          subtitle={`${exceptions.length} total · ${counts["pending_approval"] ?? 0} pending approval`}
          actions={
            <>
              <button
                onClick={() => downloadExport("/exports/exceptions", `exceptions_register_${new Date().toISOString().slice(0,10)}.xlsx`)}
                className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                New Exception
              </button>
            </>
          }
        />

        {/* Status filter tabs */}
        <div className="flex gap-0 border-b border-gray-200">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${statusFilter === "all" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            All ({exceptions.length})
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${statusFilter === s ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {STATUS_LABELS[s]}{counts[s] > 0 && ` (${counts[s]})`}
            </button>
          ))}
          {expiringSoon.length > 0 && (
            <button
              onClick={() => setStatusFilter("expiring_soon")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${statusFilter === "expiring_soon" ? "border-amber-500 text-amber-600" : "border-transparent text-amber-600 hover:text-amber-700"}`}
            >
              Expiring Soon ({expiringSoon.length})
            </button>
          )}
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
            {pagedFiltered.map((exc) => {
              const days = daysTill(exc.expiry_date);
              const isExpanded = expanded === exc.id;

              return (
                <div key={exc.id} id={`exception-${exc.id}`} className="bg-white border border-gray-200 rounded-xl overflow-hidden scroll-mt-4">
                  {/* Row header — div not button so approve/reject buttons inside are valid HTML */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpanded(isExpanded ? null : exc.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(isExpanded ? null : exc.id); }}
                  >
                    {/* Risk level pill */}
                    <SeverityBadge severity={exc.risk_level} />

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
                            className="text-blue-600 hover:underline font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {exc.control.control_id}
                          </Link>
                          {" — "}{exc.control.title}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Expiry badge (lifecycle-aware) */}
                      <ExpiryIndicator expiresAt={exc.expires_at ?? exc.expiry_date} hideIfEmpty />

                      {exc.resubmission_count && exc.resubmission_count > 0 && (
                        <span className="text-xs text-gray-400">Resubmission #{exc.resubmission_count}</span>
                      )}

                      <StatusBadge status={exc.status} />

                      {/* Approve / Reject quick actions */}
                      {exc.status === "pending_approval" && canApprove && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleApprove(exc.id)}
                            title="Approve"
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                          >
                            <CheckIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openRejectModal(exc.id); }}
                            title="Reject"
                            className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <NoSymbolIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

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

                      {/* 4B: Rejection reason + resubmit */}
                      {exc.rejection_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">Rejection Reason</p>
                          <p className="text-sm text-red-700 whitespace-pre-wrap">{exc.rejection_reason}</p>
                          {exc.status === "rejected" && (
                            <button
                              onClick={() => handleResubmit(exc.id)}
                              className="mt-2 text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 font-medium"
                            >
                              Resubmit Exception
                            </button>
                          )}
                        </div>
                      )}

                      {/* 4B: Approved expiry from lifecycle service */}
                      {exc.expires_at && exc.status === "approved" && (
                        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm">
                          <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">Approved until: </span>
                          <span className="text-green-700">{new Date(exc.expires_at).toLocaleDateString()}</span>
                          {exc.expiry_notified_at && (
                            <span className="text-xs text-green-500 ml-3">· 30-day warning sent {new Date(exc.expiry_notified_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-6 text-xs text-gray-400">
                        {exc.requester && <span>Requested by <b className="text-gray-600">{exc.requester.display_name}</b></span>}
                        {exc.approver  && <span>Reviewed by <b className="text-gray-600">{exc.approver.display_name}</b></span>}
                        <span>Created {new Date(exc.created_at).toLocaleDateString()}</span>
                        {exc.expiry_date && <span>Requested expiry {new Date(exc.expiry_date).toLocaleDateString()}</span>}
                        {exc.parent_exception_id && <span>· Resubmission of Exception #{exc.parent_exception_id}</span>}
                      </div>

                      {/* Approval Workflow */}
                      <ExceptionWorkflowPanel
                        exceptionId={exc.id}
                        userId={user?.id}
                        userRole={user?.role}
                        onRefresh={load}
                      />

                      {/* Status change — admin + grc_manager only */}
                      {canApprove && (
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
                        {user?.role === "admin" && (
                        <button
                          onClick={async () => { await exceptionsApi.delete(exc.id); load(); }}
                          className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Delete
                        </button>
                        )}
                      </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Pagination
              total={filtered.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              itemLabel="exception"
            />
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

      {/* 4B: Reject with reason modal */}
      {rejectModal !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Reject Exception</h2>
              <button onClick={() => setRejectModal(null)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {actionError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</div>
              )}
              <label className="block text-sm font-medium text-gray-700">
                Rejection Reason <span className="text-red-500">*</span>
                <span className="text-xs font-normal text-gray-400 ml-1">(min 20 characters)</span>
              </label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:border-transparent"
                rows={4}
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Explain why this exception cannot be approved and what the requestor should address before resubmitting…"
              />
              <p className="text-xs text-gray-400">{rejectReason.length} / 20 minimum</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
                Cancel
              </button>
              <button
                onClick={handleRejectWithReason}
                disabled={rejectReason.trim().length < 20}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ExceptionsPage() {
  return (
    <Suspense fallback={null}>
      <ExceptionsPageContent />
    </Suspense>
  );
}
