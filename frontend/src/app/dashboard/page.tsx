"use client";

import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { dashboardApi } from "@/lib/api";
import type { DashboardStats, PciTestingBreakdown, RiskAgingBuckets } from "@/types";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { FRAMEWORK_HEX } from "@/lib/design-tokens";

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "#cbd5e1",
  "In Progress": "#2563eb",
  "Needs Review": "#f59e0b",
  Complete:       "#10b981",
};

const AGING_BUCKETS = [
  { key: "0_30", label: "0 - 30 days", color: "#22c55e" },
  { key: "30_60", label: "30 - 60 days", color: "#84cc16" },
  { key: "60_90", label: "60 - 90 days", color: "#f59e0b" },
  { key: "90_180", label: "90 - 180 days", color: "#f97316" },
  { key: "180_365", label: "180 - 365 days", color: "#ef4444" },
  { key: "365_plus", label: "365+ days", color: "#7f1d1d" },
] as const;

const PCI_STATUS_CONFIG = [
  { key: "complete", label: "Complete", color: "#10b981" },
  { key: "needs_review", label: "Needs Review", color: "#f59e0b" },
  { key: "in_progress", label: "In Progress", color: "#2563eb" },
  { key: "not_started", label: "Not Started", color: "#cbd5e1" },
  { key: "failed", label: "Failed", color: "#ef4444" },
  { key: "never_tested", label: "Never Tested", color: "#94a3b8" },
] as const;

function Surface({
  title,
  eyebrow,
  children,
  right,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function OverviewCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: ReactNode;
  tone: "teal" | "blue" | "amber" | "rose";
}) {
  const toneClasses = {
    teal: "from-teal-500/15 to-emerald-500/5 text-teal-700 ring-teal-200",
    blue: "from-blue-500/15 to-cyan-500/5 text-blue-700 ring-blue-200",
    amber: "from-amber-500/15 to-orange-500/5 text-amber-700 ring-amber-200",
    rose: "from-rose-500/15 to-red-500/5 text-rose-700 ring-rose-200",
  }[tone];

  return (
    <div className={`rounded-[24px] border border-slate-200 bg-gradient-to-br ${toneClasses} p-5 shadow-sm`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-inset ring-white/80">
          {icon}
        </div>
      </div>
    </div>
  );
}

function PriorityTile({
  href,
  label,
  value,
  caption,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  caption: string;
  tone: "amber" | "emerald" | "rose";
}) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50/80 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900",
  }[tone];

  return (
    <a
      href={href}
      className={`group rounded-[24px] border p-5 transition-transform duration-150 hover:-translate-y-0.5 ${toneClasses}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold">{value}</p>
          <p className="mt-1 text-sm opacity-75">{caption}</p>
        </div>
        <span className="text-xs font-medium opacity-70 transition-opacity group-hover:opacity-100">Open -&gt;</span>
      </div>
    </a>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    dashboardApi
      .stats()
      .then((response) => setStats(response.data))
      .catch((e) => setError(e?.response?.data?.detail ?? "Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-6">
            <div className="h-44 rounded-[32px] bg-slate-200/70" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-32 rounded-[24px] bg-slate-200/70" />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="h-80 rounded-[28px] bg-slate-200/70" />
              <div className="h-80 rounded-[28px] bg-slate-200/70" />
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !stats) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl pt-16 text-center">
          <p className="mb-3 text-sm text-red-500">{error || "No data returned."}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError("");
              dashboardApi
                .stats()
                .then((response) => setStats(response.data))
                .catch((e) => setError(e?.response?.data?.detail ?? "Failed to load dashboard data."))
                .finally(() => setLoading(false));
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            Retry
          </button>
        </div>
      </AppShell>
    );
  }

  const statusData = [
    { name: "Not Started", value: stats.not_started },
    { name: "In Progress", value: stats.in_progress },
    { name: "Needs Review", value: stats.needs_review },
    { name: "Complete", value: stats.complete },
  ];

  const frameworkData = Object.entries(stats.framework_coverage).map(([name, controls]) => ({
    name,
    controls,
  }));

  const completionRate =
    stats.total_assignments > 0 ? Math.round((stats.complete / stats.total_assignments) * 100) : 0;

  const pciChartData = PCI_STATUS_CONFIG.map(({ key, label, color }) => ({
    name: label,
    value: stats.pci_testing[key as keyof PciTestingBreakdown] as number,
    fill: color,
  })).filter((entry) => entry.value > 0);

  const deficiencyData = [
    { name: "Open", value: stats.deficiency_open, fill: "#ef4444" },
    { name: "In Remediation", value: stats.deficiency_in_remediation, fill: "#f97316" },
    { name: "Remediated", value: stats.deficiency_remediated, fill: "#10b981" },
    { name: "Risk Accepted", value: stats.deficiency_risk_accepted, fill: "#94a3b8" },
  ];

  const agingData = AGING_BUCKETS.map(({ key, label, color }) => ({
    name: label,
    value: stats.risk_aging[key as keyof RiskAgingBuckets],
    fill: color,
  }));

  const staleRisks = stats.risk_aging["180_365"] + stats.risk_aging["365_plus"];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
          <OverviewCard label="Total Controls" value={stats.total_controls} sub={`${stats.active_controls} currently active`} tone="teal" icon={<ShieldCheckIcon className="h-6 w-6" />} />
          <OverviewCard label="Test Cycles" value={stats.total_test_cycles} sub={`${stats.active_test_cycles} active cycles in motion`} tone="blue" icon={<RectangleStackIcon className="h-6 w-6" />} />
          <OverviewCard label="Total Assignments" value={stats.total_assignments} sub={`${stats.in_progress} actively in progress`} tone="amber" icon={<ClipboardDocumentListIcon className="h-6 w-6" />} />
          <OverviewCard label="Evidence Files" value={stats.total_evidence} sub="Supporting documentation on file" tone="rose" icon={<DocumentDuplicateIcon className="h-6 w-6" />} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <PriorityTile href="/exceptions" label="Immediate Attention" value={stats.exception_pending} caption="exceptions waiting for approval" tone="amber" />
          <PriorityTile href="/exceptions?status=approved" label="Governance Coverage" value={stats.exception_approved} caption="approved exceptions remain active" tone="emerald" />
          <PriorityTile href="/exceptions" label="Time Sensitive" value={stats.exception_expiring_soon} caption="exceptions expiring within 30 days" tone="rose" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <Surface eyebrow="Execution" title="Testing Momentum" right={<div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{completionRate}% complete</div>}>
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>
                      {statusData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-4">
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">Overall assignment completion</span>
                    <span className="font-semibold text-slate-900">{completionRate}%</span>
                  </div>
                  <div className="flex h-4 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                    {statusData.map((status) =>
                      status.value > 0 ? (
                        <div
                          key={status.name}
                          style={{
                            width: `${(status.value / Math.max(stats.total_assignments, 1)) * 100}%`,
                            backgroundColor: STATUS_COLORS[status.name],
                          }}
                          title={`${status.name}: ${status.value}`}
                        />
                      ) : null
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {statusData.map((status) => (
                    <div key={status.name} className="rounded-[20px] border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status.name] }} />
                        <p className="text-sm font-medium text-slate-700">{status.name}</p>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">{status.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Surface>

          <Surface eyebrow="Coverage" title="Framework Mapping Depth">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={frameworkData} barSize={42} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="controls" radius={[10, 10, 0, 0]}>
                    {frameworkData.map((entry) => (
                      <Cell key={entry.name} fill={FRAMEWORK_HEX[entry.name] ?? "#64748b"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        {stats.pci_testing && stats.pci_testing.total > 0 ? (
          <Surface eyebrow="Program Focus" title="PCI DSS Testing Snapshot" right={<div className="text-right"><p className="text-3xl font-semibold text-emerald-600">{stats.pci_testing.complete}</p><p className="text-xs uppercase tracking-[0.18em] text-slate-400">complete</p></div>}>
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div>
                <div className="mb-4 flex items-center justify-between text-sm">
                  <span className="text-slate-500">{stats.pci_testing.total} controls in PCI scope</span>
                  <span className="font-medium text-slate-700">{Math.round((stats.pci_testing.complete / stats.pci_testing.total) * 100)}% validated</span>
                </div>
                <div className="mb-4 flex h-5 overflow-hidden rounded-full bg-slate-100">
                  {PCI_STATUS_CONFIG.map(({ key, color }) => {
                    const value = stats.pci_testing[key as keyof PciTestingBreakdown] as number;
                    const width = (value / stats.pci_testing.total) * 100;
                    return width > 0 ? <div key={key} style={{ width: `${width}%`, backgroundColor: color }} title={`${key}: ${value}`} /> : null;
                  })}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {PCI_STATUS_CONFIG.map(({ key, label, color }) => {
                    const value = stats.pci_testing[key as keyof PciTestingBreakdown] as number;
                    return (
                      <div key={key} className="rounded-[18px] bg-slate-50 p-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pciChartData} barSize={30} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {pciChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Surface>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          {deficiencyData.some((entry) => entry.value > 0) ? (
            <Surface eyebrow="Issue Health" title="Deficiency Status">
              <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {deficiencyData.map(({ name, value, fill }) => (
                  <div key={name} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fill }} />
                      <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{name}</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deficiencyData} barSize={44}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {deficiencyData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Surface>
          ) : null}

        </div>

        {stats.risk_aging ? (
          <Surface eyebrow="Register Health" title="Risk Age Distribution" right={staleRisks > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">{staleRisks} risks over 180 days</span> : null}>
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {AGING_BUCKETS.map(({ key, label, color }) => {
                const value = stats.risk_aging[key as keyof RiskAgingBuckets];
                return (
                  <div key={key} className="rounded-[18px] border border-slate-200 bg-white p-4" style={{ borderTopWidth: 3, borderTopColor: color }}>
                    <p className="text-2xl font-semibold text-slate-950">{value}</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mb-5 flex h-4 overflow-hidden rounded-full bg-slate-100">
              {AGING_BUCKETS.map(({ key, color, label }) => {
                const value = stats.risk_aging[key as keyof RiskAgingBuckets];
                const total = Object.values(stats.risk_aging).reduce((sum, bucket) => sum + bucket, 0);
                const width = total > 0 ? (value / total) * 100 : 0;
                return width > 0 ? <div key={key} style={{ width: `${width}%`, backgroundColor: color }} title={`${label}: ${value}`} /> : null;
              })}
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingData} barSize={42} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {agingData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        ) : null}
      </div>
    </AppShell>
  );
}
