"use client";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { cyclesApi } from "@/lib/api";
import type { TestCycle, TestAssignment } from "@/types";
import { PaperClipIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

export default function EvidencePage() {
  const [cycles, setCycles] = useState<TestCycle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all cycles with full assignments (which include evidence)
    cyclesApi.list().then(async (res) => {
      const full = await Promise.all(res.data.map((c) => cyclesApi.get(c.id).then((r) => r.data)));
      setCycles(full);
      setLoading(false);
    });
  }, []);

  // Flatten all evidence entries across all assignments
  type EvidenceRow = {
    cycleId: number;
    cycleName: string;
    assignmentId: number;
    controlId: string;
    controlTitle: string;
    evId: number;
    filename: string;
    description?: string;
    uploadedAt: string;
  };

  const rows: EvidenceRow[] = [];
  for (const cycle of cycles) {
    for (const a of cycle.assignments) {
      for (const ev of a.evidence) {
        rows.push({
          cycleId:     cycle.id,
          cycleName:   cycle.name,
          assignmentId: a.id,
          controlId:   a.control?.control_id ?? String(a.control_id),
          controlTitle: a.control?.title ?? "",
          evId:        ev.id,
          filename:    ev.original_filename,
          description: ev.description,
          uploadedAt:  ev.uploaded_at,
        });
      }
    }
  }

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidence</h1>
          <p className="text-gray-500 mt-1">{rows.length} file{rows.length !== 1 ? "s" : ""} uploaded across all test cycles</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading…</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">File</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Control</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Test Cycle</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-gray-400">
                      No evidence uploaded yet. Upload files from inside a test cycle.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.evId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PaperClipIcon className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">{row.filename}</p>
                            {row.description && (
                              <p className="text-xs text-gray-400">{row.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-brand-600 mr-1">{row.controlId}</span>
                        <span className="text-gray-700">{row.controlTitle}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/test-cycles/${row.cycleId}`}
                          className="text-brand-600 hover:underline"
                        >
                          {row.cycleName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(row.uploadedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
