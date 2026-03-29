"use client";
import { useEffect, useState } from "react";
import { treatmentPlansApi } from "@/lib/api";
import type { TreatmentPlan, TreatmentMilestone, User, MilestoneStatus } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────

const STRATEGIES = [
  { value: "mitigate", label: "Mitigate" },
  { value: "accept",   label: "Accept"   },
  { value: "transfer", label: "Transfer" },
  { value: "avoid",    label: "Avoid"    },
];

const PLAN_STATUSES = [
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed"   },
  { value: "on_hold",     label: "On Hold"     },
  { value: "cancelled",   label: "Cancelled"   },
];

const MILESTONE_STATUSES: { value: MilestoneStatus; label: string }[] = [
  { value: "open",        label: "Open"        },
  { value: "in_progress", label: "In Progress" },
  { value: "completed",   label: "Completed"   },
  { value: "overdue",     label: "Overdue"     },
];

function milestoneBadge(status: MilestoneStatus) {
  const map: Record<MilestoneStatus, string> = {
    open:        "bg-gray-100 text-gray-600",
    in_progress: "bg-blue-100 text-blue-700",
    completed:   "bg-green-100 text-green-700",
    overdue:     "bg-red-100 text-red-700",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function planStatusBadge(status: string) {
  const map: Record<string, string> = {
    in_progress: "bg-blue-100 text-blue-700",
    completed:   "bg-green-100 text-green-700",
    on_hold:     "bg-yellow-100 text-yellow-700",
    cancelled:   "bg-gray-100 text-gray-500",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function strategyBadge(strategy: string) {
  const map: Record<string, string> = {
    mitigate: "bg-indigo-50 text-indigo-700",
    accept:   "bg-yellow-50 text-yellow-700",
    transfer: "bg-purple-50 text-purple-700",
    avoid:    "bg-red-50 text-red-700",
  };
  return map[strategy] ?? "bg-gray-100 text-gray-600";
}

function progressPct(milestones: TreatmentMilestone[]) {
  if (!milestones.length) return 0;
  return Math.round((milestones.filter(m => m.status === "completed").length / milestones.length) * 100);
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props {
  riskId: number;
  users:  User[];
  canEdit: boolean;
}

export default function TreatmentPlanPanel({ riskId, users, canEdit }: Props) {
  const [plan, setPlan]           = useState<TreatmentPlan | null | undefined>(undefined);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");

  // Plan create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating]     = useState(false);
  const [createForm, setCreateForm] = useState({
    strategy: "mitigate", description: "", owner_id: "", target_date: "",
  });

  // Plan edit
  const [editingPlan, setEditingPlan] = useState(false);
  const [planForm, setPlanForm]       = useState({ strategy: "", description: "", owner_id: "", target_date: "", status: "" });
  const [savingPlan, setSavingPlan]   = useState(false);

  // Add milestone form
  const [showAddMs, setShowAddMs]   = useState(false);
  const [msForm, setMsForm]         = useState({ title: "", description: "", assigned_to_id: "", due_date: "" });
  const [addingMs, setAddingMs]     = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const res = await treatmentPlansApi.getByRisk(riskId);
      setPlan(res.data ?? null);
    } catch {
      setError("Failed to load treatment plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [riskId]);

  // ── Plan create ────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await treatmentPlansApi.create({
        risk_id:     riskId,
        strategy:    createForm.strategy,
        description: createForm.description || undefined,
        owner_id:    createForm.owner_id ? Number(createForm.owner_id) : undefined,
        target_date: createForm.target_date || undefined,
      });
      setShowCreate(false);
      await load();
    } catch {
      setError("Failed to create plan");
    } finally {
      setCreating(false);
    }
  };

  // ── Plan edit ─────────────────────────────────────────────────────────

  const openEditPlan = () => {
    if (!plan) return;
    setPlanForm({
      strategy:    plan.strategy,
      description: plan.description ?? "",
      owner_id:    plan.owner_id ? String(plan.owner_id) : "",
      target_date: plan.target_date ?? "",
      status:      plan.status,
    });
    setEditingPlan(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan) return;
    setSavingPlan(true);
    try {
      await treatmentPlansApi.update(plan.id, {
        strategy:    planForm.strategy,
        description: planForm.description || undefined,
        owner_id:    planForm.owner_id ? Number(planForm.owner_id) : undefined,
        target_date: planForm.target_date || undefined,
        status:      planForm.status,
      });
      setEditingPlan(false);
      await load();
    } catch {
      setError("Failed to update plan");
    } finally {
      setSavingPlan(false);
    }
  };

  // ── Add milestone ─────────────────────────────────────────────────────

  const handleAddMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !msForm.title.trim()) return;
    setAddingMs(true);
    try {
      await treatmentPlansApi.addMilestone(plan.id, {
        title:          msForm.title,
        description:    msForm.description || undefined,
        assigned_to_id: msForm.assigned_to_id ? Number(msForm.assigned_to_id) : undefined,
        due_date:       msForm.due_date || undefined,
        sort_order:     plan.milestones.length,
      });
      setMsForm({ title: "", description: "", assigned_to_id: "", due_date: "" });
      setShowAddMs(false);
      await load();
    } catch {
      setError("Failed to add milestone");
    } finally {
      setAddingMs(false);
    }
  };

  // ── Milestone status toggle ───────────────────────────────────────────

  const toggleMilestone = async (m: TreatmentMilestone) => {
    const next: MilestoneStatus = m.status === "completed" ? "open" : "completed";
    try {
      await treatmentPlansApi.updateMilestone(m.id, { status: next });
      await load();
    } catch {
      setError("Failed to update milestone");
    }
  };

  const deleteMilestone = async (id: number) => {
    try {
      await treatmentPlansApi.deleteMilestone(id);
      await load();
    } catch {
      setError("Failed to delete milestone");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="text-xs text-gray-400 py-2">Loading treatment plan...</div>;
  }

  if (error) {
    return <div className="text-xs text-red-500 py-2">{error}</div>;
  }

  // ── No plan yet ───────────────────────────────────────────────────────

  if (!plan) {
    return (
      <div>
        {showCreate ? (
          <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-semibold text-gray-800">New Treatment Plan</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Strategy</label>
                <select
                  value={createForm.strategy}
                  onChange={e => setCreateForm({ ...createForm, strategy: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Plan Owner</label>
                <select
                  value={createForm.owner_id}
                  onChange={e => setCreateForm({ ...createForm, owner_id: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— None —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Target Completion</label>
                <input
                  type="date"
                  value={createForm.target_date}
                  onChange={e => setCreateForm({ ...createForm, target_date: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Optional overview"
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={creating}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {creating ? "Creating..." : "Create Plan"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 py-2">
            <span className="text-xs text-gray-400 italic">No treatment plan yet</span>
            {canEdit && (
              <button onClick={() => setShowCreate(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                + Create Plan
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Plan exists ───────────────────────────────────────────────────────

  const pct = progressPct(plan.milestones);
  const completed = plan.milestones.filter(m => m.status === "completed").length;

  return (
    <div className="space-y-3">
      {/* Plan Header */}
      {editingPlan ? (
        <form onSubmit={handleSavePlan} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Edit Plan</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Strategy</label>
              <select value={planForm.strategy} onChange={e => setPlanForm({ ...planForm, strategy: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={planForm.status} onChange={e => setPlanForm({ ...planForm, status: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                {PLAN_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Plan Owner</label>
              <select value={planForm.owner_id} onChange={e => setPlanForm({ ...planForm, owner_id: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">— None —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Completion</label>
              <input type="date" value={planForm.target_date}
                onChange={e => setPlanForm({ ...planForm, target_date: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input type="text" value={planForm.description}
                onChange={e => setPlanForm({ ...planForm, description: e.target.value })}
                placeholder="Optional overview"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={savingPlan}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {savingPlan ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setEditingPlan(false)}
              className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${strategyBadge(plan.strategy)}`}>
                {plan.strategy}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${planStatusBadge(plan.status)}`}>
                {PLAN_STATUSES.find(s => s.value === plan.status)?.label ?? plan.status}
              </span>
              {plan.owner && (
                <span className="text-xs text-gray-500">Owner: <span className="font-medium text-gray-700">{plan.owner.display_name}</span></span>
              )}
              {plan.target_date && (
                <span className="text-xs text-gray-500">Due: <span className="font-medium text-gray-700">{plan.target_date}</span></span>
              )}
            </div>
            {canEdit && (
              <button onClick={openEditPlan}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0">
                Edit
              </button>
            )}
          </div>
          {plan.description && (
            <p className="text-xs text-gray-600 mb-3">{plan.description}</p>
          )}
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0">
              {completed}/{plan.milestones.length} milestones
            </span>
          </div>
        </div>
      )}

      {/* Milestones */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Milestones</span>
          {canEdit && !showAddMs && (
            <button onClick={() => setShowAddMs(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              + Add
            </button>
          )}
        </div>

        {/* Add milestone form */}
        {showAddMs && (
          <form onSubmit={handleAddMilestone}
            className="bg-white border border-dashed border-blue-300 rounded-lg p-3 mb-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2">
                <input
                  type="text"
                  required
                  placeholder="Milestone title *"
                  value={msForm.title}
                  onChange={e => setMsForm({ ...msForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <select
                  value={msForm.assigned_to_id}
                  onChange={e => setMsForm({ ...msForm, assigned_to_id: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Assign to —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
                </select>
              </div>
              <div>
                <input
                  type="date"
                  value={msForm.due_date}
                  onChange={e => setMsForm({ ...msForm, due_date: e.target.value })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={addingMs}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {addingMs ? "Adding..." : "Add Milestone"}
              </button>
              <button type="button" onClick={() => setShowAddMs(false)}
                className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}

        {plan.milestones.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No milestones yet — add one to start tracking progress</p>
        ) : (
          <ul className="space-y-1.5">
            {plan.milestones.map(m => (
              <li key={m.id}
                className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-3 py-2">
                {/* Check toggle */}
                <button
                  onClick={() => toggleMilestone(m)}
                  disabled={!canEdit}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                    m.status === "completed"
                      ? "bg-green-500 border-green-500"
                      : "border-gray-300 hover:border-green-400"
                  } ${!canEdit ? "cursor-default" : "cursor-pointer"}`}
                  title={m.status === "completed" ? "Mark as open" : "Mark as completed"}
                >
                  {m.status === "completed" && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium ${m.status === "completed" ? "line-through text-gray-400" : "text-gray-800"}`}>
                    {m.title}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {m.assigned_to && (
                      <span className="text-xs text-gray-400">{m.assigned_to.display_name}</span>
                    )}
                    {m.due_date && (
                      <span className="text-xs text-gray-400">due {m.due_date}</span>
                    )}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 capitalize ${milestoneBadge(m.status)}`}>
                  {MILESTONE_STATUSES.find(s => s.value === m.status)?.label ?? m.status}
                </span>

                {/* Delete */}
                {canEdit && (
                  <button
                    onClick={() => deleteMilestone(m.id)}
                    className="text-gray-300 hover:text-red-400 text-xs shrink-0 transition-colors"
                    title="Delete milestone"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
