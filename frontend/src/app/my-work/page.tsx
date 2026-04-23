"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { myWorkApi, approvalsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { WorkItem, ApprovalWorkflow } from "@/types";
import KpiCard from "@/components/ui/KpiCard";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ApprovalTimeline from "@/components/ApprovalTimeline";
import {
  CheckCircleIcon,
  ShieldExclamationIcon,
  ArchiveBoxXMarkIcon,
  DocumentCheckIcon,
} from "@heroicons/react/24/outline";

// ── Queue tab constants ───────────────────────────────────────────────────────

const URGENCY_LABEL: Record<string, string> = {
  critical: "Critical",
  high:     "High Priority",
  medium:   "Medium Priority",
  low:      "Low / Upcoming",
};

const URGENCY_COLORS: Record<string, { section: string; badge: string; header: string; accent: string }> = {
  critical: { section: "border-red-200",    badge: "bg-red-100 text-red-700",       header: "text-red-800",    accent: "border-l-red-600"    },
  high:     { section: "border-orange-200", badge: "bg-orange-100 text-orange-700", header: "text-orange-800", accent: "border-l-orange-500"  },
  medium:   { section: "border-amber-200",  badge: "bg-amber-100 text-amber-700",   header: "text-amber-800",  accent: "border-l-amber-500"   },
  low:      { section: "border-gray-200",   badge: "bg-gray-100 text-gray-600",     header: "text-gray-700",   accent: "border-l-gray-300"    },
};

const ITEM_TYPE_LABEL: Record<string, string> = {
  assignment_to_test:          "Test",
  assignment_to_review:        "Review",
  deficiency_milestone_due:    "Milestone",
  risk_review_pending:         "Risk Review",
  exception_pending_approval:  "Exception",
  extension_request_pending:   "Extension",
};

function overdueLabel(days: number | undefined) {
  if (days === undefined || days === null) return null;
  if (days > 0)  return <span className="text-red-600 text-xs font-medium">{days}d overdue</span>;
  if (days === 0) return <span className="text-amber-600 text-xs font-medium">Due today</span>;
  return <span className="text-gray-400 text-xs">Due in {Math.abs(days)}d</span>;
}

// ── Approvals tab constants ───────────────────────────────────────────────────

const ENTITY_ICON: Record<string, React.ReactNode> = {
  exception:    <ArchiveBoxXMarkIcon className="w-5 h-5 text-orange-500" />,
  control_test: <DocumentCheckIcon  className="w-5 h-5 text-blue-500"   />,
};

const ENTITY_LABEL: Record<string, string> = {
  exception:    "Control Exception",
  control_test: "Control Test",
};

const ENTITY_LINK = (wf: ApprovalWorkflow) => {
  if (wf.entity_type === "exception")    return "/exceptions";
  if (wf.entity_type === "control_test") return "/test-cycles";
  return "#";
};

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "queue" | "approvals";

export default function MyWorkPage() {
  const [me] = useState(() => getUser());

  // ── Queue state ─────────────────────────────────────────────────────────────
  const [items,      setItems]      = useState<WorkItem[]>([]);
  const [queueLoad,  setQueueLoad]  = useState(true);

  // ── Approvals state ─────────────────────────────────────────────────────────
  const [workflows,  setWorkflows]  = useState<ApprovalWorkflow[]>([]);
  const [appLoad,    setAppLoad]    = useState(true);
  const [expanded,   setExpanded]   = useState<number | null>(null);

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [tab,        setTab]        = useState<Tab>("queue");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loading = tab === "queue" ? queueLoad : appLoad;

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const loadQueue = useCallback(async () => {
    if (!me) return;
    setQueueLoad(true);
    try {
      const res = await myWorkApi.queue();
      setItems(res.data);
    } catch { /* ignore */ }
    setQueueLoad(false);
  }, [me]);

  const loadApprovals = useCallback(async () => {
    setAppLoad(true);
    try {
      const res = await approvalsApi.myQueue();
      setWorkflows(res.data);
    } catch { /* ignore */ }
    setAppLoad(false);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([loadQueue(), loadApprovals()]);
    setLastRefresh(new Date());
  }, [loadQueue, loadApprovals]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadAll]);

  if (!me) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20 text-gray-400">Not signed in.</div>
      </AppShell>
    );
  }

  // ── Queue derived state ──────────────────────────────────────────────────────
  const urgencyOrder = ["critical", "high", "medium", "low"] as const;
  const grouped = urgencyOrder.reduce((acc, u) => {
    acc[u] = items.filter(i => i.urgency === u);
    return acc;
  }, {} as Record<string, WorkItem[]>);
  const totalItems = items.length;

  // ── Approvals derived state ──────────────────────────────────────────────────
  const pendingCount  = workflows.filter(w => w.status === "pending").length;
  const approvedCount = workflows.filter(w => w.status === "approved").length;
  const rejectedCount = workflows.filter(w => w.status === "rejected").length;

  // ── Tab label helpers ────────────────────────────────────────────────────────
  const queueBadge    = totalItems > 0 ? ` (${totalItems})` : "";
  const approvalBadge = pendingCount  > 0 ? ` (${pendingCount})` : "";

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto p-6 space-y-5">

        {/* Header */}
        <PageHeader
          title="My Work"
          subtitle={`${me.display_name}${lastRefresh ? ` · Updated ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}`}
          actions={
            <button
              onClick={loadAll}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          }
        />

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-200 -mt-2">
          <button
            onClick={() => setTab("queue")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "queue"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Queue{queueBadge}
          </button>
          <button
            onClick={() => setTab("approvals")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-1.5 ${
              tab === "approvals"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Approvals{approvalBadge}
            {pendingCount > 0 && tab !== "approvals" && (
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            )}
          </button>
        </div>

        {/* ── QUEUE TAB ── */}
        {tab === "queue" && (
          <>
            {/* KPI summary */}
            {!queueLoad && totalItems > 0 && (
              <div className="grid grid-cols-4 gap-3">
                <KpiCard label="Critical"       value={grouped.critical.length} colorScheme="critical" />
                <KpiCard label="High Priority"  value={grouped.high.length}     colorScheme="high"     />
                <KpiCard label="Medium"         value={grouped.medium.length}   colorScheme="medium"   />
                <KpiCard label="Low / Upcoming" value={grouped.low.length}      colorScheme="neutral"  />
              </div>
            )}

            {queueLoad && (
              <div className="flex items-center justify-center py-16 text-gray-400">Loading your work queue…</div>
            )}

            {!queueLoad && totalItems === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="w-9 h-9 text-green-400" />
                </div>
                <p className="text-lg font-semibold text-gray-800">All caught up!</p>
                <p className="text-sm text-gray-400 mt-1">No outstanding tasks require your attention.</p>
              </div>
            )}

            {!queueLoad && urgencyOrder.map(u => {
              const group = grouped[u];
              if (group.length === 0) return null;
              const colors = URGENCY_COLORS[u];
              return (
                <section key={u} className={`border border-l-4 rounded-xl overflow-hidden ${colors.section} ${colors.accent}`}>
                  <div className="px-5 py-3 border-b border-inherit bg-white/60 flex items-center justify-between">
                    <h2 className={`text-sm font-semibold ${colors.header}`}>{URGENCY_LABEL[u]}</h2>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
                      {group.length}
                    </span>
                  </div>
                  <ul className="bg-white divide-y divide-gray-100">
                    {group.map((item, idx) => (
                      <li key={`${item.entity_type}-${item.entity_id}-${idx}`} className="px-5 py-3 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors.badge}`}>
                              {ITEM_TYPE_LABEL[item.item_type] ?? item.item_type}
                            </span>
                            <span className="text-sm font-medium text-gray-900 truncate">{item.title}</span>
                          </div>
                          {item.due_date && (
                            <div className="mt-0.5">
                              {overdueLabel(item.days_overdue)}
                              {item.days_overdue === undefined && (
                                <span className="text-xs text-gray-400">Due {item.due_date}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <Link
                          href={item.url}
                          className="shrink-0 text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
                        >
                          Open →
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}

        {/* ── APPROVALS TAB ── */}
        {tab === "approvals" && (
          <>
            {/* KPI summary */}
            {!appLoad && (
              <div className="grid grid-cols-3 gap-3">
                <KpiCard label="Pending"  value={pendingCount}  colorScheme="medium"   />
                <KpiCard label="Approved" value={approvedCount} colorScheme="low"      />
                <KpiCard label="Rejected" value={rejectedCount} colorScheme="critical" />
              </div>
            )}

            {appLoad && (
              <div className="flex items-center justify-center py-16 text-gray-400">Loading approvals…</div>
            )}

            {!appLoad && workflows.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircleIcon className="w-9 h-9 text-green-400" />
                </div>
                <p className="text-lg font-semibold text-gray-800">All caught up!</p>
                <p className="text-sm text-gray-400 mt-1">Nothing waiting for your approval right now.</p>
              </div>
            )}

            {!appLoad && (
              <div className="space-y-3">
                {workflows.map(wf => {
                  const currentStep = wf.steps.find(s => s.step_order === wf.current_step);
                  const isOpen = expanded === wf.id;

                  return (
                    <div key={wf.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpanded(prev => prev === wf.id ? null : wf.id)}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(prev => prev === wf.id ? null : wf.id); }}
                        className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
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
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View record →
                            </Link>
                            <span className="text-gray-400 text-sm">{isOpen ? "▲" : "▼"}</span>
                          </div>
                        </div>

                        {/* Step progress bar */}
                        <div className="mt-3 flex items-center gap-1.5">
                          {[...wf.steps].sort((a, b) => a.step_order - b.step_order).map(step => (
                            <div
                              key={step.id}
                              title={`${step.label}: ${step.status}`}
                              className={`h-1.5 flex-1 rounded-full ${
                                step.status === "approved"   ? "bg-green-500"
                                : step.status === "rejected" ? "bg-red-500"
                                : step.step_order === wf.current_step ? "bg-amber-400"
                                : "bg-gray-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-gray-100 px-5 py-4">
                          <ApprovalTimeline
                            workflow={wf}
                            currentUserId={me?.id}
                            currentUserRole={me?.role}
                            onDecision={loadApprovals}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </AppShell>
  );
}
