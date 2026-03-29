"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { threatsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Threat } from "@/types";

const THREAT_CATEGORIES = [
  { value: "cyber", label: "Cyber" },
  { value: "access", label: "Unauthorized Access" },
  { value: "data-breach", label: "Data Breach" },
  { value: "insider", label: "Insider Threat" },
  { value: "physical", label: "Physical" },
  { value: "natural", label: "Natural Disaster" },
  { value: "compliance", label: "Compliance" },
  { value: "operational", label: "Operational" },
];

const SOURCES = [
  { value: "internal", label: "Internal" },
  { value: "external", label: "External" },
  { value: "environmental", label: "Environmental" },
];

function sourceBadge(s?: string) {
  const map: Record<string, string> = {
    internal: "bg-purple-100 text-purple-800",
    external: "bg-red-100 text-red-800",
    environmental: "bg-gray-100 text-gray-700",
  };
  return map[s ?? ""] ?? "bg-gray-100 text-gray-700";
}

function categoryBadge(c?: string) {
  const map: Record<string, string> = {
    cyber: "bg-blue-100 text-blue-800",
    access: "bg-orange-100 text-orange-800",
    "data-breach": "bg-red-100 text-red-800",
    insider: "bg-purple-100 text-purple-800",
    physical: "bg-yellow-100 text-yellow-800",
    natural: "bg-teal-100 text-teal-800",
    compliance: "bg-indigo-100 text-indigo-800",
    operational: "bg-gray-100 text-gray-700",
  };
  return map[c ?? ""] ?? "bg-gray-100 text-gray-700";
}

const EMPTY_FORM = {
  name: "",
  description: "",
  threat_category: "cyber",
  source: "external",
};

export default function ThreatsPage() {
  const [threats, setThreats] = useState<Threat[]>([]);
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
      const res = await threatsApi.list();
      setThreats(res.data);
    } catch {
      setError("Failed to load threats");
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

  const openEdit = (t: Threat) => {
    setEditId(t.id);
    setForm({
      name: t.name,
      description: t.description ?? "",
      threat_category: t.threat_category ?? "cyber",
      source: t.source ?? "external",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        await threatsApi.update(editId, form);
      } else {
        await threatsApi.create(form);
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditId(null);
      await load();
    } catch {
      setError("Failed to save threat");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this threat?")) return;
    try {
      await threatsApi.delete(id);
      await load();
    } catch {
      setError("Failed to delete threat");
    }
  };

  return (
    <AppShell>
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Threat Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">{threats.length} threat{threats.length !== 1 ? "s" : ""} catalogued</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            + Add Threat
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
            {editId ? "Edit Threat" : "New Threat"}
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
                placeholder="e.g. Ransomware Attack"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of this threat"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={form.threat_category}
                onChange={e => setForm({ ...form, threat_category: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {THREAT_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={form.source}
                onChange={e => setForm({ ...form, source: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {SOURCES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : editId ? "Update Threat" : "Create Threat"}
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
        <div className="text-center py-12 text-gray-400">Loading threats...</div>
      ) : threats.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg font-medium">No threats yet</p>
          <p className="text-sm mt-1">Add your first threat to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Source</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                {isAdmin && <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {threats.map(threat => (
                <tr key={threat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{threat.name}</td>
                  <td className="px-4 py-3">
                    {threat.threat_category && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryBadge(threat.threat_category)}`}>
                        {THREAT_CATEGORIES.find(c => c.value === threat.threat_category)?.label ?? threat.threat_category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {threat.source && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceBadge(threat.source)}`}>
                        {SOURCES.find(s => s.value === threat.source)?.label ?? threat.source}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{threat.description ?? "-"}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(threat)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(threat.id)}
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
