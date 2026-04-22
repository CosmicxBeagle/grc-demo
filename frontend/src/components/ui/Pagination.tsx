"use client";

/**
 * Reusable pagination footer.
 *
 * Handles:
 *  - "Showing X–Y of Z items" label
 *  - Rows-per-page selector (25 / 50 / 100)
 *  - Page number buttons with ellipsis for large page counts
 *  - Prev / Next buttons
 *
 * The parent manages `page` and `pageSize` state; this component just fires
 * callbacks when the user interacts.
 *
 * Usage:
 *   <Pagination
 *     total={filtered.length}
 *     page={page}
 *     pageSize={pageSize}
 *     onPageChange={setPage}
 *     onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
 *     itemLabel="deficiency"        // optional — shown in the count string
 *   />
 */

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  itemLabel?: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export default function Pagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = "item",
}: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const plural = total !== 1 ? `${itemLabel}s` : itemLabel;

  // Build page number list: always show first, last, current ±1, with "…" gaps
  const pageNumbers: (number | "…")[] = [];
  const raw = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  raw.forEach((p, i) => {
    if (i > 0 && p - (raw[i - 1] as number) > 1) pageNumbers.push("…");
    pageNumbers.push(p);
  });

  if (total === 0) return null;

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
      {/* Left: count + rows-per-page */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span>
          Showing {from}–{to} of {total} {plural}
        </span>
        <span className="text-gray-300">|</span>
        <label className="flex items-center gap-1.5">
          Rows per page
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="border border-gray-200 rounded px-1.5 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Right: page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-2.5 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>

          {pageNumbers.map((p, i) =>
            p === "…" ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400 select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p as number)}
                className={`px-2.5 py-1 text-xs border rounded-md transition-colors ${
                  page === p
                    ? "bg-blue-600 text-white border-blue-600 font-medium"
                    : "border-gray-300 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-2.5 py-1 text-xs border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
