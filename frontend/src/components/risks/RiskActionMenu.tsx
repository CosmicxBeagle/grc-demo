"use client";
import { useRef, useState, useEffect } from "react";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";

interface Props {
  riskId: number;
  onViewDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
}

export default function RiskActionMenu({ riskId, onViewDetails, onEdit, onDelete, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Risk actions"
      >
        <EllipsisHorizontalIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 text-sm">
          <button
            onClick={() => { setOpen(false); onViewDetails(); }}
            className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Details
          </button>
          {canEdit && (
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full text-left px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Edit Risk
            </button>
          )}
          <a
            href={`/risk-reviews/history/${riskId}`}
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View History
          </a>
          {canEdit && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => { setOpen(false); onDelete(); }}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete Risk
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
