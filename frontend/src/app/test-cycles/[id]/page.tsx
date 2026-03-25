"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import FrameworkBadge from "@/components/FrameworkBadge";
import { cyclesApi, evidenceApi, controlsApi, usersApi, deficiencyApi, downloadExport } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { TestCycle, TestAssignment, AssignmentStatus, Control, User, Deficiency, DeficiencyStatus, DeficiencySeverity } from "@/types";
import { BRANDS } from "@/types";
import { ArrowLeftIcon, PaperClipIcon, TrashIcon, ChevronDownIcon, PlusIcon, ExclamationTriangleIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";

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
}: {
  a: TestAssignment;
  cycleId: number;
  users: User[];
  onUpdate: () => void;
}) {
  const user    = getUser();
  const [open, setOpen]   = useState(false);
  const [notes, setNotes] = useState(a.tester_notes ?? "");
  const [comments, setComments] = useState(a.reviewer_comments ?? "");
  const [testerId, setTesterId]     = useState<string>(a.tester_id ? String(a.tester_id) : "");
  const [reviewerId, setReviewerId] = useState<string>(a.reviewer_id ? String(a.reviewer_id) : "");
  const [uploading, setUploading] = useState(false);
  const [file, setFile]   = useState<File | null>(null);
  const [fileDesc, setFileDesc] = useState("");

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
    });
    onUpdate();
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
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Row header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 text-left"
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
          {a.deficiencies.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-400">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" />
              {a.deficiencies.length}
            </span>
          )}
        </div>
      </button>

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
            <button
              disabled
              className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 text-gray-400 cursor-not-allowed"
            >
              Request Evidence
            </button>
            {transition && (
              <button
                onClick={advance}
                className="text-xs bg-brand-600 text-white rounded-lg px-3 py-1.5 hover:bg-brand-700"
              >
                {transition.label}
              </button>
            )}
            {canFail && (
              <button
                onClick={markFailed}
                className="text-xs bg-red-600 text-white rounded-lg px-3 py-1.5 hover:bg-red-700"
              >
                Mark Failed
              </button>
            )}
            {a.status === "failed" && (
              <button
                onClick={reopen}
                className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700"
              >
                Reopen
              </button>
            )}
          </div>

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

export default function TestCycleDetailPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const user    = getUser();
  const [cycle, setCycle]       = useState<TestCycle | null>(null);
  const [controls, setControls] = useState<Control[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ control_id: "", tester_id: "", reviewer_id: "" });
  const [adding, setAdding]       = useState(false);
  const [bulkingFw, setBulkingFw] = useState<string | null>(null);

  const load = useCallback(() => {
    cyclesApi.get(Number(id)).then((r) => setCycle(r.data));
  }, [id]);

  useEffect(() => {
    if (id !== "new") {
      load();
      controlsApi.list().then((r) => setControls(r.data));
      usersApi.list().then((r) => setUsers(r.data));
    }
  }, [id, load]);

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
            <h2 className="text-sm font-semibold text-gray-600">
              Control Assignments ({cycle.assignments.length})
            </h2>
            {user?.role === "admin" && (
              <button
                onClick={() => setShowAdd((v) => !v)}
                className="inline-flex items-center gap-1.5 text-sm bg-brand-600 text-white px-3 py-1.5 rounded-lg hover:bg-brand-700"
              >
                <PlusIcon className="w-4 h-4" /> Add Control
              </button>
            )}
          </div>

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
              <AssignmentRow key={a.id} a={a} cycleId={cycle.id} users={users} onUpdate={load} />
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
