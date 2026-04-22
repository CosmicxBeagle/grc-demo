"use client";
import type { RiskStatus } from "@/types";

export const RISK_STATUS_META: {
  value: RiskStatus;
  label: string;
  activeClass: string;
  dotClass: string;
}[] = [
  {
    value: "new",
    label: "New",
    activeClass: "bg-blue-600 text-white border-blue-600",
    dotClass: "bg-blue-400",
  },
  {
    value: "unmanaged",
    label: "Unmanaged",
    activeClass: "bg-red-600 text-white border-red-600",
    dotClass: "bg-red-400",
  },
  {
    value: "managed_with_dates",
    label: "Managed ✓",
    activeClass: "bg-green-600 text-white border-green-600",
    dotClass: "bg-green-400",
  },
  {
    value: "managed_without_dates",
    label: "Managed",
    activeClass: "bg-teal-600 text-white border-teal-600",
    dotClass: "bg-teal-400",
  },
  {
    value: "closed",
    label: "Closed",
    activeClass: "bg-gray-500 text-white border-gray-500",
    dotClass: "bg-gray-400",
  },
];

export const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  new: "New",
  unmanaged: "Unmanaged",
  managed_with_dates: "Managed ✓",
  managed_without_dates: "Managed",
  closed: "Closed",
};

export const RISK_STATUS_BADGE: Record<RiskStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  unmanaged: "bg-red-100 text-red-800",
  managed_with_dates: "bg-green-100 text-green-800",
  managed_without_dates: "bg-teal-100 text-teal-800",
  closed: "bg-gray-100 text-gray-500",
};

interface Props {
  selected: RiskStatus[];
  onChange: (statuses: RiskStatus[]) => void;
  counts: Record<string, number>;
  total: number;
}

export default function RiskStatusFilter({ selected, onChange, counts, total }: Props) {
  const allSelected = selected.length === 0;

  const toggle = (status: RiskStatus) => {
    if (selected.includes(status)) {
      onChange(selected.filter((s) => s !== status));
    } else {
      onChange([...selected, status]);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* All chip */}
      <button
        onClick={() => onChange([])}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
          allSelected
            ? "bg-gray-800 text-white border-gray-800"
            : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
        }`}
      >
        All <span className="opacity-70">({total})</span>
      </button>

      {RISK_STATUS_META.map((meta) => {
        const isActive = selected.includes(meta.value);
        const count = counts[meta.value] ?? 0;
        return (
          <button
            key={meta.value}
            onClick={() => toggle(meta.value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              isActive
                ? meta.activeClass
                : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
            }`}
          >
            {!isActive && (
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
            )}
            {meta.label}
            <span className={isActive ? "opacity-70" : "text-gray-400"}>({count})</span>
          </button>
        );
      })}
    </div>
  );
}
