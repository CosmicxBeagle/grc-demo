"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { riskReviewsApi, risksApi, usersApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { RiskReviewCycleDetail, RiskReviewRequest, Risk } from "@/types";
import AppShell from "@/components/AppShell";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  EnvelopeIcon,
  BellAlertIcon,
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
  if (s >= 12) return { label: "High",     color: "text-orange-700 bg-orange-100" };
  if (s >= 4)  return { label: "Medium",   color: "text-yellow-700 bg-yellow-100" };
  return              { label: "Low",      color: "text-green-700 bg-green-100" };
}

function fmtDate(d?: string) {
  if (!d) return "—";
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
  const [form, setForm] = useState<{
    status_confirmed:    string;
    mitigation_progress: string;
    notes:               string;
  }>({
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
              placeholder="Describe any mitigation activities completed this quarter…"
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

// ── Request row ───────────────────────────────────────────────────────────────

function RequestRow({
  request,
  riskMap,
  canUpdate,
  onUpdate,
}: {
  request:   RiskReviewRequest;
  riskMap:   Map<number, Risk>;
  canUpdate: boolean;
  onUpdate:  (r: RiskReviewRequest) => void;
}) {
  const [open, setOpen] = useState(false);
  const risk = riskMap.get(request.risk_id);
  const tier = risk ? scoreTier(risk.likelihood, risk.impact) : null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 bg-white cursor-pointer hover:bg-gray-50 transition-colors"
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
            Owner: {request.owner?.display_name ?? `User #${request.owner_id}`}
            {request.email_sent_at && ` · Email sent ${fmtDate(request.email_sent_at)}`}
            {request.reminder_count > 0 && ` · ${request.reminder_count} reminder(s)`}
          </p>
        </div>

        {tier && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.color}`}>
            {tier.label} ({(risk!.likelihood * risk!.impact)})
          </span>
        )}
        {risk && (
          <span className="text-xs text-gray-500 capitalize">
            {risk.status}
          </span>
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
                <div key={upd.id} className="text-xs bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">
                      {upd.submitter?.display_name ?? `User #${upd.submitted_by}`}
                    </span>
                    <span className="text-gray-400">{fmtDate(upd.submitted_at)}</span>
                  </div>
                  {upd.status_confirmed && (
                    <p className="text-gray-600 mb-1">
                      <strong>Status:</strong> {upd.status_confirmed}
                    </p>
                  )}
                  {upd.mitigation_progress && (
                    <p className="text-gray-600 mb-1">
                      <strong>Mitigation:</strong> {upd.mitigation_progress}
                    </p>
                  )}
                  {upd.notes && (
                    <p className="text-gray-600"><strong>Notes:</strong> {upd.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CycleDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const cycleId = Number(id);
  const router  = useRouter();
  const user    = getUser();
  const canEdit = user?.role && ["admin", "grc_manager", "grc_analyst"].includes(user.role);

  const [cycle,     setCycle]     = useState<RiskReviewCycleDetail | null>(null);
  const [riskMap,   setRiskMap]   = useState<Map<number, Risk>>(new Map());
  const [loading,   setLoading]   = useState(true);
  const [busy,      setBusy]      = useState(false);
  const [toUpdate,  setToUpdate]  = useState<RiskReviewRequest | null>(null);
  const [toast,     setToast]     = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
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
      risksRes.data.forEach(r => map.set(r.id, r));
      setRiskMap(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [cycleId]);

  const handleLaunch = async () => {
    if (!cycle) return;
    setBusy(true);
    try {
      const res = await riskReviewsApi.launchCycle(cycleId);
      showToast(`Launched! ${res.data.emails_sent} email(s) sent, ${res.data.requests_created} requests created.`);
      await load();
    } catch (e: any) {
      showToast(e?.response?.data?.detail ?? "Launch failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemind = async () => {
    if (!cycle) return;
    setBusy(true);
    try {
      const res = await riskReviewsApi.sendReminders(cycleId);
      showToast(`Reminders sent to ${res.data.reminders_sent} owner(s).`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!cycle || !confirm("Close this cycle? This cannot be undone.")) return;
    setBusy(true);
    try {
      await riskReviewsApi.closeCycle(cycleId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;
  if (!cycle)  return <div className="p-8 text-sm text-red-500">Cycle not found.</div>;

  // Group requests by owner
  const byOwner = new Map<number, RiskReviewRequest[]>();
  for (const req of cycle.requests) {
    const list = byOwner.get(req.owner_id) ?? [];
    list.push(req);
    byOwner.set(req.owner_id, list);
  }

  const allPending = cycle.requests.filter(r => r.status === "pending").length;
  const allUpdated = cycle.requests.filter(r => r.status === "updated").length;

  // Can current user submit updates (risk owner or GRC staff)
  const canUpdate = !!(
    user?.role && ["admin", "grc_manager", "grc_analyst", "risk_owner"].includes(user.role)
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Back + header */}
      <button
        onClick={() => router.push("/risk-reviews")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        All Cycles
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{cycle.label}</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span className="capitalize">{cycle.cycle_type.replace("_", " ")}</span>
            {cycle.year && <span>· {cycle.year}</span>}
            <span>·</span>
            <span className="font-medium capitalize">{cycle.status}</span>
            {cycle.launched_at && <span>· Launched {fmtDate(cycle.launched_at)}</span>}
          </div>
          {cycle.scope_note && <p className="text-sm text-gray-400 mt-1">{cycle.scope_note}</p>}
        </div>

        {canEdit && (
          <div className="flex gap-2">
            {cycle.status === "draft" && (
              <button
                onClick={handleLaunch}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                <EnvelopeIcon className="w-4 h-4" />
                {busy ? "Launching…" : "Launch & Send Emails"}
              </button>
            )}
            {cycle.status === "active" && (
              <>
                <button
                  onClick={handleRemind}
                  disabled={busy}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
                >
                  <BellAlertIcon className="w-4 h-4" />
                  {busy ? "Sending…" : "Send Reminders"}
                </button>
                <button
                  onClick={handleClose}
                  disabled={busy}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Close Cycle
                </button>
              </>
            )}
            <button onClick={load} className="p-2 text-gray-400 hover:text-gray-600">
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Stat bar */}
      {cycle.status !== "draft" && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Requests",  value: cycle.request_count, color: "text-gray-900" },
            { label: "Pending",         value: allPending,           color: "text-amber-600" },
            { label: "Updated",         value: allUpdated,           color: "text-green-600" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Requests grouped by owner */}
      {cycle.status === "draft" ? (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          <EnvelopeIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">This cycle is in draft.</p>
          {canEdit && (
            <p className="text-xs mt-1">
              Click <strong>Launch &amp; Send Emails</strong> to auto-include in-scope risks and notify owners.
            </p>
          )}
        </div>
      ) : cycle.requests.length === 0 ? (
        <p className="text-sm text-gray-400">No review requests in this cycle.</p>
      ) : (
        <div className="space-y-6">
          {Array.from(byOwner.entries()).map(([ownerId, reqs]) => {
            const owner   = reqs[0]?.owner;
            const pending = reqs.filter(r => r.status === "pending").length;
            const updated = reqs.filter(r => r.status === "updated").length;

            return (
              <div key={ownerId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Owner header */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm font-bold uppercase">
                      {owner?.display_name[0] ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {owner?.display_name ?? `User #${ownerId}`}
                      </p>
                      <p className="text-xs text-gray-400">{owner?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-amber-600 font-medium">{pending} pending</span>
                    <span className="text-green-600 font-medium">{updated} updated</span>
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
                      onUpdate={r => setToUpdate(r)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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
