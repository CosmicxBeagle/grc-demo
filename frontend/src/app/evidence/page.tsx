"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { evidenceApi, cyclesApi } from "@/lib/api";
import type { EvidenceListItem, EvidenceListParams, TestCycleSummary } from "@/types";
import { getUser } from "@/lib/auth";
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  ArrowPathIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  DocumentTextIcon,
  TableCellsIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";

// ── File-type icon ──────────────────────────────────────────────────────────
function FileIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const cls = className ?? "w-5 h-5";
  if (["pdf"].includes(ext))               return <DocumentTextIcon className={`${cls} text-red-500`} />;
  if (["doc", "docx"].includes(ext))       return <DocumentIcon className={`${cls} text-blue-600`} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <TableCellsIcon className={`${cls} text-green-600`} />;
  if (["ppt", "pptx"].includes(ext))      return <PresentationChartBarIcon className={`${cls} text-orange-500`} />;
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return <PhotoIcon className={`${cls} text-purple-500`} />;
  if (["zip", "gz", "tar", "7z"].includes(ext)) return <ArchiveBoxIcon className={`${cls} text-yellow-600`} />;
  return <DocumentIcon className={`${cls} text-gray-400`} />;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function formatBytes(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function controlPrefix(controlId?: string) {
  if (!controlId) return null;
  const m = controlId.match(/^([A-Z]+)/);
  return m ? m[1] : null;
}

const PREFIX_COLORS: Record<string, string> = {
  IAC: "bg-violet-100 text-violet-700",
  MON: "bg-sky-100 text-sky-700",
  CFG: "bg-emerald-100 text-emerald-700",
  CHG: "bg-amber-100 text-amber-700",
  VUL: "bg-rose-100 text-rose-700",
  LOG: "bg-indigo-100 text-indigo-700",
  DAT: "bg-pink-100 text-pink-700",
  BCP: "bg-teal-100 text-teal-700",
};
function prefixColor(prefix: string | null) {
  if (!prefix) return "bg-gray-100 text-gray-600";
  return PREFIX_COLORS[prefix] ?? "bg-gray-100 text-gray-600";
}

type SortBy = "original_filename" | "uploaded_at" | "control" | "cycle";

// ── Upload Drawer ────────────────────────────────────────────────────────────
function UploadDrawer({
  open,
  onClose,
  cycles,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  cycles: TestCycleSummary[];
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [cycleId, setCycleId] = useState("");
  const [description, setDescription] = useState("");
  const [assignmentId, setAssignmentId] = useState("");
  const [assignments, setAssignments] = useState<{ id: number; control_id: string; control_title: string }[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setFile(null); setCycleId(""); setDescription(""); setAssignmentId("");
      setAssignments([]); setProgress(null); setError(null); setSuccess(false);
    }
  }, [open]);

  // Load assignments when cycle selected
  useEffect(() => {
    if (!cycleId) { setAssignments([]); setAssignmentId(""); return; }
    cyclesApi.get(Number(cycleId)).then((r) => {
      const items = r.data.assignments.map((a) => ({
        id: a.id,
        control_id: a.control?.control_id ?? String(a.control_id),
        control_title: a.control?.title ?? "",
      }));
      setAssignments(items);
      setAssignmentId("");
    });
  }, [cycleId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !assignmentId) return;
    setError(null); setProgress(0);
    try {
      await evidenceApi.upload(Number(assignmentId), file, description, setProgress);
      setProgress(100);
      setSuccess(true);
      setTimeout(() => { onClose(); onUploaded(); }, 1200);
    } catch (e: unknown) {
      setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Upload failed");
      setProgress(null);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full md:w-[480px] bg-white z-50 flex flex-col shadow-2xl"
        style={{ animation: "slideInRight 0.2s ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Upload Evidence</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Drop zone */}
          <div
            ref={dragRef}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-colors"
          >
            <CloudArrowUpIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            {file ? (
              <div>
                <p className="font-medium text-gray-800">{file.name}</p>
                <p className="text-sm text-gray-400">{formatBytes(file.size)}</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-gray-700">Drag & drop a file here</p>
                <p className="text-sm text-gray-400 mt-1">or click to browse</p>
              </div>
            )}
            <input ref={inputRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
          </div>

          {/* Test cycle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Test Cycle</label>
            <select
              value={cycleId}
              onChange={(e) => setCycleId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Select a cycle…</option>
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Assignment / control */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Control / Assignment</label>
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              disabled={!cycleId || assignments.length === 0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Select a control…</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>{a.control_id} — {a.control_title}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what this file contains…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Progress */}
          {progress !== null && (
            <div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-brand-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1 text-right">{progress}%</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm">
              File uploaded successfully!
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!file || !assignmentId || progress !== null}
            className="px-5 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Upload
          </button>
        </div>
      </div>
    </>
  );
}

// ── Delete confirmation modal ───────────────────────────────────────────────
function DeleteModal({
  count,
  onConfirm,
  onCancel,
  busy,
}: {
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete {count} file{count !== 1 ? "s" : ""}?</h3>
        <p className="text-sm text-gray-500 mb-6">This cannot be undone. The files will be permanently removed.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton rows ────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-gray-100">
          <td className="px-4 py-3"><div className="w-4 h-4 rounded bg-gray-200 animate-pulse" /></td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
            </div>
          </td>
          <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
          <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
        </tr>
      ))}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function EvidencePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = getUser();
  const isAdmin = user?.role === "admin" || user?.role === "grc_manager" || user?.role === "grc_analyst";

  // ── State from URL ──────────────────────────────────────────────────────
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [selectedCycleIds, setSelectedCycleIds] = useState<number[]>(
    searchParams.getAll("cycle").map(Number).filter(Boolean)
  );
  const [selectedPrefixes, setSelectedPrefixes] = useState<string[]>(
    searchParams.getAll("prefix")
  );
  const [dateFrom, setDateFrom] = useState(searchParams.get("date_from") ?? "");
  const [dateTo, setDateTo] = useState(searchParams.get("date_to") ?? "");
  const [sortBy, setSortBy] = useState<SortBy>((searchParams.get("sort_by") as SortBy) ?? "uploaded_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">((searchParams.get("sort_dir") as "asc" | "desc") ?? "desc");
  const [page, setPage] = useState(Number(searchParams.get("page") ?? 1));
  const [pageSize, setPageSize] = useState(Number(searchParams.get("page_size") ?? 25));

  // ── Data ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<EvidenceListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycles, setCycles] = useState<TestCycleSummary[]>([]);

  // ── Selection ───────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Upload drawer ───────────────────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);

  // ── Filter panel ────────────────────────────────────────────────────────
  const [filterOpen, setFilterOpen] = useState(false);

  // ── Debounced search ────────────────────────────────────────────────────
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 300);
  }, [q]);

  // Load cycles for filter/upload
  useEffect(() => {
    cyclesApi.list().then((r) => setCycles(r.data)).catch(() => {});
  }, []);

  // Sync URL params
  const syncUrl = useCallback((overrides: Record<string, unknown> = {}) => {
    const state = {
      q: debouncedQ || undefined,
      cycle: selectedCycleIds.length ? selectedCycleIds.map(String) : undefined,
      prefix: selectedPrefixes.length ? selectedPrefixes : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      sort_by: sortBy !== "uploaded_at" ? sortBy : undefined,
      sort_dir: sortDir !== "desc" ? sortDir : undefined,
      page: page > 1 ? String(page) : undefined,
      page_size: pageSize !== 25 ? String(pageSize) : undefined,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) {
      if (v === undefined) continue;
      if (Array.isArray(v)) v.forEach((vi) => params.append(k, vi));
      else params.set(k, String(v));
    }
    router.replace(`/evidence?${params.toString()}`, { scroll: false });
  }, [debouncedQ, selectedCycleIds, selectedPrefixes, dateFrom, dateTo, sortBy, sortDir, page, pageSize, router]);

  // Fetch data
  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: EvidenceListParams = {
      q: debouncedQ || undefined,
      test_cycle_id: selectedCycleIds.length ? selectedCycleIds : undefined,
      control_prefix: selectedPrefixes.length ? selectedPrefixes : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
      page,
      page_size: pageSize,
    };
    evidenceApi.list(params)
      .then((r) => {
        setItems(r.data.items);
        setTotal(r.data.total);
        setSelected(new Set());
      })
      .catch(() => setError("Failed to load evidence. Please try again."))
      .finally(() => setLoading(false));
    syncUrl();
  }, [debouncedQ, selectedCycleIds, selectedPrefixes, dateFrom, dateTo, sortBy, sortDir, page, pageSize, syncUrl]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Sorting ─────────────────────────────────────────────────────────────
  const handleSort = (col: SortBy) => {
    if (col === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  // ── Selection ───────────────────────────────────────────────────────────
  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.id)));
  };
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Download single ─────────────────────────────────────────────────────
  const downloadOne = async (item: EvidenceListItem) => {
    const res = await evidenceApi.download(item.id);
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url; a.download = item.original_filename; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Bulk delete ─────────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    setDeleting(true);
    await Promise.all(Array.from(selected).map((id) => evidenceApi.delete(id)));
    setDeleting(false);
    setShowDeleteModal(false);
    fetchData();
  };

  // ── Active filter chips ─────────────────────────────────────────────────
  const clearAll = () => {
    setQ(""); setSelectedCycleIds([]); setSelectedPrefixes([]);
    setDateFrom(""); setDateTo(""); setPage(1);
  };
  const hasFilters = debouncedQ || selectedCycleIds.length || selectedPrefixes.length || dateFrom || dateTo;

  // ── Sort header helper ──────────────────────────────────────────────────
  const SortIcon = ({ col }: { col: SortBy }) => {
    if (col !== sortBy) return <ChevronUpDownIcon className="w-4 h-4 text-gray-400" />;
    return sortDir === "asc"
      ? <ChevronUpIcon className="w-4 h-4 text-brand-600" />
      : <ChevronDownIcon className="w-4 h-4 text-brand-600" />;
  };

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, total);
  const totalPages = Math.ceil(total / pageSize);

  // Known prefixes for filter
  const KNOWN_PREFIXES = ["IAC", "MON", "CFG", "CHG", "VUL", "LOG", "DAT", "BCP"];

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-4">
        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evidence Library</h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              {loading ? "Loading…" : `${total.toLocaleString()} file${total !== 1 ? "s" : ""} across all test cycles`}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setUploadOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
            >
              <CloudArrowUpIcon className="w-4 h-4" />
              Upload Evidence
            </button>
          )}
        </div>

        {/* ── Search + filter bar ──────────────────────────────────────── */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by file name, control, or test cycle…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${filterOpen || hasFilters ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
            {hasFilters && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-brand-600 text-white text-xs rounded-full">
                {[debouncedQ ? 1 : 0, selectedCycleIds.length > 0 ? 1 : 0, selectedPrefixes.length > 0 ? 1 : 0, dateFrom || dateTo ? 1 : 0].reduce((a, b) => a + b, 0)}
              </span>
            )}
          </button>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
        </div>

        {/* ── Expanded filter panel ────────────────────────────────────── */}
        {filterOpen && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Test Cycle multi-select */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Test Cycle</label>
              <select
                multiple
                value={selectedCycleIds.map(String)}
                onChange={(e) => {
                  const vals = Array.from(e.target.selectedOptions, (o) => Number(o.value));
                  setSelectedCycleIds(vals); setPage(1);
                }}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {cycles.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Control prefix */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Control Family</label>
              <div className="flex flex-wrap gap-1">
                {KNOWN_PREFIXES.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setSelectedPrefixes((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                      );
                      setPage(1);
                    }}
                    className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${selectedPrefixes.includes(p) ? "bg-brand-600 text-white border-brand-600" : "border-gray-300 text-gray-600 hover:border-brand-400"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Upload Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Upload Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>
        )}

        {/* ── Active filter chips ───────────────────────────────────────── */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2">
            {debouncedQ && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-brand-50 border border-brand-200 text-brand-700 rounded-full text-xs font-medium">
                Search: "{debouncedQ}"
                <button onClick={() => setQ("")}><XMarkIcon className="w-3 h-3" /></button>
              </span>
            )}
            {selectedCycleIds.map((id) => {
              const c = cycles.find((x) => x.id === id);
              return (
                <span key={id} className="inline-flex items-center gap-1 px-3 py-1 bg-sky-50 border border-sky-200 text-sky-700 rounded-full text-xs font-medium">
                  Cycle: {c?.name ?? id}
                  <button onClick={() => setSelectedCycleIds((p) => p.filter((x) => x !== id))}><XMarkIcon className="w-3 h-3" /></button>
                </span>
              );
            })}
            {selectedPrefixes.map((p) => (
              <span key={p} className="inline-flex items-center gap-1 px-3 py-1 bg-violet-50 border border-violet-200 text-violet-700 rounded-full text-xs font-medium">
                Family: {p}
                <button onClick={() => setSelectedPrefixes((prev) => prev.filter((x) => x !== p))}><XMarkIcon className="w-3 h-3" /></button>
              </span>
            ))}
            {(dateFrom || dateTo) && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-medium">
                Date: {dateFrom || "…"} → {dateTo || "…"}
                <button onClick={() => { setDateFrom(""); setDateTo(""); }}><XMarkIcon className="w-3 h-3" /></button>
              </span>
            )}
            <button onClick={clearAll} className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">
              Clear all
            </button>
          </div>
        )}

        {/* ── Bulk action toolbar ───────────────────────────────────────── */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-brand-50 border border-brand-200 rounded-lg">
            <span className="text-sm font-medium text-brand-700">{selected.size} selected</span>
            <div className="flex-1" />
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              <TrashIcon className="w-4 h-4" />
              Delete Selected
            </button>
            <button onClick={() => setSelected(new Set())} className="text-sm text-gray-500 hover:text-gray-700">
              Clear selection
            </button>
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {error ? (
            <div className="text-center py-16">
              <p className="text-gray-500 mb-4">{error}</p>
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <ArrowPathIcon className="w-4 h-4" />
                Retry
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("original_filename")} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                      File <SortIcon col="original_filename" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("control")} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                      Control <SortIcon col="control" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("cycle")} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                      Test Cycle <SortIcon col="cycle" />
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Uploaded By</th>
                  <th className="text-left px-4 py-3">
                    <button onClick={() => handleSort("uploaded_at")} className="flex items-center gap-1 font-medium text-gray-600 hover:text-gray-900">
                      Uploaded <SortIcon col="uploaded_at" />
                    </button>
                  </th>
                  <th className="px-4 py-3 w-24" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows />
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-20">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <DocumentIcon className="w-12 h-12 text-gray-200" />
                        <p className="font-medium text-gray-500">
                          {hasFilters ? "No files match your filters" : "No evidence uploaded yet"}
                        </p>
                        <p className="text-sm">
                          {hasFilters ? (
                            <button onClick={clearAll} className="text-brand-600 hover:underline">Clear filters</button>
                          ) : (
                            "Upload files from inside a test cycle or use the Upload button above."
                          )}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const prefix = controlPrefix(item.control_id);
                    const isChecked = selected.has(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-gray-100 group hover:bg-gray-50 transition-colors ${isChecked ? "bg-brand-50" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(item.id)}
                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <FileIcon name={item.original_filename} />
                            <div>
                              <p className="font-medium text-gray-900 leading-tight">{item.original_filename}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.description && (
                                  <span className="text-xs text-gray-400 truncate max-w-[180px]">{item.description}</span>
                                )}
                                {item.file_size && (
                                  <span className="text-xs text-gray-400">{formatBytes(item.file_size)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.control_id ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${prefixColor(prefix)}`}>
                                {item.control_id}
                              </span>
                              {item.control_title && (
                                <span className="text-gray-600 text-xs truncate max-w-[140px]">{item.control_title}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {item.test_cycle_id ? (
                            <Link
                              href={`/test-cycles/${item.test_cycle_id}`}
                              className="text-brand-600 hover:underline text-sm"
                            >
                              {item.test_cycle_name}
                            </Link>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-gray-600 text-sm">
                            {item.uploader_name ?? item.uploader_email ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                          {new Date(item.uploaded_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => downloadOne(item)}
                              title="Download"
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800"
                            >
                              <ArrowDownTrayIcon className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => { setSelected(new Set([item.id])); setShowDeleteModal(true); }}
                                title="Delete"
                                className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>
              Showing {firstItem.toLocaleString()}–{lastItem.toLocaleString()} of {total.toLocaleString()} files
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) p = i + 1;
                else if (page <= 4) p = i + 1;
                else if (page >= totalPages - 3) p = totalPages - 6 + i;
                else p = page - 3 + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded text-center ${p === page ? "bg-brand-600 text-white font-medium" : "hover:bg-gray-100"}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="px-2 py-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Upload drawer ─────────────────────────────────────────────── */}
      <UploadDrawer
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        cycles={cycles}
        onUploaded={fetchData}
      />

      {/* ── Delete confirmation modal ──────────────────────────────────── */}
      {showDeleteModal && (
        <DeleteModal
          count={selected.size}
          onConfirm={handleBulkDelete}
          onCancel={() => setShowDeleteModal(false)}
          busy={deleting}
        />
      )}
    </AppShell>
  );
}

export default function EvidencePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-400">Loading…</div>}>
      <EvidencePageContent />
    </Suspense>
  );
}
