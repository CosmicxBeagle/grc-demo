"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { riskReviewsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { RiskReviewCycle } from "@/types";
import {
  ArrowPathIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CYCLE_LABELS: Record<string, string> = {
  jan:       "January",
  jul:       "July",
  quarterly: "Quarterly",
  monthly:   "Monthly",
  ad_hoc:    "Ad Hoc",
};

const SCOPE_OPTIONS = [
  { value: 0,  label: "All risks",             description: "Every open risk with an assigned owner" },
  { value: 4,  label: "Medium and above",       description: "Score ≥ 4  (medium / high / critical)" },
  { value: 12, label: "High and critical only", description: "Score ≥ 12 (high / critical)" },
  { value: 20, label: "Critical only",          description: "Score ≥ 20 (critical)" },
];

function cycleTypeColor(t: string) {
  if (t === "jan")    return "bg-blue-100 text-blue-700";
  if (t === "jul")    return "bg-amber-100 text-amber-700";
  return "bg-purple-100 text-purple-700";
}

function statusBadge(s: string) {
  if (s === "draft")  return "bg-gray-100 text-gray-600";
  if (s === "active") return "bg-green-100 text-green-700";
  return "bg-slate-100 text-slate-600";
}

function fmtDate(d?: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateCycleDialog({
  onClose,
  onCreated,
}: {
  onClose:   () => void;
  onCreated: (c: RiskReviewCycle) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    cycle_type: "ad_hoc",
    year:       String(currentYear),
    label:      "",
    scope_note: "",
    min_score:  0,
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const scopeOption = SCOPE_OPTIONS.find(s => s.value === form.min_score) ?? SCOPE_OPTIONS[0];

  const autoLabel = () => {
    const scopeTag = scopeOption.label;
    if (form.cycle_type === "ad_hoc") return `Ad Hoc Review — ${scopeTag}`;
    return `${CYCLE_LABELS[form.cycle_type] ?? form.cycle_type} ${form.year} — ${scopeTag}`;
  };

  const label = form.label || autoLabel();

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await riskReviewsApi.createCycle({
        label:      label,
        cycle_type: form.cycle_type,
        year:       form.cycle_type !== "ad_hoc" ? Number(form.year) : undefined,
        scope_note: form.scope_note || undefined,
        min_score:  form.min_score,
      });
      onCreated(res.data);
    } catch {
      setErr("Failed to create cycle.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">New Review Cycle</h2>

        <div className="space-y-4">
          {/* Cycle type — label only */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cycle</label>
              <select
                value={form.cycle_type}
                onChange={e => setForm(f => ({ ...f, cycle_type: e.target.value, label: "" }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ad_hoc">Ad Hoc</option>
                <option value="jan">January</option>
                <option value="jul">July</option>
                <option value="quarterly">Quarterly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {form.cycle_type !== "ad_hoc" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => setForm(f => ({ ...f, year: e.target.value, label: "" }))}
                  min={2020} max={2040}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
          </div>

          {/* Scope — which risks to include */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Risk Scope</label>
            <select
              value={form.min_score}
              onChange={e => setForm(f => ({ ...f, min_score: Number(e.target.value), label: "" }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {SCOPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">{scopeOption.description}</p>
          </div>

          {/* Label (auto-filled, editable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              type="text"
              value={form.label}
              placeholder={autoLabel()}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Scope note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope Note (optional)</label>
            <textarea
              rows={2}
              value={form.scope_note}
              onChange={e => setForm(f => ({ ...f, scope_note: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Any notes about this cycle…"
            />
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create Cycle"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RiskReviewsPage() {
  const user    = getUser();
  const canEdit = user?.role && ["admin", "grc_manager", "grc_analyst"].includes(user.role);

  const [cycles,     setCycles]     = useState<RiskReviewCycle[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await riskReviewsApi.listCycles();
      setCycles(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const drafts  = cycles.filter(c => c.status === "draft");
  const active  = cycles.filter(c => c.status === "active");
  const closed  = cycles.filter(c => c.status === "closed");

  return (
    <AppShell>
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quarterly and bi-annual review cycles for risk owners
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          {canEdit && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              <PlusIcon className="w-4 h-4" />
              New Cycle
            </button>
          )}
        </div>
      </div>

      {/* Scope legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <p className="font-medium mb-2">Risk scope options — configurable per cycle:</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
          {SCOPE_OPTIONS.map(o => (
            <div key={o.value} className="flex items-center gap-2">
              <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />
              <span><strong>{o.label}</strong> — {o.description}</span>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : cycles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CalendarDaysIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No review cycles yet.</p>
          {canEdit && (
            <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-brand-600 hover:underline">
              Create the first cycle →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { label: "Active",  items: active,  icon: <CheckCircleIcon className="w-4 h-4 text-green-500" /> },
            { label: "Draft",   items: drafts,  icon: <ClockIcon        className="w-4 h-4 text-gray-400" /> },
            { label: "Closed",  items: closed,  icon: <XCircleIcon      className="w-4 h-4 text-slate-400" /> },
          ].filter(g => g.items.length > 0).map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-3">
                {group.icon}
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  {group.label}
                </h2>
              </div>
              <div className="space-y-2">
                {group.items.map(cycle => (
                  <Link
                    key={cycle.id}
                    href={`/risk-reviews/${cycle.id}`}
                    className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{cycle.label}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cycleTypeColor(cycle.cycle_type)}`}>
                            {CYCLE_LABELS[cycle.cycle_type] ?? cycle.cycle_type}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(cycle.status)}`}>
                            {cycle.status}
                          </span>
                          <span className="text-xs text-gray-400">
                            {SCOPE_OPTIONS.find(o => o.value === cycle.min_score)?.label ?? "All risks"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      {cycle.status !== "draft" && (
                        <>
                          <div>
                            <p className="text-lg font-bold text-gray-900">{cycle.request_count}</p>
                            <p className="text-xs text-gray-400">requests</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-amber-600">{cycle.pending_count}</p>
                            <p className="text-xs text-gray-400">pending</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold text-green-600">{cycle.updated_count}</p>
                            <p className="text-xs text-gray-400">updated</p>
                          </div>
                        </>
                      )}
                      {cycle.launched_at && (
                        <div>
                          <p className="text-xs text-gray-400">Launched</p>
                          <p className="text-xs font-medium text-gray-600">{fmtDate(cycle.launched_at)}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <EnvelopeIcon className="w-4 h-4" />
                        <span>{fmtDate(cycle.created_at)}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCycleDialog
          onClose={() => setShowCreate(false)}
          onCreated={c => { setCycles(prev => [c, ...prev]); setShowCreate(false); }}
        />
      )}
    </div>
    </AppShell>
  );
}
