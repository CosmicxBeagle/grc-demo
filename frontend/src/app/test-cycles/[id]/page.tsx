"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import FrameworkBadge from "@/components/FrameworkBadge";
import { cyclesApi, evidenceApi, controlsApi, usersApi, deficiencyApi, checklistApi, downloadExport } from "@/lib/api";
import { CheckCircleIcon, XCircleIcon, ArrowUturnLeftIcon } from "@heroicons/react/24/outline";
import { getUser } from "@/lib/auth";
import type { TestCycle, TestAssignment, AssignmentStatus, Control, User, Deficiency, DeficiencyStatus, DeficiencySeverity, ChecklistItem } from "@/types";
import { BRANDS } from "@/types";
import { ArrowLeftIcon, PaperClipIcon, TrashIcon, ChevronDownIcon, PlusIcon, ExclamationTriangleIcon, ArrowDownTrayIcon, ArchiveBoxIcon } from "@heroicons/react/24/outline";

const NEXT_STATUS: Partial<Record<AssignmentStatus, { label: string; to: AssignmentStatus }>> = {
  not_started:  { label: "Start Testing",  to: "in_progress" },
  in_progress:  { label: "Submit for Review", to: "needs_review" },
  needs_review: { label: "Mark Complete",  to: "complete" },
};

const SEVERITY_COLORS: Record<DeficiencySeverity, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-blue-100 text-blue-700",
};

const DEFICIENCY_STATUS_COLORS: Record<DeficiencyStatus, string> = {
  open:            "text-red-600",
  in_remediation:  "text-orange-600",
  remediated:      "text-green-600",
  risk_accepted:   "text-gray-500",
};

const DEFICIENCY_STATUS_LABELS: Record<DeficiencyStatus, string> = {
  open:            "Open",
  in_remediation:  "In Remediation",
  remediated:      "Remediated",
  risk_accepted:   "Risk Accepted",
};

function ChecklistPanel({ a, onUpdate }: { a: TestAssignment; onUpdate: () => void }) {
  const items: ChecklistItem[] = a.checklist_items ?? [];
  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const toggle = async (item: ChecklistItem) => {
    await checklistApi.update(a.id, item.id, { completed: !item.completed });
    onUpdate();
  };

  const addItem = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await checklistApi.create(a.id, newTitle.trim(), items.length);
      setNewTitle("");
      setShowInput(false);
      onUpdate();
    } finally {
      setAdding(false);
    }
  };

  const deleteItem = async (itemId: number) => {
    await checklistApi.delete(a.id, itemId);
    onUpdate();
  };

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50 p-4 space-y-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <p className="text-sm font-semibold text-blue-700 shrink-0">
            Checklist ({completed}/{total})
          </p>
          {total > 0 && (
            <div className="flex-1 bg-blue-200 rounded-full h-1.5 max-w-48">
              <div
                className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {pct === 100 && total > 0 && (
            <span className="text-xs text-green-600 font-medium">Complete</span>
          )}
        </div>
        <button
          onClick={() => setShowInput((s) => !s)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
        >
          + Add item
        </button>
      </div>

      {/* Checklist items */}
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggle(item)}
                className="w-4 h-4 accent-blue-600 shrink-0 cursor-pointer"
              />
              <span className={`flex-1 text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                {item.title}
              </span>
              <button
                onClick={() => deleteItem(item.id)}
                className="text-gray-300 hover:text-red-400 shrink-0"
                title="Remove"
              >
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add item input */}
      {showInput && (
        <div className="flex gap-2">
          <input
            type="text"
            autoFocus
            placeholder="Checklist item title…"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setShowInput(false); setNewTitle(""); } }}
            className="flex-1 text-xs border border-blue-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
          <button
            onClick={addItem}
            disabled={adding || !newTitle.trim()}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
          <button
            onClick={() => { setShowInput(false); setNewTitle(""); }}
            className="text-xs border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}

      {items.length === 0 && !showInput && (
        <p className="text-xs text-blue-400 italic">No checklist items yet — click &quot;+ Add item&quot; to start.</p>
      )}
    </div>
  );
}

function DeficienciesPanel({ a, onUpdate }: { a: TestAssignment; onUpdate: () => void }) {
  const [form, setForm] = useState({
    title: "",
    severity: "high" as DeficiencySeverity,
    description: "",
    remediation_plan: "",
    due_date: "",
  });
  const [adding, setAdding] = useState(false);

  const addDeficiency = async () => {
    if (!form.title.trim()) return;
    setAdding(true);
    try {
      await deficiencyApi.create({
        assignment_id: a.id,
        title: form.title,
        severity: form.severity,
        description: form.description || undefined,
        remediation_plan: form.remediation_plan || undefined,
        due_date: form.due_date || undefined,
      });
      setForm({ title: "", severity: "high", description: "", remediation_plan: "", due_date: "" });
      onUpdate();
    } finally {
      setAdding(false);
    }
  };

  const updateStatus = async (defId: number, status: DeficiencyStatus) => {
    await deficiencyApi.update(defId, { status });
    onUpdate();
  };

  const deleteDeficiency = async (defId: number) => {
    if (!confirm("Delete this deficiency?")) return;
    await deficiencyApi.delete(defId);
    onUpdate();
  };

  return (
    <div className="border border-red-200 rounded-lg bg-red-50 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ExclamationTriangleIcon className="w-4 h-4 text-red-500 shrink-0" />
        <p className="text-sm font-semibold text-red-700">Deficiencies ({a.deficiencies.length})</p>
      </div>

      {/* Existing deficiencies */}
      {a.deficiencies.length > 0 && (
        <ul className="space-y-3">
          {a.deficiencies.map((d) => (
            <li key={d.id} className="bg-white border border-red-100 rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[d.severity]}`}>
                    {d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}
                  </span>
                  <span className="text-sm font-medium text-gray-900">{d.title}</span>
                </div>
                <button onClick={() => deleteDeficiency(d.id)} className="text-red-400 hover:text-red-600 shrink-0">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              {d.description && <p className="text-xs text-gray-500">{d.description}</p>}
              {d.remediation_plan && (
                <p className="text-xs text-gray-600"><span className="font-medium">Remediation: </span>{d.remediation_plan}</p>
              )}
              <div className="flex items-center gap-3 flex-wrap">
                {d.due_date && <span className="text-xs text-gray-400">Due: {d.due_date}</span>}
                <select
                  className={`text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none font-medium ${DEFICIENCY_STATUS_COLORS[d.status]}`}
                  value={d.status}
                  onChange={(e) => updateStatus(d.id, e.target.value as DeficiencyStatus)}
                >
                  {(Object.keys(DEFICIENCY_STATUS_LABELS) as DeficiencyStatus[]).map((s) => (
                    <option key={s} value={s}>{DEFICIENCY_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Log deficiency form */}
      <div className="bg-white border border-red-100 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-gray-600">Log Deficiency</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 col-span-1 sm:col-span-2"
          />
          <div>
            <label className="block text-xs text-gray-400 mb-0.5">Severity</label>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as DeficiencySeverity })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-0.5">Due Date</label>
            <input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
          </div>
          <textarea
            rows={2}
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 col-span-1 sm:col-span-2"
          />
          <textarea
            rows={2}
            placeholder="Remediation plan (optional)"
            value={form.remediation_plan}
            onChange={(e) => setForm({ ...form, remediation_plan: e.target.value })}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 col-span-1 sm:col-span-2"
          />
        </div>
        <button
          onClick={addDeficiency}
          disabled={adding || !form.title.trim()}
          className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add Deficiency"}
        </button>
      </div>
    </div>
  );
}

function AssignmentRow({
  a,
  cycleId,
  users,
  onUpdate,
  isSelected,
  onToggle,
  initialOpen,
}: {
  a: TestAssignment;
  cycleId: number;
  users: User[];
  onUpdate: () => void;
  isSelected?: boolean;
  onToggle?: (id: number) => void;
  initialOpen?: boolean;
}) {
  const user    = getUser();
  const [open, setOpen]   = useState(initialOpen ?? false);
  const [notes, setNotes] = useState(a.tester_notes ?? "");
  const [comments, setComments] = useState(a.reviewer_comments ?? "");
  const [testerId, setTesterId]     = useState<string>(a.tester_id ? String(a.tester_id) : "");
  const [reviewerId, setReviewerId] = useState<string>(a.reviewer_id ? String(a.reviewer_id) : "");
  const [uploading, setUploading] = useState(false);
  const [file, setFile]   = useState<File | null>(null);
  const [fileDesc, setFileDesc] = useState("");

  // workpaper state
  const [testingSteps, setTestingSteps]       = useState(a.testing_steps ?? "");
  const [sampleDetails, setSampleDetails]     = useState(a.sample_details ?? "");
  const [walkthroughNotes, setWalkthroughNotes] = useState(a.walkthrough_notes ?? "");
  const [conclusion, setConclusion]           = useState(a.conclusion ?? "");
  const [evidenceReqText, setEvidenceReqText] = useState(a.evidence_request_text ?? "");
  const [evidenceReqDue, setEvidenceReqDue]   = useState(a.evidence_request_due_date ?? "");

  // signoff state
  const [signoffNote, setSignoffNote]       = useState("");
  const [decidingNote, setDecidingNote]     = useState("");
  const [submitting, setSubmitting]         = useState(false);
  const [deciding, setDeciding]             = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason, setReturnReason]     = useState("");
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason]     = useState("");
  const [reopening, setReopening]           = useState(false);

  const transition = NEXT_STATUS[a.status as AssignmentStatus];

  const advance = async () => {
    if (!transition) return;
    await cyclesApi.updateAssignment(cycleId, a.id, { status: transition.to });
    onUpdate();
  };

  const markFailed = async () => {
    await cyclesApi.updateAssignment(cycleId, a.id, { status: "failed" });
    onUpdate();
  };

  const reopen = async () => {
    await cyclesApi.updateAssignment(cycleId, a.id, { status: "in_progress" });
    onUpdate();
  };

  const saveNotes = async () => {
    await cyclesApi.updateAssignment(cycleId, a.id, {
      tester_id:        testerId   ? Number(testerId)   : null,
      reviewer_id:      reviewerId ? Number(reviewerId) : null,
      tester_notes:     notes,
      reviewer_comments: comments,
      testing_steps:    testingSteps    || null,
      sample_details:   sampleDetails   || null,
      walkthrough_notes: walkthroughNotes || null,
      conclusion:        conclusion       || null,
      evidence_request_text:     evidenceReqText || null,
      evidence_request_due_date: evidenceReqDue  || null,
    });
    onUpdate();
  };

  const submitForReview = async () => {
    if (!confirm("Submit this assignment for review? Make sure your notes and workpaper are complete.")) return;
    setSubmitting(true);
    try {
      await cyclesApi.submitForReview(cycleId, a.id, signoffNote || undefined);
      setSignoffNote("");
      onUpdate();
    } finally {
      setSubmitting(false);
    }
  };

  const decide = async (outcome: "approved" | "returned" | "failed", reason?: string) => {
    const labels = { approved: "approve", returned: "return for rework", failed: "mark as failed" };
    if (!confirm(`Are you sure you want to ${labels[outcome]} this assignment?`)) return;
    setDeciding(true);
    try {
      await cyclesApi.reviewerDecide(cycleId, a.id, outcome, decidingNote || undefined, reason);
      setDecidingNote("");
      setReturnReason("");
      setShowReturnModal(false);
      onUpdate();
    } finally {
      setDeciding(false);
    }
  };

  const doReopen = async () => {
    if (reopenReason.trim().length < 10) return;
    setReopening(true);
    try {
      await cyclesApi.reopenEvidence(cycleId, a.id, reopenReason.trim());
      setReopenReason("");
      setShowReopenModal(false);
      onUpdate();
    } finally {
      setReopening(false);
    }
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    try {
      await evidenceApi.upload(a.id, file, fileDesc);
      setFile(null);
      setFileDesc("");
      onUpdate();
    } finally {
      setUploading(false);
    }
  };

  const deleteEvidence = async (evId: number) => {
    if (!confirm("Remove this evidence file?")) return;
    await evidenceApi.delete(evId);
    onUpdate();
  };

  const canFail = ["in_progress", "needs_review", "complete"].includes(a.status);
  const showDeficienciesPanel = a.status === "failed" || a.deficiencies.length > 0;

  return (
    <div id={`assignment-${a.id}`} className="border border-gray-200 rounded-lg overflow-hidden scroll-mt-4">
      {/* Row header */}
      <div className="w-full flex items-center bg-white hover:bg-gray-50">
        {onToggle && (
          <label
            className="pl-4 flex items-center self-stretch cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={() => onToggle(a.id)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        )}
        <button
          className="flex-1 flex items-center gap-3 px-4 py-3 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          <ChevronDownIcon className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-brand-600">{a.control?.control_id}</span>
              <span className="font-medium text-sm text-gray-900">{a.control?.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {a.control?.mappings && Array.from(new Set(a.control.mappings.map((m) => m.framework))).map((f) => (
                <FrameworkBadge key={f} framework={f} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-400">{a.tester?.display_name ?? "Unassigned"}</span>
            <StatusBadge status={a.status} />
            {a.evidence.length > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                <PaperClipIcon className="w-3.5 h-3.5" />
                {a.evidence.length}
              </span>
            )}
            {(a.checklist_items?.length ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-blue-400" title="Checklist">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {a.checklist_items!.filter(i => i.completed).length}/{a.checklist_items!.length}
              </span>
            )}
            {a.deficiencies.length > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-red-400">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                {a.deficiencies.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
          {/* Tester / Reviewer assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tester</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={testerId}
                onChange={(e) => setTesterId(e.target.value)}
                disabled={user?.role === "reviewer"}
              >
                <option value="">Unassigned</option>
                {users.filter((u) => u.role === "tester" || u.role === "admin").map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reviewer</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={reviewerId}
                onChange={(e) => setReviewerId(e.target.value)}
                disabled={user?.role === "tester"}
              >
                <option value="">Unassigned</option>
                {users.filter((u) => u.role === "reviewer" || u.role === "admin").map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tester notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tester Notes</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Document testing steps, observations..."
              disabled={user?.role === "reviewer"}
            />
          </div>

          {/* ── Workpaper fields ─────────────────────────────────────────── */}
          <details className="group">
            <summary className="text-xs font-semibold text-gray-500 cursor-pointer select-none flex items-center gap-1 py-1">
              <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
              Workpaper Details
              {(testingSteps || sampleDetails || walkthroughNotes || conclusion) && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-brand-100 text-brand-700 rounded">filled</span>
              )}
            </summary>
            <div className="mt-2 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Testing Steps</label>
                <textarea rows={3} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={testingSteps} onChange={e => setTestingSteps(e.target.value)}
                  placeholder="Step-by-step procedure followed..." disabled={user?.role === "reviewer"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sample Details</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={sampleDetails} onChange={e => setSampleDetails(e.target.value)}
                  placeholder="Sample size, selection methodology..." disabled={user?.role === "reviewer"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Walkthrough Notes</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={walkthroughNotes} onChange={e => setWalkthroughNotes(e.target.value)}
                  placeholder="Observations from walkthrough..." disabled={user?.role === "reviewer"} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Conclusion</label>
                <textarea rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={conclusion} onChange={e => setConclusion(e.target.value)}
                  placeholder="Overall testing conclusion..." disabled={user?.role === "reviewer"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Evidence Request Text</label>
                  <textarea rows={2} className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    value={evidenceReqText} onChange={e => setEvidenceReqText(e.target.value)}
                    placeholder="Text of evidence request sent to control owner..." disabled={user?.role === "reviewer"} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Evidence Due Date</label>
                  <input type="date" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={evidenceReqDue} onChange={e => setEvidenceReqDue(e.target.value)} disabled={user?.role === "reviewer"} />
                </div>
              </div>
            </div>
          </details>

          {/* Reviewer comments */}
          {(a.status === "needs_review" || a.status === "complete") && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Reviewer Comments</label>
              <textarea
                rows={2}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Reviewer feedback..."
                disabled={user?.role === "tester"}
              />
            </div>
          )}

          {/* Evidence list */}
          {a.evidence.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Evidence Files</p>
              <ul className="space-y-1">
                {a.evidence.map((ev) => (
                  <li key={ev.id} className="flex items-center gap-2 text-sm">
                    <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 flex-1">{ev.original_filename}</span>
                    {ev.description && <span className="text-gray-400 text-xs">{ev.description}</span>}
                    <button onClick={() => deleteEvidence(ev.id)} className="text-red-400 hover:text-red-600">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Upload */}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs flex-1 border border-gray-200 rounded-lg p-1.5 bg-white"
            />
            <input
              type="text"
              placeholder="File description (optional)"
              value={fileDesc}
              onChange={(e) => setFileDesc(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white sm:w-48 focus:outline-none"
            />
            <button
              onClick={uploadFile}
              disabled={!file || uploading}
              className="text-xs bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <button
              onClick={saveNotes}
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100"
            >
              Save Notes
            </button>
            {a.status === "failed" && (
              <button
                onClick={reopen}
                className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700"
              >
                Reopen
              </button>
            )}
          </div>

          {/* ── Signoff / Attestation ─────────────────────────────────────── */}
          {/* Tester: submit for review */}
          {["not_started", "in_progress"].includes(a.status) && user?.role !== "reviewer" && (
            <div className="border border-brand-200 rounded-lg bg-brand-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-brand-700">Submit for Review</p>
              <textarea
                rows={2}
                className="w-full border border-brand-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                placeholder="Optional signoff note (e.g. 'All sample items passed, evidence attached')"
                value={signoffNote}
                onChange={e => setSignoffNote(e.target.value)}
              />
              <button
                onClick={submitForReview}
                disabled={submitting}
                className="text-xs bg-brand-600 text-white rounded-lg px-3 py-1.5 hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit for Review"}
              </button>
            </div>
          )}

          {/* Submission receipt banner */}
          {a.tester_submitted_at && (
            <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-gray-700">Submitted for review</span>
                {" by "}
                <span className="font-medium">{a.tester_submitter?.display_name ?? `User #${a.tester_submitted_by_id}`}</span>
                {" on "}
                {new Date(a.tester_submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {a.tester_signoff_note && <p className="mt-0.5 italic text-gray-400">&ldquo;{a.tester_signoff_note}&rdquo;</p>}
              </div>
            </div>
          )}

          {/* Reviewer: decide */}
          {a.status === "needs_review" && (user?.role === "reviewer" || user?.role === "admin") && (
            <div className="border border-indigo-200 rounded-lg bg-indigo-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-indigo-700">Reviewer Decision</p>

              {/* Rework count warning */}
              {(a.rework_count ?? 0) >= 3 && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-700">
                  <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Repeated rework:</strong> This assignment has been returned {a.rework_count} times.
                    GRC managers have been notified.
                  </span>
                </div>
              )}
              {(a.rework_count ?? 0) > 0 && (a.rework_count ?? 0) < 3 && (
                <p className="text-xs text-yellow-700">
                  Returned for rework <strong>{a.rework_count}x</strong> previously.
                </p>
              )}

              <textarea
                rows={2}
                className="w-full border border-indigo-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                placeholder="Optional reviewer notes..."
                value={decidingNote}
                onChange={e => setDecidingNote(e.target.value)}
              />
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => decide("approved")} disabled={deciding}
                  className="flex items-center gap-1 text-xs bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-50">
                  <CheckCircleIcon className="w-3.5 h-3.5" /> Approve
                </button>
                <button onClick={() => setShowReturnModal(true)} disabled={deciding}
                  className="flex items-center gap-1 text-xs bg-yellow-500 text-white rounded-lg px-3 py-1.5 hover:bg-yellow-600 disabled:opacity-50">
                  <ArrowUturnLeftIcon className="w-3.5 h-3.5" /> Return for Rework
                </button>
                <button onClick={() => decide("failed")} disabled={deciding}
                  className="flex items-center gap-1 text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700 disabled:opacity-50">
                  <XCircleIcon className="w-3.5 h-3.5" /> Fail
                </button>
              </div>
            </div>
          )}

          {/* Return for Rework modal */}
            {showReturnModal && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
                  <h3 className="font-semibold text-gray-900">Return for Rework</h3>
                  <p className="text-xs text-gray-500">Provide a clear reason (min 10 characters) so the tester knows what to fix.</p>
                  <textarea
                    rows={3}
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    placeholder="Describe what needs to be corrected..."
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                  />
                  {returnReason.length > 0 && returnReason.trim().length < 10 && (
                    <p className="text-xs text-red-600">Reason must be at least 10 characters.</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowReturnModal(false); setReturnReason(""); }}
                      className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      Cancel
                    </button>
                    <button
                      disabled={returnReason.trim().length < 10 || deciding}
                      onClick={() => decide("returned", returnReason.trim())}
                      className="text-sm px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">
                      Return for Rework
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Rework log */}
            {(a.rework_log ?? []).length > 0 && (
              <div className="border border-yellow-200 rounded-lg bg-yellow-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-yellow-700">Rework History ({a.rework_log.length})</p>
                <div className="space-y-1.5">
                  {a.rework_log.map((entry) => (
                    <div key={entry.id} className="text-xs bg-white border border-yellow-200 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-medium text-yellow-800">Return #{entry.rework_number}</span>
                        <span className="text-gray-400">
                          {new Date(entry.returned_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-gray-600 italic">&ldquo;{entry.return_reason}&rdquo;</p>
                      {entry.returned_by && (
                        <p className="text-gray-400 mt-0.5">by {entry.returned_by.display_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reopen Evidence button — for reviewer when evidence looks insufficient */}
            {["needs_review", "in_progress"].includes(a.status) && (
              <button
                onClick={() => setShowReopenModal(true)}
                className="text-xs text-orange-600 hover:text-orange-800 underline"
              >
                Reopen evidence request
              </button>
            )}

            {/* Reopen Evidence modal */}
            {showReopenModal && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
                  <h3 className="font-semibold text-gray-900">Reopen Evidence Request</h3>
                  <p className="text-xs text-gray-500">Explain why the submitted evidence is insufficient (min 10 characters).</p>
                  {(a.reopen_count ?? 0) >= 2 && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg px-3 py-2 text-xs text-red-700">
                      <ExclamationTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Evidence already reopened <strong>{a.reopen_count}x</strong>. GRC managers have been notified.</span>
                    </div>
                  )}
                  <textarea
                    rows={3}
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                    placeholder="What is missing or insufficient?"
                    value={reopenReason}
                    onChange={e => setReopenReason(e.target.value)}
                  />
                  {reopenReason.length > 0 && reopenReason.trim().length < 10 && (
                    <p className="text-xs text-red-600">Reason must be at least 10 characters.</p>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowReopenModal(false); setReopenReason(""); }}
                      className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      Cancel
                    </button>
                    <button
                      disabled={reopenReason.trim().length < 10 || reopening}
                      onClick={doReopen}
                      className="text-sm px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
                      Reopen
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Evidence reopen history */}
            {(a.evidence_history ?? []).length > 0 && (
              <div className="border border-orange-200 rounded-lg bg-orange-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-700">Evidence Request History</p>
                <div className="space-y-1.5">
                  {a.evidence_history.map((entry) => (
                    <div key={entry.id} className="text-xs bg-white border border-orange-200 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className={`font-medium capitalize ${
                          entry.action === "reopened" ? "text-orange-700" :
                          entry.action === "fulfilled" ? "text-green-700" : "text-gray-700"
                        }`}>{entry.action}</span>
                        <span className="text-gray-400">
                          {new Date(entry.occurred_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      {entry.reason && <p className="text-gray-600 italic">&ldquo;{entry.reason}&rdquo;</p>}
                      {entry.actor && <p className="text-gray-400 mt-0.5">by {entry.actor.display_name}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Reviewer decision receipt */}
          {a.reviewer_decided_at && (
            <div className={`flex items-start gap-2 text-xs border rounded-lg px-3 py-2 ${
              a.reviewer_outcome === "approved" ? "bg-green-50 border-green-200 text-green-700" :
              a.reviewer_outcome === "failed"   ? "bg-red-50 border-red-200 text-red-700" :
              "bg-yellow-50 border-yellow-200 text-yellow-700"
            }`}>
              {a.reviewer_outcome === "approved" ? <CheckCircleIcon className="w-4 h-4 shrink-0 mt-0.5" /> :
               a.reviewer_outcome === "failed"   ? <XCircleIcon className="w-4 h-4 shrink-0 mt-0.5" /> :
               <ArrowUturnLeftIcon className="w-4 h-4 shrink-0 mt-0.5" />}
              <div>
                <span className="font-semibold capitalize">{a.reviewer_outcome}</span>
                {" by "}
                <span className="font-medium">{a.reviewer_decider?.display_name ?? `User #${a.reviewer_decided_by_id}`}</span>
                {" on "}
                {new Date(a.reviewer_decided_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {a.reviewer_comments && <p className="mt-0.5 italic opacity-75">&ldquo;{a.reviewer_comments}&rdquo;</p>}
              </div>
            </div>
          )}

          {/* Legacy status transition (for failed/reopened flows) */}
          {canFail && a.status !== "needs_review" && (
            <div className="flex gap-2">
              <button
                onClick={markFailed}
                className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
              >
                Mark Failed
              </button>
            </div>
          )}

          {/* Checklist panel */}
          <ChecklistPanel a={a} onUpdate={onUpdate} />

          {/* Deficiencies panel */}
          {showDeficienciesPanel && (
            <DeficienciesPanel a={a} onUpdate={onUpdate} />
          )}
        </div>
      )}
    </div>
  );
}

function NewCyclePage() {
  const router = useRouter();
  const user   = getUser();
  const [form, setForm] = useState({ name: "", description: "", start_date: "", end_date: "", brand: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        brand: form.brand || undefined,
        created_by: user!.id,
      };
      const r = await cyclesApi.create(payload);
      router.push(`/test-cycles/${r.data.id}`);
    } catch {
      setError("Failed to create cycle. Check all fields and try again.");
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => router.push("/test-cycles")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Test Cycles
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">New Test Cycle</h1>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="e.g. Q2 2025 SOC 2 Testing"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Optional description…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Brand</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
            >
              <option value="">— Select brand —</option>
              {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Creating…" : "Create Cycle"}
            </button>
            <button
              onClick={() => router.push("/test-cycles")}
              className="border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function TestCycleDetailPageContent() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const searchParams = useSearchParams();
  const targetAssignmentId = searchParams.get("assignment") ? Number(searchParams.get("assignment")) : null;
  const user    = getUser();
  const [cycle, setCycle]       = useState<TestCycle | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ control_id: "", tester_id: "", reviewer_id: "" });
  const [adding, setAdding]       = useState(false);
  const [bulkingFw, setBulkingFw] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  // ── Bulk-assign state ────────────────────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState<Set<number>>(new Set());
  const [bulkTesterId,   setBulkTesterId]   = useState("");
  const [bulkReviewerId, setBulkReviewerId] = useState("");
  const [bulkApplying,   setBulkApplying]   = useState(false);

  const load = useCallback(() => {
    cyclesApi.get(Number(id)).then((r) => setCycle(r.data));
  }, [id]);

  const handleCloseCycle = async () => {
    if (!cycle) return;
    if (!confirm(`Close "${cycle.name}"? All assignments must be complete or failed. This cannot be undone.`)) return;
    setClosing(true);
    setCloseError(null);
    try {
      const r = await cyclesApi.close(cycle.id);
      setCycle(r.data);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setCloseError(detail ?? "Could not close cycle.");
    } finally {
      setClosing(false);
    }
  };

  useEffect(() => {
    if (id !== "new") {
      load();
      controlsApi.list().then((r) => setControls(r.data));
      usersApi.list().then((r) => setUsers(r.data));
    }
  }, [id, load]);

  // Scroll to targeted assignment when coming from My Work
  useEffect(() => {
    if (!targetAssignmentId) return;
    const el = document.getElementById(`assignment-${targetAssignmentId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [targetAssignmentId, cycle]);

  const addByFramework = async (fw: string) => {
    setBulkingFw(fw);
    try {
      const r = await cyclesApi.bulkAddFramework(Number(id), fw);
      load();
      if (r.data.added === 0) alert(`All ${fw} controls are already in this cycle.`);
    } finally {
      setBulkingFw(null);
    }
  };

  const addControl = async () => {
    if (!addForm.control_id) return;
    setAdding(true);
    try {
      await cyclesApi.addAssignment(Number(id), {
        control_id: Number(addForm.control_id),
        tester_id:  addForm.tester_id  ? Number(addForm.tester_id)  : undefined,
        reviewer_id: addForm.reviewer_id ? Number(addForm.reviewer_id) : undefined,
      });
      setAddForm({ control_id: "", tester_id: "", reviewer_id: "" });
      setShowAdd(false);
      load();
    } finally {
      setAdding(false);
    }
  };

  const toggleSelected = (assignId: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(assignId) ? next.delete(assignId) : next.add(assignId);
      return next;
    });
  };

  const applyBulkAssign = async () => {
    if (selectedIds.size === 0) return;
    const patch: Record<string, number> = {};
    if (bulkTesterId)   patch.tester_id   = Number(bulkTesterId);
    if (bulkReviewerId) patch.reviewer_id = Number(bulkReviewerId);
    if (!patch.tester_id && !patch.reviewer_id) return;
    setBulkApplying(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(assignId =>
          cyclesApi.updateAssignment(Number(id), assignId, patch)
        )
      );
      setSelectedIds(new Set());
      setBulkTesterId("");
      setBulkReviewerId("");
      load();
    } finally {
      setBulkApplying(false);
    }
  };

  if (id === "new") return <NewCyclePage />;

  if (!cycle) {
    return <AppShell><div className="text-center py-20 text-gray-400">Loading…</div></AppShell>;
  }

  const total    = cycle.assignments.length;
  const complete = cycle.assignments.filter((a) => a.status === "complete").length;
  const pct      = total === 0 ? 0 : Math.round((complete / total) * 100);
  const assignedControlIds = new Set(cycle.assignments.map((a) => a.control_id));
  const availableControls  = controls.filter((c) => !assignedControlIds.has(c.id));
  const frameworks = Array.from(new Set(controls.flatMap((c) => c.mappings.map((m) => m.framework)))).sort();

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <button onClick={() => router.push("/test-cycles")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Test Cycles
        </button>

        {/* Cycle header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={cycle.status} />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{cycle.name}</h1>
                {cycle.brand && (
                  <span className="text-xs font-semibold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">
                    {cycle.brand}
                  </span>
                )}
              </div>
              {cycle.description && <p className="text-sm text-gray-500 mt-1">{cycle.description}</p>}
              {cycle.start_date && (
                <p className="text-xs text-gray-400 mt-2">{cycle.start_date} → {cycle.end_date}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadExport(
                    `/exports/test-cycles/${cycle.id}`,
                    `test_cycle_${cycle.id}_${cycle.name.replace(/\s+/g,"_").slice(0,30)}_${new Date().toISOString().slice(0,10)}.xlsx`
                  )}
                  className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors"
                >
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                  Export Report
                </button>
                {(user?.role === "admin" || user?.role === "grc_manager") && cycle.status !== "completed" && (
                  <button
                    onClick={handleCloseCycle}
                    disabled={closing}
                    className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <ArchiveBoxIcon className="w-3.5 h-3.5" />
                    {closing ? "Closing…" : "Close Cycle"}
                  </button>
                )}
              </div>
              {closeError && (
                <p className="text-xs text-red-600 max-w-xs text-right">{closeError}</p>
              )}
              {cycle.status === "completed" && cycle.closed_at && (
                <p className="text-xs text-green-600">
                  Closed {new Date(cycle.closed_at).toLocaleDateString()}
                </p>
              )}
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{pct}%</p>
                <p className="text-xs text-gray-400">{complete} / {total} complete</p>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Assignments */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {user?.role === "admin" && cycle.assignments.length > 0 && (
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={selectedIds.size === cycle.assignments.length}
                  onChange={e =>
                    setSelectedIds(e.target.checked
                      ? new Set(cycle.assignments.map(a => a.id))
                      : new Set()
                    )
                  }
                  title="Select all"
                />
              )}
              <h2 className="text-sm font-semibold text-gray-600">
                Control Assignments ({cycle.assignments.length})
              </h2>
            </div>
            {user?.role === "admin" && (
              <button
                onClick={() => setShowAdd((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700"
              >
                <PlusIcon className="w-4 h-4" /> Add Control
              </button>
            )}
          </div>

          {/* Bulk-assign toolbar */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <span className="text-sm text-blue-700 font-medium shrink-0">
                {selectedIds.size} selected
              </span>
              <select
                value={bulkTesterId}
                onChange={e => setBulkTesterId(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tester: no change</option>
                {users.filter(u => u.role === "tester" || u.role === "admin").map(u => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
              <select
                value={bulkReviewerId}
                onChange={e => setBulkReviewerId(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Reviewer: no change</option>
                {users.filter(u => u.role === "reviewer" || u.role === "admin").map(u => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
              <button
                onClick={applyBulkAssign}
                disabled={bulkApplying || (!bulkTesterId && !bulkReviewerId)}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
              >
                {bulkApplying ? "Applying…" : `Apply to ${selectedIds.size}`}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1.5 shrink-0"
              >
                Clear
              </button>
            </div>
          )}

          {/* Add control panel */}
          {showAdd && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-4">
              {/* Framework quick-add */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Add all controls by framework</p>
                <div className="flex flex-wrap gap-2">
                  {frameworks.map((fw) => (
                    <button
                      key={fw}
                      onClick={() => addByFramework(fw)}
                      disabled={bulkingFw !== null}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-brand-300 text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-50 transition-colors"
                    >
                      {bulkingFw === fw ? "Adding…" : `+ All ${fw}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Or add a single control</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Control *</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={addForm.control_id}
                    onChange={(e) => setAddForm({ ...addForm, control_id: e.target.value })}
                  >
                    <option value="">Select a control…</option>
                    {availableControls.map((c) => (
                      <option key={c.id} value={c.id}>{c.control_id} — {c.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tester</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={addForm.tester_id}
                    onChange={(e) => setAddForm({ ...addForm, tester_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.filter((u) => u.role === "tester").map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Reviewer</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    value={addForm.reviewer_id}
                    onChange={(e) => setAddForm({ ...addForm, reviewer_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {users.filter((u) => u.role === "reviewer").map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addControl}
                  disabled={adding || !addForm.control_id}
                  className="text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {adding ? "Adding…" : "Add"}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {cycle.assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                a={a}
                cycleId={cycle.id}
                users={users}
                onUpdate={load}
                isSelected={selectedIds.has(a.id)}
                onToggle={user?.role === "admin" ? toggleSelected : undefined}
              />
            ))}
            {cycle.assignments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10">No assignments in this cycle.</p>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function TestCycleDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>}>
      <TestCycleDetailPageContent />
    </Suspense>
  );
}
