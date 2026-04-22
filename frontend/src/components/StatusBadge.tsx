import { STATUS_BADGE, STATUS_LABEL, type AppStatus } from "@/lib/design-tokens";

export default function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const classes = STATUS_BADGE[status as AppStatus] ?? "bg-gray-100 text-gray-600";
  const label   = STATUS_LABEL[status as AppStatus] ?? (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "));

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes} ${className}`}
    >
      {label}
    </span>
  );
}
