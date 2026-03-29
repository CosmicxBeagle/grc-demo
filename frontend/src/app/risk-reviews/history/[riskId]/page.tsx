"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { riskReviewsApi, risksApi } from "@/lib/api";
import type { RiskReviewUpdate, Risk } from "@/types";
import { ArrowLeftIcon, ClockIcon } from "@heroicons/react/24/outline";
import AppShell from "@/components/AppShell";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function statusColor(s?: string) {
  if (!s) return "bg-gray-100 text-gray-600";
  const map: Record<string, string> = {
    open:        "bg-red-100 text-red-700",
    mitigated:   "bg-green-100 text-green-700",
    accepted:    "bg-blue-100 text-blue-700",
    transferred: "bg-purple-100 text-purple-700",
    closed:      "bg-gray-100 text-gray-600",
  };
  return map[s] ?? "bg-gray-100 text-gray-600";
}

export default function RiskHistoryPage({ params }: { params: { riskId: string } }) {
  const { riskId } = params;
  const router = useRouter();

  const [risk,    setRisk]    = useState<Risk | null>(null);
  const [updates, setUpdates] = useState<RiskReviewUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(riskId);
    Promise.all([
      risksApi.get(id),
      riskReviewsApi.riskHistory(id),
    ]).then(([rRes, uRes]) => {
      setRisk(rRes.data);
      setUpdates(uRes.data);
    }).finally(() => setLoading(false));
  }, [riskId]);

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <AppShell>
    <div className="p-8 max-w-3xl mx-auto">
      <button
        onClick={() => router.push("/risks")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Risks
      </button>

      {risk && (
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{risk.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review history · {updates.length} update{updates.length !== 1 ? "s" : ""}
          </p>
          {risk.description && (
            <p className="text-sm text-gray-600 mt-2">{risk.description}</p>
          )}
        </div>
      )}

      {updates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ClockIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No review updates yet for this risk.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-200" />

          <div className="space-y-4">
            {updates.map((upd, idx) => (
              <div key={upd.id} className="relative pl-10">
                {/* Dot */}
                <div className="absolute left-0 top-3 w-7 h-7 rounded-full bg-white border-2 border-brand-400 flex items-center justify-center text-xs font-bold text-brand-600">
                  {updates.length - idx}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold uppercase">
                        {upd.submitter?.display_name?.[0] ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {upd.submitter?.display_name ?? `User #${upd.submitted_by}`}
                        </p>
                        <p className="text-xs text-gray-400">{fmtDateTime(upd.submitted_at)}</p>
                      </div>
                    </div>
                    {upd.status_confirmed && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColor(upd.status_confirmed)}`}>
                        {upd.status_confirmed}
                      </span>
                    )}
                  </div>

                  {upd.mitigation_progress && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Mitigation Progress
                      </p>
                      <p className="text-sm text-gray-700">{upd.mitigation_progress}</p>
                    </div>
                  )}

                  {upd.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                        Notes
                      </p>
                      <p className="text-sm text-gray-700">{upd.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </AppShell>
  );
}
