"use client";
/**
 * BulkImportModal — upload a CSV to create many risks at once.
 *
 * Flow:
 *   1. Upload  — drop or pick a .csv file; template download available
 *   2. Preview — table of parsed rows before submitting
 *   3. Results — success count + per-row errors
 */
import { useRef, useState, useCallback } from "react";
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { risksApi } from "@/lib/api";

// ── CSV template ──────────────────────────────────────────────────────────────

const TEMPLATE_HEADERS = [
  "name",
  "description",
  "likelihood",
  "impact",
  "residual_likelihood",
  "residual_impact",
  "treatment",
  "status",
  "owner",
  "managed_start_date",
  "managed_end_date",
] as const;

const TEMPLATE_EXAMPLE_ROWS = [
  [
    "Unauthorised access to production database",
    "External attacker exploits misconfigured firewall to access customer data",
    "4", "5", "2", "3",
    "mitigate", "new", "Jane Smith", "", "",
  ],
  [
    "Vendor SLA breach",
    "Critical vendor fails to meet 99.9% uptime commitment",
    "3", "4", "", "",
    "transfer", "new", "John Doe", "", "",
  ],
  [
    "Outdated OS on legacy server",
    "Server running unsupported OS receives no security patches",
    "4", "3", "", "",
    "mitigate", "managed_with_dates", "IT Security", "2026-01-01", "2026-06-30",
  ],
];

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS.join(",")];
  for (const row of TEMPLATE_EXAMPLE_ROWS) {
    // Quote fields that may contain commas
    rows.push(row.map(v => (v.includes(",") ? `"${v}"` : v)).join(","));
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "risk_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV parser (client-side preview) ─────────────────────────────────────────

interface ParsedRow {
  rowNum: number;
  name: string;
  description: string;
  likelihood: string;
  impact: string;
  residual_likelihood: string;
  residual_impact: string;
  treatment: string;
  status: string;
  owner: string;
  managed_start_date: string;
  managed_end_date: string;
  _error?: string;
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  if (lines.length < 2) return [];

  // Simple CSV split — handles quoted fields
  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuote = !inQuote;
      } else if (c === "," && !inQuote) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur.trim());
    return fields;
  }

  const headers = splitLine(lines[0]).map(h => h.toLowerCase().trim());

  const get = (row: string[], header: string) => {
    const idx = headers.indexOf(header);
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = splitLine(lines[i]);
    const name = get(row, "name");
    let error: string | undefined;
    if (!name) error = "name is required";
    const likelihood = get(row, "likelihood");
    const impact = get(row, "impact");
    if (!error && likelihood && (isNaN(Number(likelihood)) || Number(likelihood) < 1 || Number(likelihood) > 5)) {
      error = "likelihood must be 1–5";
    }
    if (!error && impact && (isNaN(Number(impact)) || Number(impact) < 1 || Number(impact) > 5)) {
      error = "impact must be 1–5";
    }

    rows.push({
      rowNum: i + 1,
      name,
      description:          get(row, "description"),
      likelihood:           likelihood || "3",
      impact:               impact || "3",
      residual_likelihood:  get(row, "residual_likelihood"),
      residual_impact:      get(row, "residual_impact"),
      treatment:            get(row, "treatment") || "mitigate",
      status:               get(row, "status") || "new",
      owner:                get(row, "owner"),
      managed_start_date:   get(row, "managed_start_date"),
      managed_end_date:     get(row, "managed_end_date"),
      _error:               error,
    });
  }
  return rows;
}

// ── Score helper ──────────────────────────────────────────────────────────────

function scoreChip(l: string, im: string) {
  const score = (parseInt(l) || 3) * (parseInt(im) || 3);
  if (score >= 20) return <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded font-semibold">{score}</span>;
  if (score >= 15) return <span className="bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded font-semibold">{score}</span>;
  if (score >= 9)  return <span className="bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded font-semibold">{score}</span>;
  return <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded font-semibold">{score}</span>;
}

// ── Import result types ───────────────────────────────────────────────────────

interface ImportResult {
  created: number;
  errors: { row: number; name: string; error: string }[];
  created_items: { row: number; id: number; name: string }[];
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "results";

interface Props {
  onClose: () => void;
  onImported: () => void;
}

export default function BulkImportModal({ onClose, onImported }: Props) {
  const [step, setStep]             = useState<Step>("upload");
  const [file, setFile]             = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setParseError("");
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setParseError("Please select a .csv file.");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setParseError("No data rows found — make sure the CSV has a header row and at least one data row.");
        return;
      }
      setParsedRows(rows);
      setStep("preview");
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const validRows   = parsedRows.filter(r => !r._error);
  const invalidRows = parsedRows.filter(r =>  r._error);

  const handleSubmit = async () => {
    if (!file || validRows.length === 0) return;
    setSubmitting(true);
    try {
      const res = await risksApi.bulkImport(file);
      setResult(res.data);
      setStep("results");
      if (res.data.created > 0) onImported();
    } catch (err: any) {
      setParseError(err?.response?.data?.detail ?? "Import failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <ArrowUpTrayIcon className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Bulk Import Risks</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === "upload"  && "Upload a CSV file to create many risks at once"}
                {step === "preview" && `${parsedRows.length} rows parsed · ${validRows.length} ready · ${invalidRows.length} with errors`}
                {step === "results" && `Import complete`}
              </p>
            </div>
          </div>
          <button onClick={onClose}>
            <XMarkIcon className="w-5 h-5 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* ── Step indicator ── */}
        <div className="flex items-center gap-0 px-6 pt-4 shrink-0">
          {(["upload", "preview", "results"] as Step[]).map((s, idx) => (
            <div key={s} className="flex items-center gap-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? "bg-blue-600 text-white"
                : (step === "preview" && s === "upload") || (step === "results") ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-500"
              }`}>
                {((step === "preview" && s === "upload") || step === "results") && s !== "results"
                  ? "✓"
                  : idx + 1}
              </div>
              <span className={`ml-1.5 text-xs font-medium capitalize ${step === s ? "text-blue-600" : "text-gray-400"}`}>
                {s}
              </span>
              {idx < 2 && <div className="w-8 h-px bg-gray-200 mx-2" />}
            </div>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── UPLOAD step ── */}
          {step === "upload" && (
            <div className="space-y-5">
              {/* Template download */}
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <DocumentTextIcon className="w-8 h-8 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">Start with our template</p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Includes all supported columns and 3 example rows
                    </p>
                  </div>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 text-sm font-medium text-blue-700 border border-blue-200 bg-white px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Download template
                </button>
              </div>

              {/* Column reference */}
              <details className="group">
                <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 list-none flex items-center gap-1">
                  <span className="group-open:rotate-90 inline-block transition-transform">▶</span>
                  Column reference
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs border border-gray-100 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide">Column</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide">Required</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-500 uppercase tracking-wide">Values / Default</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        ["name",                 "✓",  "Free text"],
                        ["description",          "",   "Free text"],
                        ["likelihood",           "",   "1–5 (default: 3)"],
                        ["impact",               "",   "1–5 (default: 3)"],
                        ["residual_likelihood",  "",   "1–5"],
                        ["residual_impact",      "",   "1–5"],
                        ["treatment",            "",   "mitigate | accept | transfer | avoid (default: mitigate)"],
                        ["status",               "",   "new | unmanaged | managed_with_dates | managed_without_dates | closed (default: new)"],
                        ["owner",                "",   "Free text"],
                        ["managed_start_date",   "",   "YYYY-MM-DD"],
                        ["managed_end_date",     "",   "YYYY-MM-DD"],
                      ].map(([col, req, hint]) => (
                        <tr key={col} className="hover:bg-gray-50">
                          <td className="px-3 py-1.5 font-mono text-gray-700">{col}</td>
                          <td className="px-3 py-1.5 text-center">{req && <span className="text-red-500 font-bold">{req}</span>}</td>
                          <td className="px-3 py-1.5 text-gray-500">{hint}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                }`}
              >
                <ArrowUpTrayIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  {isDragging ? "Drop it!" : "Drag & drop your CSV here"}
                </p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  <ExclamationTriangleIcon className="w-4 h-4 mt-0.5 shrink-0" />
                  {parseError}
                </div>
              )}
            </div>
          )}

          {/* ── PREVIEW step ── */}
          {step === "preview" && (
            <div className="space-y-4">
              {invalidRows.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-sm font-medium text-amber-800 mb-1">
                    {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} have validation errors and will be skipped
                  </p>
                  <ul className="text-xs text-amber-700 space-y-0.5">
                    {invalidRows.map(r => (
                      <li key={r.rowNum}>Row {r.rowNum}{r.name ? ` (${r.name})` : ""}: {r._error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validRows.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2 text-amber-400" />
                  <p className="font-medium text-gray-600">No valid rows to import.</p>
                  <p className="text-sm mt-1">Fix the errors above and re-upload.</p>
                  <button onClick={() => setStep("upload")} className="mt-3 text-sm text-blue-600 hover:underline">
                    ← Back to upload
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase tracking-wide">#</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase tracking-wide">Name</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase tracking-wide">Score</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase tracking-wide">Treatment</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase tracking-wide">Status</th>
                        <th className="text-left px-3 py-2 text-gray-400 font-semibold uppercase tracking-wide">Owner</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {validRows.map(r => (
                        <tr key={r.rowNum} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400">{r.rowNum}</td>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-900 truncate max-w-[240px]">{r.name}</p>
                            {r.description && (
                              <p className="text-gray-400 truncate max-w-[240px] mt-0.5">{r.description}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">{scoreChip(r.likelihood, r.impact)}</td>
                          <td className="px-3 py-2 text-gray-600 capitalize">{r.treatment}</td>
                          <td className="px-3 py-2 text-gray-600">{r.status.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2 text-gray-600">{r.owner || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── RESULTS step ── */}
          {step === "results" && result && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
                  <CheckCircleIcon className="w-8 h-8 text-green-500 mx-auto mb-1" />
                  <p className="text-3xl font-bold text-green-700">{result.created}</p>
                  <p className="text-sm text-green-600 mt-0.5">risk{result.created !== 1 ? "s" : ""} created</p>
                </div>
                <div className={`${result.errors.length > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"} border rounded-xl p-5 text-center`}>
                  <ExclamationTriangleIcon className={`w-8 h-8 mx-auto mb-1 ${result.errors.length > 0 ? "text-red-400" : "text-gray-300"}`} />
                  <p className={`text-3xl font-bold ${result.errors.length > 0 ? "text-red-700" : "text-gray-400"}`}>{result.errors.length}</p>
                  <p className={`text-sm mt-0.5 ${result.errors.length > 0 ? "text-red-600" : "text-gray-400"}`}>
                    row{result.errors.length !== 1 ? "s" : ""} failed
                  </p>
                </div>
              </div>

              {/* Error detail */}
              {result.errors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Failed rows</p>
                  <div className="bg-red-50 border border-red-100 rounded-lg divide-y divide-red-100 max-h-48 overflow-y-auto">
                    {result.errors.map(e => (
                      <div key={e.row} className="px-4 py-2.5 text-sm">
                        <span className="font-medium text-red-700">Row {e.row}</span>
                        {e.name && <span className="text-red-600"> — {e.name}</span>}
                        <p className="text-xs text-red-500 mt-0.5">{e.error}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Success list */}
              {result.created > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Created risks</p>
                  <div className="bg-green-50 border border-green-100 rounded-lg divide-y divide-green-100 max-h-48 overflow-y-auto">
                    {result.created_items.map(item => (
                      <div key={item.id} className="px-4 py-2.5 text-sm flex items-center gap-2">
                        <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="font-medium text-gray-900">{item.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">ID {item.id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <div>
            {step === "preview" && (
              <button
                onClick={() => { setStep("upload"); setParseError(""); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              {step === "results" ? "Close" : "Cancel"}
            </button>

            {step === "preview" && validRows.length > 0 && (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Importing…
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="w-4 h-4" />
                    Import {validRows.length} risk{validRows.length !== 1 ? "s" : ""}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
