/**
 * Design tokens — single source of truth for all semantic colors.
 * Import these instead of declaring ad-hoc Tailwind classes in component files.
 *
 * IMPORTANT: Every class string must appear here in full so Tailwind JIT
 * includes them in the build — never construct class names dynamically.
 */

// ── Severity ──────────────────────────────────────────────────────────────────
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export const SEVERITY_BADGE: Record<Severity, string> = {
  critical: "bg-red-100 text-red-600",
  high:     "bg-orange-100 text-orange-600",
  medium:   "bg-amber-100 text-amber-700",
  low:      "bg-green-100 text-green-700",
  info:     "bg-blue-100 text-blue-700",
};

export const SEVERITY_BORDER: Record<Severity, string> = {
  critical: "border-l-red-600",
  high:     "border-l-orange-600",
  medium:   "border-l-amber-600",
  low:      "border-l-green-600",
  info:     "border-l-blue-600",
};

export const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-red-600",
  high:     "bg-orange-600",
  medium:   "bg-amber-600",
  low:      "bg-green-600",
  info:     "bg-blue-600",
};

export const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-red-600",
  high:     "text-orange-600",
  medium:   "text-amber-700",
  low:      "text-green-700",
  info:     "text-blue-700",
};

// Hex values for use in recharts / canvas contexts where Tailwind classes can't apply
export const SEVERITY_HEX: Record<Severity, string> = {
  critical: "#DC2626",
  high:     "#EA580C",
  medium:   "#D97706",
  low:      "#16A34A",
  info:     "#2563EB",
};

// ── Status ────────────────────────────────────────────────────────────────────
export type AppStatus =
  | "open" | "pending" | "pending_approval"
  | "approved" | "rejected" | "expired"
  | "in_remediation" | "draft"
  | "not_started" | "in_progress" | "needs_review" | "complete" | "failed"
  | "planned" | "active" | "completed" | "inactive";

export const STATUS_BADGE: Record<AppStatus, string> = {
  open:             "bg-amber-100 text-amber-700",
  pending:          "bg-blue-100 text-blue-700",
  pending_approval: "bg-blue-100 text-blue-700",
  approved:         "bg-green-100 text-green-700",
  rejected:         "bg-red-100 text-red-600",
  expired:          "bg-gray-100 text-gray-500",
  in_remediation:   "bg-orange-100 text-orange-700",
  draft:            "bg-gray-100 text-gray-600",
  not_started:      "bg-gray-100 text-gray-600",
  in_progress:      "bg-blue-100 text-blue-700",
  needs_review:     "bg-amber-100 text-amber-700",
  complete:         "bg-green-100 text-green-700",
  failed:           "bg-red-100 text-red-600",
  planned:          "bg-gray-100 text-gray-600",
  active:           "bg-blue-100 text-blue-700",
  completed:        "bg-green-100 text-green-700",
  inactive:         "bg-red-100 text-red-600",
};

export const STATUS_LABEL: Record<AppStatus, string> = {
  open:             "Open",
  pending:          "Pending",
  pending_approval: "Pending Approval",
  approved:         "Approved",
  rejected:         "Rejected",
  expired:          "Expired",
  in_remediation:   "In Remediation",
  draft:            "Draft",
  not_started:      "Not Started",
  in_progress:      "In Progress",
  needs_review:     "Needs Review",
  complete:         "Complete",
  failed:           "Failed",
  planned:          "Planned",
  active:           "Active",
  completed:        "Completed",
  inactive:         "Inactive",
};

// ── Frameworks ────────────────────────────────────────────────────────────────
export type Framework = "CIS" | "NIST" | "PCI" | "SOX";

export const FRAMEWORK_BADGE: Record<string, string> = {
  CIS:  "bg-teal-100 text-teal-700",
  NIST: "bg-blue-100 text-blue-700",
  PCI:  "bg-purple-100 text-purple-700",
  SOX:  "bg-orange-100 text-orange-700",
};

// Hex values for recharts bars
export const FRAMEWORK_HEX: Record<string, string> = {
  CIS:  "#0D9488", // teal-600
  NIST: "#2563EB", // blue-600
  PCI:  "#7C3AED", // violet-600
  SOX:  "#EA580C", // orange-600
};

// ── Risk score → severity ─────────────────────────────────────────────────────
export function scoreToSeverity(score: number): Severity {
  if (score >= 20) return "critical";
  if (score >= 15) return "high";
  if (score >= 10) return "medium";
  return "low";
}

// ── KpiCard accent border (left-4px) ─────────────────────────────────────────
export type KpiScheme = Severity | "neutral";

export const KPI_BORDER: Record<KpiScheme, string> = {
  critical: "border-l-red-600",
  high:     "border-l-orange-600",
  medium:   "border-l-amber-600",
  low:      "border-l-green-600",
  info:     "border-l-blue-600",
  neutral:  "border-l-gray-200",
};
