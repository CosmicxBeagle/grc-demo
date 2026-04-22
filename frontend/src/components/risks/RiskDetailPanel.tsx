"use client";
import { useEffect, useState, useCallback } from "react";
import { XMarkIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { risksApi } from "@/lib/api";
import type { Risk, Control, User } from "@/types";
import { RISK_STATUS_LABELS, RISK_STATUS_BADGE } from "./RiskStatusFilter";
import TreatmentPlanPanel from "@/components/TreatmentPlanPanel";

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreBg(score: number) {
  if (score >= 20) return "bg-red-100 text-red-800";
  if (score >= 15) return "bg-orange-100 text-orange-800";
  if (score >= 9) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}
function scoreLabel(score: number) {
  if (score >= 20) return "Critical";
  if (score >= 15) return "High";
  if (score >= 9) return "Medium";
  return "Low";
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
    </div>
  );
}

function SectionHeader({
  title,
  open,
  onToggle,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 text-left group"
    >
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest group-hover:text-gray-700 transition-colors">
        {title}
      </span>
      {open ? (
        <ChevronDownIcon className="w-4 h-4 text-gray-400" />
      ) : (
        <ChevronRightIcon className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  risk: Risk;
  controls: Control[];
  users: User[];
  canEdit: boolean;
  onClose: () => void;
  onEdit: (risk: Risk) => void;
  onDelete: (id: number) => void;
  onLinkedControlsChange: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RiskDetailPanel({
  risk: initialRisk,
  controls,
  users,
  canEdit,
  onClose,
  onEdit,
  onDelete,
  onLinkedControlsChange,
}: Props) {
  // Keep a local copy that refreshes when controls are linked/unlinked
  const [risk, setRisk] = useState(initialRisk);
  const [openSections, setOpenSections] = useState({
    details: true,
    treatment: true,
    controls: true,
    milestones: true,
  });

  const [selectedControlId, setSelectedControlId] = useState("");
  const [linkingControl, setLinkingControl] = useState(false);
  const [linkError, setLinkError] = useState("");

  // Refresh local risk when parent changes (e.g. after an API reload)
  useEffect(() => setRisk(initialRisk), [initialRisk]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while panel is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  };

  const handleLinkControl = async () => {
    if (!selectedControlId) return;
    setLinkingControl(true);
    setLinkError("");
    try {
      await risksApi.linkControl(risk.id, { control_id: Number(selectedControlId) });
      const res = await risksApi.get(risk.id);
      setRisk(res.data);
      setSelectedControlId("");
      onLinkedControlsChange();
    } catch {
      setLinkError("Failed to link control");
    } finally {
      setLinkingControl(false);
    }
  };

  const handleUnlinkControl = async (controlId: number) => {
    try {
      await risksApi.unlinkControl(risk.id, controlId);
      const res = await risksApi.get(risk.id);
      setRisk(res.data);
      onLinkedControlsChange();
    } catch {
      setLinkError("Failed to unlink control");
    }
  };

  const status = risk.status as keyof typeof RISK_STATUS_LABELS;

  const availableControls = controls.filter(
    (c) => !risk.controls.some((rc) => rc.control_id === c.id)
  );

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[480px] bg-white flex flex-col"
        style={{
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          animation: "slideInRight 200ms ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 leading-snug truncate">
              {risk.name}
            </h2>
            {risk.owner && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{risk.owner}</p>
            )}
            <div className="mt-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  RISK_STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {RISK_STATUS_LABELS[status] ?? risk.status}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 mt-0.5"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {/* ── Section 1: Details ── */}
          <div className="border-b border-gray-100">
            <SectionHeader
              title="Risk Details"
              open={openSections.details}
              onToggle={() => toggleSection("details")}
            />
            {openSections.details && (
              <dl className="mb-3">
                <DetailRow label="Likelihood">
                  {risk.likelihood} / 5
                </DetailRow>
                <DetailRow label="Impact">
                  {risk.impact} / 5
                </DetailRow>
                <DetailRow label="Inherent Score">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBg(risk.inherent_score)}`}>
                    {risk.inherent_score} — {scoreLabel(risk.inherent_score)}
                  </span>
                </DetailRow>
                <DetailRow label="Residual Score">
                  {risk.residual_score != null ? (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBg(risk.residual_score)}`}>
                      {risk.residual_score} — {scoreLabel(risk.residual_score)}
                    </span>
                  ) : (
                    <span className="text-gray-400 text-xs">Not set</span>
                  )}
                </DetailRow>
                <DetailRow label="Treatment">
                  <span className="capitalize">{risk.treatment ?? "—"}</span>
                </DetailRow>
                {risk.asset && (
                  <DetailRow label="Asset">{risk.asset.name}</DetailRow>
                )}
                {risk.threat && (
                  <DetailRow label="Threat">{risk.threat.name}</DetailRow>
                )}
                <DetailRow label="Owner">
                  {risk.owner ?? <span className="text-gray-400">—</span>}
                </DetailRow>
                {risk.managed_start_date && (
                  <DetailRow label="Managed Period">
                    {risk.managed_start_date} → {risk.managed_end_date}
                  </DetailRow>
                )}
                <DetailRow label="Date Created">
                  {new Date(risk.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </DetailRow>
                <DetailRow label="Age">
                  {risk.days_open} day{risk.days_open !== 1 ? "s" : ""}
                </DetailRow>
                {risk.description && (
                  <DetailRow label="Description">
                    <span className="text-gray-700 leading-relaxed whitespace-pre-wrap">{risk.description}</span>
                  </DetailRow>
                )}
              </dl>
            )}
          </div>

          {/* ── Section 2: Treatment Plan ── */}
          <div className="border-b border-gray-100">
            <SectionHeader
              title="Treatment Plan"
              open={openSections.treatment}
              onToggle={() => toggleSection("treatment")}
            />
            {openSections.treatment && (
              <div className="mb-4">
                <TreatmentPlanPanel riskId={risk.id} users={users} canEdit={canEdit} />
              </div>
            )}
          </div>

          {/* ── Section 3: Linked Controls ── */}
          <div className="border-b border-gray-100">
            <SectionHeader
              title="Linked Controls"
              open={openSections.controls}
              onToggle={() => toggleSection("controls")}
            />
            {openSections.controls && (
              <div className="mb-4 space-y-2">
                {risk.controls.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-1">No controls linked yet</p>
                ) : (
                  <ul className="space-y-1.5">
                    {risk.controls.map((rc) => (
                      <li
                        key={rc.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border border-gray-200"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-mono font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded shrink-0">
                            {rc.control?.control_id}
                          </span>
                          <span className="text-xs text-gray-700 truncate">{rc.control?.title}</span>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleUnlinkControl(rc.control_id)}
                            className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-2 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {canEdit && (
                  <div className="flex gap-2 mt-2">
                    <select
                      value={selectedControlId}
                      onChange={(e) => setSelectedControlId(e.target.value)}
                      className="flex-1 min-w-0 border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">+ Add a control...</option>
                      {availableControls.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.control_id} — {c.title}
                        </option>
                      ))}
                    </select>
                    {selectedControlId && (
                      <button
                        onClick={handleLinkControl}
                        disabled={linkingControl}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                      >
                        Link
                      </button>
                    )}
                  </div>
                )}
                {linkError && <p className="text-xs text-red-500">{linkError}</p>}
              </div>
            )}
          </div>

          {/* ── Section 4: Milestones (embedded in TreatmentPlanPanel above) ── */}
        </div>

        {/* Panel Footer */}
        <div className="shrink-0 border-t border-gray-200 px-6 py-4 flex items-center gap-3">
          {canEdit && (
            <button
              onClick={() => onEdit(risk)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Edit Risk
            </button>
          )}
          <a
            href={`/risk-reviews/history/${risk.id}`}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            View History
          </a>
          {canEdit && (
            <button
              onClick={() => onDelete(risk.id)}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
