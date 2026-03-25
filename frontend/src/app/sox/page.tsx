"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import FrameworkBadge from "@/components/FrameworkBadge";
import { controlsApi, downloadExport } from "@/lib/api";
import type { Control, SoxItgcDomain } from "@/types";
import { ArrowDownTrayIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";

const ITGC_DOMAINS: SoxItgcDomain[] = [
  "Access Controls",
  "Change Management",
  "Computer Operations",
  "Program Development",
];

const DOMAIN_COLORS: Record<SoxItgcDomain, string> = {
  "Access Controls":    "bg-blue-100 text-blue-800",
  "Change Management":  "bg-purple-100 text-purple-800",
  "Computer Operations":"bg-orange-100 text-orange-800",
  "Program Development":"bg-green-100 text-green-800",
};

const ALL_ASSERTIONS = [
  "Completeness",
  "Accuracy",
  "Existence",
  "Authorization",
  "Valuation",
  "Presentation & Disclosure",
];

function AssertionDot({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      title={label}
      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border
        ${active
          ? "bg-brand-600 text-white border-brand-600"
          : "bg-gray-100 text-gray-300 border-gray-200"
        }`}
    >
      {label.charAt(0)}
    </span>
  );
}

export default function SoxScopingPage() {
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<SoxItgcDomain | "all">("all");

  useEffect(() => {
    controlsApi.list()
      .then((r) => { setControls(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const inScope = controls.filter((c) => c.sox_in_scope);
  const filtered = domainFilter === "all"
    ? inScope
    : inScope.filter((c) => c.sox_itgc_domain === domainFilter);

  const domainCounts = ITGC_DOMAINS.reduce<Record<string, number>>((acc, d) => {
    acc[d] = inScope.filter((c) => c.sox_itgc_domain === d).length;
    return acc;
  }, {});

  // Unique systems across all in-scope controls
  const allSystems = Array.from(
    new Set(
      inScope
        .flatMap((c) => (c.sox_systems ?? "").split(",").map((s) => s.trim()))
        .filter(Boolean)
    )
  ).sort();

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="w-6 h-6 text-brand-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SOX ITGC Scoping</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {inScope.length} of {controls.length} controls in scope
              </p>
            </div>
          </div>
          <button
            onClick={() => downloadExport("/exports/sox", `sox_itgc_scoping_${new Date().toISOString().slice(0, 10)}.xlsx`)}
            className="inline-flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export SOX Workbook
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {ITGC_DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => setDomainFilter(d === domainFilter ? "all" : d)}
              className={`bg-white border rounded-xl p-4 text-left transition-all hover:shadow-sm ${
                domainFilter === d ? "border-brand-400 ring-1 ring-brand-400" : "border-gray-200"
              }`}
            >
              <p className="text-2xl font-bold text-gray-900">{domainCounts[d]}</p>
              <p className="text-xs text-gray-500 mt-1">{d}</p>
            </button>
          ))}
        </div>

        {/* Systems covered */}
        {allSystems.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Systems in Scope</h2>
            <div className="flex flex-wrap gap-2">
              {allSystems.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Assertion legend */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Financial Assertion Legend</h2>
          <div className="flex flex-wrap gap-3">
            {ALL_ASSERTIONS.map((a) => (
              <div key={a} className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold">
                  {a.charAt(0)}
                </span>
                {a}
              </div>
            ))}
          </div>
        </div>

        {/* Domain filter tabs */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setDomainFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              domainFilter === "all"
                ? "bg-brand-600 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            All In-Scope ({inScope.length})
          </button>
          {ITGC_DOMAINS.map((d) => (
            <button
              key={d}
              onClick={() => setDomainFilter(d === domainFilter ? "all" : d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                domainFilter === d
                  ? "bg-brand-600 text-white"
                  : "border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {d} ({domainCounts[d]})
            </button>
          ))}
        </div>

        {/* Controls table */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <ShieldCheckIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No SOX in-scope controls yet.</p>
            <p className="text-sm text-gray-400 mt-1">
              Open a control, toggle <strong>SOX In-Scope</strong>, and assign its ITGC domain.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-28">Control ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">ITGC Domain</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Systems</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Assertions
                    <span className="block font-normal normal-case tracking-normal text-gray-400">C · A · E · Au · V · P</span>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Frameworks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const activeAssertions = new Set(
                    (c.sox_assertions ?? "").split(",").map((s) => s.trim()).filter(Boolean)
                  );
                  const systems = (c.sox_systems ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                  const frameworks = Array.from(new Set(c.mappings.map((m) => m.framework)));

                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/controls/${c.id}`}
                          className="font-mono text-brand-600 hover:underline text-xs"
                        >
                          {c.control_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/controls/${c.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                          {c.title}
                        </Link>
                        {c.owner && (
                          <p className="text-xs text-gray-400 mt-0.5">{c.owner}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.sox_itgc_domain ? (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${DOMAIN_COLORS[c.sox_itgc_domain as SoxItgcDomain] ?? "bg-gray-100 text-gray-700"}`}>
                            {c.sox_itgc_domain}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {systems.length > 0
                            ? systems.map((s) => (
                                <span key={s} className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5">{s}</span>
                              ))
                            : <span className="text-xs text-gray-400">—</span>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {ALL_ASSERTIONS.map((a) => (
                            <AssertionDot key={a} label={a} active={activeAssertions.has(a)} />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {frameworks.map((f) => <FrameworkBadge key={f} framework={f} />)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
