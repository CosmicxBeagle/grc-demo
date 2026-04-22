"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { cyclesApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { TestCycleSummary } from "@/types";
import {
  PlusIcon,
  CalendarDaysIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  Squares2X2Icon,
  ListBulletIcon,
  EllipsisHorizontalIcon,
  EyeIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  ArchiveBoxIcon,
  FunnelIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const PAGE_SIZE = 20;

// ─── Status helpers ────────────────────────────────────────────────────────────

function isOverdue(c: TestCycleSummary) {
  if (c.status === "completed") return false;
  if (!c.end_date) return false;
  return new Date(c.end_date) < new Date();
}

function effectiveStatus(c: TestCycleSummary): string {
  return isOverdue(c) ? "overdue" : c.status;
}

function completionPct(c: TestCycleSummary) {
  return c.total_assignments === 0 ? 0 : Math.round((c.complete_count / c.total_assignments) * 100);
}

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned", active: "Active", completed: "Completed", overdue: "Overdue",
};

// Full class strings so Tailwind JIT can detect them
const STATUS_BADGE_CLASS: Record<string, string> = {
  planned:   "bg-gray-100 text-gray-600",
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue:   "bg-red-100 text-red-700",
};

const STATUS_DOT_CLASS: Record<string, string> = {
  planned: "bg-gray-400", active: "bg-blue-500", completed: "bg-green-500", overdue: "bg-red-500",
};

// Used as inline style to avoid Tailwind JIT issues with dynamic border-l colors
const STATUS_BORDER_COLOR: Record<string, string> = {
  planned: "#d1d5db", active: "#3b82f6", completed: "#22c55e", overdue: "#ef4444",
};

const STATUS_GROUP_BADGE: Record<string, string> = {
  planned:   "bg-gray-100 text-gray-600",
  active:    "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  overdue:   "bg-red-100 text-red-700",
};

// ─── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ complete, total }: { complete: number; total: number }) {
  const p = total === 0 ? 0 : Math.round((complete / total) * 100);
  const barColor = p === 100 ? "bg-green-500" : p >= 50 ? "bg-blue-500" : "bg-gray-300";
  return (
    <div className="flex items-center gap-1.5 w-32">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full ${barColor} transition-all`} style={{ width: `${p}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right tabular-nums">{p}%</span>
    </div>
  );
}

// ─── Action menu ───────────────────────────────────────────────────────────────

function ActionMenu({ cycle, onClosed }: { cycle: TestCycleSummary; onClosed: () => void }) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const handleClose = async () => {
    setOpen(false);
    if (!confirm(`Close "${cycle.name}"? All assignments must be complete or failed. This cannot be undone.`)) return;
    setClosing(true);
    setErr(null);
    try {
      await cyclesApi.close(cycle.id);
      onClosed();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErr(detail ?? "Could not close cycle.");
    } finally {
      setClosing(false);
    }
  };

  const isClosed = cycle.status === "completed";

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <div ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Actions"
          disabled={closing}
        >
          <EllipsisHorizontalIcon className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-8 z-30 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm">
            <Link
              href={`/test-cycles/${cycle.id}`}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700"
              onClick={() => setOpen(false)}
            >
              <EyeIcon className="w-3.5 h-3.5 shrink-0" /> View
            </Link>
            <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700 w-full text-left">
              <PencilSquareIcon className="w-3.5 h-3.5 shrink-0" /> Edit
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700 w-full text-left">
              <DocumentDuplicateIcon className="w-3.5 h-3.5 shrink-0" /> Duplicate
            </button>
            {!isClosed && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleClose}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 w-full text-left"
                >
                  <ArchiveBoxIcon className="w-3.5 h-3.5 shrink-0" /> Close Cycle
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {err && (
        <div className="absolute right-0 top-10 z-40 w-64 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2 shadow-lg">
          {err}
          <button onClick={() => setErr(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}
    </div>
  );
}

// ─── Compact card (single-row) ─────────────────────────────────────────────────

function CycleCard({ cycle, onClosed }: { cycle: TestCycleSummary; onClosed: () => void }) {
  const status = effectiveStatus(cycle);
  return (
    <div
      className="group relative flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-2.5 hover:border-gray-300 hover:shadow-sm transition-all border-l-4"
      style={{ borderLeftColor: STATUS_BORDER_COLOR[status] ?? "#d1d5db" }}
    >
      {/* Status badge */}
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${STATUS_BADGE_CLASS[status] ?? "bg-gray-100 text-gray-600"}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_DOT_CLASS[status] ?? "bg-gray-400"}`} />
        {STATUS_LABEL[status] ?? status}
      </span>

      {/* Brand / framework tag */}
      {cycle.brand && (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100 shrink-0">
          {cycle.brand}
        </span>
      )}

      {/* Name — main clickable area */}
      <Link
        href={`/test-cycles/${cycle.id}`}
        className="flex-1 min-w-0 text-sm font-medium text-gray-900 hover:text-brand-600 truncate"
      >
        {cycle.name}
      </Link>

      {/* Date range */}
      {(cycle.start_date || cycle.end_date) && (
        <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400 shrink-0">
          <CalendarDaysIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="tabular-nums">
            {cycle.start_date ?? "—"} → {cycle.end_date ?? "—"}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <ProgressBar complete={cycle.complete_count} total={cycle.total_assignments} />

      {/* Count */}
      <span className="text-xs text-gray-500 shrink-0 w-14 text-right tabular-nums">
        {cycle.complete_count} / {cycle.total_assignments}
      </span>

      {/* Action menu */}
      <div className="shrink-0 w-7">
        <ActionMenu cycle={cycle} onClosed={onClosed} />
      </div>
    </div>
  );
}

// ─── Table row ─────────────────────────────────────────────────────────────────

function CycleRow({ cycle, onClosed }: { cycle: TestCycleSummary; onClosed: () => void }) {
  const status = effectiveStatus(cycle);
  return (
    <tr className="group border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <td className="py-2.5 pl-4 pr-2">
        <Link
          href={`/test-cycles/${cycle.id}`}
          className="text-sm font-medium text-gray-900 hover:text-brand-600"
        >
          {cycle.name}
        </Link>
      </td>
      <td className="py-2.5 px-2">
        {cycle.brand && (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
            {cycle.brand}
          </span>
        )}
      </td>
      <td className="py-2.5 px-2">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[status] ?? "bg-gray-100 text-gray-600"}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_DOT_CLASS[status] ?? "bg-gray-400"}`} />
          {STATUS_LABEL[status] ?? status}
        </span>
      </td>
      <td className="py-2.5 px-2 text-xs text-gray-500 tabular-nums whitespace-nowrap">
        {cycle.start_date && cycle.end_date
          ? `${cycle.start_date} → ${cycle.end_date}`
          : cycle.start_date ?? "—"}
      </td>
      <td className="py-2.5 px-2">
        <ProgressBar complete={cycle.complete_count} total={cycle.total_assignments} />
      </td>
      <td className="py-2.5 px-2 text-xs text-gray-500 text-right tabular-nums whitespace-nowrap">
        {cycle.complete_count} / {cycle.total_assignments}
      </td>
      <td className="py-2.5 pl-2 pr-3">
        <div className="flex justify-end">
          <ActionMenu cycle={cycle} onClosed={onClosed} />
        </div>
      </td>
    </tr>
  );
}

// ─── Collapsible group header (card view) ──────────────────────────────────────

function CardGroup({
  groupKey, label, cycles, badge, onClosed,
}: { groupKey: string; label: string; cycles: TestCycleSummary[]; badge: string; onClosed: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left py-1.5 px-1 mb-1 group/hdr"
      >
        {open
          ? <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          : <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
        <span className="text-xs font-bold tracking-widest uppercase text-gray-500">{label}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badge}`}>
          {cycles.length}
        </span>
      </button>
      {open && (
        <div className="space-y-1.5 pl-5">
          {cycles.map(c => <CycleCard key={c.id} cycle={c} onClosed={onClosed} />)}
        </div>
      )}
    </div>
  );
}

// ─── Sort button ───────────────────────────────────────────────────────────────

function SortBtn({
  field, label, sortBy, sortDir, onToggle,
}: {
  field: "name" | "date" | "progress";
  label: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onToggle: (f: "name" | "date" | "progress") => void;
}) {
  const active = sortBy === field;
  return (
    <button
      onClick={() => onToggle(field)}
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${active ? "text-brand-600" : "text-gray-500 hover:text-gray-700"}`}
    >
      {label}
      {active
        ? sortDir === "asc"
          ? <ChevronUpIcon className="w-3 h-3" />
          : <ChevronDownIcon className="w-3 h-3" />
        : <span className="w-3 h-3 text-gray-300">↕</span>}
    </button>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TestCyclesPage() {
  const [cycles, setCycles] = useState<TestCycleSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter / sort / view state
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brandFilter, setBrandFilter]   = useState("all");
  const [sortBy, setSortBy]           = useState<"name" | "date" | "progress">("date");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc");
  const [view, setView]               = useState<"card" | "table">("card");
  const [groupBy, setGroupBy]         = useState<"none" | "status" | "month">("none");
  const [page, setPage]               = useState(1);

  const user = getUser();

  const reload = () => {
    setLoading(true);
    cyclesApi.list().then(r => { setCycles(r.data); setLoading(false); });
  };

  useEffect(() => { reload(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Available brand options derived from data
  const brands = useMemo(
    () => Array.from(new Set(cycles.map(c => c.brand).filter(Boolean) as string[])).sort(),
    [cycles]
  );

  // Filtered + sorted list
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let out = cycles.filter(c => {
      if (q && !c.name.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all") {
        if (statusFilter === "overdue" ? !isOverdue(c) : effectiveStatus(c) !== statusFilter) return false;
      }
      if (brandFilter !== "all" && c.brand !== brandFilter) return false;
      return true;
    });
    out = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name")     cmp = a.name.localeCompare(b.name);
      else if (sortBy === "date") cmp = (a.start_date ?? "").localeCompare(b.start_date ?? "");
      else                        cmp = completionPct(a) - completionPct(b);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return out;
  }, [cycles, search, statusFilter, brandFilter, sortBy, sortDir]);

  // Reset page whenever filters/sort change
  useEffect(() => setPage(1), [search, statusFilter, brandFilter, sortBy, sortDir, groupBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Group the current page's items
  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "", items: paged }];
    if (groupBy === "status") {
      const order = ["overdue", "active", "planned", "completed"];
      const map = new Map<string, TestCycleSummary[]>();
      for (const c of paged) {
        const s = effectiveStatus(c);
        if (!map.has(s)) map.set(s, []);
        map.get(s)!.push(c);
      }
      return order.filter(k => map.has(k)).map(k => ({ key: k, items: map.get(k)! }));
    }
    // group by month
    const map = new Map<string, TestCycleSummary[]>();
    for (const c of paged) {
      const key = c.start_date ? c.start_date.slice(0, 7) : "No Date";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => ({ key: k, items: v }));
  }, [paged, groupBy]);

  function toggleSort(field: "name" | "date" | "progress") {
    if (sortBy === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(field); setSortDir("asc"); }
  }

  function formatGroupLabel(key: string) {
    if (groupBy === "status") return STATUS_LABEL[key] ?? key;
    if (groupBy === "month" && key !== "No Date") {
      const [year, month] = key.split("-");
      return new Date(Number(year), Number(month) - 1).toLocaleString("default", { month: "long", year: "numeric" });
    }
    return key;
  }

  const hasFilters = search || statusFilter !== "all" || brandFilter !== "all";

  function clearFilters() {
    setSearch(""); setStatusFilter("all"); setBrandFilter("all");
  }

  // Visible page numbers (max 5, centred on current)
  const pageNums = useMemo(() => {
    const start = Math.max(1, Math.min(totalPages - 4, page - 2));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-4">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Test Cycles</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {loading
                ? "Loading…"
                : filtered.length === cycles.length
                  ? `${cycles.length} cycle${cycles.length !== 1 ? "s" : ""}`
                  : `${filtered.length} of ${cycles.length} cycles`}
            </p>
          </div>
          {(user?.role === "admin" || user?.role === "grc_manager") && (
            <Link
              href="/test-cycles/new"
              className="inline-flex items-center gap-1.5 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              New Cycle
            </Link>
          )}
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          {/* Search */}
          <div className="relative min-w-52 flex-1">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cycles…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent placeholder:text-gray-400"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="all">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>

          {/* Brand / framework filter */}
          {brands.length > 0 && (
            <select
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            >
              <option value="all">All Frameworks</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}

          {/* Sort */}
          <select
            value={`${sortBy}-${sortDir}`}
            onChange={e => {
              const [f, d] = e.target.value.split("-") as ["name" | "date" | "progress", "asc" | "desc"];
              setSortBy(f); setSortDir(d);
            }}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="date-desc">Date (newest first)</option>
            <option value="date-asc">Date (oldest first)</option>
            <option value="name-asc">Name A → Z</option>
            <option value="name-desc">Name Z → A</option>
            <option value="progress-desc">Progress (highest)</option>
            <option value="progress-asc">Progress (lowest)</option>
          </select>

          {/* Group by */}
          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as "none" | "status" | "month")}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          >
            <option value="none">No grouping</option>
            <option value="status">Group by status</option>
            <option value="month">Group by month</option>
          </select>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-200 shrink-0" />

          {/* View toggle */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 shrink-0">
            <button
              onClick={() => setView("card")}
              title="Card view"
              className={`p-1.5 rounded-md transition-colors ${view === "card" ? "bg-white shadow-sm text-brand-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <Squares2X2Icon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("table")}
              title="Table view"
              className={`p-1.5 rounded-md transition-colors ${view === "table" ? "bg-white shadow-sm text-brand-600" : "text-gray-400 hover:text-gray-600"}`}
            >
              <ListBulletIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3" />
              Loading cycles…
            </div>
          </div>

        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="text-center py-24 bg-white border border-gray-200 rounded-xl">
            <FunnelIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-base font-semibold text-gray-600">No cycles match your filters</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filter criteria</p>
            <button
              onClick={clearFilters}
              className="mt-4 text-sm text-brand-600 hover:text-brand-700 font-medium underline-offset-2 hover:underline"
            >
              Clear all filters
            </button>
          </div>

        ) : groupBy !== "none" ? (
          /* ── Grouped view ── */
          <div className="space-y-5">
            {view === "card" ? (
              groups.map(g => (
                <CardGroup
                  key={g.key}
                  groupKey={g.key}
                  label={formatGroupLabel(g.key)}
                  cycles={g.items}
                  badge={STATUS_GROUP_BADGE[g.key] ?? "bg-gray-100 text-gray-600"}
                  onClosed={reload}
                />
              ))
            ) : (
              /* Grouped table — single table with group header rows */
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="text-left py-2.5 pl-4 pr-2">
                        <SortBtn field="name" label="Name" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                      </th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Framework</th>
                      <th className="text-left py-2.5 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="text-left py-2.5 px-2">
                        <SortBtn field="date" label="Dates" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                      </th>
                      <th className="text-left py-2.5 px-2">
                        <SortBtn field="progress" label="Progress" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                      </th>
                      <th className="py-2.5 px-2" />
                      <th className="py-2.5 pl-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(g => (
                      <React.Fragment key={g.key}>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <td colSpan={7} className="py-1.5 pl-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                {formatGroupLabel(g.key)}
                              </span>
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${STATUS_GROUP_BADGE[g.key] ?? "bg-gray-100 text-gray-600"}`}>
                                {g.items.length}
                              </span>
                            </div>
                          </td>
                        </tr>
                        {g.items.map(c => <CycleRow key={c.id} cycle={c} onClosed={reload} />)}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        ) : view === "table" ? (
          /* ── Flat table ── */
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-left py-2.5 pl-4 pr-2">
                    <SortBtn field="name" label="Name" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                  </th>
                  <th className="text-left py-2.5 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Framework</th>
                  <th className="text-left py-2.5 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="text-left py-2.5 px-2">
                    <SortBtn field="date" label="Date Range" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                  </th>
                  <th className="text-left py-2.5 px-2">
                    <SortBtn field="progress" label="Progress" sortBy={sortBy} sortDir={sortDir} onToggle={toggleSort} />
                  </th>
                  <th className="py-2.5 px-2" />
                  <th className="py-2.5 pl-2 pr-3" />
                </tr>
              </thead>
              <tbody>
                {paged.map(c => <CycleRow key={c.id} cycle={c} onClosed={reload} />)}
              </tbody>
            </table>
          </div>

        ) : (
          /* ── Flat cards ── */
          <div className="space-y-1.5">
            {paged.map(c => <CycleCard key={c.id} cycle={c} onClosed={reload} />)}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium text-gray-700">{(page - 1) * PAGE_SIZE + 1}</span>
              {" – "}
              <span className="font-medium text-gray-700">{Math.min(page * PAGE_SIZE, filtered.length)}</span>
              {" of "}
              <span className="font-medium text-gray-700">{filtered.length}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {pageNums.map(n => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-8 h-8 text-sm rounded-lg border transition-colors ${
                    n === page
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>
    </AppShell>
  );
}
