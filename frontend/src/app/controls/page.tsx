"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import FrameworkBadge from "@/components/FrameworkBadge";
import { controlsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Control } from "@/types";
import { PlusIcon, MagnifyingGlassIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadExport } from "@/lib/api";

export default function ControlsPage() {
  const [controls, setControls]   = useState<Control[]>([]);
  const [search, setSearch]       = useState("");
  const [framework, setFramework] = useState("ALL");
  const [soxOnly, setSoxOnly]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const user = getUser();

  useEffect(() => {
    controlsApi.list()
      .then((r) => { setControls(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const frameworks = [
    "ALL",
    ...Array.from(new Set(controls.flatMap((c) => c.mappings.map((m) => m.framework)))).sort(),
  ];

  const filtered = controls.filter((c) => {
    const matchesSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.control_id.toLowerCase().includes(search.toLowerCase()) ||
      (c.owner ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFramework =
      framework === "ALL" ||
      c.mappings.some((m) => m.framework === framework);
    const matchesSox = !soxOnly || c.sox_in_scope;
    return matchesSearch && matchesFramework && matchesSox;
  });

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Control Library</h1>
            <p className="text-gray-500 mt-1">{controls.length} controls · mapped to {frameworks.filter((f) => f !== "ALL").join(", ")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadExport("/exports/controls", `control_library_${new Date().toISOString().slice(0,10)}.xlsx`)}
              className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              Export
            </button>
            {user?.role === "admin" && (
              <Link
                href="/controls/new"
                className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Control
              </Link>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search controls…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {frameworks.map((f) => (
              <button
                key={f}
                onClick={() => setFramework(f)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  framework === f
                    ? "bg-brand-600 text-white"
                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
            <button
              onClick={() => setSoxOnly(!soxOnly)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                soxOnly
                  ? "bg-amber-500 text-white"
                  : "bg-white border border-amber-300 text-amber-700 hover:bg-amber-50"
              }`}
            >
              SOX
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Frequency</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Frameworks</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      No controls match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((ctrl) => (
                    <tr key={ctrl.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/controls/${ctrl.id}`} className="font-mono text-brand-600 hover:underline">
                          {ctrl.control_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/controls/${ctrl.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                            {ctrl.title}
                          </Link>
                          {ctrl.sox_in_scope && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700 shrink-0">
                              SOX
                            </span>
                          )}
                        </div>
                        {ctrl.owner && (
                          <p className="text-xs text-gray-400">{ctrl.owner}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600">{ctrl.control_type ?? "—"}</td>
                      <td className="px-4 py-3 capitalize text-gray-600">{ctrl.frequency ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(ctrl.mappings.map((m) => m.framework))).map((f) => (
                            <FrameworkBadge key={f} framework={f} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={ctrl.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
