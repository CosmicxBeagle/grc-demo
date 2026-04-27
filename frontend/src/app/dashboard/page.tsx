"use client";

import { useEffect, useState, type ReactNode } from "react";
import AppShell from "@/components/AppShell";
import { dashboardApi } from "@/lib/api";
import type {
  DashboardStats,
  PciTestingBreakdown,
  RiskAgingBuckets,
  RiskOwnerMetric,
  RiskQuarterlyBucket,
} from "@/types";
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
  ExclamationTriangleIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { FRAMEWORK_HEX } from "@/lib/design-tokens";

// ── Colour palettes ────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high:     "#f97316",
  medium:   "#f59e0b",
  low:      "#22c55e",
};

const MANAGED_STATUS_CONFIG = [
  { key: "new",                   label: "New",                   color: "#64748b" },
  { key: "managed_with_dates",    label: "Managed (with dates)",  color: "#10b981" },
  { key: "managed_without_dates", label: "Managed (no dates)",    color: "#34d399" },
  { key: "unmanaged",             label: "Unmanaged",             color: "#f97316" },
  { key: "closed",                label: "Closed",                color: "#cbd5e1" },
] as const;

const TREATMENT_COLORS: Record<string, string> = {
  mitigate: "#2563eb",
  accept:   "#f59e0b",
  transfer: "#8b5cf6",
  avoid:    "#10b981",
};

const STATUS_COLORS: Record<string, string> = {
  "Not Started": "#cbd5e1",
  "In Progress": "#2563eb",
  "Needs Review": "#f59e0b",
  Complete:       "#10b981",
};

const AGING_BUCKETS = [
  { key: "0_30",    label: "0–30 days",    color: "#22c55e" },
  { key: "30_60",   label: "30–60 days",   color: "#84cc16" },
  { key: "60_90",   label: "60–90 days",   color: "#f59e0b" },
  { key: "90_180",  label: "90–180 days",  color: "#f97316" },
  { key: "180_365", label: "180–365 days", color: "#ef4444" },
  { key: "365_plus",label: "365+ days",    color: "#7f1d1d" },
] as const;

const PCI_STATUS_CONFIG = [
  { key: "complete",     label: "Complete",     color: "#10b981" },
  { key: "needs_review", label: "Needs Review", color: "#f59e0b" },
  { key: "in_progress",  label: "In Progress",  color: "#2563eb" },
  { key: "not_started",  label: "Not Started",  color: "#cbd5e1" },
  { key: "failed",       label: "Failed",       color: "#ef4444" },
  { key: "never_tested", label: "Never Tested", color: "#94a3b8" },
] as const;

// ── Shared UI components ───────────────────────────────────────────────────────

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

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="h-px flex-1 bg-slate-200" />
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <div className="h-px flex-1 bg-slate-200" />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
  tone: "teal" | "blue" | "amber" | "rose" | "violet" | "slate";
}) {
  const toneClasses = {
    teal:   "from-teal-500/15 to-emerald-500/5 text-teal-700 ring-teal-200",
    blue:   "from-blue-500/15 to-cyan-500/5 text-blue-700 ring-blue-200",
    amber:  "from-amber-500/15 to-orange-500/5 text-amber-700 ring-amber-200",
    rose:   "from-rose-500/15 to-red-500/5 text-rose-700 ring-rose-200",
    violet: "from-violet-500/15 to-purple-500/5 text-violet-700 ring-violet-200",
    slate:  "from-slate-500/10 to-slate-400/5 text-slate-700 ring-slate-200",
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
    amber:   "border-amber-200 bg-amber-50/80 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    rose:    "border-rose-200 bg-rose-50/80 text-rose-900",
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

// ── Custom tooltip for bar charts ──────────────────────────────────────────────

function OwnerTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: RiskOwnerMetric }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="font-semibold text-slate-900">{d.name}</p>
      <p className="text-slate-500">{d.count} risks · avg score {d.avg_score}</p>
    </div>
  );
}

function QuarterlyTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; fill: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg text-xs">
      <p className="mb-1 font-semibold text-slate-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    dashboardApi
      .stats()
      .then((r) => setStats(r.data))
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
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 rounded-[24px] bg-slate-200/70" />
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
                .then((r) => setStats(r.data))
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

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Severity pie
  const severityData = [
    { name: "Critical", value: stats.risk_severity?.critical ?? 0, fill: SEVERITY_COLORS.critical },
    { name: "High",     value: stats.risk_severity?.high     ?? 0, fill: SEVERITY_COLORS.high },
    { name: "Medium",   value: stats.risk_severity?.medium   ?? 0, fill: SEVERITY_COLORS.medium },
    { name: "Low",      value: stats.risk_severity?.low      ?? 0, fill: SEVERITY_COLORS.low },
  ].filter((d) => d.value > 0);

  // Managed status bar data
  const managedStatusData = MANAGED_STATUS_CONFIG.map(({ key, label, color }) => ({
    name: label,
    value: stats.risk_managed_status?.[key] ?? 0,
    fill: color,
  }));

  // Treatment breakdown
  const treatmentData = Object.entries(stats.risk_treatment ?? {}).map(([key, count]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: count as number,
    fill: TREATMENT_COLORS[key] ?? "#64748b",
  }));

  // Owner bar chart (top 8)
  const ownerData: RiskOwnerMetric[] = (stats.risk_owners ?? []).slice(0, 8);
  const vpData:    RiskOwnerMetric[] = (stats.risk_vps    ?? []).slice(0, 8);

  // Dept bar
  const deptData = (stats.risk_departments ?? []).slice(0, 8).map((d) => ({
    name: d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name,
    value: d.count,
  }));

  // Quarterly trend
  const quarterlyData: RiskQuarterlyBucket[] = stats.risk_quarterly ?? [];

  // Aging
  const agingData = AGING_BUCKETS.map(({ key, label, color }) => ({
    name: label,
    value: stats.risk_aging[key as keyof RiskAgingBuckets],
    fill: color,
  }));
  const agingTotal = Object.values(stats.risk_aging).reduce((s, v) => s + v, 0);
  const staleRisks = (stats.risk_aging["180_365"] ?? 0) + (stats.risk_aging["365_plus"] ?? 0);

  // Remediation
  const remediationPlanData = [
    { name: "In Progress", value: stats.risk_remediation?.in_progress ?? 0, fill: "#2563eb" },
    { name: "Completed",   value: stats.risk_remediation?.completed   ?? 0, fill: "#10b981" },
    { name: "On Hold",     value: stats.risk_remediation?.on_hold     ?? 0, fill: "#f59e0b" },
    { name: "Cancelled",   value: stats.risk_remediation?.cancelled   ?? 0, fill: "#94a3b8" },
  ].filter((d) => d.value > 0);

  const milestonePct = stats.risk_remediation?.milestones_total
    ? Math.round((stats.risk_remediation.milestones_completed / stats.risk_remediation.milestones_total) * 100)
    : 0;

  // Controls / testing
  const statusData = [
    { name: "Not Started", value: stats.not_started },
    { name: "In Progress", value: stats.in_progress },
    { name: "Needs Review", value: stats.needs_review },
    { name: "Complete",     value: stats.complete },
  ];
  const frameworkData = Object.entries(stats.framework_coverage).map(([name, controls]) => ({ name, controls }));
  const completionRate = stats.total_assignments > 0
    ? Math.round((stats.complete / stats.total_assignments) * 100) : 0;

  const pciChartData = PCI_STATUS_CONFIG.map(({ key, label, color }) => ({
    name: label,
    value: stats.pci_testing[key as keyof PciTestingBreakdown] as number,
    fill: color,
  })).filter((e) => e.value > 0);

  const deficiencyData = [
    { name: "Open",           value: stats.deficiency_open,            fill: "#ef4444" },
    { name: "In Remediation", value: stats.deficiency_in_remediation,  fill: "#f97316" },
    { name: "Remediated",     value: stats.deficiency_remediated,      fill: "#10b981" },
    { name: "Risk Accepted",  value: stats.deficiency_risk_accepted,   fill: "#94a3b8" },
  ];

  const hasAnyQuarterlyData = quarterlyData.some((q) => q.high > 0 || q.critical > 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ════════════════════════════════════════════════════════════════════
            RISK SECTION
            ════════════════════════════════════════════════════════════════ */}
        <SectionDivider label="Risk Posture" />

        {/* Risk KPI Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Risks"
            value={stats.total_risks ?? 0}
            sub={`${stats.open_risks ?? 0} open · ${stats.risk_managed_status?.closed ?? 0} closed`}
            tone="slate"
            icon={<ChartBarIcon className="h-6 w-6" />}
          />
          <StatCard
            label="High / Critical"
            value={stats.high_critical_risks ?? 0}
            sub="open risks scoring ≥ 10"
            tone="rose"
            icon={<ExclamationTriangleIcon className="h-6 w-6" />}
          />
          <StatCard
            label="Avg Inherent Score"
            value={stats.avg_risk_score?.toFixed(1) ?? "—"}
            sub="likelihood × impact (open)"
            tone="amber"
            icon={<ChartBarIcon className="h-6 w-6" />}
          />
          <StatCard
            label="Treatment Plans"
            value={stats.risk_remediation?.total_plans ?? 0}
            sub={`${stats.risk_remediation?.in_progress ?? 0} in progress · ${stats.risk_remediation?.completed ?? 0} complete`}
            tone="teal"
            icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
          />
        </div>

        {/* Severity Pie + Managed Status */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Severity distribution */}
          <Surface eyebrow="Risk Profile" title="Severity Distribution (Open Risks)">
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={54}
                      outerRadius={88}
                      paddingAngle={3}
                    >
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3 self-center">
                {(["critical", "high", "medium", "low"] as const).map((k) => {
                  const count = stats.risk_severity?.[k] ?? 0;
                  const total = Object.values(stats.risk_severity ?? {}).reduce((s, v) => s + v, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: SEVERITY_COLORS[k] }} />
                      <span className="w-16 text-sm font-medium capitalize text-slate-700">{k}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2.5">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: SEVERITY_COLORS[k] }} />
                      </div>
                      <span className="w-8 text-right text-sm font-semibold text-slate-900">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Surface>

          {/* Managed status */}
          <Surface eyebrow="Register Health" title="Risk Managed Status">
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3">
              {MANAGED_STATUS_CONFIG.map(({ key, label, color }) => {
                const count = stats.risk_managed_status?.[key] ?? 0;
                return (
                  <div key={key} className="rounded-[18px] border border-slate-200 bg-white p-4" style={{ borderTopWidth: 3, borderTopColor: color }}>
                    <p className="text-xl font-semibold text-slate-950">{count}</p>
                    <p className="mt-1 text-xs text-slate-500">{label}</p>
                  </div>
                );
              })}
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={managedStatusData} barSize={36} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {managedStatusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        {/* Risk Owner + VP Metrics */}
        {(ownerData.length > 0 || vpData.length > 0) && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {ownerData.length > 0 && (
              <Surface eyebrow="Accountability" title="Risk by Owner">
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ownerData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                      barSize={18}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11, fill: "#475569" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                      />
                      <Tooltip content={<OwnerTooltip />} />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#2563eb" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Surface>
            )}

            {vpData.length > 0 && (
              <Surface eyebrow="Executive Accountability" title="Risk by VP">
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={vpData}
                      layout="vertical"
                      margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                      barSize={18}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11, fill: "#475569" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + "…" : v}
                      />
                      <Tooltip content={<OwnerTooltip />} />
                      <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="#7c3aed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Surface>
            )}
          </div>
        )}

        {/* Risk Age Distribution */}
        <Surface
          eyebrow="Register Health"
          title="Risk Age Distribution"
          right={
            staleRisks > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                {staleRisks} risks over 180 days
              </span>
            ) : null
          }
        >
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
              const width = agingTotal > 0 ? (value / agingTotal) * 100 : 0;
              return width > 0 ? (
                <div key={key} style={{ width: `${width}%`, backgroundColor: color }} title={`${label}: ${value}`} />
              ) : null;
            })}
          </div>
          <div className="h-[200px]">
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

        {/* Quarterly High/Critical Trend */}
        {hasAnyQuarterlyData && (
          <Surface
            eyebrow="Quarterly Reporting"
            title="High &amp; Critical Risks by Quarter"
            right={
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                last 8 quarters
              </span>
            }
          >
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterlyData} barSize={22} barGap={4} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<QuarterlyTooltip />} />
                  <Legend verticalAlign="top" height={32} iconType="circle" />
                  <Bar dataKey="high"     name="High"     fill={SEVERITY_COLORS.high}     radius={[6, 6, 0, 0]} />
                  <Bar dataKey="critical" name="Critical" fill={SEVERITY_COLORS.critical} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        )}

        {/* Treatment Strategy + Remediation Status */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Treatment breakdown */}
          <Surface eyebrow="Strategy" title="Risk Treatment Approach">
            <div className="mb-4 grid grid-cols-2 gap-3">
              {treatmentData.map(({ name, value, fill }) => (
                <div key={name} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: fill }} />
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{name}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={treatmentData} barSize={44} margin={{ top: 8, right: 0, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                    {treatmentData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>

          {/* Remediation / treatment plan status */}
          <Surface eyebrow="Remediation" title="Treatment Plan Execution">
            {/* Milestone progress bar */}
            {(stats.risk_remediation?.milestones_total ?? 0) > 0 && (
              <div className="mb-5 rounded-[22px] bg-slate-50 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">Milestone completion</span>
                  <span className="font-semibold text-slate-900">
                    {stats.risk_remediation?.milestones_completed ?? 0} / {stats.risk_remediation?.milestones_total ?? 0}
                    <span className="ml-1 text-slate-400 font-normal">({milestonePct}%)</span>
                  </span>
                </div>
                <div className="flex h-3 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                  <div style={{ width: `${milestonePct}%`, backgroundColor: "#10b981" }} className="h-full rounded-full transition-all" />
                </div>
                {(stats.risk_remediation?.milestones_overdue ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-red-600">
                    ⚠ {stats.risk_remediation?.milestones_overdue} milestone{stats.risk_remediation?.milestones_overdue !== 1 ? "s" : ""} overdue
                  </p>
                )}
              </div>
            )}

            {/* Plan status tiles */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              {[
                { label: "In Progress", value: stats.risk_remediation?.in_progress ?? 0, color: "#2563eb" },
                { label: "Completed",   value: stats.risk_remediation?.completed   ?? 0, color: "#10b981" },
                { label: "On Hold",     value: stats.risk_remediation?.on_hold     ?? 0, color: "#f59e0b" },
                { label: "Cancelled",   value: stats.risk_remediation?.cancelled   ?? 0, color: "#94a3b8" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-[20px] border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{label}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>

            {remediationPlanData.length > 0 && (
              <div className="h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={remediationPlanData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={60} paddingAngle={4}>
                      {remediationPlanData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="middle" layout="vertical" align="right" iconType="circle" iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Surface>
        </div>

        {/* Department breakdown (only if data available) */}
        {deptData.length > 1 && (
          <Surface eyebrow="Exposure" title="Open Risks by Department">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} barSize={36} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#475569" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Risks" radius={[10, 10, 0, 0]} fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            CONTROLS & TESTING SECTION
            ════════════════════════════════════════════════════════════════ */}
        <SectionDivider label="Controls &amp; Testing" />

        {/* Controls overview cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Total Controls"    value={stats.total_controls}    sub={`${stats.active_controls} currently active`}         tone="teal"  icon={<ShieldCheckIcon className="h-6 w-6" />} />
          <StatCard label="Test Cycles"       value={stats.total_test_cycles} sub={`${stats.active_test_cycles} active cycles in motion`} tone="blue"  icon={<RectangleStackIcon className="h-6 w-6" />} />
          <StatCard label="Total Assignments" value={stats.total_assignments} sub={`${stats.in_progress} actively in progress`}          tone="amber" icon={<ClipboardDocumentListIcon className="h-6 w-6" />} />
          <StatCard label="Evidence Files"    value={stats.total_evidence}    sub="Supporting documentation on file"                      tone="slate" icon={<DocumentDuplicateIcon className="h-6 w-6" />} />
        </div>

        {/* Exception priority tiles */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <PriorityTile href="/exceptions"              label="Immediate Attention" value={stats.exception_pending}       caption="exceptions waiting for approval"  tone="amber"   />
          <PriorityTile href="/exceptions?status=approved" label="Governance Coverage" value={stats.exception_approved}  caption="approved exceptions remain active" tone="emerald" />
          <PriorityTile href="/exceptions"              label="Time Sensitive"      value={stats.exception_expiring_soon} caption="exceptions expiring within 30 days" tone="rose"  />
        </div>

        {/* Testing Momentum + Framework Mapping */}
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
                    {statusData.map((s) =>
                      s.value > 0 ? (
                        <div
                          key={s.name}
                          style={{ width: `${(s.value / Math.max(stats.total_assignments, 1)) * 100}%`, backgroundColor: STATUS_COLORS[s.name] }}
                          title={`${s.name}: ${s.value}`}
                        />
                      ) : null
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {statusData.map((s) => (
                    <div key={s.name} className="rounded-[20px] border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[s.name] }} />
                        <p className="text-sm font-medium text-slate-700">{s.name}</p>
                      </div>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">{s.value}</p>
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

        {/* PCI DSS Snapshot */}
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

        {/* Deficiency Status */}
        {deficiencyData.some((e) => e.value > 0) ? (
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
    </AppShell>
  );
}
