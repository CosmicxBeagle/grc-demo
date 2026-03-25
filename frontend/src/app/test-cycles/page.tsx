"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import { cyclesApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { TestCycleSummary } from "@/types";
import { PlusIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";

function ProgressBar({ complete, total }: { complete: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((complete / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div className="h-2 bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8">{pct}%</span>
    </div>
  );
}

export default function TestCyclesPage() {
  const [cycles, setCycles] = useState<TestCycleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const user = getUser();

  useEffect(() => {
    cyclesApi.list().then((r) => { setCycles(r.data); setLoading(false); });
  }, []);

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Test Cycles</h1>
            <p className="text-gray-500 mt-1">{cycles.length} cycles</p>
          </div>
          {user?.role === "admin" && (
            <Link
              href="/test-cycles/new"
              className="inline-flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              New Cycle
            </Link>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-4">
            {cycles.map((c) => (
              <Link
                key={c.id}
                href={`/test-cycles/${c.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge status={c.status} />
                      {c.brand && (
                        <span className="text-xs font-semibold bg-brand-100 text-brand-700 rounded-full px-2 py-0.5">
                          {c.brand}
                        </span>
                      )}
                      <h2 className="font-semibold text-gray-900 truncate">{c.name}</h2>
                    </div>
                    {(c.start_date || c.end_date) && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                        {c.start_date} → {c.end_date}
                      </div>
                    )}
                    <ProgressBar complete={c.complete_count} total={c.total_assignments} />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-gray-900">{c.complete_count}</p>
                    <p className="text-xs text-gray-400">of {c.total_assignments} complete</p>
                  </div>
                </div>
              </Link>
            ))}
            {cycles.length === 0 && (
              <div className="text-center py-20 text-gray-400">No test cycles yet.</div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
