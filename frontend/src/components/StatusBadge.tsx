import clsx from "clsx";

const STATUS_STYLES: Record<string, string> = {
  // Assignment statuses
  not_started:   "bg-gray-100 text-gray-600",
  in_progress:   "bg-blue-100 text-blue-700",
  needs_review:  "bg-amber-100 text-amber-700",
  complete:      "bg-green-100 text-green-700",
  failed:        "bg-red-100 text-red-700",
  // Cycle statuses
  planned:       "bg-gray-100 text-gray-600",
  active:        "bg-blue-100 text-blue-700",
  completed:     "bg-green-100 text-green-700",
  // Control statuses
  inactive:      "bg-red-100 text-red-600",
};

const LABELS: Record<string, string> = {
  not_started:  "Not Started",
  in_progress:  "In Progress",
  needs_review: "Needs Review",
  complete:     "Complete",
  failed:       "Failed",
  planned:      "Planned",
  active:       "Active",
  completed:    "Completed",
  inactive:     "Inactive",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
