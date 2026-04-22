"use client";
import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import AppShell from "@/components/AppShell";
import { threatsApi } from "@/lib/api";
import { getUser } from "@/lib/auth";
import type { Threat } from "@/types";

// ── Constants ──────────────────────────────────────────────────────────────────

const THREAT_CATEGORIES = [
  { value: "cyber",        label: "Cyber"                },
  { value: "access",       label: "Unauthorized Access"  },
  { value: "data-breach",  label: "Data Breach"          },
  { value: "insider",      label: "Insider Threat"       },
  { value: "physical",     label: "Physical"             },
  { value: "natural",      label: "Natural Disaster"     },
  { value: "compliance",   label: "Compliance"           },
  { value: "operational",  label: "Operational"          },
];

const SOURCES = [
  { value: "internal",      label: "Internal"      },
  { value: "external",      label: "External"      },
  { value: "environmental", label: "Environmental" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function sourceBadge(s?: string) {
  const map: Record<string, string> = {
    internal:      "bg-purple-100 text-purple-800",
    external:      "bg-red-100 text-red-800",
    environmental: "bg-gray-100 text-gray-700",
  };
  return map[s ?? ""] ?? "bg-gray-100 text-gray-700";
}

function categoryBadge(c?: string) {
  const map: Record<string, string> = {
    cyber:        "bg-blue-100 text-blue-800",
    access:       "bg-orange-100 text-orange-800",
    "data-breach":"bg-red-100 text-red-800",
    insider:      "bg-purple-100 text-purple-800",
    physical:     "bg-yellow-100 text-yellow-800",
    natural:      "bg-teal-100 text-teal-800",
    compliance:   "bg-indigo-100 text-indigo-800",
    operational:  "bg-gray-100 text-gray-700",
  };
  return map[c ?? ""] ?? "bg-gray-100 text-gray-700";
}

function labelFor(list: { value: string; label: string }[], val?: string) {
  return list.find(x => x.value === val)?.label ?? val ?? "—";
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
  name:             "",
  description:      "",
  threat_category:  "cyber",
  source:           "external",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ThreatsPage() {
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Drawer state
  const [selected, setSelected] = useState<Threat | null>(null);

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
      const res = await threatsApi.list();
      setThreats(res.data);
    } catch {
      setError("Failed to load threats");
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

  const openDrawer = (t: Threat) => {
    setShowForm(false);
    setSelected(t);
  };

  const closeDrawer = () => setSelected(null);

  // ── Form helpers ───────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setSelected(null);
    setShowForm(true);
  };

  const openEdit = (t: Threat) => {
    setEditId(t.id);
    setForm({
      name:            t.name,
      description:     t.description      ?? "",
      threat_category: t.threat_category  ?? "cyber",
      source:          t.source           ?? "external",
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
        await threatsApi.update(editId, form);
      } else {
        await threatsApi.create(form);
      }
      cancelForm();
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
      closeDrawer();
      await threatsApi.delete(id);
      await load();
    } catch {
      setError("Failed to delete threat");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="p-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Threat Catalog</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {threats.length} threat{threats.length !== 1 ? "s" : ""} catalogued
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 transition-colors"
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

        {/* Add / Edit Form */}
        {showForm && (
          <div className="mb-6 p-5 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h2 className="text-base font-semibold text-gray-800 mb-4">
              {editId ? "Edit Threat" : "New Threat"}
            </h2>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text" required
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Ransomware Attack"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="Brief description of this threat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={form.threat_category}
                  onChange={e => setForm({ ...form, threat_category: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {SOURCES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2 flex gap-3 pt-1">
                <button
                  type="submit" disabled={saving}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-md hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : editId ? "Update Threat" : "Create Threat"}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {threats.map(threat => (
                  <tr
                    key={threat.id}
                    onClick={() => openDrawer(threat)}
                    className="hover:bg-brand-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{threat.name}</td>
                    <td className="px-4 py-3">
                      {threat.threat_category && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryBadge(threat.threat_category)}`}>
                          {labelFor(THREAT_CATEGORIES, threat.threat_category)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {threat.source && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceBadge(threat.source)}`}>
                          {labelFor(SOURCES, threat.source)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                      {threat.description ?? "—"}
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
                <div className="mt-1.5 flex gap-2 flex-wrap">
                  {selected.threat_category && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${categoryBadge(selected.threat_category)}`}>
                      {labelFor(THREAT_CATEGORIES, selected.threat_category)}
                    </span>
                  )}
                  {selected.source && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sourceBadge(selected.source)}`}>
                      {labelFor(SOURCES, selected.source)}
                    </span>
                  )}
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
                <DetailRow label="Category">
                  {selected.threat_category && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${categoryBadge(selected.threat_category)}`}>
                      {labelFor(THREAT_CATEGORIES, selected.threat_category)}
                    </span>
                  )}
                </DetailRow>
                <DetailRow label="Source">
                  {selected.source && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${sourceBadge(selected.source)}`}>
                      {labelFor(SOURCES, selected.source)}
                    </span>
                  )}
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
