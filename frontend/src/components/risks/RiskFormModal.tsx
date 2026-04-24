"use client";
import { useEffect, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { Risk, Asset, Threat, User, RiskStatus } from "@/types";
import { risksApi, assetsApi, threatsApi } from "@/lib/api";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

// ── Quick-add constants ───────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: "application",    label: "Application"    },
  { value: "database",       label: "Database"       },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "network",        label: "Network"        },
  { value: "data",           label: "Data"           },
  { value: "physical",       label: "Physical"       },
  { value: "process",        label: "Process"        },
  { value: "people",         label: "People"         },
  { value: "cloud",          label: "Cloud"          },
];

const CRITICALITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high",     label: "High"     },
  { value: "medium",   label: "Medium"   },
  { value: "low",      label: "Low"      },
];

const THREAT_CATEGORIES = [
  { value: "cyber",       label: "Cyber"       },
  { value: "access",      label: "Access"      },
  { value: "data-breach", label: "Data Breach" },
  { value: "insider",     label: "Insider"     },
  { value: "physical",    label: "Physical"    },
  { value: "natural",     label: "Natural"     },
  { value: "compliance",  label: "Compliance"  },
  { value: "operational", label: "Operational" },
];

// ── Field option lists ────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  "Strategic", "Operational", "Financial", "Compliance / Regulatory",
  "Technology / IT", "Cybersecurity", "Reputational", "Human Capital",
  "Environmental", "Third-Party / Vendor", "Legal", "Other",
];

const TYPE_OPTIONS = ["Internal", "External", "Both"];

const STAGE_OPTIONS = [
  "Identification", "Assessment", "Treatment Planning",
  "Active Treatment", "Monitoring", "Closed",
];

const SOURCE_OPTIONS = [
  "Internal Audit", "External Audit", "Risk Assessment",
  "Incident Report", "Employee Report", "Regulatory Review",
  "Management Review", "Third-Party Assessment", "Penetration Test", "Other",
];

// ── Quick-add modals ──────────────────────────────────────────────────────────

function QuickAddAssetModal({ onSaved, onClose }: { onSaved: (a: Asset) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("application");
  const [criticality, setCriticality] = useState("medium");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr("");
    try {
      const res = await assetsApi.create({ name: name.trim(), asset_type: assetType, criticality, status: "active" });
      onSaved(res.data as Asset);
    } catch {
      setErr("Failed to create asset");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">New Asset</h3>
        {err && <p className="text-red-600 text-xs mb-3">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text" required autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Customer Database"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select value={assetType} onChange={e => setAssetType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Criticality</label>
            <select value={criticality} onChange={e => setCriticality(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {CRITICALITY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Creating…" : "Create Asset"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickAddThreatModal({ onSaved, onClose }: { onSaved: (t: Threat) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("cyber");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr("");
    try {
      const res = await threatsApi.create({ name: name.trim(), threat_category: category });
      onSaved(res.data as Threat);
    } catch {
      setErr("Failed to create threat");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-gray-900 mb-4">New Threat</h3>
        {err && <p className="text-red-600 text-xs mb-3">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text" required autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Ransomware Attack"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {THREAT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Creating…" : "Create Threat"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreBg(score: number) {
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

// Section header component
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-100" />
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em] whitespace-nowrap">{label}</p>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

const TREATMENT_OPTIONS = [
  { value: "mitigate", label: "Mitigate" },
  { value: "accept",   label: "Accept"   },
  { value: "transfer", label: "Transfer" },
  { value: "avoid",    label: "Avoid"    },
];

const STATUS_OPTIONS: { value: RiskStatus; label: string }[] = [
  { value: "new",                   label: "New"                  },
  { value: "unmanaged",             label: "Unmanaged"            },
  { value: "managed_with_dates",    label: "Managed (with dates)" },
  { value: "managed_without_dates", label: "Managed (no dates)"   },
  { value: "closed",                label: "Closed"               },
];

const LIKELIHOOD_LABELS = ["", "Very Low", "Low", "Medium", "High", "Very High"];
const IMPACT_LABELS     = ["", "Negligible", "Minor", "Moderate", "Significant", "Severe"];

const EMPTY_FORM = {
  name: "",
  description: "",
  asset_id: "",
  threat_id: "",
  likelihood: 3,
  impact: 3,
  residual_likelihood: 0,
  residual_impact: 0,
  target_likelihood: 0,
  target_impact: 0,
  treatment: "mitigate",
  status: "new" as RiskStatus,
  managed_start_date: "",
  managed_end_date: "",
  owner: "",
  owner_id: "",
  parent_risk_id: "",
  // Extended fields
  category: "",
  risk_type: "",
  risk_theme: "",
  source: "",
  department: "",
  owning_vp: "",
  stage: "",
  date_identified: "",
  date_closed: "",
  closing_justification: "",
  regulatory_compliance: "",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  editRisk?: Risk | null;
  assets: Asset[];
  threats: Threat[];
  users: User[];
  allRisks: Risk[];
  onClose: () => void;
  onSaved: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RiskFormModal({
  editRisk,
  assets,
  threats,
  users,
  allRisks,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Warn browser on tab-close / refresh when form has unsaved changes
  useUnsavedChanges(dirty);

  // Local copies so newly created assets/threats appear immediately
  const [localAssets, setLocalAssets] = useState<Asset[]>(assets);
  const [localThreats, setLocalThreats] = useState<Threat[]>(threats);
  const [showQuickAsset, setShowQuickAsset] = useState(false);
  const [showQuickThreat, setShowQuickThreat] = useState(false);

  useEffect(() => { setLocalAssets(assets); }, [assets]);
  useEffect(() => { setLocalThreats(threats); }, [threats]);

  const handleAssetCreated = (a: Asset) => {
    setLocalAssets(prev => [...prev, a]);
    update({ asset_id: String(a.id) });
    setShowQuickAsset(false);
  };

  const handleThreatCreated = (t: Threat) => {
    setLocalThreats(prev => [...prev, t]);
    update({ threat_id: String(t.id) });
    setShowQuickThreat(false);
  };

  // Populate form when editing
  useEffect(() => {
    if (editRisk) {
      setForm({
        name:               editRisk.name,
        description:        editRisk.description        ?? "",
        asset_id:           editRisk.asset_id           ? String(editRisk.asset_id)   : "",
        threat_id:          editRisk.threat_id          ? String(editRisk.threat_id)  : "",
        likelihood:         editRisk.likelihood,
        impact:             editRisk.impact,
        residual_likelihood: editRisk.residual_likelihood ?? 0,
        residual_impact:    editRisk.residual_impact    ?? 0,
        target_likelihood:  editRisk.target_likelihood  ?? 0,
        target_impact:      editRisk.target_impact      ?? 0,
        treatment:          editRisk.treatment          ?? "mitigate",
        status:             editRisk.status,
        managed_start_date: editRisk.managed_start_date ?? "",
        managed_end_date:   editRisk.managed_end_date   ?? "",
        owner:              editRisk.owner              ?? "",
        owner_id:           editRisk.owner_id           ? String(editRisk.owner_id)   : "",
        parent_risk_id:     editRisk.parent_risk_id     ? String(editRisk.parent_risk_id) : "",
        // Extended fields
        category:              editRisk.category              ?? "",
        risk_type:             editRisk.risk_type             ?? "",
        risk_theme:            editRisk.risk_theme            ?? "",
        source:                editRisk.source                ?? "",
        department:            editRisk.department            ?? "",
        owning_vp:             editRisk.owning_vp             ?? "",
        stage:                 editRisk.stage                 ?? "",
        date_identified:       editRisk.date_identified       ?? "",
        date_closed:           editRisk.date_closed           ?? "",
        closing_justification: editRisk.closing_justification ?? "",
        regulatory_compliance: editRisk.regulatory_compliance ?? "",
      });
    }
    firstInputRef.current?.focus();
  }, [editRisk]);

  // Close on Escape (with dirty check)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    onClose();
  };

  const update = (patch: Partial<typeof EMPTY_FORM>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const payload = {
        name:               form.name.trim(),
        description:        form.description        || null,
        asset_id:           form.asset_id           ? Number(form.asset_id)           : null,
        threat_id:          form.threat_id          ? Number(form.threat_id)          : null,
        likelihood:         Number(form.likelihood),
        impact:             Number(form.impact),
        residual_likelihood: form.residual_likelihood > 0 ? Number(form.residual_likelihood) : null,
        residual_impact:    form.residual_impact    > 0 ? Number(form.residual_impact)    : null,
        target_likelihood:  form.target_likelihood  > 0 ? Number(form.target_likelihood)  : null,
        target_impact:      form.target_impact      > 0 ? Number(form.target_impact)      : null,
        treatment:          form.treatment,
        status:             form.status,
        managed_start_date:
          form.status === "managed_with_dates" && form.managed_start_date
            ? form.managed_start_date : null,
        managed_end_date:
          form.status === "managed_with_dates" && form.managed_end_date
            ? form.managed_end_date : null,
        owner:              form.owner              || null,
        owner_id:           form.owner_id           ? Number(form.owner_id)           : null,
        parent_risk_id:     form.parent_risk_id     ? Number(form.parent_risk_id)     : null,
        // Extended fields
        category:              form.category              || null,
        risk_type:             form.risk_type             || null,
        risk_theme:            form.risk_theme            || null,
        source:                form.source                || null,
        department:            form.department            || null,
        owning_vp:             form.owning_vp             || null,
        stage:                 form.stage                 || null,
        date_identified:       form.date_identified       || null,
        date_closed:           form.status === "closed" && form.date_closed ? form.date_closed : null,
        closing_justification: form.closing_justification || null,
        regulatory_compliance: form.regulatory_compliance || null,
      };
      if (editRisk) {
        await risksApi.update(editRisk.id, payload);
      } else {
        await risksApi.create(payload);
      }
      setDirty(false);  // clear beforeunload guard before modal closes
      onSaved();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : Array.isArray(detail)
          ? detail[0]?.msg ?? "Save failed"
          : "Save failed"
      );
    } finally {
      setSaving(false);
    }
  };

  const previewScore    = Number(form.likelihood) * Number(form.impact);
  const residualPreview = form.residual_likelihood > 0 && form.residual_impact > 0
    ? form.residual_likelihood * form.residual_impact : null;
  const targetPreview   = form.target_likelihood > 0 && form.target_impact > 0
    ? form.target_likelihood * form.target_impact : null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
        onClick={handleClose}
      >
        {/* Modal — wider at max-w-3xl */}
        <div
          className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl flex flex-col my-6"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
            <h2 className="text-base font-semibold text-gray-900">
              {editRisk ? "Edit Risk" : "New Risk"}
            </h2>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form id="risk-form" onSubmit={handleSubmit} className="space-y-4">

              {/* ── Basic Info ── */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={firstInputRef}
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => update({ name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Customer data exposed via SQL injection"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => update({ description: e.target.value })}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Describe the risk scenario"
                  />
                </div>
              </div>

              {/* ── Classification ── */}
              <SectionHeader label="Classification" />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => update({ category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select —</option>
                    {CATEGORY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.risk_type}
                    onChange={(e) => update({ risk_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select —</option>
                    {TYPE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    value={form.stage}
                    onChange={(e) => update({ stage: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select —</option>
                    {STAGE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => update({ department: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. IT, Finance"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Owning VP</label>
                  <input
                    type="text"
                    value={form.owning_vp}
                    onChange={(e) => update({ owning_vp: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
                  <select
                    value={form.source}
                    onChange={(e) => update({ source: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select —</option>
                    {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Risk Theme</label>
                  <input
                    type="text"
                    value={form.risk_theme}
                    onChange={(e) => update({ risk_theme: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Data Privacy"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Regulatory Compliance</label>
                  <input
                    type="text"
                    value={form.regulatory_compliance}
                    onChange={(e) => update({ regulatory_compliance: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. SOX, GDPR, PCI-DSS"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date Identified</label>
                  <input
                    type="date"
                    value={form.date_identified}
                    onChange={(e) => update({ date_identified: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Risk Opened</label>
                  <input
                    type="text"
                    readOnly
                    value={editRisk?.created_at ? new Date(editRisk.created_at).toLocaleDateString("en-US") : "Will populate automatically when created"}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-2 py-2 text-sm text-gray-500"
                  />
                </div>
              </div>

              {/* ── Asset & Threat ── */}
              <SectionHeader label="Asset & Threat" />
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Asset</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickAsset(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add new
                    </button>
                  </div>
                  <select
                    value={form.asset_id}
                    onChange={(e) => update({ asset_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— No asset —</option>
                    {localAssets.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">Threat</label>
                    <button
                      type="button"
                      onClick={() => setShowQuickThreat(true)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add new
                    </button>
                  </div>
                  <select
                    value={form.threat_id}
                    onChange={(e) => update({ threat_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— No threat —</option>
                    {localThreats.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Inherent Risk Scoring ── */}
              <SectionHeader label="Inherent Risk" />
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Likelihood:{" "}
                    <span className="font-semibold text-blue-600">{form.likelihood}</span>
                    <span className="ml-2 text-xs text-gray-400">{LIKELIHOOD_LABELS[form.likelihood]}</span>
                  </label>
                  <input
                    type="range" min={1} max={5}
                    value={form.likelihood}
                    onChange={(e) => update({ likelihood: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    {[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Impact:{" "}
                    <span className="font-semibold text-blue-600">{form.impact}</span>
                    <span className="ml-2 text-xs text-gray-400">{IMPACT_LABELS[form.impact]}</span>
                  </label>
                  <input
                    type="range" min={1} max={5}
                    value={form.impact}
                    onChange={(e) => update({ impact: Number(e.target.value) })}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    {[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
              </div>
              <div className={`mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm ${scoreBg(previewScore)}`}>
                Inherent Score: {previewScore} — {scoreLabel(previewScore)}
              </div>

              {/* ── Residual Risk ── */}
              <SectionHeader label="Residual Risk — after controls applied (optional)" />
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residual Likelihood:{" "}
                    <span className="font-semibold text-green-700">
                      {form.residual_likelihood > 0 ? form.residual_likelihood : "—"}
                    </span>
                  </label>
                  <input
                    type="range" min={0} max={5}
                    value={form.residual_likelihood}
                    onChange={(e) => update({ residual_likelihood: Number(e.target.value) })}
                    className="w-full accent-green-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>—</span>{[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residual Impact:{" "}
                    <span className="font-semibold text-green-700">
                      {form.residual_impact > 0 ? form.residual_impact : "—"}
                    </span>
                  </label>
                  <input
                    type="range" min={0} max={5}
                    value={form.residual_impact}
                    onChange={(e) => update({ residual_impact: Number(e.target.value) })}
                    className="w-full accent-green-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>—</span>{[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
              </div>
              {residualPreview !== null && (
                <div className={`mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm ${scoreBg(residualPreview)}`}>
                  Residual Score: {residualPreview} — {scoreLabel(residualPreview)}
                </div>
              )}

              {/* ── Target Risk ── */}
              <SectionHeader label="Target Risk — desired state (optional)" />
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Likelihood:{" "}
                    <span className="font-semibold text-purple-700">
                      {form.target_likelihood > 0 ? form.target_likelihood : "—"}
                    </span>
                  </label>
                  <input
                    type="range" min={0} max={5}
                    value={form.target_likelihood}
                    onChange={(e) => update({ target_likelihood: Number(e.target.value) })}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>—</span>{[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Target Impact:{" "}
                    <span className="font-semibold text-purple-700">
                      {form.target_impact > 0 ? form.target_impact : "—"}
                    </span>
                  </label>
                  <input
                    type="range" min={0} max={5}
                    value={form.target_impact}
                    onChange={(e) => update({ target_impact: Number(e.target.value) })}
                    className="w-full accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>—</span>{[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                  </div>
                </div>
              </div>
              {targetPreview !== null && (
                <div className={`mt-3 inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm ${scoreBg(targetPreview)}`}>
                  Target Score: {targetPreview} — {scoreLabel(targetPreview)}
                </div>
              )}

              {/* ── Treatment & Status ── */}
              <SectionHeader label="Treatment & Status" />
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment</label>
                  <select
                    value={form.treatment}
                    onChange={(e) => update({ treatment: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TREATMENT_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      update({
                        status: e.target.value as RiskStatus,
                        managed_start_date: "",
                        managed_end_date: "",
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Managed dates — conditional */}
                {form.status === "managed_with_dates" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date" required
                        value={form.managed_start_date}
                        onChange={(e) => update({ managed_start_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date" required
                        value={form.managed_end_date}
                        onChange={(e) => update({ managed_end_date: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Closure fields ? conditional */}
                {form.status === "closed" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status Changed To Closed</label>
                      <input
                        type="text"
                        readOnly
                        value={editRisk?.closed_at ? new Date(editRisk.closed_at).toLocaleDateString("en-US") : "Will populate automatically when saved as Closed"}
                        className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Risk Closed Date</label>
                      <input
                        type="date"
                        value={form.date_closed}
                        onChange={(e) => update({ date_closed: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Closing Justification</label>
                      <textarea
                        value={form.closing_justification}
                        onChange={(e) => update({ closing_justification: e.target.value })}
                        rows={2}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Why is this risk being closed?"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* ── Ownership ── */}
              <SectionHeader label="Ownership" />
              <div className="grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner (label)</label>
                  <input
                    type="text"
                    value={form.owner}
                    onChange={(e) => update({ owner: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Security Team"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assigned Owner
                    <span className="ml-1 text-xs text-gray-400 font-normal">(for reviews)</span>
                  </label>
                  <select
                    value={form.owner_id}
                    onChange={(e) => update({ owner_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— No owner —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* ── Parent Risk ── */}
              <SectionHeader label="Hierarchy" />
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Risk
                  <span className="ml-2 text-xs font-normal text-gray-400">optional — nest under a strategic risk</span>
                </label>
                <select
                  value={form.parent_risk_id}
                  onChange={(e) => update({ parent_risk_id: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No parent (top-level risk) —</option>
                  {allRisks
                    .filter((r) => !r.parent_risk_id && r.id !== editRisk?.id)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (Score: {r.inherent_score})
                      </option>
                    ))}
                </select>
              </div>

            </form>
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-gray-200 px-6 py-4 flex items-center gap-3">
            <button
              type="submit"
              form="risk-form"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : editRisk ? "Update Risk" : "Create Risk"}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
      {showQuickAsset && (
        <QuickAddAssetModal
          onSaved={handleAssetCreated}
          onClose={() => setShowQuickAsset(false)}
        />
      )}
      {showQuickThreat && (
        <QuickAddThreatModal
          onSaved={handleThreatCreated}
          onClose={() => setShowQuickThreat(false)}
        />
      )}
    </>
  );
}
