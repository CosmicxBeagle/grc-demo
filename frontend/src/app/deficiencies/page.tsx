"use client";
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { deficiencyApi, risksApi, usersApi, deficiencyMilestoneApi, cyclesApi, downloadExport } from "@/lib/api";
import type { Deficiency, DeficiencyStatus, DeficiencySeverity, Risk, User, DeficiencyMilestone, TestCycleSummary } from "@/types";
import { getUser } from "@/lib/auth";
import {
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  XMarkIcon,
  ArrowUpCircleIcon,
  CheckCircleIcon,
  TrashIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import PageHeader from "@/components/ui/PageHeader";
import KpiCard from "@/components/ui/KpiCard";
import SeverityBadge from "@/components/ui/SeverityBadge";
import Pagination from "@/components/ui/Pagination";

// ── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<DeficiencySeverity, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-blue-100 text-blue-700",
};

const STATUS_COLORS: Record<DeficiencyStatus, string> = {
  open:            "text-red-600",
  in_remediation:  "text-orange-600",
  remediated:      "text-green-600",
  risk_accepted:   "text-gray-500",
};

const STATUS_LABELS: Record<DeficiencyStatus, string> = {
  open:            "Open",
  in_remediation:  "In Remediation",
  remediated:      "Remediated",
  risk_accepted:   "Risk Accepted",
};

const ALL_STATUSES = ["open", "in_remediation", "remediated", "risk_accepted"] as const;

const SEVERITY_LIKELIHOOD: Record<DeficiencySeverity, number> = {
  critical: 5, high: 4, medium: 3, low: 2,
};

const RISK_STATUS_COLORS: Record<string, string> = {
  open:        "bg-red-50 text-red-700 border-red-200",
  mitigated:   "bg-green-50 text-green-700 border-green-200",
  accepted:    "bg-gray-50 text-gray-600 border-gray-200",
  transferred: "bg-blue-50 text-blue-700 border-blue-200",
  closed:      "bg-gray-50 text-gray-400 border-gray-200",
};

// ── Promote to Risk modal ────────────────────────────────────────────────────

function PromoteModal({ deficiency, onClose, onDone }: {
  deficiency: Deficiency; onClose: () => void; onDone: () => void;
}) {
  const [name, setName]             = useState(deficiency.title);
  const [description, setDesc]      = useState(deficiency.description ?? "");
  const [likelihood, setLikelihood] = useState(SEVERITY_LIKELIHOOD[deficiency.severity]);
  const [impact, setImpact]         = useState(3);
  const [treatment, setTreatment]   = useState("mitigate");
  const [owner, setOwner]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");

  const submit = async () => {
    if (!name.trim()) { setError("Risk name is required"); return; }
    setSaving(true); setError("");
    try {
      await deficiencyApi.promoteToRisk(deficiency.id, { name: name.trim(), description: description.trim() || null, likelihood, impact, treatment, owner: owner.trim() || null });
      onDone();
    } catch { setError("Failed to create risk. Please try again."); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Promote to Risk</h2>
            <p className="text-xs text-gray-500 mt-0.5">A new risk will be created and linked to this deficiency</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Source Deficiency</p>
            <p className="font-medium text-gray-800">{deficiency.title}</p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">Severity: {deficiency.severity}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Name <span className="text-red-500">*</span></label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" rows={2} value={description} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Likelihood (1–5)</label>
              <input type="number" min={1} max={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={likelihood} onChange={e => setLikelihood(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Impact (1–5)</label>
              <input type="number" min={1} max={5} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={impact} onChange={e => setImpact(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={treatment} onChange={e => setTreatment(e.target.value)}>
                <option value="mitigate">Mitigate</option>
                <option value="accept">Accept</option>
                <option value="transfer">Transfer</option>
                <option value="avoid">Avoid</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner (optional)</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Name or team" value={owner} onChange={e => setOwner(e.target.value)} />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
            Inherent score will be <strong>{likelihood * impact}</strong> ({likelihood} × {impact})
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? "Creating…" : "Create Risk & Link"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Link to existing risk modal ──────────────────────────────────────────────

function LinkRiskModal({ deficiency, onClose, onDone }: {
  deficiency: Deficiency; onClose: () => void; onDone: () => void;
}) {
  const [risks, setRisks]       = useState<Risk[]>([]);
  const [query, setQuery]       = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");

  useEffect(() => { risksApi.list().then(r => setRisks(r.data.items)).catch(() => {}); }, []);

  const filtered = risks.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) && r.id !== deficiency.linked_risk_id);

  const submit = async () => {
    if (!selected) { setError("Select a risk first"); return; }
    setSaving(true); setError("");
    try { await deficiencyApi.linkRisk(deficiency.id, selected); onDone(); }
    catch { setError("Failed to link risk."); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Link to Existing Risk</h2>
            <p className="text-xs text-gray-500 mt-0.5">Associate this deficiency with a risk in the register</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="px-6 pt-4 pb-2">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</div>}
          <input type="text" placeholder="Search risks by name…" value={query} onChange={e => setQuery(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
        </div>
        <div className="px-6 pb-4 max-h-72 overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No risks found</p>
          ) : filtered.map(r => {
            const score = r.likelihood * r.impact;
            const isSelected = selected === r.id;
            return (
              <button key={r.id} onClick={() => setSelected(r.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{r.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-500">Score {score}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${RISK_STATUS_COLORS[r.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>{r.status}</span>
                  </div>
                </div>
                {r.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{r.description}</p>}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={submit} disabled={saving || !selected} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
            {saving ? "Linking…" : "Link Risk"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DeficiencyDrawer({
  deficiency,
  users,
  isManager,
  onClose,
  onReload,
  onPromote,
  onLink,
}: {
  deficiency: Deficiency;
  users: User[];
  isManager: boolean;
  onClose: () => void;
  onReload: () => void;
  onPromote: (d: Deficiency) => void;
  onLink: (d: Deficiency) => void;
}) {
  const router = useRouter();

  // Remediation edit
  const [editingRem, setEditingRem] = useState(false);
  const [remForm, setRemForm] = useState({
    root_cause: deficiency.root_cause ?? "",
    business_impact: deficiency.business_impact ?? "",
    remediation_owner: deficiency.remediation_owner ?? "",
    validation_notes: deficiency.validation_notes ?? "",
    closure_evidence: deficiency.closure_evidence ?? "",
  });
  const [savingRem, setSavingRem] = useState(false);

  // Milestone
  const [addingMilestone, setAddingMilestone] = useState(false);
  const [milForm, setMilForm] = useState({ title: "", due_date: "", assignee_id: "" });
  const [savingMil, setSavingMil] = useState(false);

  // Extension
  const [extensionModal, setExtensionModal] = useState<{ milestoneId: number; mode: "request" | "approve" } | null>(null);
  const [extensionReason, setExtensionReason] = useState("");
  const [extensionDate, setExtensionDate]     = useState("");
  const [savingExtension, setSavingExtension] = useState(false);

  // Retest
  const [retestOpen, setRetestOpen]     = useState(false);
  const [retestCycles, setRetestCycles] = useState<TestCycleSummary[]>([]);
  const [retestForm, setRetestForm]     = useState({ cycle_id: "", assigned_to_user_id: "" });
  const [savingRetest, setSavingRetest] = useState(false);
  const [waiveOpen, setWaiveOpen]       = useState(false);
  const [waiveReason, setWaiveReason]   = useState("");
  const [savingWaive, setSavingWaive]   = useState(false);

  // Esc key + scroll lock
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", handler); };
  }, [onClose]);

  const updateStatus = async (status: DeficiencyStatus) => {
    await deficiencyApi.update(deficiency.id, { status });
    onReload();
  };

  const saveRem = async () => {
    setSavingRem(true);
    try {
      await deficiencyApi.update(deficiency.id, {
        root_cause: remForm.root_cause || undefined,
        business_impact: remForm.business_impact || undefined,
        remediation_owner: remForm.remediation_owner || undefined,
        validation_notes: remForm.validation_notes || undefined,
        closure_evidence: remForm.closure_evidence || undefined,
      });
      setEditingRem(false);
      onReload();
    } finally { setSavingRem(false); }
  };

  const addMilestone = async () => {
    if (!milForm.title.trim()) return;
    setSavingMil(true);
    try {
      await deficiencyMilestoneApi.create(deficiency.id, {
        title: milForm.title.trim(),
        due_date: milForm.due_date || undefined,
        assignee_id: milForm.assignee_id ? Number(milForm.assignee_id) : undefined,
      });
      setMilForm({ title: "", due_date: "", assignee_id: "" });
      setAddingMilestone(false);
      onReload();
    } finally { setSavingMil(false); }
  };

  const toggleMilestone = async (m: DeficiencyMilestone) => {
    const newStatus = m.status === "completed" ? "open" : "completed";
    await deficiencyMilestoneApi.update(deficiency.id, m.id, { status: newStatus });
    onReload();
  };

  const deleteMilestone = async (milestoneId: number) => {
    if (!confirm("Delete this milestone?")) return;
    await deficiencyMilestoneApi.delete(deficiency.id, milestoneId);
    onReload();
  };

  const submitExtension = async () => {
    if (!extensionModal) return;
    setSavingExtension(true);
    try {
      if (extensionModal.mode === "request") {
        await deficiencyMilestoneApi.requestExtension(deficiency.id, extensionModal.milestoneId, extensionReason.trim());
      } else {
        await deficiencyMilestoneApi.approveExtension(deficiency.id, extensionModal.milestoneId, extensionDate);
      }
      setExtensionModal(null); setExtensionReason(""); setExtensionDate("");
      onReload();
    } catch { /* ignore */ }
    finally { setSavingExtension(false); }
  };

  const rejectExtension = async (milestoneId: number) => {
    if (!confirm("Reject this extension request?")) return;
    await deficiencyMilestoneApi.rejectExtension(deficiency.id, milestoneId);
    onReload();
  };

  const openRetestModal = async () => {
    setRetestForm({ cycle_id: "", assigned_to_user_id: "" });
    try { const res = await cyclesApi.list(); setRetestCycles(res.data.filter(c => c.status !== "closed")); }
    catch { setRetestCycles([]); }
    setRetestOpen(true);
  };

  const submitRetest = async () => {
    if (!retestForm.cycle_id || !retestForm.assigned_to_user_id) return;
    setSavingRetest(true);
    try {
      await deficiencyApi.createRetest(deficiency.id, { cycle_id: Number(retestForm.cycle_id), assigned_to_user_id: Number(retestForm.assigned_to_user_id) });
      setRetestOpen(false); onReload();
    } catch { /* ignore */ }
    finally { setSavingRetest(false); }
  };

  const submitWaive = async () => {
    if (waiveReason.trim().length < 10) return;
    setSavingWaive(true);
    try {
      await deficiencyApi.waiveRetest(deficiency.id, waiveReason.trim());
      setWaiveOpen(false); onReload();
    } catch { /* ignore */ }
    finally { setSavingWaive(false); }
  };

  const unlinkRisk = async () => {
    await deficiencyApi.unlinkRisk(deficiency.id);
    onReload();
  };

  const milDone  = deficiency.milestones?.filter(m => m.status === "completed").length ?? 0;
  const milTotal = deficiency.milestones?.length ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full md:w-[520px] bg-white z-50 flex flex-col"
        style={{ animation: "slideInRight 0.2s ease-out", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_COLORS[deficiency.severity]}`}>
                {deficiency.severity.charAt(0).toUpperCase() + deficiency.severity.slice(1)}
              </span>
              <select
                className={`text-xs border border-gray-200 rounded-full px-2.5 py-0.5 bg-white focus:outline-none font-medium ${STATUS_COLORS[deficiency.status]}`}
                value={deficiency.status}
                onChange={e => updateStatus(e.target.value as DeficiencyStatus)}
              >
                {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-snug">{deficiency.title}</h2>
            {deficiency.due_date && (
              <p className="text-xs text-gray-400 mt-1">Due: {deficiency.due_date}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 shrink-0 mt-0.5">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Description */}
          {deficiency.description && (
            <p className="text-sm text-gray-600">{deficiency.description}</p>
          )}

          {/* ── Remediation Details ──────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Remediation Details</h3>
              {!editingRem ? (
                <button onClick={() => { setEditingRem(true); setRemForm({ root_cause: deficiency.root_cause ?? "", business_impact: deficiency.business_impact ?? "", remediation_owner: deficiency.remediation_owner ?? "", validation_notes: deficiency.validation_notes ?? "", closure_evidence: deficiency.closure_evidence ?? "" }); }}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
                  <PencilSquareIcon className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={saveRem} disabled={savingRem} className="text-xs bg-brand-600 text-white px-3 py-1 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                    {savingRem ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => setEditingRem(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                </div>
              )}
            </div>

            {editingRem ? (
              <div className="space-y-3">
                {([
                  { label: "Root Cause", key: "root_cause" as const, rows: 2 },
                  { label: "Business Impact", key: "business_impact" as const, rows: 2 },
                  { label: "Remediation Owner", key: "remediation_owner" as const, rows: 1 },
                  { label: "Validation Notes", key: "validation_notes" as const, rows: 2 },
                  { label: "Closure Evidence", key: "closure_evidence" as const, rows: 2 },
                ] as const).map(({ label, key, rows }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
                    <textarea rows={rows} value={remForm[key]} onChange={e => setRemForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none" />
                  </div>
                ))}
              </div>
            ) : (
              <dl className="space-y-3">
                {([
                  ["Root Cause", deficiency.root_cause],
                  ["Business Impact", deficiency.business_impact],
                  ["Remediation Owner", deficiency.remediation_owner],
                  ["Validation Notes", deficiency.validation_notes],
                  ["Closure Evidence", deficiency.closure_evidence],
                ] as [string, string | undefined][]).map(([label, value]) => value ? (
                  <div key={label}>
                    <dt className="text-xs font-medium text-gray-400">{label}</dt>
                    <dd className="text-sm text-gray-700 mt-0.5">{value}</dd>
                  </div>
                ) : null)}
                {!deficiency.root_cause && !deficiency.business_impact && !deficiency.remediation_owner && (
                  <p className="text-sm text-gray-400 italic">No remediation details yet — click Edit to add.</p>
                )}
              </dl>
            )}
          </section>

          {/* ── Milestones ───────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">
                Milestones
                {milTotal > 0 && <span className="ml-2 text-xs font-normal text-gray-400">{milDone}/{milTotal} done</span>}
              </h3>
              <button onClick={() => setAddingMilestone(v => !v)}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium">
                <PlusIcon className="w-3.5 h-3.5" /> Add
              </button>
            </div>

            {addingMilestone && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 mb-3">
                <input type="text" placeholder="Milestone title *" value={milForm.title}
                  onChange={e => setMilForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Due date</label>
                    <input type="date" value={milForm.due_date} onChange={e => setMilForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-0.5">Assignee</label>
                    <select value={milForm.assignee_id} onChange={e => setMilForm(f => ({ ...f, assignee_id: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
                      <option value="">— None —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addMilestone} disabled={savingMil || !milForm.title.trim()}
                    className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50">
                    {savingMil ? "Adding…" : "Add Milestone"}
                  </button>
                  <button onClick={() => setAddingMilestone(false)} className="text-xs border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50">Cancel</button>
                </div>
              </div>
            )}

            {milTotal === 0 && !addingMilestone ? (
              <p className="text-sm text-gray-400 italic">No milestones yet.</p>
            ) : (
              <ul className="space-y-2">
                {deficiency.milestones?.map(m => (
                  <li key={m.id} className={`bg-white border rounded-lg px-3 py-2.5 space-y-1 ${
                    m.escalation_level >= 2 ? "border-red-300" :
                    m.escalation_level === 1 ? "border-orange-300" :
                    "border-gray-200"
                  }`}>
                    <div className="flex items-start gap-2">
                      <button onClick={() => toggleMilestone(m)} className="mt-0.5 shrink-0">
                        <CheckCircleIcon className={`w-4 h-4 ${m.status === "completed" ? "text-green-500" : "text-gray-300"}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${m.status === "completed" ? "line-through text-gray-400" : "text-gray-700"}`}>
                          {m.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {m.due_date && <span className="text-xs text-gray-400">Due: {m.due_date}</span>}
                          {m.assignee && <span className="text-xs text-gray-400">{m.assignee.display_name}</span>}
                          {m.status === "overdue" && m.escalation_level === 0 && <span className="text-xs text-red-500 font-medium">Overdue</span>}
                          {m.escalation_level === 1 && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-medium">Escalated L1</span>}
                          {m.escalation_level >= 2 && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Escalated L2</span>}
                          {m.extension_requested && m.extension_approved === null && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Extension pending</span>}
                          {m.extension_approved === true && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Extended → {m.new_due_date}</span>}
                          {m.extension_approved === false && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">Extension rejected</span>}
                        </div>
                        {m.extension_requested && m.extension_request_reason && m.extension_approved === null && (
                          <p className="text-xs text-blue-600 italic mt-0.5">&ldquo;{m.extension_request_reason}&rdquo;</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {m.status !== "completed" && !isManager && !(m.extension_requested && m.extension_approved === null) && (
                          <button onClick={() => { setExtensionModal({ milestoneId: m.id, mode: "request" }); setExtensionReason(""); }}
                            className="text-xs text-blue-500 hover:text-blue-700 underline">Extend</button>
                        )}
                        {isManager && m.extension_requested && m.extension_approved === null && (
                          <>
                            <button onClick={() => { setExtensionModal({ milestoneId: m.id, mode: "approve" }); setExtensionDate(""); }}
                              className="text-xs text-green-600 hover:text-green-800 underline">Approve</button>
                            <button onClick={() => rejectExtension(m.id)} className="text-xs text-red-500 hover:text-red-700 underline">Reject</button>
                          </>
                        )}
                        <button onClick={() => deleteMilestone(m.id)} className="text-gray-300 hover:text-red-400 ml-1">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Re-Test ──────────────────────────────────────── */}
          {deficiency.retest_required && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-800">Re-Test Requirement</h3>
                <span className="text-xs text-blue-500">Required before closure</span>
              </div>

              {deficiency.retest_waived ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                  <span className="text-xs font-semibold text-yellow-600 uppercase">Waived</span>
                  {deficiency.retest_waived_reason && <p className="text-yellow-700 mt-1 text-sm">{deficiency.retest_waived_reason}</p>}
                </div>
              ) : deficiency.retest_assignment_id ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-700">
                  Re-test assignment <strong>#{deficiency.retest_assignment_id}</strong> created.
                  Assignment must pass before deficiency can be closed.
                </div>
              ) : isManager ? (
                <div className="flex gap-2">
                  <button onClick={openRetestModal}
                    className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
                    Create Re-Test
                  </button>
                  <button onClick={() => { setWaiveOpen(true); setWaiveReason(""); }}
                    className="text-sm border border-yellow-300 text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-50 font-medium">
                    Waive Re-Test
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Re-test not yet assigned. Contact your GRC manager.</p>
              )}
            </section>
          )}

          {/* ── Linked Risk ───────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Linked Risk</h3>
            {deficiency.linked_risk ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => router.push("/risks")}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
                    <ArrowTopRightOnSquareIcon className="w-4 h-4 shrink-0" />
                    {deficiency.linked_risk.name}
                  </button>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${RISK_STATUS_COLORS[deficiency.linked_risk.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                    {deficiency.linked_risk.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onLink(deficiency)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-200 rounded-lg px-2.5 py-1">
                    <LinkIcon className="w-3.5 h-3.5" /> Change
                  </button>
                  <button onClick={unlinkRisk}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded-lg px-2.5 py-1">
                    <XMarkIcon className="w-3.5 h-3.5" /> Unlink
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => onPromote(deficiency)}
                  className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-800 border border-orange-200 hover:border-orange-300 rounded-lg px-3 py-1.5 font-medium">
                  <ArrowUpCircleIcon className="w-4 h-4" /> Promote to Risk
                </button>
                <button onClick={() => onLink(deficiency)}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-1.5 font-medium">
                  <LinkIcon className="w-4 h-4" /> Link Existing Risk
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Footer — admin actions */}
        {isManager && (
          <div className="border-t border-gray-200 px-6 py-4 shrink-0 flex justify-end">
            <button
              onClick={async () => {
                if (!confirm("Delete this deficiency? This cannot be undone.")) return;
                await deficiencyApi.delete(deficiency.id);
                onClose();
                onReload();
              }}
              className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800 border border-red-200 hover:border-red-300 rounded-lg px-3 py-1.5"
            >
              <TrashIcon className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
      </div>

      {/* ── Inline modals (z-[60] to sit above drawer) ──────── */}

      {/* Extension */}
      {extensionModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">
              {extensionModal.mode === "request" ? "Request Due-Date Extension" : "Approve Extension"}
            </h3>
            {extensionModal.mode === "request" ? (
              <>
                <p className="text-xs text-gray-500">Explain why you need more time (min 10 characters).</p>
                <textarea rows={3} autoFocus className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                  placeholder="Reason for extension..." value={extensionReason} onChange={e => setExtensionReason(e.target.value)} />
                {extensionReason.length > 0 && extensionReason.trim().length < 10 && (
                  <p className="text-xs text-red-600">Reason must be at least 10 characters.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500">Set the new due date for this milestone.</p>
                <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={extensionDate} onChange={e => setExtensionDate(e.target.value)} />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setExtensionModal(null)} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={submitExtension}
                disabled={savingExtension || (extensionModal.mode === "request" ? extensionReason.trim().length < 10 : !extensionDate)}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingExtension ? "Saving…" : extensionModal.mode === "request" ? "Submit Request" : "Approve Extension"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retest */}
      {retestOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Create Re-Test Assignment</h3>
            <p className="text-xs text-gray-500">Select the test cycle and tester for the re-test.</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Test Cycle</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={retestForm.cycle_id} onChange={e => setRetestForm(f => ({ ...f, cycle_id: e.target.value }))}>
                <option value="">— Select cycle —</option>
                {retestCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assign To</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={retestForm.assigned_to_user_id} onChange={e => setRetestForm(f => ({ ...f, assigned_to_user_id: e.target.value }))}>
                <option value="">— Select tester —</option>
                {users.filter(u => u.status !== "inactive").map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRetestOpen(false)} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={submitRetest} disabled={savingRetest || !retestForm.cycle_id || !retestForm.assigned_to_user_id}
                className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingRetest ? "Creating…" : "Create Re-Test"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waive */}
      {waiveOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Waive Re-Test Requirement</h3>
            <p className="text-xs text-gray-500">Provide a documented reason (min 10 characters).</p>
            <textarea rows={3} autoFocus className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              placeholder="e.g. Risk accepted by management; compensating controls confirmed…"
              value={waiveReason} onChange={e => setWaiveReason(e.target.value)} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setWaiveOpen(false)} className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={submitWaive} disabled={savingWaive || waiveReason.trim().length < 10}
                className="text-sm px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50">
                {savingWaive ? "Saving…" : "Waive Re-Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function DeficienciesPageContent() {
  const searchParams = useSearchParams();
  const currentUser = getUser();
  const isManager   = currentUser?.role === "admin" || currentUser?.role === "grc_manager";

  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
  const [users, setUsers]               = useState<User[]>([]);
  const [filter, setFilter]             = useState<DeficiencyStatus | "all">("all");
  const [loading, setLoading]           = useState(true);

  // Drawer state
  const [selectedDef, setSelectedDef] = useState<Deficiency | null>(null);

  // Modals
  const [promoteTarget, setPromoteTarget] = useState<Deficiency | null>(null);
  const [linkTarget, setLinkTarget]       = useState<Deficiency | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, uRes] = await Promise.all([deficiencyApi.list(), usersApi.list()]);
      setDeficiencies(dRes.data);
      setUsers(uRes.data);
      // Keep drawer in sync if open
      if (selectedDef) {
        const fresh = dRes.data.find(d => d.id === selectedDef.id);
        if (fresh) setSelectedDef(fresh);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [selectedDef]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open the drawer for the targeted deficiency when coming from My Work
  useEffect(() => {
    const targetId = searchParams.get("id");
    if (!targetId || deficiencies.length === 0 || selectedDef) return;
    const target = deficiencies.find(d => d.id === Number(targetId));
    if (target) setSelectedDef(target);
  }, [deficiencies, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts: Record<DeficiencyStatus, number> = {
    open:           deficiencies.filter(d => d.status === "open").length,
    in_remediation: deficiencies.filter(d => d.status === "in_remediation").length,
    remediated:     deficiencies.filter(d => d.status === "remediated").length,
    risk_accepted:  deficiencies.filter(d => d.status === "risk_accepted").length,
  };

  const filtered = filter === "all" ? deficiencies : deficiencies.filter(d => d.status === filter);

  // Pagination
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [filter]);
  const pagedFiltered = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleReload = useCallback(async () => {
    const [dRes, uRes] = await Promise.all([deficiencyApi.list(), usersApi.list()]);
    setDeficiencies(dRes.data);
    setUsers(uRes.data);
    if (selectedDef) {
      const fresh = dRes.data.find(d => d.id === selectedDef.id);
      if (fresh) setSelectedDef(fresh);
    }
  }, [selectedDef]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="Deficiencies"
          subtitle={`${deficiencies.length} total deficiencies tracked`}
          actions={
            <button
              onClick={() => downloadExport("/exports/deficiencies", `deficiency_register_${new Date().toISOString().slice(0,10)}.xlsx`)}
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export
            </button>
          }
        />

        {/* Summary KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard
            label="Open"
            value={counts.open}
            colorScheme="critical"
            onClick={() => setFilter(filter === "open" ? "all" : "open")}
          />
          <KpiCard
            label="In Remediation"
            value={counts.in_remediation}
            colorScheme="high"
            onClick={() => setFilter(filter === "in_remediation" ? "all" : "in_remediation")}
          />
          <KpiCard
            label="Remediated"
            value={counts.remediated}
            colorScheme="low"
            onClick={() => setFilter(filter === "remediated" ? "all" : "remediated")}
          />
          <KpiCard
            label="Risk Accepted"
            value={counts.risk_accepted}
            colorScheme="neutral"
            onClick={() => setFilter(filter === "risk_accepted" ? "all" : "risk_accepted")}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-0 border-b border-gray-200">
          <button onClick={() => setFilter("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${filter === "all" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            All ({deficiencies.length})
          </button>
          {ALL_STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s === filter ? "all" : s)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${filter === s ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {STATUS_LABELS[s]} ({counts[s]})
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {filter === "all" ? "No deficiencies found." : `No ${STATUS_LABELS[filter as DeficiencyStatus]} deficiencies.`}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pagedFiltered.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDef(d)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedDef?.id === d.id ? "bg-blue-50" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-900">{d.title}</span>
                        {d.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.description}</p>}
                        {(d.milestones?.length ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-indigo-500 mt-0.5">
                            <CheckCircleIcon className="w-3 h-3" />
                            {d.milestones.filter(m => m.status === "completed").length}/{d.milestones.length} milestones
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <SeverityBadge severity={d.severity} />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <select
                        className={`text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none font-medium ${STATUS_COLORS[d.status]}`}
                        value={d.status}
                        onChange={async e => { await deficiencyApi.update(d.id, { status: e.target.value as DeficiencyStatus }); handleReload(); }}
                      >
                        {ALL_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{d.due_date ?? "—"}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {d.linked_risk ? (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${RISK_STATUS_COLORS[d.linked_risk.status] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                          <LinkIcon className="w-3 h-3" />
                          {d.linked_risk.name.length > 24 ? d.linked_risk.name.slice(0, 24) + "…" : d.linked_risk.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              total={filtered.length}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              itemLabel="deficiency"
            />
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedDef && (
        <DeficiencyDrawer
          deficiency={selectedDef}
          users={users}
          isManager={isManager}
          onClose={() => setSelectedDef(null)}
          onReload={handleReload}
          onPromote={d => setPromoteTarget(d)}
          onLink={d => setLinkTarget(d)}
        />
      )}

      {/* Modals */}
      {promoteTarget && (
        <PromoteModal deficiency={promoteTarget} onClose={() => setPromoteTarget(null)}
          onDone={() => { setPromoteTarget(null); handleReload(); }} />
      )}
      {linkTarget && (
        <LinkRiskModal deficiency={linkTarget} onClose={() => setLinkTarget(null)}
          onDone={() => { setLinkTarget(null); handleReload(); }} />
      )}
    </AppShell>
  );
}

export default function DeficienciesPage() {
  return (
    <Suspense fallback={null}>
      <DeficienciesPageContent />
    </Suspense>
  );
}
