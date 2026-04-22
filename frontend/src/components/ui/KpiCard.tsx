import type { ReactNode } from "react";
import { KPI_BORDER, type KpiScheme } from "@/lib/design-tokens";

interface TrendProps {
  value: number;   // positive = up, negative = down
  label?: string;
}

interface Props {
  label: string;
  value: number | string;
  sub?: string;
  colorScheme?: KpiScheme;
  trend?: TrendProps;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export default function KpiCard({
  label,
  value,
  sub,
  colorScheme = "neutral",
  trend,
  icon,
  href,
  onClick,
}: Props) {
  const border = KPI_BORDER[colorScheme];

  const inner = (
    <div
      className={`
        bg-white rounded-xl border border-gray-100 border-l-4 ${border}
        p-5 shadow-sm flex flex-col gap-1
        ${onClick || href ? "cursor-pointer hover:shadow-md transition-shadow duration-150" : ""}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight">
          {label}
        </p>
        {icon && (
          <div className="text-gray-400 shrink-0">{icon}</div>
        )}
      </div>
      <p className="text-4xl font-bold tracking-tight text-gray-900 leading-none mt-1">
        {value}
      </p>
      {sub && (
        <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
      )}
      {trend && (
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-xs font-medium ${trend.value >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}
          </span>
          {trend.label && (
            <span className="text-xs text-gray-400">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return <a href={href} className="block">{inner}</a>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className="block w-full text-left">{inner}</button>;
  }
  return inner;
}
