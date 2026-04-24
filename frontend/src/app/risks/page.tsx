"use client";
import React, { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  ChevronDownIcon, ChevronUpIcon, ArrowDownTrayIcon,
  MagnifyingGlassIcon, XMarkIcon, ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { risksApi, assetsApi, threatsApi, controlsApi, usersApi, downloadExport } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Risk, Asset, Threat, Control, User, RiskStatus, RiskListParams } from "@/types";
import AppShell from "@/components/AppShell";
import Pagination from "@/components/ui/Pagination";
import RiskStatusFilter from "@/components/risks/RiskStatusFilter";
import RiskActionMenu from "@/components/risks/RiskActionMenu";
import RiskDetailPanel from "@/components/risks/RiskDetailPanel";
import RiskFormModal from "@/components/risks/RiskFormModal";
import BulkImportModal from "@/components/risks/BulkImportModal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 20) return "#ef4444";
  if (score >= 15) return "#f97316";
  if (score >= 9)  return "#eab308";
  return "#22c55e";
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

type SortCol = "name" | "likelihood" | "impact" | "status" | "created_at";

// ── Column picker ─────────────────────────────────────────────────────────────

type ColKey =
  | "asset_threat" | "score" | "likelihood" | "impact" | "residual_score" | "target_score"
  | "treatment" | "owner" | "status" | "created" | "age" | "controls" | "description"
  | "category" | "risk_type" | "department" | "owning_vp" | "stage" | "source" | "risk_theme"
  | "date_identified" | "date_closed" | "status_changed_closed" | "regulatory_compliance";

const COLUMN_DEFS: { key: ColKey; label: string }[] = [
  { key: "score",                label: "Score"                 },
  { key: "status",               label: "Status"               },
  { key: "treatment",            label: "Treatment"            },
  { key: "asset_threat",         label: "Asset / Threat"       },
  { key: "owner",                label: "Owner"                },
  { key: "likelihood",           label: "Likelihood"           },
  { key: "impact",               label: "Impact"               },
  { key: "residual_score",       label: "Residual Score"       },
  { key: "target_score",         label: "Target Score"         },
  { key: "created",              label: "Created"              },
  { key: "age",                  label: "Age"                  },
  { key: "controls",             label: "Controls"             },
  { key: "category",             label: "Category"             },
  { key: "risk_type",            label: "Type"                 },
  { key: "department",           label: "Department"           },
  { key: "owning_vp",            label: "Owning VP"            },
  { key: "stage",                label: "Stage"                },
  { key: "source",               label: "Source"               },
  { key: "risk_theme",           label: "Risk Theme"           },
  { key: "date_identified",      label: "Date Identified"      },
  { key: "date_closed",          label: "Risk Closed Date"     },
  { key: "status_changed_closed",label: "Status Changed Closed"},
  { key: "regulatory_compliance",label: "Regulatory Compliance"},
  { key: "description",          label: "Description"          },
];

const DEFAULT_COLS: ColKey[] = [
  "score", "asset_threat", "treatment", "status", "created", "age", "controls",
];

// ── Matrix tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  payload?: { name: string; score: number; x: number; y: number };
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

// ── Inner page (uses useSearchParams → needs Suspense boundary) ───────────────

function RisksPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Reference data ──────────────────────────────────────────────────────────
  const [assets, setAssets] = useState<Asset[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // ── Risk data ───────────────────────────────────────────────────────────────
  const [risks, setRisks] = useState<Risk[]>([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [severityCounts, setSeverityCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0 });
  const [agingCounts, setAgingCounts] = useState({ d90: 0, d180: 0, d365: 0, d730: 0, over: 0 });
  // keep flat accessors for header subtitle
  const criticalCount = severityCounts.critical;
  const highCount = severityCounts.high;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── UI State (initialised from URL params) ──────────────────────────────────
  const [selectedStatuses, setSelectedStatuses] = useState<RiskStatus[]>(() => {
    const s = searchParams.get("status");
    return s ? (s.split(",") as RiskStatus[]) : [];
  });
  const [sortBy, setSortBy] = useState<SortCol>(() => {
    const s = searchParams.get("sort") ?? "";
    const [col] = s.split("_");
    return (["name","likelihood","impact","status","created_at"].includes(col) ? col : "created_at") as SortCol;
  });
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => {
    const s = searchParams.get("sort") ?? "";
    return s.endsWith("_asc") ? "asc" : "desc";
  });
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Panel / modal state
  const [selectedRisk, setSelectedRisk] = useState<Risk | null>(null);
  const [editRisk, setEditRisk] = useState<Risk | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Pagination
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Matrix collapse (localStorage-persisted, collapsed by default)
  const [matrixOpen, setMatrixOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("riskMatrixOpen") === "true";
  });

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Column picker
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(() => {
    if (typeof window === "undefined") return DEFAULT_COLS;
    try {
      const stored = localStorage.getItem("riskRegisterCols");
      if (stored) return JSON.parse(stored) as ColKey[];
    } catch { /* ignore */ }
    return DEFAULT_COLS;
  });
  const [showColPicker, setShowColPicker] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);

  const user = getUser();
  const canEdit = user?.role === "admin" || user?.role === "grc_manager";

  // ── Sync URL when filter/sort/search changes ────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedStatuses.length > 0) params.set("status", selectedStatuses.join(","));
    if (sortBy !== "created_at" || sortDir !== "desc") params.set("sort", `${sortBy}_${sortDir}`);
    if (debouncedQuery) params.set("q", debouncedQuery);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [selectedStatuses, sortBy, sortDir, debouncedQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounce search query ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Persist matrix open state ──────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("riskMatrixOpen", String(matrixOpen));
  }, [matrixOpen]);

  // ── Export dropdown click-outside ─────────────────────────────────────────
  useEffect(() => {
    if (!showExportMenu) return;
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showExportMenu]);

  // ── Column picker click-outside ────────────────────────────────────────────
  useEffect(() => {
    if (!showColPicker) return;
    const h = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) {
        setShowColPicker(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showColPicker]);

  // ── Persist column selection ───────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("riskRegisterCols", JSON.stringify(visibleCols));
  }, [visibleCols]);

  // ── Load global counts (unfiltered, for stats bar + filter chips) ──────────
  const loadCounts = useCallback(async () => {
    const res = await risksApi.list({ limit: 1000 });
    const statusC: Record<string, number> = {};
    const sev = { critical: 0, high: 0, medium: 0, low: 0 };
    const aging = { d90: 0, d180: 0, d365: 0, d730: 0, over: 0 };
    for (const r of res.data.items) {
      // status
      statusC[r.status] = (statusC[r.status] ?? 0) + 1;
      // severity
      if      (r.inherent_score >= 20) sev.critical++;
      else if (r.inherent_score >= 15) sev.high++;
      else if (r.inherent_score >= 9)  sev.medium++;
      else                             sev.low++;
      // aging
      const d = r.days_open ?? 0;
      if      (d <= 90)  aging.d90++;
      else if (d <= 180) aging.d180++;
      else if (d <= 365) aging.d365++;
      else if (d <= 730) aging.d730++;
      else               aging.over++;
    }
    setStatusCounts(statusC);
    setSeverityCounts(sev);
    setAgingCounts(aging);
  }, []);

  // ── Load filtered risks ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: RiskListParams = {
        sort_by: sortBy,
        sort_dir: sortDir,
        limit: 500,
      };
      if (selectedStatuses.length === 1) {
        params.status = selectedStatuses[0];
      } else if (selectedStatuses.length > 1) {
        params.statuses = selectedStatuses;
      }

      const [rRes, aRes, tRes, cRes, uRes] = await Promise.all([
        risksApi.list(params),
        assetsApi.list(),
        threatsApi.list(),
        controlsApi.list(),
        usersApi.list(),
      ]);
      setRisks(rRes.data.items);
      setTotal(rRes.data.total);
      setAssets(aRes.data);
      setThreats(tRes.data);
      setControls(cRes.data);
      setUsers(uRes.data);
      setError("");
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail ?? err?.message ?? "unknown";
      if (status === 401) setError("Session expired — please log in again.");
      else if (status === 403) setError(`Permission denied (${detail})`);
      else setError(`Failed to load data (${status ?? "network error"}: ${detail})`);
    } finally {
      setLoading(false);
    }
  }, [selectedStatuses, sortBy, sortDir]);

  useEffect(() => { loadCounts(); }, [loadCounts]);
  useEffect(() => { load(); }, [load]);

  // Reset to page 1 whenever filters/search change
  useEffect(() => { setPage(1); }, [debouncedQuery, selectedStatuses, sortBy, sortDir]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sort helper ────────────────────────────────────────────────────────────
  const handleSort = (col: SortCol) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };
  const sortIndicator = (col: SortCol) =>
    sortBy === col ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  // ── Client-side search filter ──────────────────────────────────────────────
  const q = debouncedQuery.toLowerCase().trim();

  // Build hierarchical display
  const topLevel = risks.filter(r => !r.parent_risk_id);
  const childMap = new Map<number, Risk[]>();
  risks.filter(r => r.parent_risk_id).forEach(r => {
    const arr = childMap.get(r.parent_risk_id!) ?? [];
    arr.push(r);
    childMap.set(r.parent_risk_id!, arr);
  });
  const hierarchical: { risk: Risk; isChild: boolean }[] = [];
  topLevel.forEach(parent => {
    hierarchical.push({ risk: parent, isChild: false });
    (childMap.get(parent.id) ?? []).forEach(child => hierarchical.push({ risk: child, isChild: true }));
  });
  const topIds = new Set(topLevel.map(r => r.id));
  risks.filter(r => r.parent_risk_id && !topIds.has(r.parent_risk_id)).forEach(r => {
    if (!hierarchical.find(h => h.risk.id === r.id)) hierarchical.push({ risk: r, isChild: true });
  });

  const displayRisks = q
    ? hierarchical.filter(({ risk }) =>
        risk.name.toLowerCase().includes(q) ||
        (risk.description ?? "").toLowerCase().includes(q) ||
        (risk.owner ?? "").toLowerCase().includes(q) ||
        (risk.asset?.name ?? "").toLowerCase().includes(q) ||
        (risk.threat?.name ?? "").toLowerCase().includes(q)
      )
    : hierarchical;

  // ── Pagination ────────────────────────────────────────────────────────────
  const pagedRisks = displayRisks.slice((page - 1) * pageSize, page * pageSize);

  // ── Matrix data ────────────────────────────────────────────────────────────
  const matrixData = risks.map(r => ({ x: r.likelihood, y: r.impact, name: r.name, score: r.inherent_score, id: r.id }));
  const matrixResidual = risks
    .filter(r => r.residual_likelihood && r.residual_impact)
    .map(r => ({ x: r.residual_likelihood!, y: r.residual_impact!, name: r.name, score: r.residual_score!, id: r.id }));

  // ── Stats bar ──────────────────────────────────────────────────────────────
  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const unmanagedCount = statusCounts["unmanaged"] ?? 0;

  // ── Column visibility helper ───────────────────────────────────────────────
  const col = (key: ColKey) => visibleCols.includes(key);

  // ── Actions ────────────────────────────────────────────────────────────────
  const openAdd = () => { setEditRisk(null); setShowForm(true); };
  const openEdit = (r: Risk) => { setEditRisk(r); setShowForm(true); };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this risk? This cannot be undone.")) return;
    try {
      await risksApi.delete(id);
      if (selectedRisk?.id === id) setSelectedRisk(null);
      await Promise.all([load(), loadCounts()]);
    } catch {
      setError("Failed to delete risk");
    }
  };

  const handleSaved = async () => {
    setShowForm(false);
    setEditRisk(null);
    await Promise.all([load(), loadCounts()]);
  };

  // When the detail panel's linked controls change, refresh the risk in the panel
  const handleLinkedControlsChange = useCallback(async () => {
    await load();
    if (selectedRisk) {
      const res = await risksApi.get(selectedRisk.id);
      setSelectedRisk(res.data);
    }
  }, [load, selectedRisk]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-[1800px] mx-auto">

      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Risk Register</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalAll} risk{totalAll !== 1 ? "s" : ""} total
            {selectedStatuses.length > 0 ? ` · ${risks.length} shown` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setShowExportMenu(o => !o)}
              className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export
              <ChevronDownIcon className="w-3.5 h-3.5" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-10 z-30 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-sm">
                <button
                  onClick={() => { setShowExportMenu(false); downloadExport("/exports/risks", `risk_register_${new Date().toISOString().slice(0,10)}.xlsx`); }}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50"
                >Risk Register</button>
                <button
                  onClick={() => { setShowExportMenu(false); downloadExport("/exports/risk-aging", `risk_aging_${new Date().toISOString().slice(0,10)}.xlsx`); }}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50"
                >Risk Aging</button>
                <button
                  onClick={() => { setShowExportMenu(false); downloadExport("/exports/treatment-plans", `treatment_plans_${new Date().toISOString().slice(0,10)}.xlsx`); }}
                  className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50"
                >Treatment Plans</button>
              </div>
            )}
          </div>
          {canEdit && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <ArrowDownTrayIcon className="w-4 h-4 rotate-180" />
                Import CSV
              </button>
              <button
                onClick={openAdd}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                + New Risk
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => { setError(""); load(); }}
            className="ml-4 px-3 py-1 text-xs font-medium bg-red-100 hover:bg-red-200 rounded-md"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Stats Breakdown Panel ── */}
      {!loading && totalAll > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">

          {/* Severity */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Severity</p>
            <div className="space-y-2">
              {([
                { label: "Critical", value: severityCounts.critical, bar: "bg-red-500",    text: "text-red-700"    },
                { label: "High",     value: severityCounts.high,     bar: "bg-orange-400", text: "text-orange-700" },
                { label: "Medium",   value: severityCounts.medium,   bar: "bg-yellow-400", text: "text-yellow-700" },
                { label: "Low",      value: severityCounts.low,      bar: "bg-green-400",  text: "text-green-700"  },
              ] as const).map(({ label, value, bar, text }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-14 shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${bar} transition-all duration-500`}
                      style={{ width: totalAll ? `${(value / totalAll) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-6 text-right shrink-0 ${value > 0 ? text : "text-gray-300"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Status</p>
            <div className="space-y-2">
              {([
                { label: "New",        key: "new",                   dot: "bg-blue-400",  text: "text-blue-700"  },
                { label: "Unmanaged",  key: "unmanaged",             dot: "bg-red-400",   text: "text-red-700"   },
                { label: "Managed ✓",  key: "managed_with_dates",    dot: "bg-green-400", text: "text-green-700" },
                { label: "Managed",    key: "managed_without_dates", dot: "bg-teal-400",  text: "text-teal-700"  },
                { label: "Closed",     key: "closed",                dot: "bg-gray-300",  text: "text-gray-500"  },
              ] as const).map(({ label, key, dot, text }) => {
                const value = statusCounts[key] ?? 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <span className="text-xs text-gray-500 flex-1">{label}</span>
                    <div className="w-20 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${dot} transition-all duration-500`}
                        style={{ width: totalAll ? `${(value / totalAll) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className={`text-sm font-semibold w-6 text-right shrink-0 ${value > 0 ? text : "text-gray-300"}`}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aging */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Aging</p>
            <div className="space-y-2">
              {([
                { label: "≤ 90 days",  value: agingCounts.d90,  bar: "bg-green-400",  text: "text-green-700"  },
                { label: "91–180 days", value: agingCounts.d180, bar: "bg-yellow-400", text: "text-yellow-700" },
                { label: "181d – 1yr", value: agingCounts.d365, bar: "bg-orange-400", text: "text-orange-700" },
                { label: "1 – 2 years", value: agingCounts.d730, bar: "bg-red-400",    text: "text-red-700"    },
                { label: "2+ years",   value: agingCounts.over, bar: "bg-red-700",    text: "text-red-900"    },
              ] as const).map(({ label, value, bar, text }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full ${bar} transition-all duration-500`}
                      style={{ width: totalAll ? `${(value / totalAll) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className={`text-sm font-semibold w-6 text-right shrink-0 ${value > 0 ? text : "text-gray-300"}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── Risk Matrix (collapsible) ── */}
      {!loading && risks.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-5">
          <button
            onClick={() => setMatrixOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left group"
          >
            <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">
              Risk Matrix
            </span>
            {matrixOpen
              ? <ChevronUpIcon className="w-4 h-4 text-gray-400" />
              : <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            }
          </button>

          {matrixOpen && (
            <div className="px-5 pb-5">
              <div className="relative">
                <div className="absolute inset-0 ml-12 mr-4 mt-2 mb-10 pointer-events-none" style={{ zIndex: 0 }}>
                  <div className="w-full h-full grid grid-cols-5 grid-rows-5" style={{ opacity: 0.18 }}>
                    <div className="bg-yellow-400" /><div className="bg-orange-400" /><div className="bg-red-500" /><div className="bg-red-500" /><div className="bg-red-600" />
                    <div className="bg-green-400" /><div className="bg-yellow-400" /><div className="bg-orange-400" /><div className="bg-red-500" /><div className="bg-red-500" />
                    <div className="bg-green-400" /><div className="bg-yellow-400" /><div className="bg-yellow-400" /><div className="bg-orange-400" /><div className="bg-red-400" />
                    <div className="bg-green-300" /><div className="bg-green-400" /><div className="bg-yellow-300" /><div className="bg-yellow-400" /><div className="bg-orange-400" />
                    <div className="bg-green-300" /><div className="bg-green-300" /><div className="bg-green-400" /><div className="bg-yellow-300" /><div className="bg-yellow-400" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" dataKey="x" name="Likelihood" domain={[0.5, 5.5]} ticks={[1,2,3,4,5]}
                      label={{ value: "Likelihood", position: "insideBottom", offset: -15, fontSize: 12 }} tick={{ fontSize: 11 }} />
                    <YAxis type="number" dataKey="y" name="Impact" domain={[0.5, 5.5]} ticks={[1,2,3,4,5]}
                      label={{ value: "Impact", angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }} tick={{ fontSize: 11 }} />
                    <Tooltip content={<MatrixTooltip />} />
                    <Scatter name="Inherent" data={matrixData} shape="circle">
                      {matrixData.map((e, i) => <Cell key={i} fill={scoreColor(e.score)} opacity={0.85} />)}
                    </Scatter>
                    {matrixResidual.length > 0 && (
                      <Scatter name="Residual" data={matrixResidual} shape={(props: any) => {
                        const { cx, cy } = props;
                        return <circle cx={cx} cy={cy} r={10} fill="white" stroke={scoreColor(props.payload.score)} strokeWidth={2.5} strokeDasharray="4 2" />;
                      }} />
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-600 justify-center">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Low (1–8)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />Medium (9–14)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />High (15–19)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />Critical (20–25)</span>
                {matrixResidual.length > 0 && (
                  <span className="flex items-center gap-1.5 border-l border-gray-200 pl-4">
                    <span className="w-3 h-3 rounded-full border-2 border-gray-500 inline-block" style={{ borderStyle: "dashed" }} />
                    Residual position
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Toolbar: Search + Status Filter + Sort ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-3 mb-3 space-y-3">
        {/* Row 1: Search + Sort */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search risks…"
              className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort + Columns */}
          <div className="ml-auto flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap hidden sm:block">Sort by</label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortCol)}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_at">Date Created</option>
              <option value="name">Name</option>
              <option value="likelihood">Likelihood</option>
              <option value="impact">Impact</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              className="text-xs border border-gray-300 rounded-md px-2 py-1.5 hover:bg-gray-50 transition-colors"
              title="Toggle sort direction"
            >
              {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
            </button>

            {/* Column picker */}
            <div ref={colsRef} className="relative">
              <button
                onClick={() => setShowColPicker(o => !o)}
                className={`text-xs border rounded-md px-2 py-1.5 flex items-center gap-1 transition-colors ${
                  showColPicker
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-gray-300 hover:bg-gray-50 text-gray-600"
                }`}
              >
                <ViewColumnsIcon className="w-3.5 h-3.5" />
                Columns
                {visibleCols.length !== DEFAULT_COLS.length && (
                  <span className="ml-0.5 px-1 py-0 rounded bg-blue-100 text-blue-700 text-[10px] font-semibold">
                    {visibleCols.length}
                  </span>
                )}
              </button>

              {showColPicker && (
                <div className="absolute right-0 top-9 z-30 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-2">
                  <p className="px-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Show columns
                  </p>
                  <div className="px-1 max-h-72 overflow-y-auto">
                    {/* Name is always shown */}
                    <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-md opacity-40 cursor-not-allowed select-none">
                      <input type="checkbox" checked readOnly className="w-3.5 h-3.5 rounded" />
                      <span className="text-sm text-gray-700">Name</span>
                    </label>
                    {COLUMN_DEFS.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-50 select-none"
                      >
                        <input
                          type="checkbox"
                          checked={col(key)}
                          onChange={e =>
                            setVisibleCols(prev =>
                              e.target.checked ? [...prev, key] : prev.filter(k => k !== key)
                            )
                          }
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mx-3 mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => setVisibleCols(DEFAULT_COLS)}
                      className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setVisibleCols(COLUMN_DEFS.map(d => d.key))}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      Show all
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Status Filter Chips */}
        <RiskStatusFilter
          selected={selectedStatuses}
          onChange={setSelectedStatuses}
          counts={statusCounts}
          total={totalAll}
        />
      </div>

      {/* ── Risk Table ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
          <p className="text-sm">Loading risks…</p>
        </div>
      ) : displayRisks.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg shadow-sm">
          <p className="text-base font-medium text-gray-700">No risks found</p>
          <p className="text-sm text-gray-400 mt-1">
            {q
              ? `No results for "${q}" — try a different search`
              : selectedStatuses.length > 0
                ? "No risks match the selected filters"
                : canEdit
                  ? "Create a new risk to get started"
                  : "No risks have been added yet"}
          </p>
          {(q || selectedStatuses.length > 0) && (
            <button
              onClick={() => { setSearchQuery(""); setSelectedStatuses([]); }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {/* Name — always shown */}
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("name")}
                >Name{sortIndicator("name")}</th>

                {col("asset_threat") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Asset / Threat
                  </th>
                )}
                {col("score") && (
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap"
                    onClick={() => handleSort("impact")}
                  >Score{sortIndicator("impact")}</th>
                )}
                {col("likelihood") && (
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap"
                    onClick={() => handleSort("likelihood")}
                  >Likelihood{sortIndicator("likelihood")}</th>
                )}
                {col("impact") && (
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap"
                    onClick={() => handleSort("impact")}
                  >Impact{sortIndicator("impact")}</th>
                )}
                {col("residual_score") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Residual
                  </th>
                )}
                {col("target_score") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Target
                  </th>
                )}
                {col("treatment") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Treatment
                  </th>
                )}
                {col("owner") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Owner
                  </th>
                )}
                {col("status") && (
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap"
                    onClick={() => handleSort("status")}
                  >Status{sortIndicator("status")}</th>
                )}
                {col("created") && (
                  <th
                    className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer select-none hover:text-blue-600 transition-colors whitespace-nowrap"
                    onClick={() => handleSort("created_at")}
                  >Created{sortIndicator("created_at")}</th>
                )}
                {col("age") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Age
                  </th>
                )}
                {col("controls") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Controls
                  </th>
                )}
                {col("category") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Category</th>
                )}
                {col("risk_type") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Type</th>
                )}
                {col("department") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Department</th>
                )}
                {col("owning_vp") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Owning VP</th>
                )}
                {col("stage") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Stage</th>
                )}
                {col("source") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Source</th>
                )}
                {col("risk_theme") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Theme</th>
                )}
                {col("date_identified") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Identified</th>
                )}
                {col("date_closed") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Risk Closed</th>
                )}
                {col("status_changed_closed") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Status Closed</th>
                )}
                {col("regulatory_compliance") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Compliance</th>
                )}
                {col("description") && (
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Description
                  </th>
                )}
                <th className="w-10 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedRisks.map(({ risk, isChild }) => (
                <tr
                  key={risk.id}
                  className={`group min-h-14 hover:bg-blue-50/40 transition-colors cursor-pointer ${
                    selectedRisk?.id === risk.id ? "bg-blue-50" : isChild ? "bg-gray-50/50" : ""
                  }`}
                  onClick={() => setSelectedRisk(risk)}
                >
                  {/* Name — always shown */}
                  <td className="px-4 py-3.5">
                    <div className={`flex items-start gap-2 ${isChild ? "pl-5" : ""}`}>
                      {isChild && <span className="text-gray-300 mt-0.5 shrink-0">↳</span>}
                      <div>
                        <div className="font-medium text-gray-900 leading-snug flex items-center gap-2">
                          {risk.name}
                          {!isChild && risk.child_count > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 font-medium">
                              {risk.child_count} sub
                            </span>
                          )}
                        </div>
                        {/* Show owner under name only when owner column is hidden */}
                        {risk.owner && !col("owner") && (
                          <div className="text-xs text-gray-400 mt-0.5">{risk.owner}</div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Asset / Threat */}
                  {col("asset_threat") && (
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-gray-600 space-y-0.5">
                        {risk.asset  ? <div>{risk.asset.name}</div>  : null}
                        {risk.threat ? <div className="text-gray-400">{risk.threat.name}</div> : null}
                        {!risk.asset && !risk.threat && <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                  )}

                  {/* Inherent Score */}
                  {col("score") && (
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBgClass(risk.inherent_score)}`}>
                        {risk.inherent_score}
                      </span>
                      {/* Show residual inline only if the dedicated residual column is hidden */}
                      {!col("residual_score") && risk.residual_score != null && (
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs text-gray-400">→</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBgClass(risk.residual_score)}`}>
                            {risk.residual_score}
                          </span>
                        </div>
                      )}
                    </td>
                  )}

                  {/* Likelihood */}
                  {col("likelihood") && (
                    <td className="px-4 py-3.5 text-sm font-medium text-gray-700">
                      {risk.likelihood}
                    </td>
                  )}

                  {/* Impact */}
                  {col("impact") && (
                    <td className="px-4 py-3.5 text-sm font-medium text-gray-700">
                      {risk.impact}
                    </td>
                  )}

                  {/* Residual Score */}
                  {col("residual_score") && (
                    <td className="px-4 py-3.5">
                      {risk.residual_score != null ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBgClass(risk.residual_score)}`}>
                          {risk.residual_score}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Target Score */}
                  {col("target_score") && (
                    <td className="px-4 py-3.5">
                      {risk.target_score != null ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBgClass(risk.target_score)}`}>
                          {risk.target_score}
                        </span>
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Treatment */}
                  {col("treatment") && (
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 capitalize">
                        {risk.treatment}
                      </span>
                    </td>
                  )}

                  {/* Owner */}
                  {col("owner") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.owner ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Status */}
                  {col("status") && (
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        risk.status === "new"                   ? "bg-blue-100 text-blue-800"  :
                        risk.status === "unmanaged"             ? "bg-red-100 text-red-800"    :
                        risk.status === "managed_with_dates"    ? "bg-green-100 text-green-800":
                        risk.status === "managed_without_dates" ? "bg-teal-100 text-teal-800"  :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {risk.status === "new"                   ? "New"        :
                         risk.status === "unmanaged"             ? "Unmanaged"  :
                         risk.status === "managed_with_dates"    ? "Managed ✓"  :
                         risk.status === "managed_without_dates" ? "Managed"    :
                         "Closed"}
                      </span>
                      {risk.status === "managed_with_dates" && risk.managed_start_date && (
                        <div className="text-xs text-gray-400 mt-0.5 whitespace-nowrap">
                          {risk.managed_start_date} – {risk.managed_end_date}
                        </div>
                      )}
                    </td>
                  )}

                  {/* Created */}
                  {col("created") && (
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(risk.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  )}

                  {/* Age */}
                  {col("age") && (
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                        risk.days_open <= 30  ? "bg-green-100 text-green-700"  :
                        risk.days_open <= 60  ? "bg-yellow-100 text-yellow-700":
                        risk.days_open <= 90  ? "bg-orange-100 text-orange-700":
                        risk.days_open <= 180 ? "bg-red-100 text-red-700"      :
                                                "bg-red-200 text-red-900"
                      }`}>
                        {risk.days_open}d
                      </span>
                    </td>
                  )}

                  {/* Controls count */}
                  {col("controls") && (
                    <td className="px-4 py-3.5">
                      {risk.controls.length > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 font-medium">
                          {risk.controls.length}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  )}

                  {/* Category */}
                  {col("category") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.category ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Type */}
                  {col("risk_type") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.risk_type ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Department */}
                  {col("department") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.department ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Owning VP */}
                  {col("owning_vp") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.owning_vp ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Stage */}
                  {col("stage") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.stage ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Source */}
                  {col("source") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.source ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Risk Theme */}
                  {col("risk_theme") && (
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                      {risk.risk_theme ?? <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Date Identified */}
                  {col("date_identified") && (
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {risk.date_identified
                        ? new Date(risk.date_identified).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Risk Closed Date */}
                  {col("date_closed") && (
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {risk.date_closed
                        ? new Date(risk.date_closed).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Status Changed To Closed */}
                  {col("status_changed_closed") && (
                    <td className="px-4 py-3.5 text-xs text-gray-500 whitespace-nowrap">
                      {risk.closed_at
                        ? new Date(risk.closed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {col("regulatory_compliance") && (
                    <td className="px-4 py-3.5 text-xs text-gray-500 max-w-[160px]">
                      {risk.regulatory_compliance
                        ? <span className="line-clamp-2">{risk.regulatory_compliance}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                  )}

                  {/* Description */}
                  {col("description") && (
                    <td className="px-4 py-3.5 text-xs text-gray-500 max-w-xs">
                      {risk.description
                        ? <span className="line-clamp-2">{risk.description}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                  )}

                  {/* Action menu */}
                  <td className="px-2 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                    <RiskActionMenu
                      riskId={risk.id}
                      canEdit={canEdit}
                      onViewDetails={() => setSelectedRisk(risk)}
                      onEdit={() => openEdit(risk)}
                      onDelete={() => handleDelete(risk.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <Pagination
            total={displayRisks.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            itemLabel="risk"
          />
        </div>
      )}

      {/* ── Detail Panel ── */}
      {selectedRisk && (
        <RiskDetailPanel
          risk={selectedRisk}
          controls={controls}
          users={users}
          canEdit={canEdit}
          onClose={() => setSelectedRisk(null)}
          onEdit={(r) => { setSelectedRisk(null); openEdit(r); }}
          onDelete={(id) => { setSelectedRisk(null); handleDelete(id); }}
          onLinkedControlsChange={handleLinkedControlsChange}
        />
      )}

      {/* ── Form Modal ── */}
      {showForm && (
        <RiskFormModal
          editRisk={editRisk}
          assets={assets}
          threats={threats}
          users={users}
          allRisks={risks}
          onClose={() => { setShowForm(false); setEditRisk(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* ── Bulk Import Modal ── */}
      {showImport && (
        <BulkImportModal
          onClose={() => setShowImport(false)}
          onImported={() => Promise.all([load(), loadCounts()])}
        />
      )}
    </div>
  );
}

// ── Page wrapper with Suspense (required for useSearchParams in Next.js 14) ───

export default function RisksPage() {
  return (
    <AppShell>
      <Suspense fallback={
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-gray-400">
            <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-sm">Loading…</p>
          </div>
        </div>
      }>
        <RisksPageContent />
      </Suspense>
    </AppShell>
  );
}



