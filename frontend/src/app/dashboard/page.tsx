"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { dashboardApi } from "@/lib/api";
import type { DashboardStats } from "@/types";
import { getUser } from "@/lib/auth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar,
} from "recharts";
import type { PciTestingBreakdown, RiskAgingBuckets } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "#e5e7eb",
  "In Progress": "#3b82f6",
  "Needs Review": "#f59e0b",
  "Complete":    "#22c55e",
};

const FRAMEWORK_COLORS = ["#7c3aed", "#0891b2", "#ea580c", "#e11d48"];

const AGING_BUCKETS = [
  { key: "0_30",    label: "0 – 30 days",    color: "#22c55e" },  // green — fresh
  { key: "30_60",   label: "30 – 60 days",   color: "#84cc16" },  // lime
  { key: "60_90",   label: "60 – 90 days",   color: "#f59e0b" },  // amber
  { key: "90_180",  label: "90 – 180 days",  color: "#f97316" },  // orange
  { key: "180_365", label: "180 – 365 days", color: "#ef4444" },  // red
  { key: "365_plus",label: "365+ days",      color: "#7f1d1d" },  // dark red — critical
] as const;

const PCI_STATUS_CONFIG = [
  { key: "complete",     label: "Complete",     color: "#22c55e" },
  { key: "needs_review", label: "Needs Review", color: "#f59e0b" },
  { key: "in_progress",  label: "In Progress",  color: "#3b82f6" },
  { key: "not_started",  label: "Not Started",  color: "#d1d5db" },
  { key: "failed",       label: "Failed",       color: "#ef4444" },
  { key: "never_tested", label: "Never Tested", color: "#e5e7eb" },
] as const;

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const user = getUser();

  useEffect(() => {
    dashboardApi.stats().then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      </AppShell>
    );
  }

  const statusData = [
    { name: "Not Started", value: stats.not_started },
    { name: "In Progress", value: stats.in_progress },
    { name: "Needs Review", value: stats.needs_review },
    { name: "Complete",    value: stats.complete },
  ];

  const frameworkData = Object.entries(stats.framework_coverage).map(([k, v]) => ({
    name: k, controls: v,
  }));

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, {user?.display_name} · {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
          </p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Controls"     value={stats.total_controls}     sub={`${stats.active_controls} active`} />
          <StatCard label="Test Cycles"        value={stats.total_test_cycles}  sub={`${stats.active_test_cycles} active`} />
          <StatCard label="Total Assignments"  value={stats.total_assignments}  />
          <StatCard label="Evidence Files"     value={stats.total_evidence}     />
        </div>

        {/* Exceptions alert row — only shown when there's something to act on */}
        {(stats.exception_pending > 0 || stats.exception_expiring_soon > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a href="/exceptions" className="group flex items-center gap-4 bg-white border border-yellow-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.exception_pending}</p>
                <p className="text-xs text-gray-500">Exceptions Awaiting Approval</p>
              </div>
            </a>

            <a href="/exceptions?status=approved" className="group flex items-center gap-4 bg-white border border-green-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.exception_approved}</p>
                <p className="text-xs text-gray-500">Active Approved Exceptions</p>
              </div>
            </a>

            {stats.exception_expiring_soon > 0 && (
              <a href="/exceptions" className="group flex items-center gap-4 bg-white border border-red-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.exception_expiring_soon}</p>
                  <p className="text-xs text-gray-500">Exceptions Expiring Within 30 Days</p>
                </div>
              </a>
            )}
          </div>
        )}

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Testing status pie */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Assignment Status</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => value > 0 ? `${name}: ${value}` : ""}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Framework coverage bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Framework Coverage (controls mapped)</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={frameworkData} barSize={40}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="controls" radius={[4, 4, 0, 0]}>
                  {frameworkData.map((_, i) => (
                    <Cell key={i} fill={FRAMEWORK_COLORS[i % FRAMEWORK_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* PCI DSS Testing Progress */}
        {stats.pci_testing && stats.pci_testing.total > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">PCI DSS Control Testing</h2>
                <p className="text-xs text-gray-400 mt-0.5">{stats.pci_testing.total} controls in scope</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-600">{stats.pci_testing.complete}</p>
                <p className="text-xs text-gray-400">tested complete</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex h-5 rounded-full overflow-hidden bg-gray-100 gap-px">
                {PCI_STATUS_CONFIG.map(({ key, color }) => {
                  const val = stats.pci_testing[key as keyof PciTestingBreakdown] as number;
                  const pct = (val / stats.pci_testing.total) * 100;
                  return pct > 0 ? (
                    <div
                      key={key}
                      style={{ width: `${pct}%`, backgroundColor: color }}
                      title={`${PCI_STATUS_CONFIG.find(c => c.key === key)?.label}: ${val}`}
                      className="transition-all"
                    />
                  ) : null;
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {PCI_STATUS_CONFIG.map(({ key, label, color }) => {
                  const val = stats.pci_testing[key as keyof PciTestingBreakdown] as number;
                  return val > 0 ? (
                    <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      {label}: <b>{val}</b>
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={160}>
              <BarChart
                data={PCI_STATUS_CONFIG.map(({ key, label, color }) => ({
                  name: label,
                  value: stats.pci_testing[key as keyof PciTestingBreakdown] as number,
                  fill: color,
                })).filter(d => d.value > 0)}
                barSize={44}
                margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [value, "Controls"]}
                  labelFormatter={(l) => `${l}`}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {PCI_STATUS_CONFIG.map(({ key, color }) => (
                    <Cell key={key} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Deficiency status */}
        {(stats.deficiency_open + stats.deficiency_in_remediation + stats.deficiency_remediated + stats.deficiency_risk_accepted) > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Deficiency Status</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Open",           value: stats.deficiency_open,           color: "#ef4444" },
                { label: "In Remediation", value: stats.deficiency_in_remediation, color: "#f97316" },
                { label: "Remediated",     value: stats.deficiency_remediated,     color: "#22c55e" },
                { label: "Risk Accepted",  value: stats.deficiency_risk_accepted,  color: "#9ca3af" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={[
                  { name: "Open",           value: stats.deficiency_open,           fill: "#ef4444" },
                  { name: "In Remediation", value: stats.deficiency_in_remediation, fill: "#f97316" },
                  { name: "Remediated",     value: stats.deficiency_remediated,     fill: "#22c55e" },
                  { name: "Risk Accepted",  value: stats.deficiency_risk_accepted,  fill: "#9ca3af" },
                ]}
                barSize={48}
              >
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[
                    { fill: "#ef4444" },
                    { fill: "#f97316" },
                    { fill: "#22c55e" },
                    { fill: "#9ca3af" },
                  ].map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Risk Aging */}
        {stats.risk_aging && Object.values(stats.risk_aging).some(v => v > 0) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">Risk Age Distribution</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  How long open risks have been on the register
                </p>
              </div>
              <div className="text-right">
                {(stats.risk_aging["180_365"] + stats.risk_aging["365_plus"]) > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-full px-3 py-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    {stats.risk_aging["180_365"] + stats.risk_aging["365_plus"]} risk{(stats.risk_aging["180_365"] + stats.risk_aging["365_plus"]) !== 1 ? "s" : ""} over 180 days
                  </span>
                )}
              </div>
            </div>

            {/* Stacked age bar */}
            {(() => {
              const total = Object.values(stats.risk_aging).reduce((a, b) => a + b, 0);
              return total > 0 ? (
                <div className="mb-5">
                  <div className="flex h-6 rounded-full overflow-hidden bg-gray-100 gap-px">
                    {AGING_BUCKETS.map(({ key, color, label }) => {
                      const val = stats.risk_aging[key as keyof RiskAgingBuckets];
                      const pct = (val / total) * 100;
                      return pct > 0 ? (
                        <div
                          key={key}
                          style={{ width: `${pct}%`, backgroundColor: color }}
                          title={`${label}: ${val}`}
                          className="transition-all"
                        />
                      ) : null;
                    })}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                    {AGING_BUCKETS.map(({ key, label, color }) => {
                      const val = stats.risk_aging[key as keyof RiskAgingBuckets];
                      return val > 0 ? (
                        <div key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          {label}: <b>{val}</b>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Bar chart */}
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={AGING_BUCKETS.map(({ key, label, color }) => ({
                  name: label,
                  value: stats.risk_aging[key as keyof RiskAgingBuckets],
                  fill: color,
                }))}
                barSize={48}
                margin={{ top: 4, right: 0, left: -20, bottom: 0 }}
              >
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: number) => [v, "Risks"]} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {AGING_BUCKETS.map(({ key, color }) => (
                    <Cell key={key} fill={color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Progress summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Overall Test Completion</h2>
          {stats.total_assignments > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden flex">
                  {statusData.map((s) => (
                    s.value > 0 && (
                      <div
                        key={s.name}
                        style={{
                          width: `${(s.value / stats.total_assignments) * 100}%`,
                          backgroundColor: STATUS_COLORS[s.name],
                        }}
                        title={`${s.name}: ${s.value}`}
                      />
                    )
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-700 w-12 text-right">
                  {Math.round((stats.complete / stats.total_assignments) * 100)}%
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-3">
                {statusData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] }} />
                    {s.name}: <b>{s.value}</b>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400">No assignments yet.</p>
          )}
        </div>
      </div>
    </AppShell>
  );
}
