"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { riskReviewsApi, risksApi, usersApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { RiskReviewCycle, Risk, User } from "@/types";
import {
  ArrowPathIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  EnvelopeIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";

// ── Helpers ───────────────────────────────────────────────────────────────────

const CYCLE_LABELS: Record<string, string> = {
  monthly:   "Monthly",
  quarterly: "Quarterly",
  yearly:    "Yearly",
  ad_hoc:    "Ad Hoc",
};

const SEVERITY_OPTIONS = [
  { value: "low",      label: "Low",      color: "bg-green-100 text-green-700 border-green-300" },
  { value: "medium",   label: "Medium",   color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  { value: "high",     label: "High",     color: "bg-orange-100 text-orange-700 border-orange-300" },
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700 border-red-300" },
] as const;

type SeverityValue = "low" | "medium" | "high" | "critical";

function cycleTypeColor(t: string) {
  if (t === "monthly")   return "bg-blue-100 text-blue-700";
  if (t === "quarterly") return "bg-indigo-100 text-indigo-700";
  if (t === "yearly")    return "bg-amber-100 text-amber-700";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

// Thresholds must match backend _score_tier / _severity_for_score: 20 / 15 / 9
function scoreTier(likelihood: number, impact: number): { label: string; color: string } {
  const s = (likelihood || 1) * (impact || 1);
  if (s >= 20) return { label: "Critical", color: "bg-red-100 text-red-700" };
  if (s >= 15) return { label: "High",     color: "bg-orange-100 text-orange-700" };
  if (s >= 9)  return { label: "Medium",   color: "bg-yellow-100 text-yellow-700" };
  return        { label: "Low",      color: "bg-green-100 text-green-700" };
}

type ScopeMode = "severity" | "owner" | "risks";

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateCycleDialog({
  onClose,
  onCreated,
}: {
  onClose:   () => void;
  onCreated: (c: RiskReviewCycle) => void;
}) {
  const currentYear = new Date().getFullYear();

  // ── basic form fields ──
  const [form, setForm] = useState({
    cycle_type: "ad_hoc",
    year:       String(currentYear),
    label:      "",
    scope_note: "",
  });

  // ── scope mode ──
  const [scopeMode, setScopeMode] = useState<ScopeMode>("severity");

  // severity mode
  const [severities, setSeverities] = useState<SeverityValue[]>(["low", "medium", "high", "critical"]);

  // owner/VP mode
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<Set<number>>(new Set());
  const [selectedVps,      setSelectedVps]      = useState<Set<string>>(new Set());

  // specific risks mode
  const [selectedRiskIds, setSelectedRiskIds] = useState<Set<number>>(new Set());
  const [riskSearch,      setRiskSearch]      = useState("");

  // lazy-loaded data
  const [risksList,    setRisksList]    = useState<Risk[]>([]);
  const [usersList,    setUsersList]    = useState<User[]>([]);
  const [dataLoading,  setDataLoading]  = useState(false);

  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  // ── load risks + users when switching to owner/risk mode ──
  useEffect(() => {
    if ((scopeMode === "owner" || scopeMode === "risks") && risksList.length === 0 && !dataLoading) {
      setDataLoading(true);
      Promise.all([
        risksApi.list({ limit: 500 }),
        usersApi.list(),
      ]).then(([rr, ur]) => {
        setRisksList(rr.data.items);
        setUsersList(ur.data);
      }).catch(() => {}).finally(() => setDataLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeMode]);

  // ── derived lists ──
  const uniqueVps = useMemo(() => {
    const vps = new Set<string>();
    risksList.forEach(r => { if (r.owning_vp) vps.add(r.owning_vp); });
    return [...vps].sort();
  }, [risksList]);

  const uniqueOwners = useMemo((): User[] => {
    const seen = new Set<number>();
    const out: User[] = [];
    risksList.forEach(r => {
      if (r.owner_id && !seen.has(r.owner_id)) {
        const u = usersList.find(u => u.id === r.owner_id);
        if (u) { seen.add(r.owner_id); out.push(u); }
      }
    });
    return out.sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [risksList, usersList]);

  const filteredRisks = useMemo(() => {
    const q = riskSearch.trim().toLowerCase();
    return q ? risksList.filter(r => r.name.toLowerCase().includes(q)) : risksList;
  }, [risksList, riskSearch]);

  // ── label helpers ──
  const severityLabel = () => {
    if (severities.length === 4) return "All risks";
    if (severities.length === 0) return "None selected";
    return severities.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");
  };

  const autoLabel = (): string => {
    const base = form.cycle_type === "ad_hoc"
      ? "Ad Hoc Review"
      : `${CYCLE_LABELS[form.cycle_type] ?? form.cycle_type} ${form.year} Review`;
    if (scopeMode === "severity") return `${base} — ${severityLabel()}`;
    if (scopeMode === "owner")    return `${base} — ${selectedOwnerIds.size + selectedVps.size} owner(s)/VP(s)`;
    return `${base} — ${selectedRiskIds.size} specific risk(s)`;
  };

  const label = form.label || autoLabel();

  // ── toggle helpers ──
  const toggleSeverity = (v: SeverityValue) =>
    setSeverities(prev => prev.includes(v) ? prev.filter(s => s !== v) : [...prev, v]);

  const toggleOwner = (id: number) =>
    setSelectedOwnerIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleVp = (vp: string) =>
    setSelectedVps(prev => { const n = new Set(prev); n.has(vp) ? n.delete(vp) : n.add(vp); return n; });

  const toggleRisk = (id: number) =>
    setSelectedRiskIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── submit ──
  const submit = async () => {
    setErr("");
    let risk_ids_filter:  string | undefined;
    let owner_ids_filter: string | undefined;
    let severitiesStr:    string | undefined;

    if (scopeMode === "severity") {
      if (severities.length === 0) { setErr("Select at least one severity level."); return; }
      severitiesStr = severities.join(",");
    } else if (scopeMode === "risks") {
      if (selectedRiskIds.size === 0) { setErr("Select at least one risk."); return; }
      risk_ids_filter = [...selectedRiskIds].join(",");
    } else {
      if (selectedOwnerIds.size === 0 && selectedVps.size === 0) {
        setErr("Select at least one owner or VP."); return;
      }

      if (selectedVps.size > 0) {
        // VP selection → resolve to exact risk IDs where owning_vp matches.
        // We can NOT use owner_ids_filter here because that would pull in ALL of
        // that owner's risks, not just the ones under that VP.
        const riskIds = new Set<number>();
        for (const vp of selectedVps) {
          risksList.forEach(r => { if (r.owning_vp === vp && r.owner_id) riskIds.add(r.id); });
        }
        // Also include individual owner selections, resolved to their specific risk IDs
        for (const oid of selectedOwnerIds) {
          risksList.forEach(r => { if (r.owner_id === oid) riskIds.add(r.id); });
        }
        if (riskIds.size === 0) { setErr("No owned risks found for the selected VP(s)."); return; }
        risk_ids_filter = [...riskIds].join(",");
      } else {
        // Only individual owners selected → use owner_ids_filter (pulls all current + future risks)
        owner_ids_filter = [...selectedOwnerIds].join(",");
        severitiesStr    = "low,medium,high,critical";
      }
    }

    setBusy(true);
    try {
      const res = await riskReviewsApi.createCycle({
        label,
        cycle_type:       form.cycle_type,
        year:             form.cycle_type !== "ad_hoc" ? Number(form.year) : undefined,
        scope_note:       form.scope_note || undefined,
        min_score:        0,
        severities:       severitiesStr,
        risk_ids_filter,
        owner_ids_filter,
      });
      onCreated(res.data);
    } catch {
      setErr("Failed to create cycle.");
    } finally {
      setBusy(false);
    }
  };

  // ── render ──
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New Review Cycle</h2>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Cycle type + year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cycle</label>
              <select
                value={form.cycle_type}
                onChange={e => setForm(f => ({ ...f, cycle_type: e.target.value, label: "" }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="ad_hoc">Ad Hoc</option>
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

          {/* Scope mode selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scope Mode</label>
            <div className="flex gap-2">
              {(["severity", "owner", "risks"] as ScopeMode[]).map(m => {
                const labels: Record<ScopeMode, string> = {
                  severity: "By Severity",
                  owner:    "By Owner / VP",
                  risks:    "Specific Risks",
                };
                const active = scopeMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setScopeMode(m); setErr(""); setForm(f => ({ ...f, label: "" })); }}
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                      active
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-600"
                    }`}
                  >
                    {labels[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── By Severity ── */}
          {scopeMode === "severity" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Severity Levels</label>
              <div className="flex gap-2 flex-wrap">
                {SEVERITY_OPTIONS.map(opt => {
                  const checked = severities.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => { toggleSeverity(opt.value); setForm(f => ({ ...f, label: "" })); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                        checked
                          ? opt.color + " ring-2 ring-offset-1 ring-current"
                          : "bg-white border-gray-200 text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
                        checked ? "bg-current border-current" : "border-gray-300"
                      }`}>
                        {checked && (
                          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        )}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {severities.length === 0
                  ? "No severities selected — no risks will be included."
                  : severities.length === 4
                  ? "All open risks with an assigned owner will be included."
                  : `Only ${severityLabel()} risks will be included.`}
              </p>
            </div>
          )}

          {/* ── By Owner / VP ── */}
          {scopeMode === "owner" && (
            <div className="space-y-4">
              {dataLoading ? (
                <p className="text-sm text-gray-400">Loading owners…</p>
              ) : (
                <>
                  {/* VPs */}
                  {uniqueVps.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">By VP</p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {uniqueVps.map(vp => {
                          const checked = selectedVps.has(vp);
                          const count = risksList.filter(r => r.owning_vp === vp).length;
                          return (
                            <label
                              key={vp}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
                                checked
                                  ? "border-brand-400 bg-brand-50 text-brand-800"
                                  : "border-gray-200 hover:border-gray-300 text-gray-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => { toggleVp(vp); setForm(f => ({ ...f, label: "" })); }}
                                className="accent-brand-600 shrink-0"
                              />
                              <span className="truncate flex-1">{vp}</span>
                              <span className="text-xs text-gray-400 shrink-0">{count}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Individual owners */}
                  {uniqueOwners.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Individual Owners</p>
                      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                        {uniqueOwners.map(u => {
                          const checked = selectedOwnerIds.has(u.id);
                          const count = risksList.filter(r => r.owner_id === u.id).length;
                          return (
                            <label
                              key={u.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-all ${
                                checked
                                  ? "border-brand-400 bg-brand-50 text-brand-800"
                                  : "border-gray-200 hover:border-gray-300 text-gray-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => { toggleOwner(u.id); setForm(f => ({ ...f, label: "" })); }}
                                className="accent-brand-600 shrink-0"
                              />
                              <span className="truncate flex-1">{u.display_name}</span>
                              <span className="text-xs text-gray-400 shrink-0">{count}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {uniqueVps.length === 0 && uniqueOwners.length === 0 && (
                    <p className="text-sm text-gray-400">No risks with assigned owners found.</p>
                  )}

                  <p className="text-xs text-gray-400">
                    {selectedOwnerIds.size + selectedVps.size === 0
                      ? "Select one or more owners or VPs to scope this cycle."
                      : `${selectedOwnerIds.size} owner(s) + ${selectedVps.size} VP(s) selected — all their open risks will be included.`}
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Specific Risks ── */}
          {scopeMode === "risks" && (
            <div>
              {dataLoading ? (
                <p className="text-sm text-gray-400">Loading risks…</p>
              ) : (
                <>
                  <div className="relative mb-2">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search risks…"
                      value={riskSearch}
                      onChange={e => setRiskSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100">
                    {filteredRisks.length === 0 ? (
                      <p className="text-sm text-gray-400 p-3">No risks found.</p>
                    ) : filteredRisks.map(r => {
                      const checked = selectedRiskIds.has(r.id);
                      const tier = scoreTier(r.likelihood, r.impact);
                      const ownerUser = usersList.find(u => u.id === r.owner_id);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            checked ? "bg-brand-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => { toggleRisk(r.id); setForm(f => ({ ...f, label: "" })); }}
                            className="accent-brand-600 mt-0.5 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{r.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tier.color}`}>
                                {tier.label}
                              </span>
                              <span className="text-xs text-gray-400">Score {(r.likelihood||1)*(r.impact||1)}</span>
                              {ownerUser && (
                                <span className="text-xs text-gray-400 truncate">· {ownerUser.display_name}</span>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    {selectedRiskIds.size === 0
                      ? "Check specific risks to include in this cycle."
                      : `${selectedRiskIds.size} risk(s) selected.`}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Label */}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100">
          {err && <p className="mb-3 text-sm text-red-600">{err}</p>}
          <div className="flex justify-end gap-3">
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
            Monthly, quarterly, yearly and ad hoc review cycles for risk owners
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

      {/* Severity legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SEVERITY_OPTIONS.map(o => (
          <span key={o.value} className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-medium ${o.color}`}>
            {o.label}
          </span>
        ))}
        <span className="text-xs text-gray-400 self-center ml-1">— select any combination when creating a cycle</span>
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
                          {cycle.risk_ids_filter ? (
                            <span className="text-xs px-1.5 py-0.5 rounded border font-medium bg-purple-100 text-purple-700 border-purple-300">
                              {cycle.risk_ids_filter.split(",").filter(Boolean).length} specific risks
                            </span>
                          ) : cycle.owner_ids_filter ? (
                            <span className="text-xs px-1.5 py-0.5 rounded border font-medium bg-indigo-100 text-indigo-700 border-indigo-300">
                              {cycle.owner_ids_filter.split(",").filter(Boolean).length} owner(s)
                            </span>
                          ) : cycle.severities
                            ? cycle.severities.split(",").map(s => s.trim()).filter(Boolean).map(s => {
                                const opt = SEVERITY_OPTIONS.find(o => o.value === s);
                                return opt ? (
                                  <span key={s} className={`text-xs px-1.5 py-0.5 rounded border font-medium ${opt.color}`}>
                                    {opt.label}
                                  </span>
                                ) : null;
                              })
                            : <span className="text-xs text-gray-400">All risks</span>
                          }
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
