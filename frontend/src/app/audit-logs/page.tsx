"use client";
import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { auditApi } from "@/lib/api";
import type { AuditLogEntry } from "@/types";

// ── Action badge colours ───────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  RISK_CREATED:          "bg-green-100 text-green-800",
  RISK_UPDATED:          "bg-blue-100 text-blue-800",
  RISK_DELETED:          "bg-red-100 text-red-800",
  CONTROL_CREATED:       "bg-green-100 text-green-800",
  CONTROL_UPDATED:       "bg-blue-100 text-blue-800",
  CONTROL_DELETED:       "bg-red-100 text-red-800",
  EXCEPTION_CREATED:     "bg-yellow-100 text-yellow-800",
  EXCEPTION_APPROVED:    "bg-green-100 text-green-800",
  EXCEPTION_REJECTED:    "bg-red-100 text-red-800",
  EXCEPTION_UPDATED:     "bg-blue-100 text-blue-800",
  DEFICIENCY_CREATED:    "bg-orange-100 text-orange-800",
  DEFICIENCY_UPDATED:    "bg-blue-100 text-blue-800",
  DEFICIENCY_DELETED:    "bg-red-100 text-red-800",
  EVIDENCE_UPLOADED:     "bg-purple-100 text-purple-800",
  EVIDENCE_DELETED:      "bg-red-100 text-red-800",
  AUTH_LOGIN:            "bg-gray-100 text-gray-700",
  AUTH_SSO_LOGIN:        "bg-gray-100 text-gray-700",
  AUTH_LOGIN_FAILED:     "bg-red-100 text-red-800",
  EXPORT_GENERATED:      "bg-indigo-100 text-indigo-800",
};

const RESOURCE_TYPES = ["Risk", "Control", "Exception", "Deficiency", "Evidence", "User", "Export"];

function actionColor(action: string) {
  return ACTION_COLOR[action] ?? "bg-gray-100 text-gray-600";
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function ChangePill({ field, from, to }: { field: string; from: unknown; to: unknown }) {
  const fmt = (v: unknown) => (v === null || v === undefined ? "—" : String(v));
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5 mr-1 mb-1">
      <span className="font-medium text-gray-700">{field}</span>
      <span className="text-red-500 line-through">{fmt(from)}</span>
      <span className="text-gray-400">→</span>
      <span className="text-green-700 font-medium">{fmt(to)}</span>
    </span>
  );
}

const PAGE_SIZE = 50;

export default function AuditLogsPage() {
  const [items, setItems]               = useState<AuditLogEntry[]>([]);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // Filters
  const [filterResource, setFilterResource] = useState("");
  const [filterAction, setFilterAction]     = useState("");
  const [filterActor, setFilterActor]       = useState("");

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    setError(null);
    try {
      const res = await auditApi.list({
        resource_type: filterResource || undefined,
        action:        filterAction   || undefined,
        actor_email:   filterActor    || undefined,
        limit:  PAGE_SIZE,
        offset: p * PAGE_SIZE,
      });
      setItems(res.data.items);
      setTotal(res.data.total);
      setPage(p);
    } catch {
      setError("Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [filterResource, filterAction, filterActor]);

  useEffect(() => { load(0); }, [load]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {total.toLocaleString()} events recorded · append-only · SOX compliant
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live — also streaming to SIEM via Azure Monitor
          </span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <select
            value={filterResource}
            onChange={e => setFilterResource(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All resource types</option>
            {RESOURCE_TYPES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <input
            type="text"
            placeholder="Filter by action (e.g. RISK_UPDATED)"
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(0)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-60 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <input
            type="text"
            placeholder="Filter by user email"
            value={filterActor}
            onChange={e => setFilterActor(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(0)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <button
            onClick={() => load(0)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Apply
          </button>

          {(filterResource || filterAction || filterActor) && (
            <button
              onClick={() => { setFilterResource(""); setFilterAction(""); setFilterActor(""); }}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <th className="px-4 py-3 w-44">Timestamp (UTC)</th>
                <th className="px-4 py-3 w-48">Who</th>
                <th className="px-4 py-3 w-52">Action</th>
                <th className="px-4 py-3">Resource</th>
                <th className="px-4 py-3">What Changed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit events found</td></tr>
              ) : items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs whitespace-nowrap">
                    {formatTs(item.timestamp)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 truncate max-w-[180px]">{item.actor_email ?? "—"}</div>
                    {item.actor_role && (
                      <span className="text-xs text-gray-400">{item.actor_role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${actionColor(item.action)}`}>
                      {item.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.resource_type && (
                      <span className="text-xs text-gray-400 mr-1">{item.resource_type}</span>
                    )}
                    <span className="text-gray-800">{item.resource_name ?? item.resource_id ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    {item.changes && Object.keys(item.changes).length > 0 ? (
                      <div className="flex flex-wrap">
                        {Object.entries(item.changes).map(([field, { from, to }]) => (
                          <ChangePill key={field} field={field} from={from} to={to} />
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => load(page - 1)}
                disabled={page === 0}
                className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                ← Prev
              </button>
              <button
                onClick={() => load(page + 1)}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border rounded-lg disabled:opacity-40 hover:bg-gray-50"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
