"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { riskReviewsApi, risksApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { RiskReviewCycleDetail, RiskReviewRequest, RiskReviewUpdate, Risk } from "@/types";
import AppShell from "@/components/AppShell";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreTier(l: number, i: number): { label: string; color: string } {
  const s = l * i;
  if (s >= 20) return { label: "Critical", color: "text-red-700 bg-red-100" };
  if (s >= 15) return { label: "High",     color: "text-orange-700 bg-orange-100" };
  if (s >= 9)  return { label: "Medium",   color: "text-yellow-700 bg-yellow-100" };
  return              { label: "Low",      color: "text-green-700 bg-green-100" };
}

function fmtDate(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function statusIcon(s: string) {
  if (s === "updated") return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
  if (s === "overdue") return <XCircleIcon     className="w-5 h-5 text-red-500" />;
  return                      <ClockIcon       className="w-5 h-5 text-amber-500" />;
}

// ── Update modal ──────────────────────────────────────────────────────────────

function UpdateModal({
  request,
  risk,
  onClose,
  onSubmitted,
}: {
  request:     RiskReviewRequest;
  risk?:       Risk;
  onClose:     () => void;
  onSubmitted: () => void;
}) {
  const [form, setForm] = useState({
    status_confirmed:    risk?.status || "open",
    mitigation_progress: "",
    notes:               "",
  });
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  const submit = async () => {
    if (!form.notes.trim()) { setErr("Please add notes."); return; }
    setBusy(true);
    setErr("");
    try {
      await riskReviewsApi.submitUpdate(request.id, form);
      onSubmitted();
    } catch {
      setErr("Failed to submit update.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Submit Risk Update</h2>
        {risk && <p className="text-sm text-gray-500 mb-4">{risk.name}</p>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Current Status</label>
            <select
              value={form.status_confirmed}
              onChange={e => setForm(f => ({ ...f, status_confirmed: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="open">Open — risk still active</option>
              <option value="mitigated">Mitigated — controls are effective</option>
              <option value="accepted">Accepted — formally risk-accepted</option>
              <option value="transferred">Transferred — insurance / third party</option>
              <option value="closed">Closed — no longer applicable</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mitigation Progress</label>
            <textarea
              rows={3}
              value={form.mitigation_progress}
              onChange={e => setForm(f => ({ ...f, mitigation_progress: e.target.value }))}
              placeholder="Describe any mitigation activities completed this period…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any additional context, blockers, or changes since last review…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit Update"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Update review row ─────────────────────────────────────────────────────────

function UpdateReviewRow({
  upd,
  canEdit,
  canUpdate,
  currentUserId,
  onReload,
}: {
  upd:           RiskReviewUpdate;
  canEdit:       boolean;
  canUpdate:     boolean;
  currentUserId: number | undefined;
  onReload:      () => void;
}) {
  const [challenging,   setChallenging]   = useState(false);
  const [responding,    setResponding]    = useState(false);
  const [reason,        setReason]        = useState("");
  const [responseText,  setResponseText]  = useState("");
  const [busy,          setBusy]          = useState(false);

  const statusColors: Record<string, string> = {
    pending_review: "bg-amber-100 text-amber-700",
    accepted:       "bg-green-100 text-green-700",
    challenged:     "bg-red-100 text-red-700",
  };
  const statusLabel: Record<string, string> = {
    pending_review: "Pending GRC Review",
    accepted:       "Accepted",
    challenged:     "Challenged",
  };

  const accept = async () => {
    setBusy(true);
    try {
      await riskReviewsApi.acceptUpdate(upd.id);
      onReload();
    } finally { setBusy(false); }
  };

  const [challengeErr, setChallengeErr] = useState("");
  const [respondErr,   setRespondErr]   = useState("");

  const submitChallenge = async () => {
    if (reason.trim().length < 10) { setChallengeErr("Reason must be at least 10 characters."); return; }
    setBusy(true); setChallengeErr("");
    try {
      await riskReviewsApi.challengeUpdate(upd.id, reason);
      setChallenging(false); setReason(""); onReload();
    } catch { setChallengeErr("Failed to submit challenge."); }
    finally { setBusy(false); }
  };

  const submitResponse = async () => {
    if (responseText.trim().length < 10) { setRespondErr("Response must be at least 10 characters."); return; }
    setBusy(true); setRespondErr("");
    try {
      await riskReviewsApi.respondToChallenge(upd.id, responseText);
      setResponding(false); setResponseText(""); onReload();
    } catch { setRespondErr("Failed to submit response."); }
    finally { setBusy(false); }
  };

  const isOwner = currentUserId === upd.submitted_by;

  return (
    <div className="text-xs bg-white rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-700">
          {upd.submitter?.display_name ?? `User #${upd.submitted_by}`}
        </span>
        <div className="flex items-center gap-2">
          {upd.grc_review_status && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[upd.grc_review_status] ?? "bg-gray-100 text-gray-600"}`}>
              {statusLabel[upd.grc_review_status] ?? upd.grc_review_status}
            </span>
          )}
          <span className="text-gray-400">{fmtDate(upd.submitted_at)}</span>
        </div>
      </div>

      {upd.status_confirmed && (
        <p className="text-gray-600 mb-1"><strong>Status:</strong> {upd.status_confirmed.replace(/_/g, " ")}</p>
      )}
      {upd.mitigation_progress && (
        <p className="text-gray-600 mb-1"><strong>Mitigation:</strong> {upd.mitigation_progress}</p>
      )}
      {upd.notes && (
        <p className="text-gray-600"><strong>Notes:</strong> {upd.notes}</p>
      )}

      {/* Challenge / response thread */}
      {upd.grc_challenge_reason && (
        <div className="mt-2 space-y-2">
          <div className="p-2 bg-red-50 border border-red-200 rounded">
            <p className="text-red-700 font-medium mb-0.5">GRC Challenge</p>
            <p className="text-gray-700">{upd.grc_challenge_reason}</p>
          </div>
          {upd.owner_challenge_response && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-700 font-medium mb-0.5">Owner Response</p>
              <p className="text-gray-700">{upd.owner_challenge_response}</p>
            </div>
          )}
        </div>
      )}

      {/* Owner: respond to challenge */}
      {canUpdate && isOwner && upd.grc_review_status === "challenged" && !upd.owner_challenge_response && !responding && (
        <div className="mt-3">
          <button
            onClick={() => setResponding(true)}
            className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Respond to Challenge
          </button>
        </div>
      )}
      {responding && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={2}
            value={responseText}
            onChange={e => { setResponseText(e.target.value); setRespondErr(""); }}
            placeholder="Your response to the GRC challenge (min 10 characters)…"
            className="w-full text-xs rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
          />
          {respondErr && <p className="text-xs text-red-600">{respondErr}</p>}
          <div className="flex gap-2">
            <button onClick={submitResponse} disabled={busy || responseText.trim().length < 10}
              className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Submit Response
            </button>
            <button onClick={() => { setResponding(false); setResponseText(""); setRespondErr(""); }}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* GRC: Accept / Challenge — available on pending_review OR challenged+responded */}
      {canEdit && !challenging && (
        (upd.grc_review_status === "pending_review" ||
         (upd.grc_review_status === "challenged" && !!upd.owner_challenge_response))
      ) && (
        <div className="flex gap-2 mt-3">
          <button onClick={accept} disabled={busy}
            className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
            Accept
          </button>
          <button onClick={() => setChallenging(true)} disabled={busy}
            className="px-3 py-1 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50">
            Challenge Again
          </button>
        </div>
      )}

      {/* Challenge input */}
      {challenging && (
        <div className="mt-3 space-y-2">
          <textarea rows={2} value={reason}
            onChange={e => { setReason(e.target.value); setChallengeErr(""); }}
            placeholder="Explain the challenge (min 10 characters)…"
            className="w-full text-xs rounded border border-gray-300 px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
          />
          {challengeErr && <p className="text-xs text-red-600">{challengeErr}</p>}
          <div className="flex gap-2">
            <button onClick={submitChallenge} disabled={busy || reason.trim().length < 10}
              className="px-3 py-1 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
              Send Challenge
            </button>
            <button onClick={() => { setChallenging(false); setReason(""); setChallengeErr(""); }}
              className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Request row ───────────────────────────────────────────────────────────────

function RequestRow({
  request,
  riskMap,
  canUpdate,
  canEdit,
  onUpdate,
  onReload,
}: {
  request:   RiskReviewRequest;
  riskMap:   Map<number, Risk>;
  canUpdate: boolean;
  canEdit:   boolean;
  onUpdate:  (r: RiskReviewRequest) => void;
  onReload:  () => void;
}) {
  const [open, setOpen] = useState(false);
  const risk = riskMap.get(request.risk_id);
  const tier = risk ? scoreTier(risk.likelihood, risk.impact) : null;

  const hasChallenged = request.updates.some(u => u.grc_review_status === "challenged" && !u.owner_challenge_response);
  const hasResponded  = request.updates.some(u => u.grc_review_status === "challenged" && !!u.owner_challenge_response);
  const hasPending    = request.updates.some(u => u.grc_review_status === "pending_review");

  return (
    <div className={`border rounded-lg overflow-hidden ${hasChallenged ? "border-red-300" : "border-gray-200"}`}>
      <div
        className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${hasChallenged ? "bg-red-50 hover:bg-red-100" : "bg-white hover:bg-gray-50"}`}
        onClick={() => setOpen(o => !o)}
      >
        {open
          ? <ChevronDownIcon  className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRightIcon className="w-4 h-4 text-gray-400 shrink-0" />}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {risk?.name ?? `Risk #${request.risk_id}`}
          </p>
          <p className="text-xs text-gray-400">
            {request.reminder_count > 0 && `${request.reminder_count} reminder(s) sent`}
          </p>
        </div>

        {hasChallenged && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 border border-red-300">
            ⚠ Challenged
          </span>
        )}
        {hasResponded && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700 border border-orange-300">
            Response pending
          </span>
        )}
        {hasPending && !hasChallenged && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-300">
            Awaiting GRC
          </span>
        )}
        {tier && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.color}`}>
            {tier.label} ({(risk!.likelihood * risk!.impact)})
          </span>
        )}
        {risk && (
          <span className="text-xs text-gray-500 capitalize">{risk.status}</span>
        )}
        {statusIcon(request.status)}

        {canUpdate && request.status === "pending" && (
          <button
            onClick={e => { e.stopPropagation(); onUpdate(request); }}
            className="ml-2 px-3 py-1 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700"
          >
            Submit Update
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          {request.updates.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No updates submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {[...request.updates].reverse().map(upd => (
                <UpdateReviewRow
                  key={upd.id}
                  upd={upd}
                  canEdit={canEdit}
                  canUpdate={canUpdate}
                  currentUserId={getUser()?.id}
                  onReload={onReload}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Owner card ────────────────────────────────────────────────────────────────

function OwnerCard({
  ownerId,
  reqs,
  riskMap,
  cycleId,
  canEdit,
  canUpdate,
  onUpdate,
  onToast,
}: {
  ownerId:   number;
  reqs:      RiskReviewRequest[];
  riskMap:   Map<number, Risk>;
  cycleId:   number;
  canEdit:   boolean;
  canUpdate: boolean;
  onUpdate:  (r: RiskReviewRequest) => void;
  onToast:   (msg: string) => void;
}) {
  const owner   = reqs[0]?.owner;
  const pending = reqs.filter(r => r.status === "pending").length;
  const updated = reqs.filter(r => r.status === "updated").length;

  // Track the most-recent email_sent_at across all requests for this owner
  const lastSent = reqs
    .map(r => r.email_sent_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  const [sending, setSending] = useState(false);

  const handleSendEmail = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSending(true);
    try {
      const res = await riskReviewsApi.notifyOwner(cycleId, ownerId);
      onToast(
        res.data.email_sent
          ? `Email sent to ${owner?.display_name ?? "owner"} covering ${res.data.risks_count} risk(s).`
          : `Notification queued for ${owner?.display_name ?? "owner"} (${res.data.risks_count} risk(s)).`
      );
      // Reload to refresh email_sent_at timestamps
      window.dispatchEvent(new CustomEvent("cycle-reload"));
    } catch {
      onToast("Failed to send email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Owner header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold uppercase shrink-0">
            {owner?.display_name?.[0] ?? "?"}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {owner?.display_name ?? `User #${ownerId}`}
            </p>
            <p className="text-xs text-gray-400">{owner?.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Email status + send button */}
          <div className="flex flex-col items-end gap-0.5">
            {lastSent && (
              <span className="text-xs text-gray-400">
                Email sent {fmtDate(lastSent)}
              </span>
            )}
            {canEdit && (
              <button
                onClick={handleSendEmail}
                disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg hover:bg-brand-100 disabled:opacity-50 transition-colors"
              >
                <EnvelopeIcon className="w-3.5 h-3.5" />
                {sending ? "Sending…" : lastSent ? "Re-send Email" : "Send Email"}
              </button>
            )}
          </div>

          {/* Counts */}
          <div className="flex items-center gap-3 text-sm border-l border-gray-200 pl-4">
            <span className="text-amber-600 font-medium">{pending} pending</span>
            <span className="text-green-600 font-medium">{updated} updated</span>
          </div>
        </div>
      </div>

      {/* Risk rows */}
      <div className="p-3 space-y-2">
        {reqs.map(req => (
          <RequestRow
            key={req.id}
            request={req}
            riskMap={riskMap}
            canUpdate={canUpdate}
            canEdit={canEdit}
            onUpdate={onUpdate}
            onReload={() => window.dispatchEvent(new CustomEvent("cycle-reload"))}
          />
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CycleDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const cycleId = Number(id);
  const router  = useRouter();
  const user    = getUser();
  const canClose  = !!(user?.role && ["admin", "grc_manager"].includes(user.role));
  const canEdit   = !!(user?.role && ["admin", "grc_manager", "grc_analyst"].includes(user.role));
  const canUpdate = !!(user?.role && ["admin", "grc_manager", "grc_analyst", "risk_owner"].includes(user.role));

  const [cycle,    setCycle]    = useState<RiskReviewCycleDetail | null>(null);
  const [riskMap,  setRiskMap]  = useState<Map<number, Risk>>(new Map());
  const [loading,  setLoading]  = useState(true);
  const [toUpdate, setToUpdate] = useState<RiskReviewRequest | null>(null);
  const [toast,    setToast]    = useState("");
  const populated = useRef(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [cycleRes, risksRes] = await Promise.all([
        riskReviewsApi.getCycle(cycleId),
        risksApi.list(),
      ]);
      setCycle(cycleRes.data);
      const map = new Map<number, Risk>();
      risksRes.data.items.forEach(r => map.set(r.id, r));
      setRiskMap(map);
      return cycleRes.data;
    } finally {
      setLoading(false);
    }
  };

  // Auto-populate on first load if cycle is still a draft
  useEffect(() => {
    (async () => {
      const c = await load();
      if (c && c.status === "draft" && canEdit && !populated.current) {
        populated.current = true;
        try {
          await riskReviewsApi.populateCycle(cycleId);
          await load();
        } catch {
          // already active or error — ignore
        }
      }
    })();
  }, [cycleId]);

  // Allow child components to trigger a reload via custom event
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("cycle-reload", handler);
    return () => window.removeEventListener("cycle-reload", handler);
  }, [cycleId]);

  // Redirect roles that shouldn't be here
  useEffect(() => {
    if (user && !canEdit && !canUpdate) {
      router.replace("/risk-reviews");
    }
  }, [user]);

  const handleClose = async () => {
    if (!cycle || !confirm("Close this cycle? This cannot be undone.")) return;
    try {
      await riskReviewsApi.closeCycle(cycleId);
      await load();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Could not close cycle.");
    }
  };

  if (loading && !cycle) return (
    <AppShell>
      <div className="p-8 text-sm text-gray-400">Loading…</div>
    </AppShell>
  );
  if (!cycle) return (
    <AppShell>
      <div className="p-8 text-sm text-red-500">Cycle not found.</div>
    </AppShell>
  );

  // Group requests by owner — risk_owners only see their own card
  const byOwner = new Map<number, RiskReviewRequest[]>();
  for (const req of cycle.requests) {
    if (user?.role === "risk_owner" && req.owner_id !== user.id) continue;
    const list = byOwner.get(req.owner_id) ?? [];
    list.push(req);
    byOwner.set(req.owner_id, list);
  }

  const visibleReqs = user?.role === "risk_owner"
    ? cycle.requests.filter(r => r.owner_id === user.id)
    : cycle.requests;
  const allPending = visibleReqs.filter(r => r.status === "pending").length;
  const allUpdated = visibleReqs.filter(r => r.status === "updated").length;

  // Severity badges for header
  const severityColors: Record<string, string> = {
    low:      "bg-green-100 text-green-700 border-green-300",
    medium:   "bg-yellow-100 text-yellow-700 border-yellow-300",
    high:     "bg-orange-100 text-orange-700 border-orange-300",
    critical: "bg-red-100 text-red-700 border-red-300",
  };
  const selectedSeverities = cycle.severities
    ? cycle.severities.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  return (
    <AppShell>
    <div className="p-8 max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Back */}
      <button
        onClick={() => router.push("/risk-reviews")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        All Cycles
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cycle.label}</h1>
          <div className="flex items-center flex-wrap gap-2 mt-1.5">
            <span className="text-sm text-gray-500 capitalize">{cycle.cycle_type.replace("_", " ")}</span>
            {cycle.year && <span className="text-sm text-gray-500">· {cycle.year}</span>}
            <span className="text-sm text-gray-500">·</span>
            <span className="text-sm font-medium capitalize text-gray-700">{cycle.status}</span>
            {cycle.launched_at && (
              <span className="text-sm text-gray-400">· Active since {fmtDate(cycle.launched_at)}</span>
            )}
            {selectedSeverities.map(s => (
              <span key={s} className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${severityColors[s] ?? "bg-gray-100 text-gray-600"}`}>
                {s}
              </span>
            ))}
          </div>
          {cycle.scope_note && <p className="text-sm text-gray-400 mt-1">{cycle.scope_note}</p>}
          {loading && <p className="text-xs text-gray-400 mt-1">Refreshing…</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canClose && cycle.status === "active" && (
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Close Cycle
            </button>
          )}
          <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
            <ArrowPathIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {visibleReqs.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Risks",  value: visibleReqs.length, color: "text-gray-900" },
            { label: "Pending",      value: allPending,          color: "text-amber-600" },
            { label: "Updated",      value: allUpdated,          color: "text-green-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Owner cards */}
      {cycle.requests.length === 0 ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <ClockIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {loading ? "Loading risks…" : "No in-scope risks with assigned owners found for this cycle."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byOwner.entries()).map(([ownerId, reqs]) => (
            <OwnerCard
              key={ownerId}
              ownerId={ownerId}
              reqs={reqs}
              riskMap={riskMap}
              cycleId={cycleId}
              canEdit={canEdit}
              canUpdate={canUpdate}
              onUpdate={r => setToUpdate(r)}
              onToast={showToast}
            />
          ))}
        </div>
      )}

      {toUpdate && (
        <UpdateModal
          request={toUpdate}
          risk={riskMap.get(toUpdate.risk_id)}
          onClose={() => setToUpdate(null)}
          onSubmitted={async () => { setToUpdate(null); await load(); showToast("Update submitted."); }}
        />
      )}
    </div>
    </AppShell>
  );
}
