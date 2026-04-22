/**
 * ExpiryIndicator — shows how many days until a date, color-coded by urgency.
 *
 * ≤ 7 days  → red   (critical)
 * ≤ 30 days → amber (warning)
 * > 30 days → gray  (neutral)
 * expired   → slate (muted)
 */

interface Props {
  /** ISO date string or date-only string (YYYY-MM-DD) */
  expiresAt: string | null | undefined;
  /** If true, renders nothing when no date is provided */
  hideIfEmpty?: boolean;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now    = new Date();
  // Strip time for day-level comparison
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

export default function ExpiryIndicator({ expiresAt, hideIfEmpty = false }: Props) {
  if (!expiresAt) return hideIfEmpty ? null : <span className="text-xs text-gray-400">—</span>;

  const days = daysUntil(expiresAt);

  if (days < 0) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-500">
        Expired {Math.abs(days)}d ago
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
        Expires today
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
        Expires in {days}d
      </span>
    );
  }
  if (days <= 30) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
        Expires in {days}d
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-400">{days}d left</span>
  );
}
