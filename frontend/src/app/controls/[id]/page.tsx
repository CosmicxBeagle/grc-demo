"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import StatusBadge from "@/components/StatusBadge";
import FrameworkBadge from "@/components/FrameworkBadge";
import { controlsApi, risksApi, exceptionsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Control, ControlCycleHistory, Risk, SoxItgcDomain, ControlException, ExceptionStatus } from "@/types";
import { ArrowLeftIcon, PencilSquareIcon, TrashIcon, CheckIcon, XMarkIcon, PaperClipIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

function scoreBgClass(score: number) {
  if (score >= 20) return "bg-red-100 text-red-800";
  if (score >= 15) return "bg-orange-100 text-orange-800";
  if (score >= 9)  return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

function scoreLabel(score: number) {
  if (score >= 20) return "Critical";
  if (score >= 15) return "High";
  if (score >= 9)  return "Medium";
  return "Low";
}

function riskStatusBadge(status: string) {
  const map: Record<string, string> = {
    open: "bg-red-100 text-red-800",
    mitigated: "bg-green-100 text-green-800",
    accepted: "bg-blue-100 text-blue-800",
    transferred: "bg-purple-100 text-purple-800",
    closed: "bg-gray-100 text-gray-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-700";
}

export default function ControlDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const user     = getUser();
  const [ctrl, setCtrl]       = useState<Control | null>(null);
  const [cycles, setCycles]   = useState<ControlCycleHistory[]>([]);
  const [linkedRisks, setLinkedRisks] = useState<Risk[]>([]);
  const [controlExceptions, setControlExceptions] = useState<ControlException[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState({ control_id: "", title: "", description: "", owner: "", status: "active", control_type: "", frequency: "", sox_in_scope: false, sox_itgc_domain: "", sox_systems: "", sox_assertions: "" });

  useEffect(() => {
    if (id === "new") { setEditing(true); return; }
    const numId = Number(id);
    controlsApi.get(numId).then((r) => {
      setCtrl(r.data);
      setForm({
        title: r.data.title,
        description: r.data.description ?? "",
        owner: r.data.owner ?? "",
        status: r.data.status,
        control_type: r.data.control_type ?? "",
        frequency: r.data.frequency ?? "",
        sox_in_scope: r.data.sox_in_scope ?? false,
        sox_itgc_domain: r.data.sox_itgc_domain ?? "",
        sox_systems: r.data.sox_systems ?? "",
        sox_assertions: r.data.sox_assertions ?? "",
      });
    });
    controlsApi.cycles(numId).then((r) => setCycles(r.data));
    risksApi.forControl(numId).then((r) => setLinkedRisks(r.data)).catch(() => setLinkedRisks([]));
    exceptionsApi.list({ control_id: numId }).then((r) => setControlExceptions(r.data)).catch(() => setControlExceptions([]));
  }, [id]);

  const save = async () => {
    if (id === "new") {
      const r = await controlsApi.create(form);
      router.push(`/controls/${r.data.id}`);
    } else {
      await controlsApi.update(Number(id), form);
      const r = await controlsApi.get(Number(id));
      setCtrl(r.data);
      setEditing(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this control?")) return;
    await controlsApi.delete(Number(id));
    router.push("/controls");
  };

  if (!ctrl && !editing) {
    return <AppShell><div className="text-center py-20 text-gray-400">Loading…</div></AppShell>;
  }

  const frameworks = ctrl ? Array.from(new Set(ctrl.mappings.map((m) => m.framework))) : [];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <button onClick={() => router.push("/controls")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeftIcon className="w-4 h-4" /> Back to Controls
        </button>

        {/* Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              {editing && !ctrl ? (
                <input
                  className="font-mono text-brand-600 text-sm mb-1 border-b border-brand-300 focus:outline-none"
                  placeholder="Control ID (e.g. CTL-001)"
                  value={form.control_id}
                  onChange={(e) => setForm({ ...form, control_id: e.target.value })}
                />
              ) : (
                <p className="font-mono text-brand-600 text-sm mb-1">{ctrl?.control_id}</p>
              )}
              {editing ? (
                <input
                  className="text-xl font-bold border-b border-brand-400 focus:outline-none w-full"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              ) : (
                <h1 className="text-xl font-bold text-gray-900">{ctrl?.title}</h1>
              )}
            </div>
            {user?.role === "admin" && ctrl && !editing && (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-brand-600 border border-gray-200 rounded-lg px-3 py-1.5"
                >
                  <PencilSquareIcon className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={remove}
                  className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5"
                >
                  <TrashIcon className="w-4 h-4" /> Delete
                </button>
              </div>
            )}
            {editing && (
              <div className="flex gap-2">
                <button
                  onClick={save}
                  className="flex items-center gap-1.5 text-sm text-white bg-brand-600 hover:bg-brand-700 rounded-lg px-3 py-1.5"
                >
                  <CheckIcon className="w-4 h-4" /> Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5"
                >
                  <XMarkIcon className="w-4 h-4" /> Cancel
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              {editing ? (
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-1 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              ) : (
                <StatusBadge status={ctrl!.status} />
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Type</p>
              {editing ? (
                <select
                  value={form.control_type}
                  onChange={(e) => setForm({ ...form, control_type: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-1 text-sm"
                >
                  <option value="">—</option>
                  <option value="preventive">Preventive</option>
                  <option value="detective">Detective</option>
                  <option value="corrective">Corrective</option>
                </select>
              ) : (
                <p className="text-sm capitalize">{ctrl?.control_type ?? "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Frequency</p>
              {editing ? (
                <select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                  className="border border-gray-200 rounded px-2 py-1 text-sm"
                >
                  <option value="">—</option>
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="monthly">Monthly</option>
                  <option value="continuous">Continuous</option>
                </select>
              ) : (
                <p className="text-sm capitalize">{ctrl?.frequency ?? "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Owner</p>
              {editing ? (
                <input
                  className="border-b border-gray-300 text-sm focus:outline-none"
                  value={form.owner}
                  onChange={(e) => setForm({ ...form, owner: e.target.value })}
                />
              ) : (
                <p className="text-sm">{ctrl?.owner ?? "—"}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Frameworks</p>
              <div className="flex flex-wrap gap-1">
                {frameworks.map((f) => <FrameworkBadge key={f} framework={f} />)}
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-xs text-gray-400 mb-1">Description</p>
            {editing ? (
              <textarea
                rows={4}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            ) : (
              <p className="text-sm text-gray-700">{ctrl?.description ?? "No description."}</p>
            )}
          </div>

          {/* SOX ITGC Scoping */}
          <div className="mb-6 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-gray-700">SOX ITGC Scoping</h2>
              {editing ? (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sox_in_scope}
                    onChange={(e) => setForm({ ...form, sox_in_scope: e.target.checked })}
                    className="w-4 h-4 accent-brand-600"
                  />
                  <span className="text-sm text-gray-700">In Scope for SOX</span>
                </label>
              ) : ctrl?.sox_in_scope ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                  In Scope
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  Out of Scope
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">ITGC Domain</p>
                {editing ? (
                  <select
                    value={form.sox_itgc_domain}
                    onChange={(e) => setForm({ ...form, sox_itgc_domain: e.target.value })}
                    className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                  >
                    <option value="">—</option>
                    <option value="Access Controls">Access Controls</option>
                    <option value="Change Management">Change Management</option>
                    <option value="Computer Operations">Computer Operations</option>
                    <option value="Program Development">Program Development</option>
                  </select>
                ) : (
                  <p className="text-sm">{ctrl?.sox_itgc_domain ?? "—"}</p>
                )}
              </div>

              <div>
                <p className="text-xs text-gray-400 mb-1">Systems Covered</p>
                {editing ? (
                  <input
                    className="border border-gray-200 rounded px-2 py-1 text-sm w-full"
                    placeholder="e.g. SAP, Oracle, Active Directory"
                    value={form.sox_systems}
                    onChange={(e) => setForm({ ...form, sox_systems: e.target.value })}
                  />
                ) : (
                  <p className="text-sm">{ctrl?.sox_systems || "—"}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <p className="text-xs text-gray-400 mb-2">Financial Assertions</p>
                {editing ? (
                  <div className="flex flex-wrap gap-2">
                    {["Completeness","Accuracy","Existence","Authorization","Valuation","Presentation & Disclosure"].map((a) => {
                      const selected = (form.sox_assertions ?? "").split(",").map((s) => s.trim()).includes(a);
                      const toggle = () => {
                        const current = (form.sox_assertions ?? "").split(",").map((s) => s.trim()).filter(Boolean);
                        const next = selected ? current.filter((x) => x !== a) : [...current, a];
                        setForm({ ...form, sox_assertions: next.join(", ") });
                      };
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={toggle}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            selected
                              ? "bg-brand-600 text-white"
                              : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          {a}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {ctrl?.sox_assertions
                      ? ctrl.sox_assertions.split(",").map((a) => a.trim()).filter(Boolean).map((a) => (
                          <span key={a} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-700">
                            {a}
                          </span>
                        ))
                      : <span className="text-sm text-gray-400">—</span>
                    }
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Framework mappings table */}
          {ctrl && ctrl.mappings.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Framework Mappings</h2>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">Framework</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">Version</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">Reference</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-500">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctrl.mappings.map((m) => (
                      <tr key={m.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2"><FrameworkBadge framework={m.framework} /></td>
                        <td className="px-4 py-2 text-xs text-gray-500">{m.framework_version ?? "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-700">{m.framework_ref}</td>
                        <td className="px-4 py-2 text-gray-600">{m.framework_description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Test Cycle History */}
        {ctrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Test Cycle History</h2>
            {cycles.length === 0 ? (
              <p className="text-sm text-gray-400">This control has not been included in any test cycles yet.</p>
            ) : (
              <div className="space-y-3">
                {cycles.map((c) => (
                  <div key={c.assignment_id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <Link
                          href={`/test-cycles/${c.cycle_id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {c.cycle_name}
                        </Link>
                        {(c.start_date || c.end_date) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {c.start_date} → {c.end_date}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={c.assignment_status} />
                        {c.evidence_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                            <PaperClipIcon className="w-3 h-3" />
                            {c.evidence_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 mb-2">
                      {c.tester && <span>Tester: <span className="text-gray-700">{c.tester.display_name}</span></span>}
                      {c.reviewer && <span>Reviewer: <span className="text-gray-700">{c.reviewer.display_name}</span></span>}
                    </div>
                    {c.tester_notes && (
                      <p className="text-xs text-gray-600 bg-gray-50 rounded p-2 mt-2">
                        <span className="font-medium text-gray-500">Tester notes: </span>{c.tester_notes}
                      </p>
                    )}
                    {c.reviewer_comments && (
                      <p className="text-xs text-gray-600 bg-blue-50 rounded p-2 mt-1">
                        <span className="font-medium text-blue-500">Reviewer: </span>{c.reviewer_comments}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Linked Risks */}
        {ctrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Linked Risks</h2>
            {linkedRisks.length === 0 ? (
              <p className="text-sm text-gray-400">No risks linked to this control yet.</p>
            ) : (
              <div className="space-y-2">
                {linkedRisks.map((risk) => (
                  <div key={risk.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Link
                        href="/risks"
                        className="font-medium text-gray-900 hover:text-brand-600 hover:underline text-sm truncate"
                      >
                        {risk.name}
                      </Link>
                      {risk.asset && (
                        <span className="text-xs text-gray-400 truncate hidden sm:block">{risk.asset.name}</span>
                      )}
                      {risk.threat && (
                        <span className="text-xs text-gray-400 truncate hidden md:block">{risk.threat.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${scoreBgClass(risk.inherent_score)}`}>
                        {risk.inherent_score} — {scoreLabel(risk.inherent_score)}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${riskStatusBadge(risk.status)}`}>
                        {risk.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Control Exceptions */}
        {ctrl && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">Exceptions &amp; Risk Acceptances</h2>
              <Link
                href={`/exceptions`}
                className="text-xs text-brand-600 hover:underline"
              >
                Manage all →
              </Link>
            </div>
            {controlExceptions.length === 0 ? (
              <p className="text-sm text-gray-400">No exceptions recorded for this control.</p>
            ) : (
              <div className="space-y-2">
                {controlExceptions.map((exc) => {
                  const statusStyles: Record<ExceptionStatus, string> = {
                    draft:            "bg-gray-100 text-gray-600",
                    pending_approval: "bg-yellow-100 text-yellow-700",
                    approved:         "bg-green-100 text-green-700",
                    rejected:         "bg-red-100 text-red-700",
                    expired:          "bg-slate-100 text-slate-500",
                  };
                  const riskColors: Record<string, string> = {
                    critical: "text-red-700 bg-red-50 border-red-200",
                    high:     "text-orange-700 bg-orange-50 border-orange-200",
                    medium:   "text-yellow-700 bg-yellow-50 border-yellow-200",
                    low:      "text-green-700 bg-green-50 border-green-200",
                  };
                  return (
                    <div key={exc.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <span className={`mt-0.5 shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold uppercase ${riskColors[exc.risk_level]}`}>
                        {exc.risk_level}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{exc.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{exc.justification}</p>
                        {exc.expiry_date && (
                          <p className="text-xs text-gray-400 mt-0.5">Expires {new Date(exc.expiry_date).toLocaleDateString()}</p>
                        )}
                      </div>
                      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[exc.status]}`}>
                        {exc.status.replace("_", " ")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
