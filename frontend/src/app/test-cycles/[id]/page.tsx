"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import FrameworkBadge from "@/components/FrameworkBadge";
import { cyclesApi, evidenceApi, controlsApi, usersApi, deficiencyApi, checklistApi, downloadExport } from "@/lib/api";
import { CheckCircleIcon, XCircleIcon, ArrowUturnLeftIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { getUser } from "@/lib/auth";
import type { TestCycle, TestAssignment, AssignmentStatus, Control, User, Deficiency, DeficiencyStatus, DeficiencySeverity, ChecklistItem } from "@/types";
import { BRANDS } from "@/types";
import { ArrowLeftIcon, PaperClipIcon, TrashIcon, PlusIcon, ExclamationTriangleIcon, ArrowDownTrayIcon, ArchiveBoxIcon } from "@heroicons/react/24/outline";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

// ── Chart constants ───────────────────────────────────────────────────────────

const STATUS_PIE_COLORS: Record<string, string> = {
  not_started:  "#94a3b8",
  in_progress:  "#3b82f6",
  needs_review: "#f59e0b",
  complete:     "#22c55e",
  failed:       "#ef4444",
};

const STATUS_PIE_LABELS: Record<string, string> = {
  not_started:  "Not Started",
  in_progress:  "In Progress",
  needs_review: "Needs Review",
  complete:     "Complete",
  failed:       "Failed",
};

const TESTER_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#06b6d4","#f97316","#ec4899","#64748b"];

// ── ChecklistPanel ────────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-semibold text-blue-700">
            Checklist ({completed}/{total})
          </p>
        </div>
        {total > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-blue-600 font-medium">{pct}%</span>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 bg-white border border-blue-100 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={() => toggle(item)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
              />
              <span className={`text-sm flex-1 ${item.completed ? "line-through text-gray-400" : "text-gray-700"}`}>
                {item.title}
              </span>
              <button onClick={() => deleteItem(item.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                <TrashIcon className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {showInput ? (
        <div className="flex gap-2">
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); if (e.key === "Escape") setShowInput(false); }}
            placeholder="Checklist item..."
            className="flex-1 text-xs border border-blue-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          />
          <button
            onClick={addItem}
            disabled={adding || !newTitle.trim()}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
          <button onClick={() => setShowInput(false)} className="text-xs text-gray-500 px-2">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowInput(true)}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          <PlusIcon className="w-3.5 h-3.5" /> Add item
        </button>
      )}
    </div>
  );
}

// ── DeficienciesPanel ─────────────────────────────────────────────────────────

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

// ── AssignmentRow – compact clickable row (no inline expansion) ───────────────

function AssignmentRow({
  a,
  isSelected,
  onToggle,
  onOpenDrawer,
}: {
  a: TestAssignment;
  isSelected?: boolean;
  onToggle?: (id: number) => void;
  onOpenDrawer: (a: TestAssignment) => void;
}) {
  return (
    <div
      id={`assignment-${a.id}`}
      className="border border-gray-200 rounded-lg overflow-hidden scroll-mt-4"
    >
      <div className="w-full flex items-center bg-white hover:bg-gray-50 transition-colors">
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
          className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left"
          onClick={() => onOpenDrawer(a)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-brand-600">{a.control?.control_id}</span>
              <span className="font-medium text-sm text-gray-900 truncate">{a.control?.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {a.control?.mappings &&
                Array.from(new Set(a.control.mappings.map((m) => m.framework))).map((f) => (
                  <FrameworkBadge key={f} framework={f} />
                ))}
            </div>
          </div>
          <div className="flex items-center gap-4 shrink-0">

            {/* Tester + Reviewer people display */}
            <div className="hidden md:flex flex-col gap-0.5 text-xs min-w-[140px]">
              {/* Tester */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-4 shrink-0">T</span>
                {a.tester ? (
                  <>
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {a.tester.display_name.split(" ").slice(0,2).map(w => w[0]?.toUpperCase() ?? "").join("")}
                    </span>
                    <span className="text-gray-700 truncate max-w-[90px]">{a.tester.display_name}</span>
                  </>
                ) : (
                  <span className="text-gray-400 italic">Unassigned</span>
                )}
              </div>
              {/* Reviewer */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-4 shrink-0">R</span>
                {a.reviewer ? (
                  <>
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {a.reviewer.display_name.split(" ").slice(0,2).map(w => w[0]?.toUpperCase() ?? "").join("")}
                    </span>
                    <span className="text-gray-700 truncate max-w-[90px]">{a.reviewer.display_name}</span>
                  </>
                ) : (
                  <span className="text-gray-400 italic">Unassigned</span>
                )}
              </div>
            </div>

            {/* Status */}
            <StatusBadge status={a.status} />

            {/* Counts */}
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
                {a.checklist_items!.filter((i) => i.completed).length}/{a.checklist_items!.length}
              </span>
            )}
            {a.deficiencies.length > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-red-400">
                <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                {a.deficiencies.length}
              </span>
            )}

            {/* Open indicator */}
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── AssignmentDrawer – right-side slide-over with 4 tabs ─────────────────────

type DrawerTab = "assignment" | "workpaper" | "evidence" | "findings";

const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: "assignment", label: "Assignment" },
  { id: "workpaper",  label: "Workpaper"  },
  { id: "evidence",   label: "Evidence"   },
  { id: "findings",   label: "Findings"   },
];

function AssignmentDrawer({
  a,
  cycleId,
  users,
  onUpdate,
  onClose,
}: {
  a: TestAssignment;
  cycleId: number;
  users: User[];
  onUpdate: () => void;
  onClose: () => void;
}) {
  const user = getUser();
  const [activeTab, setActiveTab] = useState<DrawerTab>("assignment");

  // ── Field state ─────────────────────────────────────────────────────────────
  const [notes,      setNotes]      = useState(a.tester_notes ?? "");
  const [comments,   setComments]   = useState(a.reviewer_comments ?? "");
  const [testerId,   setTesterId]   = useState<string>(a.tester_id   ? String(a.tester_id)   : "");
  const [reviewerId, setReviewerId] = useState<string>(a.reviewer_id ? String(a.reviewer_id) : "");

  // Workpaper
  const [testingSteps,     setTestingSteps]     = useState(a.testing_steps ?? "");
  const [sampleDetails,    setSampleDetails]    = useState(a.sample_details ?? "");
  const [walkthroughNotes, setWalkthroughNotes] = useState(a.walkthrough_notes ?? "");
  const [conclusion,       setConclusion]       = useState(a.conclusion ?? "");
  const [evidenceReqText,  setEvidenceReqText]  = useState(a.evidence_request_text ?? "");
  const [evidenceReqDue,   setEvidenceReqDue]   = useState(a.evidence_request_due_date ?? "");

  // Evidence upload
  const [uploading, setUploading] = useState(false);
  const [file,      setFile]      = useState<File | null>(null);
  const [fileDesc,  setFileDesc]  = useState("");

  // Signoff / review
  const [signoffNote,  setSignoffNote]  = useState("");
  const [decidingNote, setDecidingNote] = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [deciding,     setDeciding]     = useState(false);

  // Modals
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnReason,    setReturnReason]    = useState("");
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason,    setReopenReason]    = useState("");
  const [reopening,       setReopening]       = useState(false);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const canFail = ["in_progress", "needs_review", "complete"].includes(a.status);
  const showDeficienciesPanel = a.status === "failed" || a.deficiencies.length > 0;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const saveNotes = async () => {
    await cyclesApi.updateAssignment(cycleId, a.id, {
      tester_id:                testerId   ? Number(testerId)   : null,
      reviewer_id:              reviewerId ? Number(reviewerId) : null,
      tester_notes:             notes,
      reviewer_comments:        comments,
      testing_steps:            testingSteps    || null,
      sample_details:           sampleDetails   || null,
      walkthrough_notes:        walkthroughNotes || null,
      conclusion:               conclusion       || null,
      evidence_request_text:    evidenceReqText  || null,
      evidence_request_due_date: evidenceReqDue  || null,
    });
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

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[700px] bg-white z-50 shadow-2xl flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-brand-600">{a.control?.control_id}</span>
              <StatusBadge status={a.status} />
              {(a.checklist_items?.length ?? 0) > 0 && (
                <span className="text-xs text-blue-500">
                  {a.checklist_items!.filter((i) => i.completed).length}/{a.checklist_items!.length} checklist
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 leading-snug">{a.control?.title}</h2>
            {a.control?.mappings && (
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {Array.from(new Set(a.control.mappings.map((m) => m.framework))).map((f) => (
                  <FrameworkBadge key={f} framework={f} />
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-gray-200 bg-white shrink-0 px-2">
          {DRAWER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
              {/* Badge counts on tabs */}
              {tab.id === "evidence"  && a.evidence.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{a.evidence.length}</span>
              )}
              {tab.id === "findings" && (a.deficiencies.length > 0 || (a.checklist_items?.length ?? 0) > 0) && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {a.deficiencies.length + (a.checklist_items?.length ?? 0)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ───────────────── ASSIGNMENT TAB ───────────────── */}
          {activeTab === "assignment" && (
            <div className="px-6 py-5 space-y-5">

              {/* Tester / Reviewer */}
              <div className="grid grid-cols-2 gap-3">
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
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Document testing steps, observations..."
                  disabled={user?.role === "reviewer"}
                />
              </div>

              {/* Reviewer comments */}
              {(a.status === "needs_review" || a.status === "complete") && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reviewer Comments</label>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Reviewer feedback..."
                    disabled={user?.role === "tester"}
                  />
                </div>
              )}

              {/* Save + status actions */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={saveNotes}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-100 font-medium"
                >
                  Save
                </button>
                {a.status === "failed" && (
                  <button
                    onClick={reopen}
                    className="text-sm bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700"
                  >
                    Reopen
                  </button>
                )}
                {canFail && a.status !== "needs_review" && (
                  <button
                    onClick={markFailed}
                    className="text-sm bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
                  >
                    Mark Failed
                  </button>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100" />

              {/* Submit for review (tester) */}
              {["not_started", "in_progress"].includes(a.status) && user?.role !== "reviewer" && (
                <div className="border border-brand-200 rounded-xl bg-brand-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-brand-700">Submit for Review</p>
                  <textarea
                    rows={2}
                    className="w-full border border-brand-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
                    placeholder="Optional signoff note (e.g. 'All sample items passed, evidence attached')"
                    value={signoffNote}
                    onChange={(e) => setSignoffNote(e.target.value)}
                  />
                  <button
                    onClick={submitForReview}
                    disabled={submitting}
                    className="text-sm bg-brand-600 text-white rounded-lg px-4 py-1.5 hover:bg-brand-700 disabled:opacity-50"
                  >
                    {submitting ? "Submitting…" : "Submit for Review"}
                  </button>
                </div>
              )}

              {/* Submission receipt */}
              {a.tester_submitted_at && (
                <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
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

              {/* Reviewer decision panel */}
              {a.status === "needs_review" && (user?.role === "reviewer" || user?.role === "admin") && (
                <div className="border border-indigo-200 rounded-xl bg-indigo-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-indigo-700">Reviewer Decision</p>

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
                    className="w-full border border-indigo-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                    placeholder="Optional reviewer notes..."
                    value={decidingNote}
                    onChange={(e) => setDecidingNote(e.target.value)}
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => decide("approved")}
                      disabled={deciding}
                      className="flex items-center gap-1 text-sm bg-green-600 text-white rounded-lg px-3 py-1.5 hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="w-4 h-4" /> Approve
                    </button>
                    <button
                      onClick={() => setShowReturnModal(true)}
                      disabled={deciding}
                      className="flex items-center gap-1 text-sm bg-yellow-500 text-white rounded-lg px-3 py-1.5 hover:bg-yellow-600 disabled:opacity-50"
                    >
                      <ArrowUturnLeftIcon className="w-4 h-4" /> Return for Rework
                    </button>
                    <button
                      onClick={() => decide("failed")}
                      disabled={deciding}
                      className="flex items-center gap-1 text-sm bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700 disabled:opacity-50"
                    >
                      <XCircleIcon className="w-4 h-4" /> Fail
                    </button>
                  </div>
                </div>
              )}

              {/* Rework log */}
              {(a.rework_log ?? []).length > 0 && (
                <div className="border border-yellow-200 rounded-xl bg-yellow-50 p-4 space-y-2">
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

              {/* Evidence reopen button */}
              {["needs_review", "in_progress"].includes(a.status) && (
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="text-xs text-orange-600 hover:text-orange-800 underline"
                >
                  Reopen evidence request
                </button>
              )}

              {/* Evidence reopen history */}
              {(a.evidence_history ?? []).length > 0 && (
                <div className="border border-orange-200 rounded-xl bg-orange-50 p-4 space-y-2">
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
                <div className={`flex items-start gap-2 text-xs border rounded-lg px-3 py-2.5 ${
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
            </div>
          )}

          {/* ───────────────── WORKPAPER TAB ───────────────── */}
          {activeTab === "workpaper" && (
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Testing Steps</label>
                <textarea
                  rows={4}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={testingSteps}
                  onChange={(e) => setTestingSteps(e.target.value)}
                  placeholder="Step-by-step procedure followed..."
                  disabled={user?.role === "reviewer"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sample Details</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={sampleDetails}
                  onChange={(e) => setSampleDetails(e.target.value)}
                  placeholder="Sample size, selection methodology..."
                  disabled={user?.role === "reviewer"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Walkthrough Notes</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={walkthroughNotes}
                  onChange={(e) => setWalkthroughNotes(e.target.value)}
                  placeholder="Observations from walkthrough..."
                  disabled={user?.role === "reviewer"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Conclusion</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={conclusion}
                  onChange={(e) => setConclusion(e.target.value)}
                  placeholder="Overall testing conclusion..."
                  disabled={user?.role === "reviewer"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Evidence Request Text</label>
                <textarea
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  value={evidenceReqText}
                  onChange={(e) => setEvidenceReqText(e.target.value)}
                  placeholder="Text of evidence request sent to control owner..."
                  disabled={user?.role === "reviewer"}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Evidence Due Date</label>
                <input
                  type="date"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  value={evidenceReqDue}
                  onChange={(e) => setEvidenceReqDue(e.target.value)}
                  disabled={user?.role === "reviewer"}
                />
              </div>
              <button
                onClick={saveNotes}
                className="text-sm border border-gray-300 rounded-lg px-4 py-1.5 hover:bg-gray-100 font-medium"
              >
                Save Workpaper
              </button>
            </div>
          )}

          {/* ───────────────── EVIDENCE TAB ───────────────── */}
          {activeTab === "evidence" && (
            <div className="px-6 py-5 space-y-4">
              {/* File list */}
              {a.evidence.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Attached Files ({a.evidence.length})</p>
                  <ul className="space-y-1.5">
                    {a.evidence.map((ev) => (
                      <li key={ev.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm">
                        <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-gray-700 flex-1 truncate">{ev.original_filename}</span>
                        {ev.description && <span className="text-gray-400 text-xs shrink-0">{ev.description}</span>}
                        <button onClick={() => deleteEvidence(ev.id)} className="text-red-400 hover:text-red-600 shrink-0">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  No evidence files attached yet.
                </div>
              )}

              {/* Upload */}
              <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 space-y-3">
                <p className="text-xs font-medium text-gray-600">Upload New Evidence</p>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs w-full border border-gray-200 rounded-lg p-1.5 bg-white"
                />
                <input
                  type="text"
                  placeholder="File description (optional)"
                  value={fileDesc}
                  onChange={(e) => setFileDesc(e.target.value)}
                  className="text-xs w-full border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                />
                <button
                  onClick={uploadFile}
                  disabled={!file || uploading}
                  className="text-sm bg-brand-600 text-white px-4 py-1.5 rounded-lg hover:bg-brand-700 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          )}

          {/* ───────────────── FINDINGS TAB ───────────────── */}
          {activeTab === "findings" && (
            <div className="px-6 py-5 space-y-4">
              <ChecklistPanel a={a} onUpdate={onUpdate} />
              {showDeficienciesPanel && (
                <DeficienciesPanel a={a} onUpdate={onUpdate} />
              )}
              {!showDeficienciesPanel && (
                <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                  No deficiencies logged. Deficiency logging becomes available when the assignment is failed.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Return for Rework modal ── */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <h3 className="font-semibold text-gray-900">Return for Rework</h3>
            <p className="text-xs text-gray-500">Provide a clear reason (min 10 characters) so the tester knows what to fix.</p>
            <textarea
              rows={3}
              autoFocus
              className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              placeholder="Describe what needs to be corrected..."
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
            />
            {returnReason.length > 0 && returnReason.trim().length < 10 && (
              <p className="text-xs text-red-600">Reason must be at least 10 characters.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowReturnModal(false); setReturnReason(""); }}
                className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={returnReason.trim().length < 10 || deciding}
                onClick={() => decide("returned", returnReason.trim())}
                className="text-sm px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50"
              >
                Return for Rework
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reopen Evidence modal ── */}
      {showReopenModal && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
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
              onChange={(e) => setReopenReason(e.target.value)}
            />
            {reopenReason.length > 0 && reopenReason.trim().length < 10 && (
              <p className="text-xs text-red-600">Reason must be at least 10 characters.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowReopenModal(false); setReopenReason(""); }}
                className="text-sm px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={reopenReason.trim().length < 10 || reopening}
                onClick={doReopen}
                className="text-sm px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── NewCyclePage ──────────────────────────────────────────────────────────────

function NewCyclePage() {
  const router = useRouter();
  const user   = getUser();
  const [form, setForm] = useState({ name: "", description: "", start_date: "", end_date: "", brands: [] as string[] });
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
        brand: form.brands.length > 0 ? form.brands.join(",") : undefined,
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
            <label className="block text-xs font-medium text-gray-500 mb-2">Brand</label>
            <div className="flex flex-wrap gap-2">
              {BRANDS.map((b) => {
                const checked = form.brands.includes(b);
                return (
                  <label
                    key={b}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none transition-colors ${
                      checked
                        ? "bg-brand-600 border-brand-600 text-white"
                        : "bg-white border-gray-200 text-gray-700 hover:border-brand-400 hover:text-brand-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        setForm({
                          ...form,
                          brands: checked
                            ? form.brands.filter((x) => x !== b)
                            : [...form.brands, b],
                        })
                      }
                    />
                    {b}
                  </label>
                );
              })}
            </div>
            {form.brands.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">None selected — cycle will have no brand tag.</p>
            )}
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

// ── TestCycleDetailPageContent ────────────────────────────────────────────────

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

  // Bulk-assign state
  const [selectedIds,    setSelectedIds]    = useState<Set<number>>(new Set());
  const [bulkTesterId,   setBulkTesterId]   = useState("");
  const [bulkReviewerId, setBulkReviewerId] = useState("");
  const [bulkApplying,   setBulkApplying]   = useState(false);

  // Drawer state — track by ID so it auto-refreshes when cycle reloads
  const [drawerAssignmentId, setDrawerAssignmentId] = useState<number | null>(null);
  const drawerAssignment = drawerAssignmentId !== null
    ? (cycle?.assignments.find((a) => a.id === drawerAssignmentId) ?? null)
    : null;

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

  // Auto-open drawer when deep-linking from My Work
  useEffect(() => {
    if (!targetAssignmentId || !cycle) return;
    const target = cycle.assignments.find((a) => a.id === targetAssignmentId);
    if (target) setDrawerAssignmentId(target.id);
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
                {cycle.brand && cycle.brand.split(",").map((b) => (
                  <span key={b} className="text-xs font-semibold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">
                    {b.trim()}
                  </span>
                ))}
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

          {/* Mini pie charts */}
          {cycle.assignments.length > 0 && (() => {
            // Tester distribution
            const testerCounts: Record<string, number> = {};
            for (const a of cycle.assignments) {
              const name = a.tester?.display_name ?? "Unassigned";
              testerCounts[name] = (testerCounts[name] ?? 0) + 1;
            }
            const testerData = Object.entries(testerCounts).map(([name, value]) => ({ name, value }));

            // Status distribution
            const statusCounts: Record<string, number> = {};
            for (const a of cycle.assignments) {
              statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
            }
            const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

            return (
              <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* By Tester */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1 text-center">By Tester</p>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={testerData}
                        cx="50%" cy="50%"
                        innerRadius={38} outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {testerData.map((_, i) => (
                          <Cell key={i} fill={TESTER_COLORS[i % TESTER_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} control${v !== 1 ? "s" : ""}`, name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={7}
                        formatter={(name) => <span style={{ fontSize: 11, color: "#374151" }}>{name}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* By Status */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1 text-center">By Status</p>
                  <ResponsiveContainer width="100%" height={170}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%" cy="50%"
                        innerRadius={38} outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {statusData.map((entry, i) => (
                          <Cell key={i} fill={STATUS_PIE_COLORS[entry.name] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number, name: string) => [`${v} control${v !== 1 ? "s" : ""}`, STATUS_PIE_LABELS[name] ?? name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={7}
                        formatter={(name) => <span style={{ fontSize: 11, color: "#374151" }}>{STATUS_PIE_LABELS[name] ?? name}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}
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
                isSelected={selectedIds.has(a.id)}
                onToggle={user?.role === "admin" ? toggleSelected : undefined}
                onOpenDrawer={(assignment) => setDrawerAssignmentId(assignment.id)}
              />
            ))}
            {cycle.assignments.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-10">No assignments in this cycle.</p>
            )}
          </div>
        </div>
      </div>

      {/* Right-side drawer */}
      {drawerAssignment && (
        <AssignmentDrawer
          a={drawerAssignment}
          cycleId={cycle.id}
          users={users}
          onUpdate={load}
          onClose={() => setDrawerAssignmentId(null)}
        />
      )}
    </AppShell>
  );
}

// ── Default export ────────────────────────────────────────────────────────────

export default function TestCycleDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>}>
      <TestCycleDetailPageContent />
    </Suspense>
  );
}
