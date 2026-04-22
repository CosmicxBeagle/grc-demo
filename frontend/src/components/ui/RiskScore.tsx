/**
 * RiskScore — compact colored chip displaying a numeric risk score.
 *
 * Score thresholds (mirrors scoreToSeverity in design-tokens):
 *  ≥ 20 → red    (critical)
 *  ≥ 15 → orange (high)
 *  ≥ 10 → amber  (medium)
 *   < 10 → green  (low)
 */

import { scoreToSeverity } from "@/lib/design-tokens";

const CHIP: Record<string, string> = {
  critical: "bg-red-100    text-red-700   ring-red-200",
  high:     "bg-orange-100 text-orange-700 ring-orange-200",
  medium:   "bg-amber-100  text-amber-700  ring-amber-200",
  low:      "bg-green-100  text-green-700  ring-green-200",
  info:     "bg-blue-100   text-blue-700   ring-blue-200",
};

interface Props {
  score: number | null | undefined;
  /** 'sm' = small pill (default), 'md' = slightly larger */
  size?: "sm" | "md";
  className?: string;
}

export default function RiskScore({ score, size = "sm", className = "" }: Props) {
  if (score == null) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  const severity = scoreToSeverity(score);
  const chip     = CHIP[severity] ?? CHIP.low;
  const sizeClass = size === "md"
    ? "px-2.5 py-1 text-sm font-bold min-w-[2.25rem]"
    : "px-2 py-0.5 text-xs font-semibold min-w-[1.75rem]";

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded
        ring-1 ring-inset
        ${chip} ${sizeClass} ${className}
      `}
    >
      {score}
    </span>
  );
}
