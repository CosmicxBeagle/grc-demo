"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { assetsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Asset } from "@/types";

const ASSET_TYPES = [
  { value: "application", label: "Application" },
  { value: "database", label: "Database" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "network", label: "Network" },
  { value: "data", label: "Data" },
  { value: "physical", label: "Physical" },
  { value: "process", label: "Process" },
  { value: "people", label: "People" },
];

const CRITICALITY_OPTIONS = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

function criticalityBadge(c?: string) {
  const map: Record<string, string> = {
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-blue-100 text-blue-800",
  };
  return map[c ?? ""] ?? "bg-gray-100 text-gray-700";
}

function assetTypeBadge() {
  return "bg-gray-100 text-gray-700";
}

const EMPTY_FORM = {
  name: "",
  description: "",
  asset_type: "application",
  criticality: "medium",
  owner: "",
  status: "active",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const user = getUser();
  const isAdmin = user?.role === "admin";

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

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (a: Asset) => {
    setEditId(a.id);
    setForm({
      name: a.name,
      description: a.description ?? "",
      asset_type: a.asset_type ?? "application",
      criticality: a.criticality ?? "medium",
      owner: a.owner ?? "",
      status: a.status,
    });
    setShowForm(true);
  };

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
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
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
      await assetsApi.delete(id);
      await load();
    } catch {
      setError("Failed to delete asset");
    }
  };

  return (
    <AppShell>
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">{assets.length} asset{assets.length !== 1 ? "s" : ""} registered</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
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

      {/* Add/Edit Form */}
      {showForm && (
        <div className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editId ? "Edit Asset" : "New Asset"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Customer Database"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of this asset"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
              <select
                value={form.asset_type}
                onChange={e => setForm({ ...form, asset_type: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. IT Security Team"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editId ? "Update Asset" : "Create Asset"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditId(null); }}
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
                {isAdmin && <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assets.map(asset => (
                <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{asset.name}</div>
                    {asset.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{asset.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {asset.asset_type && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${assetTypeBadge()}`}>
                        {ASSET_TYPES.find(t => t.value === asset.asset_type)?.label ?? asset.asset_type}
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
                  <td className="px-4 py-3 text-gray-600">{asset.owner ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      asset.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {asset.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(asset)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="text-red-600 hover:text-red-800 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
    </AppShell>
  );
}
