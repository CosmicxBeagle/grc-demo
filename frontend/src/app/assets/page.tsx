"use client";
import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import AppShell from "@/components/AppShell";
import { assetsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Asset } from "@/types";

// ── Constants ──────────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { value: "application",     label: "Application"     },
  { value: "database",        label: "Database"        },
  { value: "infrastructure",  label: "Infrastructure"  },
  { value: "network",         label: "Network"         },
  { value: "data",            label: "Data"            },
  { value: "physical",        label: "Physical"        },
  { value: "process",         label: "Process"         },
  { value: "people",          label: "People"          },
  { value: "cloud",           label: "Cloud"           },
];

const CRITICALITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high",     label: "High"     },
  { value: "medium",   label: "Medium"   },
  { value: "low",      label: "Low"      },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function criticalityBadge(c?: string) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high:     "bg-orange-100 text-orange-800",
    medium:   "bg-yellow-100 text-yellow-800",
    low:      "bg-blue-100 text-blue-800",
  };
  return map[c ?? ""] ?? "bg-gray-100 text-gray-700";
}

function statusBadge(s: string) {
  return s === "active"
    ? "bg-green-100 text-green-800"
    : "bg-gray-100 text-gray-600";
}

function labelFor(list: { value: string; label: string }[], val?: string) {
  return list.find(x => x.value === val)?.label ?? val ?? "-";
}

// ── Detail row used inside the drawer ─────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</dt>
      <dd className="text-sm text-gray-900">{children || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

// ── Form defaults ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name:        "",
  description: "",
  asset_type:  "application",
  criticality: "medium",
  owner:       "",
  status:      "active",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const [assets,  setAssets]  = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Drawer state
  const [selected, setSelected] = useState<Asset | null>(null);

  // Add / edit form state
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<number | null>(null);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);

  const user    = getUser();
  const isAdmin = user?.role === "admin";

  // ── Data ───────────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      const res = await assetsApi.list();
      setAssets(res.data);
    } catch {
      setError("Failed to load assets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ESC closes drawer
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeDrawer(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Lock body scroll while drawer open
  useEffect(() => {
    if (selected) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  // ── Drawer helpers ─────────────────────────────────────────────────────────

  const openDrawer = (a: Asset) => {
    setShowForm(false);
    setSelected(a);
  };

  const closeDrawer = () => setSelected(null);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setSelected(null);
    setShowForm(true);
  };

  const openEdit = (a: Asset) => {
    setEditId(a.id);
    setForm({
      name:        a.name,
      description: a.description ?? "",
      asset_type:  a.asset_type  ?? "application",
      criticality: a.criticality ?? "medium",
      owner:       a.owner       ?? "",
      status:      a.status,
    });
    setSelected(null);
    setShowForm(true);
  };

  const cancelForm = () => { setShowForm(false); setEditId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await assetsApi.update(editId, form);
      } else {
        await assetsApi.create(form);
      }
      cancelForm();
      await load();
    } catch {
      setError("Failed to save asset");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this asset?")) return;
    try {
      closeDrawer();
      await assetsApi.delete(id);
      await load();
    } catch {
      setError("Failed to delete asset");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Asset Inventory</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {assets.length} asset{assets.length !== 1 ? "s" : ""} registered
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 transition-colors"
            >
              + Add Asset
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <div className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              {editId ? "Edit Asset" : "New Asset"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text" required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Customer Database"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Brief description of this asset"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
                <select
                  value={form.asset_type}
                  onChange={e => setForm({ ...form, asset_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {ASSET_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
                <select
                  value={form.criticality}
                  onChange={e => setForm({ ...form, criticality: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {CRITICALITY_OPTIONS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
                <input
                  type="text"
                  value={form.owner}
                  onChange={e => setForm({ ...form, owner: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. IT Security Team"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="active">Active</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
              </div>
              <div className="md:col-span-2 flex gap-3 pt-1">
                <button
                  type="submit" disabled={saving}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : editId ? "Update Asset" : "Create Asset"}
                </button>
                <button
                  type="button" onClick={cancelForm}
                  className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading assets...</div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">No assets yet</p>
            <p className="text-sm mt-1">Add your first asset to get started</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Criticality</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Owner</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {assets.map(asset => (
                  <tr
                    key={asset.id}
                    onClick={() => openDrawer(asset)}
                    className="hover:bg-brand-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{asset.name}</div>
                      {asset.description && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
                          {asset.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {asset.asset_type && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {labelFor(ASSET_TYPES, asset.asset_type)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {asset.criticality && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${criticalityBadge(asset.criticality)}`}>
                          {asset.criticality.charAt(0).toUpperCase() + asset.criticality.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{asset.owner ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(asset.status)}`}>
                        {asset.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ───────────────────────────────────────────────────── */}
      {selected && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[480px] bg-white flex flex-col"
            style={{
              boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
              animation: "slideInRight 200ms ease-out",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 leading-snug">{selected.name}</h2>
                {selected.owner && (
                  <p className="text-xs text-gray-500 mt-0.5">{selected.owner}</p>
                )}
                <div className="mt-1.5 flex gap-2 flex-wrap">
                  {selected.criticality && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${criticalityBadge(selected.criticality)}`}>
                      {selected.criticality.charAt(0).toUpperCase() + selected.criticality.slice(1)}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(selected.status)}`}>
                    {selected.status}
                  </span>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0 mt-0.5"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <dl className="mt-1 divide-y divide-gray-100">
                <DetailRow label="Asset Type">
                  {labelFor(ASSET_TYPES, selected.asset_type)}
                </DetailRow>
                <DetailRow label="Criticality">
                  {selected.criticality
                    ? labelFor(CRITICALITY_OPTIONS, selected.criticality)
                    : undefined}
                </DetailRow>
                <DetailRow label="Owner">{selected.owner}</DetailRow>
                <DetailRow label="Status">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(selected.status)}`}>
                    {selected.status}
                  </span>
                </DetailRow>
                {selected.description && (
                  <DetailRow label="Description">{selected.description}</DetailRow>
                )}
              </dl>
            </div>

            {/* Footer actions */}
            {isAdmin && (
              <div className="shrink-0 px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => openEdit(selected)}
                  className="flex-1 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-md hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
