"use client";
import { useEffect, useState, useCallback } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { risksApi, assetsApi, threatsApi, controlsApi, usersApi, downloadExport } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Risk, Asset, Threat, Control, User } from "@/types";
import TreatmentPlanPanel from "@/components/TreatmentPlanPanel";
import AppShell from "@/components/AppShell";

// ── Helpers ───────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 20) return "#ef4444"; // red
  if (score >= 15) return "#f97316"; // orange
  if (score >= 9)  return "#eab308"; // yellow
  return "#22c55e"; // green
}

function scoreBgClass(score: number) {
  if (score >= 20) return "bg-red-100 text-red-800";
  if (score >= 15) return "bg-orange-100 text-orange-800";
  if (score >= 9)  return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

function scoreLabel(score: number) {
  if (score >= 20) return "Critical";
  if (score >= 15) return "High";
  if (score >= 9)  return "Medium";
  return "Low";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    open: "bg-red-100 text-red-800",
    mitigated: "bg-green-100 text-green-800",
    accepted: "bg-blue-100 text-blue-800",
    transferred: "bg-purple-100 text-purple-800",
    closed: "bg-gray-100 text-gray-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

const TREATMENT_OPTIONS = [
  { value: "mitigate", label: "Mitigate" },
  { value: "accept", label: "Accept" },
  { value: "transfer", label: "Transfer" },
  { value: "avoid", label: "Avoid" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "mitigated", label: "Mitigated" },
  { value: "accepted", label: "Accepted" },
  { value: "transferred", label: "Transferred" },
  { value: "closed", label: "Closed" },
];

const FILTER_OPTIONS = ["all", "open", "mitigated", "accepted", "closed"] as const;
type Filter = typeof FILTER_OPTIONS[number];

// ── Risk Matrix Background Grid ───────────────────────────────────────────

function RiskMatrixGrid() {
  // Background zones rendered as SVG inside the chart
  // We'll overlay with reference lines and colored cells
  return null;
}

// Custom tooltip for scatter chart
interface TooltipPayload {
  payload?: {
    name: string;
    score: number;
    x: number;
    y: number;
  };
}

function MatrixTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-900 mb-1">{d.name}</p>
      <p className="text-gray-600">Likelihood: {d.x}</p>
      <p className="text-gray-600">Impact: {d.y}</p>
      <p className="font-medium mt-1" style={{ color: scoreColor(d.score) }}>
        Score: {d.score} ({scoreLabel(d.score)})
      </p>
    </div>
  );
}

const EMPTY_FORM = {
  name: "",
  description: "",
  asset_id: "",
  threat_id: "",
  likelihood: 3,
  impact: 3,
  treatment: "mitigate",
  status: "open",
  owner: "",
  owner_id: "",
};

// ── Main Page ─────────────────────────────────────────────────────────────

export default function RisksPage() {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addControlRiskId, setAddControlRiskId] = useState<number | null>(null);
  const [selectedControlId, setSelectedControlId] = useState<string>("");
  const [linkingControl, setLinkingControl] = useState(false);

  const user = getUser();
  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    try {
      const [rRes, aRes, tRes, cRes, uRes] = await Promise.all([
        risksApi.list(),
        assetsApi.list(),
        threatsApi.list(),
        controlsApi.list(),
        usersApi.list(),
      ]);
      setRisks(rRes.data);
      setAssets(aRes.data);
      setThreats(tRes.data);
      setControls(cRes.data);
      setUsers(uRes.data);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail ?? err?.message ?? "unknown";
      if (status === 401) {
        setError("Session expired — please log in again.");
      } else if (status === 403) {
        setError(`Permission denied (${detail})`);
      } else {
        setError(`Failed to load data (${status ?? "network error"}: ${detail})`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRisks = filter === "all"
    ? risks
    : risks.filter(r => r.status === filter);

  // Matrix data
  const matrixData = risks.map(r => ({
    x: r.likelihood,
    y: r.impact,
    name: r.name,
    score: r.inherent_score,
    id: r.id,
  }));

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setExpandedId(null);
  };

  const openEdit = (r: Risk) => {
    setEditId(r.id);
    setForm({
      name: r.name,
      description: r.description ?? "",
      asset_id: r.asset_id ? String(r.asset_id) : "",
      threat_id: r.threat_id ? String(r.threat_id) : "",
      likelihood: r.likelihood,
      impact: r.impact,
      treatment: r.treatment ?? "mitigate",
      status: r.status,
      owner: r.owner ?? "",
      owner_id: r.owner_id ? String(r.owner_id) : "",
    });
    setShowForm(true);
    setExpandedId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        asset_id: form.asset_id ? Number(form.asset_id) : null,
        threat_id: form.threat_id ? Number(form.threat_id) : null,
        likelihood: Number(form.likelihood),
        impact: Number(form.impact),
        treatment: form.treatment,
        status: form.status,
        owner: form.owner || null,
        owner_id: form.owner_id ? Number(form.owner_id) : null,
      };
      if (editId) {
        await risksApi.update(editId, payload);
      } else {
        await risksApi.create(payload);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
      await load();
    } catch {
      setError("Failed to save risk");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this risk?")) return;
    try {
      await risksApi.delete(id);
      if (expandedId === id) setExpandedId(null);
      await load();
    } catch {
      setError("Failed to delete risk");
    }
  };

  const handleUnlinkControl = async (riskId: number, controlId: number) => {
    try {
      await risksApi.unlinkControl(riskId, controlId);
      await load();
    } catch {
      setError("Failed to unlink control");
    }
  };

  const handleLinkControl = async (riskId: number) => {
    if (!selectedControlId) return;
    setLinkingControl(true);
    try {
      await risksApi.linkControl(riskId, { control_id: Number(selectedControlId) });
      setAddControlRiskId(null);
      setSelectedControlId("");
      await load();
    } catch {
      setError("Failed to link control");
    } finally {
      setLinkingControl(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId(prev => prev === id ? null : id);
    setAddControlRiskId(null);
    setSelectedControlId("");
  };

  const previewScore = Number(form.likelihood) * Number(form.impact);

  return (
    <AppShell>
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Register</h1>
          <p className="text-sm text-gray-500 mt-0.5">{risks.length} risk{risks.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadExport("/exports/risks", `risk_register_${new Date().toISOString().slice(0,10)}.xlsx`)}
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export
          </button>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              + New Risk
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => { setError(""); load(); }} className="ml-4 px-3 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 rounded-md">
            Retry
          </button>
        </div>
      )}

      {/* 5x5 Risk Matrix */}
      {!loading && risks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Risk Matrix (Likelihood vs Impact)</h2>
          <div className="relative">
            {/* Colored background zones */}
            <div className="absolute inset-0 ml-12 mr-4 mt-2 mb-10 pointer-events-none" style={{ zIndex: 0 }}>
              <div className="w-full h-full grid grid-cols-5 grid-rows-5" style={{ opacity: 0.18 }}>
                {/* Row 5 (impact=5, top row) */}
                <div className="bg-yellow-400"></div>
                <div className="bg-orange-400"></div>
                <div className="bg-red-500"></div>
                <div className="bg-red-500"></div>
                <div className="bg-red-600"></div>
                {/* Row 4 */}
                <div className="bg-green-400"></div>
                <div className="bg-yellow-400"></div>
                <div className="bg-orange-400"></div>
                <div className="bg-red-500"></div>
                <div className="bg-red-500"></div>
                {/* Row 3 */}
                <div className="bg-green-400"></div>
                <div className="bg-yellow-400"></div>
                <div className="bg-yellow-400"></div>
                <div className="bg-orange-400"></div>
                <div className="bg-red-400"></div>
                {/* Row 2 */}
                <div className="bg-green-300"></div>
                <div className="bg-green-400"></div>
                <div className="bg-yellow-300"></div>
                <div className="bg-yellow-400"></div>
                <div className="bg-orange-400"></div>
                {/* Row 1 (impact=1, bottom row) */}
                <div className="bg-green-300"></div>
                <div className="bg-green-300"></div>
                <div className="bg-green-400"></div>
                <div className="bg-yellow-300"></div>
                <div className="bg-yellow-400"></div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Likelihood"
                  domain={[0.5, 5.5]}
                  ticks={[1, 2, 3, 4, 5]}
                  label={{ value: "Likelihood", position: "insideBottom", offset: -15, fontSize: 12 }}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Impact"
                  domain={[0.5, 5.5]}
                  ticks={[1, 2, 3, 4, 5]}
                  label={{ value: "Impact", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip content={<MatrixTooltip />} />
                <Scatter data={matrixData} shape="circle">
                  {matrixData.map((entry, idx) => (
                    <Cell key={idx} fill={scoreColor(entry.score)} opacity={0.9} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-600 justify-center">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>Low (1-8)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block"></span>Medium (9-14)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block"></span>High (15-19)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block"></span>Critical (20-25)</span>
          </div>
        </div>
      )}

      {/* New/Edit Risk Form */}
      {showForm && (
        <div className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editId ? "Edit Risk" : "New Risk"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Risk Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Customer data exposed via SQL injection"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the risk scenario"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
              <select
                value={form.asset_id}
                onChange={e => setForm({ ...form, asset_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No asset --</option>
                {assets.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Threat</label>
              <select
                value={form.threat_id}
                onChange={e => setForm({ ...form, threat_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No threat --</option>
                {threats.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Likelihood: <span className="font-semibold text-blue-600">{form.likelihood}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {["", "Very Low", "Low", "Medium", "High", "Very High"][form.likelihood]}
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={form.likelihood}
                onChange={e => setForm({ ...form, likelihood: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Impact: <span className="font-semibold text-blue-600">{form.impact}</span>
                <span className="ml-2 text-xs text-gray-400">
                  {["", "Negligible", "Minor", "Moderate", "Significant", "Severe"][form.impact]}
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={form.impact}
                onChange={e => setForm({ ...form, impact: Number(e.target.value) })}
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
              <select
                value={form.treatment}
                onChange={e => setForm({ ...form, treatment: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TREATMENT_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Owner (text label)</label>
              <input
                type="text"
                value={form.owner}
                onChange={e => setForm({ ...form, owner: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Security Team"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned Owner <span className="text-gray-400 font-normal">(for review emails)</span>
              </label>
              <select
                value={form.owner_id}
                onChange={e => setForm({ ...form, owner_id: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— No assigned owner —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <div className={`px-3 py-2 rounded-md text-sm font-semibold ${scoreBgClass(previewScore)}`}>
                Inherent Score: {previewScore} — {scoreLabel(previewScore)}
              </div>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editId ? "Update Risk" : "Create Risk"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Buttons */}
      <div className="flex gap-2 mb-4">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? `All (${risks.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${risks.filter(r => r.status === f).length})`}
          </button>
        ))}
      </div>

      {/* Risk Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading risks...</div>
      ) : filteredRisks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No risks found</p>
          <p className="text-sm mt-1">
            {filter !== "all" ? "Try a different filter or " : ""}
            {isAdmin ? "create a new risk to get started" : "no risks match the current filter"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Asset</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Threat</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Score</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Treatment</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date Created</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Age</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Controls</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRisks.map(risk => (
                <>
                  <tr
                    key={risk.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedId === risk.id ? "bg-blue-50" : ""}`}
                    onClick={() => toggleExpand(risk.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{risk.name}</div>
                      {risk.owner && <div className="text-xs text-gray-400 mt-0.5">{risk.owner}</div>}
                      {risk.owner_id && (
                        <div className="text-xs text-brand-600 mt-0.5">
                          {users.find(u => u.id === risk.owner_id)?.display_name ?? `Owner #${risk.owner_id}`}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {risk.asset ? risk.asset.name : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {risk.threat ? risk.threat.name : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBgClass(risk.inherent_score)}`}>
                        {risk.inherent_score} — {scoreLabel(risk.inherent_score)}
                      </span>
                      <div className="text-xs text-gray-400 mt-0.5">L{risk.likelihood} × I{risk.impact}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 capitalize">
                        {risk.treatment}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadge(risk.status)}`}>
                        {risk.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap">
                      {new Date(risk.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                        risk.days_open <= 30  ? "bg-green-100 text-green-700" :
                        risk.days_open <= 60  ? "bg-yellow-100 text-yellow-700" :
                        risk.days_open <= 90  ? "bg-orange-100 text-orange-700" :
                        risk.days_open <= 180 ? "bg-red-100 text-red-700" :
                                                "bg-red-200 text-red-900"
                      }`}>
                        {risk.days_open}d
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 font-medium">
                        {risk.controls.length} linked
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <a
                        href={`/risk-reviews/history/${risk.id}`}
                        className="text-purple-600 hover:text-purple-800 text-xs font-medium mr-3"
                        onClick={e => e.stopPropagation()}
                      >
                        History
                      </a>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEdit(risk)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(risk.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Detail Row */}
                  {expandedId === risk.id && (
                    <tr key={`${risk.id}-detail`}>
                      <td colSpan={8} className="px-6 py-4 bg-blue-50 border-b border-blue-100">
                        <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Left: Details */}
                          <div>
                            <h3 className="text-sm font-semibold text-gray-800 mb-2">Risk Details</h3>
                            {risk.description && (
                              <p className="text-sm text-gray-600 mb-3">{risk.description}</p>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div><span className="text-gray-500">Likelihood:</span> <span className="font-medium">{risk.likelihood}/5</span></div>
                              <div><span className="text-gray-500">Impact:</span> <span className="font-medium">{risk.impact}/5</span></div>
                              <div><span className="text-gray-500">Treatment:</span> <span className="font-medium capitalize">{risk.treatment}</span></div>
                              <div><span className="text-gray-500">Owner:</span> <span className="font-medium">{risk.owner ?? "-"}</span></div>
                              {risk.asset && (
                                <div><span className="text-gray-500">Asset:</span> <span className="font-medium">{risk.asset.name}</span></div>
                              )}
                              {risk.threat && (
                                <div><span className="text-gray-500">Threat:</span> <span className="font-medium">{risk.threat.name}</span></div>
                              )}
                            </div>
                          </div>

                          {/* Right: Linked Controls */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-sm font-semibold text-gray-800">Linked Controls</h3>
                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setAddControlRiskId(addControlRiskId === risk.id ? null : risk.id);
                                    setSelectedControlId("");
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  + Add Control
                                </button>
                              )}
                            </div>

                            {/* Add Control Dropdown */}
                            {addControlRiskId === risk.id && (
                              <div className="mb-3 flex gap-2">
                                <select
                                  value={selectedControlId}
                                  onChange={e => setSelectedControlId(e.target.value)}
                                  className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <option value="">-- Select control --</option>
                                  {controls
                                    .filter(c => !risk.controls.some(rc => rc.control_id === c.id))
                                    .map(c => (
                                      <option key={c.id} value={c.id}>{c.control_id} - {c.title}</option>
                                    ))}
                                </select>
                                <button
                                  disabled={!selectedControlId || linkingControl}
                                  onClick={() => handleLinkControl(risk.id)}
                                  className="px-2 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                >
                                  Link
                                </button>
                              </div>
                            )}

                            {risk.controls.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No controls linked yet</p>
                            ) : (
                              <ul className="space-y-1.5">
                                {risk.controls.map(rc => (
                                  <li key={rc.id} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-gray-200 text-xs">
                                    <div>
                                      <span className="font-medium text-gray-700">{rc.control?.control_id}</span>
                                      <span className="text-gray-500 ml-2">{rc.control?.title}</span>
                                    </div>
                                    {isAdmin && (
                                      <button
                                        onClick={() => handleUnlinkControl(risk.id, rc.control_id)}
                                        className="text-red-400 hover:text-red-600 ml-2 text-xs"
                                        title="Unlink"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>

                        {/* Treatment Plan */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-2">Treatment Plan</h3>
                          <TreatmentPlanPanel
                            riskId={risk.id}
                            users={users}
                            canEdit={isAdmin}
                          />
                        </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </AppShell>
  );
}
