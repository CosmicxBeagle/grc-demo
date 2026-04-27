"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { riskReviewsApi } from "@/lib/api";
import type { RiskHistoryEntry } from "@/types";
import {
  PlusCircleIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftEllipsisIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

// ── Event config ──────────────────────────────────────────────────────────────

type EventType = RiskHistoryEntry["event_type"];

const EVENT_CONFIG: Record<EventType, {
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
}> = {
  created: {
    label: "Risk Created",
    icon: PlusCircleIcon,
    iconBg: "bg-blue-100", iconColor: "text-blue-600",
    badgeBg: "bg-blue-50 border-blue-200 text-blue-700",
  },
  field_changed: {
    label: "Fields Updated",
    icon: PencilSquareIcon,
    iconBg: "bg-slate-100", iconColor: "text-slate-600",
    badgeBg: "bg-slate-50 border-slate-200 text-slate-700",
  },
  review_submitted: {
    label: "Review Submitted",
    icon: ArrowPathIcon,
    iconBg: "bg-violet-100", iconColor: "text-violet-600",
    badgeBg: "bg-violet-50 border-violet-200 text-violet-700",
  },
  review_accepted: {
    label: "GRC Accepted",
    icon: CheckCircleIcon,
    iconBg: "bg-emerald-100", iconColor: "text-emerald-600",
    badgeBg: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  review_challenged: {
    label: "GRC Challenged",
    icon: ExclamationTriangleIcon,
    iconBg: "bg-amber-100", iconColor: "text-amber-600",
    badgeBg: "bg-amber-50 border-amber-200 text-amber-700",
  },
  challenge_responded: {
    label: "Owner Responded",
    icon: ChatBubbleLeftEllipsisIcon,
    iconBg: "bg-sky-100", iconColor: "text-sky-600",
    badgeBg: "bg-sky-50 border-sky-200 text-sky-700",
  },
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name", description: "Description",
  likelihood: "Likelihood", impact: "Impact",
  residual_likelihood: "Residual Likelihood", residual_impact: "Residual Impact",
  status: "Status", treatment: "Treatment", owner: "Owner",
  managed_start_date: "Managed Start Date", managed_end_date: "Managed End Date",
  asset_id: "Asset", threat_id: "Threat", parent_risk_id: "Parent Risk", owner_id: "Owner (user)",
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, string> = {
    new: "bg-slate-100 text-slate-700",
    closed: "bg-slate-200 text-slate-800",
    managed_with_dates: "bg-emerald-100 text-emerald-800",
    managed_without_dates: "bg-teal-100 text-teal-800",
    unmanaged: "bg-orange-100 text-orange-800",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Avatar({ name }: { name: string | null }) {
  const initials = (name ?? "?").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white flex-shrink-0">
      {initials}
    </span>
  );
}

function ChangedFieldsTable({ fields }: { fields: Record<string, { before: unknown; after: unknown }> }) {
  const rows = Object.entries(fields);
  if (!rows.length) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-50">
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">Field</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">Before</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-400">After</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([field, { before, after }]) => (
            <tr key={field}>
              <td className="px-3 py-2 font-medium text-slate-700">{FIELD_LABELS[field] ?? field}</td>
              <td className="px-3 py-2 text-slate-400 line-through">{String(before ?? "—")}</td>
              <td className="px-3 py-2 font-semibold text-slate-900">{String(after ?? "—")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function RiskHistoryPage() {
  const params  = useParams();
  const riskId  = Number(params?.riskId);
  const [entries, setEntries] = useState<RiskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!riskId) return;
    riskReviewsApi
      .riskUnifiedHistory(riskId)
      .then((r) => setEntries(r.data))
      .catch((e) => setError(e?.response?.data?.detail ?? "Failed to load history."))
      .finally(() => setLoading(false));
  }, [riskId]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-4 pt-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <a href="/risks" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
            ← Back to Risks
          </a>
          <h1 className="text-2xl font-bold text-slate-900">Risk #{riskId} — Change History</h1>
          <p className="mt-1 text-sm text-slate-500">
            {entries.length} event{entries.length !== 1 ? "s" : ""} recorded
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {entries.length === 0 && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <p className="text-sm text-slate-500">No history yet. Events appear here as the risk is created, edited, and reviewed.</p>
          </div>
        )}

        <div className="relative">
          {entries.length > 1 && (
            <div className="absolute left-[22px] top-10 bottom-10 w-px bg-slate-200" />
          )}
          <ol className="space-y-4">
            {entries.map((entry) => {
              const cfg = EVENT_CONFIG[entry.event_type] ?? EVENT_CONFIG.field_changed;
              const Icon = cfg.icon;
              const ts = entry.created_at
                ? new Date(entry.created_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "numeric", minute: "2-digit",
                  })
                : null;

              return (
                <li key={String(entry.id)} className="relative flex gap-4">
                  <div className={`relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${cfg.iconBg} ring-4 ring-white`}>
                    <Icon className={`h-5 w-5 ${cfg.iconColor}`} />
                  </div>

                  <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Avatar name={entry.actor_name} />
                        <span className="text-sm font-semibold text-slate-900">{entry.actor_name ?? "System"}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.badgeBg}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {ts && <span className="text-xs text-slate-400">{ts}</span>}
                    </div>

                    <p className="mt-3 text-sm text-slate-700">{entry.summary}</p>

                    {/* Status transition */}
                    {(entry.old_status || entry.new_status) && entry.old_status !== entry.new_status && (
                      <div className="mt-3 flex items-center gap-2">
                        {entry.old_status && <StatusBadge status={entry.old_status} />}
                        {entry.old_status && entry.new_status && <span className="text-xs text-slate-400">→</span>}
                        {entry.new_status && <StatusBadge status={entry.new_status} />}
                      </div>
                    )}

                    {/* Changed fields */}
                    {entry.changed_fields && Object.keys(entry.changed_fields).length > 0 && (
                      <ChangedFieldsTable fields={entry.changed_fields} />
                    )}

                    {/* Mitigation progress */}
                    {entry.mitigation_progress && (
                      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Mitigation Progress</p>
                        <p className="text-sm text-slate-700">{entry.mitigation_progress}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {entry.notes && (
                      <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Notes</p>
                        <p className="text-sm text-slate-700">{entry.notes}</p>
                      </div>
                    )}

                    {/* GRC challenge */}
                    {entry.grc_challenge_reason && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-amber-600">GRC Challenge</p>
                        <p className="text-sm text-amber-900">{entry.grc_challenge_reason}</p>
                      </div>
                    )}

                    {/* Owner response */}
                    {entry.owner_challenge_response && (
                      <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-sky-600">Owner Response</p>
                        <p className="text-sm text-sky-900">{entry.owner_challenge_response}</p>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </AppShell>
  );
}
