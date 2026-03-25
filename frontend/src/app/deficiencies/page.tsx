"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { deficiencyApi } from "@/lib/api";
import type { Deficiency, DeficiencyStatus, DeficiencySeverity } from "@/types";
import { ExclamationTriangleIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadExport } from "@/lib/api";

const SEVERITY_COLORS: Record<DeficiencySeverity, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-blue-100 text-blue-700",
};

const STATUS_COLORS: Record<DeficiencyStatus, string> = {
  open:            "text-red-600",
  in_remediation:  "text-orange-600",
  remediated:      "text-green-600",
  risk_accepted:   "text-gray-500",
};

const STATUS_LABELS: Record<DeficiencyStatus, string> = {
  open:            "Open",
  in_remediation:  "In Remediation",
  remediated:      "Remediated",
  risk_accepted:   "Risk Accepted",
};

const ALL_STATUSES = ["open", "in_remediation", "remediated", "risk_accepted"] as const;

export default function DeficienciesPage() {
  const router = useRouter();
  const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
  const [filter, setFilter] = useState<DeficiencyStatus | "all">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    deficiencyApi.list().then((r) => {
      setDeficiencies(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts: Record<DeficiencyStatus, number> = {
    open:           deficiencies.filter((d) => d.status === "open").length,
    in_remediation: deficiencies.filter((d) => d.status === "in_remediation").length,
    remediated:     deficiencies.filter((d) => d.status === "remediated").length,
    risk_accepted:  deficiencies.filter((d) => d.status === "risk_accepted").length,
  };

  const filtered = filter === "all" ? deficiencies : deficiencies.filter((d) => d.status === filter);

  const updateStatus = async (id: number, status: DeficiencyStatus) => {
    await deficiencyApi.update(id, { status });
    load();
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">Deficiencies</h1>
          </div>
          <button
            onClick={() => downloadExport("/exports/deficiencies", `deficiency_register_${new Date().toISOString().slice(0,10)}.xlsx`)}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s === filter ? "all" : s)}
              className={`bg-white border rounded-xl p-4 text-left transition-all hover:shadow-sm ${
                filter === s ? "border-brand-400 ring-1 ring-brand-400" : "border-gray-200"
              }`}
            >
              <p className={`text-2xl font-bold ${STATUS_COLORS[s]}`}>{counts[s]}</p>
              <p className="text-xs text-gray-500 mt-1">{STATUS_LABELS[s]}</p>
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-brand-600 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            All ({deficiencies.length})
          </button>
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s === filter ? "all" : s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === s
                  ? "bg-brand-600 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {STATUS_LABELS[s]} ({counts[s]})
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            {filter === "all" ? "No deficiencies found." : `No ${STATUS_LABELS[filter as DeficiencyStatus]} deficiencies.`}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Severity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Due Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Remediation Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{d.title}</span>
                      {d.description && (
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[d.severity]}`}>
                        {d.severity.charAt(0).toUpperCase() + d.severity.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className={`text-xs border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none font-medium ${STATUS_COLORS[d.status]}`}
                        value={d.status}
                        onChange={(e) => updateStatus(d.id, e.target.value as DeficiencyStatus)}
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {d.due_date ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                      <span className="line-clamp-2">{d.remediation_plan ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
