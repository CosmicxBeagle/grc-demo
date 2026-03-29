"use client";
import { useState } from "react";
import type { ApprovalWorkflow } from "@/types";
import { approvalsApi } from "@/lib/api";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/solid";

interface Props {
  workflow: ApprovalWorkflow | null;
  currentUserId?: number;
  currentUserRole?: string;
  onDecision?: () => void; // refresh callback after approve/reject
}

const STATUS_ICON = {
  approved: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
  rejected:  <XCircleIcon    className="w-5 h-5 text-red-500"   />,
  pending:   <ClockIcon      className="w-5 h-5 text-gray-400"  />,
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  rejected:  "Rejected",
  pending:   "Pending",
};

export default function ApprovalTimeline({ workflow, currentUserId, currentUserRole, onDecision }: Props) {
  const [notes, setNotes]     = useState("");
  const [busy,  setBusy]      = useState(false);
  const [error, setError]     = useState("");

  if (!workflow) {
    return (
      <div className="text-sm text-gray-400 italic">
        No approval workflow attached to this record.
      </div>
    );
  }

  const steps = [...workflow.steps].sort((a, b) => a.step_order - b.step_order);

  const currentStep = steps.find(s => s.step_order === workflow.current_step);
  const canDecide =
    workflow.status === "pending" &&
    currentStep &&
    (
      currentStep.approver_user_id === currentUserId ||
      currentStep.approver_role === currentUserRole ||
      currentUserRole === "admin"
    );

  const decide = async (decision: "approved" | "rejected") => {
    setBusy(true);
    setError("");
    try {
      await approvalsApi.decide(workflow.id, decision, notes || undefined);
      setNotes("");
      onDecision?.();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Failed to submit decision");
    } finally {
      setBusy(false);
    }
  };

  const overallBadge = () => {
    if (workflow.status === "approved")
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Approved</span>;
    if (workflow.status === "rejected")
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Rejected</span>;
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Pending Approval</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ShieldExclamationIcon className="w-4 h-4 text-brand-600" />
          Approval Workflow
        </h3>
        {overallBadge()}
      </div>

      {/* Step timeline */}
      <ol className="relative border-l border-gray-200 ml-2 space-y-4">
        {steps.map((step, idx) => {
          const isActive  = workflow.status === "pending" && step.step_order === workflow.current_step;
          const isFuture  = workflow.status === "pending" && step.step_order > workflow.current_step;

          return (
            <li key={step.id} className="ml-4">
              {/* Dot */}
              <span className={`absolute -left-2 flex items-center justify-center w-4 h-4 rounded-full ring-2 ring-white ${
                step.status === "approved" ? "bg-green-500"
                : step.status === "rejected"  ? "bg-red-500"
                : isActive                    ? "bg-yellow-400"
                : "bg-gray-300"
              }`} />

              <div className={`rounded-lg border p-3 ${
                isActive  ? "border-yellow-300 bg-yellow-50"
                : isFuture ? "border-gray-100 bg-gray-50 opacity-60"
                : step.status === "approved" ? "border-green-200 bg-green-50"
                : "border-red-200 bg-red-50"
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {STATUS_ICON[step.status as keyof typeof STATUS_ICON]}
                    <span className="text-sm font-medium text-gray-800">
                      {step.label}
                      {step.is_escalation && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">
                          Escalation
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">Step {idx + 1}</span>
                </div>

                {/* Assignee */}
                <p className="text-xs text-gray-500">
                  Approver:{" "}
                  {step.approver
                    ? step.approver.display_name
                    : step.approver_role
                    ? <span className="capitalize">{step.approver_role} (any)</span>
                    : "Not assigned"}
                </p>

                {/* Decision details */}
                {step.decider && step.decided_at && (
                  <p className="text-xs text-gray-500 mt-1">
                    {STATUS_LABEL[step.status]} by {step.decider.display_name} on{" "}
                    {new Date(step.decided_at).toLocaleDateString()}
                    {step.notes && <> — <em className="italic">{step.notes}</em></>}
                  </p>
                )}

                {/* Active indicator */}
                {isActive && (
                  <p className="text-xs font-medium text-yellow-700 mt-1">Waiting for decision…</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Decision controls (only shown when user can decide) */}
      {canDecide && (
        <div className="border-t pt-4 space-y-3">
          <label className="block text-xs font-medium text-gray-600">
            Notes (optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add a comment about your decision…"
            className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => decide("approved")}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50"
            >
              <CheckCircleIcon className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={() => decide("rejected")}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50"
            >
              <XCircleIcon className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
