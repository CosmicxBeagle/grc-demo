"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { approvalsApi, usersApi } from "@/lib/api";
import type { ApprovalPolicy, User } from "@/types";
import {
  PlusIcon, TrashIcon, PencilSquareIcon, CheckBadgeIcon,
  ChevronUpIcon, ChevronDownIcon,
} from "@heroicons/react/24/outline";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StepDraft {
  step_order: number;
  label: string;
  approver_user_id: number | null;
  approver_role: string | null;
}

interface EscalationDraft {
  condition_field: string;
  condition_value: string;
  add_step_label: string;
  add_step_user_id: number | null;
  add_step_role: string | null;
}

interface PolicyDraft {
  name: string;
  description: string;
  entity_type: string;
  is_default: boolean;
  steps: StepDraft[];
  escalation_rules: EscalationDraft[];
}

const BLANK_POLICY: PolicyDraft = {
  name: "", description: "", entity_type: "exception", is_default: false,
  steps: [], escalation_rules: [],
};

const ROLES = ["admin", "reviewer", "tester"] as const;
const ENTITY_TYPES = [
  { value: "exception",    label: "Control Exception" },
  { value: "control_test", label: "Control Test Assignment" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApprovalSettingsPage() {
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [users,    setUsers]    = useState<User[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<ApprovalPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft,    setDraft]    = useState<PolicyDraft>(BLANK_POLICY);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  useEffect(() => {
    Promise.all([approvalsApi.listPolicies(), usersApi.list()])
      .then(([p, u]) => {
        setPolicies(p.data);
        setUsers(u.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditing(null);
    setDraft(BLANK_POLICY);
    setCreating(true);
    setError("");
  };

  const openEdit = (p: ApprovalPolicy) => {
    setEditing(p);
    setDraft({
      name: p.name,
      description: p.description ?? "",
      entity_type: p.entity_type,
      is_default: p.is_default,
      steps: p.steps.map(s => ({
        step_order: s.step_order,
        label: s.label,
        approver_user_id: s.approver_user_id ?? null,
        approver_role: s.approver_role ?? null,
      })),
      escalation_rules: p.escalation_rules.map(r => ({
        condition_field: r.condition_field,
        condition_value: r.condition_value,
        add_step_label: r.add_step_label,
        add_step_user_id: r.add_step_user_id ?? null,
        add_step_role: r.add_step_role ?? null,
      })),
    });
    setCreating(true);
    setError("");
  };

  const save = async () => {
    if (!draft.name.trim()) { setError("Name is required"); return; }
    if (draft.steps.length === 0) { setError("At least one approval step is required"); return; }

    setSaving(true);
    setError("");
    try {
      if (editing) {
        const updated = await approvalsApi.updatePolicy(editing.id, draft);
        setPolicies(ps => ps.map(p => p.id === editing.id ? updated.data : p));
      } else {
        const created = await approvalsApi.createPolicy(draft);
        setPolicies(ps => [...ps, created.data]);
      }
      setCreating(false);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const deletePolicy = async (id: number) => {
    if (!confirm("Delete this approval policy? Active workflows using it will not be affected.")) return;
    await approvalsApi.deletePolicy(id);
    setPolicies(ps => ps.filter(p => p.id !== id));
  };

  // ── Step helpers ─────────────────────────────────────────────────────────────

  const addStep = () => {
    const next = draft.steps.length > 0 ? Math.max(...draft.steps.map(s => s.step_order)) + 1 : 1;
    setDraft(d => ({ ...d, steps: [...d.steps, { step_order: next, label: "", approver_user_id: null, approver_role: null }] }));
  };

  const removeStep = (idx: number) => {
    setDraft(d => {
      const steps = d.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 }));
      return { ...d, steps };
    });
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setDraft(d => {
      const steps = [...d.steps];
      const target = idx + dir;
      if (target < 0 || target >= steps.length) return d;
      [steps[idx], steps[target]] = [steps[target], steps[idx]];
      return { ...d, steps: steps.map((s, i) => ({ ...s, step_order: i + 1 })) };
    });
  };

  const updateStep = (idx: number, patch: Partial<StepDraft>) => {
    setDraft(d => ({ ...d, steps: d.steps.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  };

  // ── Escalation helpers ────────────────────────────────────────────────────────

  const addEscalation = () => {
    setDraft(d => ({
      ...d,
      escalation_rules: [...d.escalation_rules, {
        condition_field: "risk_level", condition_value: "critical",
        add_step_label: "", add_step_user_id: null, add_step_role: null,
      }],
    }));
  };

  const removeEscalation = (idx: number) => {
    setDraft(d => ({ ...d, escalation_rules: d.escalation_rules.filter((_, i) => i !== idx) }));
  };

  const updateEscalation = (idx: number, patch: Partial<EscalationDraft>) => {
    setDraft(d => ({ ...d, escalation_rules: d.escalation_rules.map((r, i) => i === idx ? { ...r, ...patch } : r) }));
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <AppShell>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Approval Policies</h1>
          <p className="text-sm text-gray-500 mt-1">
            Define multi-step approval workflows for exceptions and control tests
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-4 py-2"
        >
          <PlusIcon className="w-4 h-4" />
          New Policy
        </button>
      </div>

      {/* Policy list */}
      {!creating && (
        <div className="space-y-3">
          {policies.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              No approval policies yet. Create one to start routing approvals.
            </div>
          )}
          {policies.map(policy => (
            <div key={policy.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{policy.name}</h2>
                    {policy.is_default && (
                      <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckBadgeIcon className="w-3 h-3" /> Default
                      </span>
                    )}
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                      {ENTITY_TYPES.find(e => e.value === policy.entity_type)?.label}
                    </span>
                  </div>
                  {policy.description && (
                    <p className="text-sm text-gray-500 mt-1">{policy.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(policy)} className="p-2 text-gray-400 hover:text-brand-600 rounded-lg hover:bg-gray-50">
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => deletePolicy(policy.id)} className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-50">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Steps preview */}
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {[...policy.steps].sort((a, b) => a.step_order - b.step_order).map((step, idx) => (
                  <div key={step.id} className="flex items-center gap-1">
                    {idx > 0 && <span className="text-gray-300">→</span>}
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {step.label}
                      {step.approver && <span className="text-gray-400 ml-1">({step.approver.display_name})</span>}
                    </span>
                  </div>
                ))}
                {policy.escalation_rules.length > 0 && (
                  <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded-full">
                    +{policy.escalation_rules.length} escalation rule{policy.escalation_rules.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit form */}
      {creating && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {editing ? "Edit Policy" : "New Approval Policy"}
          </h2>

          {/* Basic fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Policy Name *</label>
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Standard Exception Approval"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
              <select
                value={draft.entity_type}
                onChange={e => setDraft(d => ({ ...d, entity_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {ENTITY_TYPES.map(et => (
                  <option key={et.value} value={et.value}>{et.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={draft.description}
                onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="Optional description…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={draft.is_default}
                onChange={e => setDraft(d => ({ ...d, is_default: e.target.checked }))}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-400"
              />
              <label htmlFor="is_default" className="text-sm text-gray-700">
                Set as default policy for this entity type
              </label>
            </div>
          </div>

          {/* Approval Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Approval Steps *</h3>
              <button
                onClick={addStep}
                className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 font-medium"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>

            {draft.steps.length === 0 && (
              <p className="text-sm text-gray-400 italic">No steps yet — add at least one approval step.</p>
            )}

            <div className="space-y-3">
              {draft.steps.map((step, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Step {idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => moveStep(idx, -1)} disabled={idx === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded">
                        <ChevronUpIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => moveStep(idx, 1)} disabled={idx === draft.steps.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 rounded">
                        <ChevronDownIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeStep(idx)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-3 sm:col-span-1">
                      <label className="block text-xs text-gray-600 mb-1">Step Label</label>
                      <input
                        type="text"
                        value={step.label}
                        onChange={e => updateStep(idx, { label: e.target.value })}
                        placeholder="e.g. GRC Manager Review"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Specific Approver</label>
                      <select
                        value={step.approver_user_id ?? ""}
                        onChange={e => updateStep(idx, { approver_user_id: e.target.value ? +e.target.value : null })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                      >
                        <option value="">— Any user —</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Or by Role (fallback)</label>
                      <select
                        value={step.approver_role ?? ""}
                        onChange={e => updateStep(idx, { approver_role: e.target.value || null })}
                        disabled={!!step.approver_user_id}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-40"
                      >
                        <option value="">— No role —</option>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Escalation Rules */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Escalation Rules</h3>
                <p className="text-xs text-gray-500">Add extra approval steps when a condition is met (e.g. risk_level = critical → add CISO)</p>
              </div>
              <button
                onClick={addEscalation}
                className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 font-medium"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Add Rule
              </button>
            </div>

            <div className="space-y-3">
              {draft.escalation_rules.map((rule, idx) => (
                <div key={idx} className="border border-orange-200 rounded-lg p-4 bg-orange-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-orange-700">Escalation Rule {idx + 1}</span>
                    <button onClick={() => removeEscalation(idx)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">If Field</label>
                      <select
                        value={rule.condition_field}
                        onChange={e => updateEscalation(idx, { condition_field: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value="risk_level">risk_level</option>
                        <option value="exception_type">exception_type</option>
                        <option value="status">status</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Equals</label>
                      <input
                        type="text"
                        value={rule.condition_value}
                        onChange={e => updateEscalation(idx, { condition_value: e.target.value })}
                        placeholder="e.g. critical"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Then Add Step</label>
                      <input
                        type="text"
                        value={rule.add_step_label}
                        onChange={e => updateEscalation(idx, { add_step_label: e.target.value })}
                        placeholder="e.g. CISO Review"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Approver</label>
                      <select
                        value={rule.add_step_user_id ?? ""}
                        onChange={e => updateEscalation(idx, { add_step_user_id: e.target.value ? +e.target.value : null })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value="">— Select user —</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.display_name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t">
            <button
              onClick={save}
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg px-5 py-2 disabled:opacity-50"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Policy"}
            </button>
            <button
              onClick={() => setCreating(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
