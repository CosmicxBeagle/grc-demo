import { SEVERITY_BADGE, type Severity } from "@/lib/design-tokens";

const LABELS: Record<Severity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
  info:     "Info",
};

interface Props {
  severity: Severity | string;
  className?: string;
}

export default function SeverityBadge({ severity, className = "" }: Props) {
  const key = severity as Severity;
  const classes = SEVERITY_BADGE[key] ?? "bg-gray-100 text-gray-600";
  const label   = LABELS[key] ?? (severity.charAt(0).toUpperCase() + severity.slice(1));

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes} ${className}`}
    >
      {label}
    </span>
  );
}
