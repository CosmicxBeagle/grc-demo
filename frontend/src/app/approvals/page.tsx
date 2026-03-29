"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { approvalsApi } from "@/lib/api";
import { getSession } from "@/lib/auth";
import type { ApprovalWorkflow } from "@/types";
import ApprovalTimeline from "@/components/ApprovalTimeline";
import {
  ShieldExclamationIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentCheckIcon,
  ArchiveBoxXMarkIcon,
} from "@heroicons/react/24/outline";

const ENTITY_ICON: Record<string, React.ReactNode> = {
  exception:    <ArchiveBoxXMarkIcon  className="w-5 h-5 text-orange-500" />,
  control_test: <DocumentCheckIcon   className="w-5 h-5 text-blue-500"   />,
};

const ENTITY_LABEL: Record<string, string> = {
  exception:    "Control Exception",
  control_test: "Control Test",
};

const ENTITY_LINK = (wf: ApprovalWorkflow) => {
  if (wf.entity_type === "exception")    return `/exceptions`;
  if (wf.entity_type === "control_test") return `/test-cycles`;
  return "#";
};

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 flex items-center gap-1"><CheckCircleIcon className="w-3 h-3" />Approved</span>;
  if (status === "rejected")
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 flex items-center gap-1"><XCircleIcon className="w-3 h-3" />Rejected</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1"><ClockIcon className="w-3 h-3" />Pending</span>;
}

export default function ApprovalsPage() {
  const [queue,    setQueue]    = useState<ApprovalWorkflow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const session = getSession();

  const load = () => {
    setLoading(true);
    approvalsApi.myQueue()
      .then(r => setQueue(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const toggle = (id: number) => setExpanded(prev => prev === id ? null : id);

  return (
    <AppShell>
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldExclamationIcon className="w-6 h-6 text-brand-600" />
            My Approval Queue
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Items waiting for your review and decision
          </p>
        </div>
        <button onClick={load} className="text-sm text-brand-600 hover:text-brand-800 font-medium">
          Refresh
        </button>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending",  value: queue.filter(w => w.status === "pending").length,  color: "yellow" },
            { label: "Approved", value: queue.filter(w => w.status === "approved").length, color: "green"  },
            { label: "Rejected", value: queue.filter(w => w.status === "rejected").length, color: "red"    },
          ].map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold text-${s.color}-600`}>{s.value}</div>
              <div className="text-xs text-gray-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Queue */}
      {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}

      {!loading && queue.length === 0 && (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-xl">
          <CheckCircleIcon className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">All clear — nothing waiting for your approval.</p>
        </div>
      )}

      <div className="space-y-3">
        {queue.map(wf => {
          const currentStep = wf.steps.find(s => s.step_order === wf.current_step);
          const isOpen = expanded === wf.id;

          return (
            <div key={wf.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Row header */}
              <button
                onClick={() => toggle(wf.id)}
                className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {ENTITY_ICON[wf.entity_type] ?? <ShieldExclamationIcon className="w-5 h-5 text-gray-400" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {ENTITY_LABEL[wf.entity_type] ?? wf.entity_type} #{wf.entity_id}
                        </span>
                        <StatusBadge status={wf.status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {currentStep
                          ? <>Waiting on: <strong>{currentStep.label}</strong>
                              {currentStep.approver && <> — {currentStep.approver.display_name}</>}
                            </>
                          : "Workflow complete"
                        }
                        {" · "}Submitted {new Date(wf.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={ENTITY_LINK(wf)}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      View record →
                    </Link>
                    <span className="text-gray-400 text-sm">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {/* Step mini-progress */}
                <div className="mt-3 flex items-center gap-1.5">
                  {[...wf.steps].sort((a, b) => a.step_order - b.step_order).map(step => (
                    <div
                      key={step.id}
                      title={`${step.label}: ${step.status}`}
                      className={`h-1.5 flex-1 rounded-full ${
                        step.status === "approved" ? "bg-green-500"
                        : step.status === "rejected"  ? "bg-red-500"
                        : step.step_order === wf.current_step ? "bg-yellow-400"
                        : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
              </button>

              {/* Expanded timeline + decision */}
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <ApprovalTimeline
                    workflow={wf}
                    currentUserId={session?.user?.id}
                    currentUserRole={session?.user?.role}
                    onDecision={load}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
    </AppShell>
  );
}
