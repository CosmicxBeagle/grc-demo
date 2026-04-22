import type { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  /** Pass className to override max-width/padding if needed */
  className?: string;
}

export default function PageHeader({ title, subtitle, actions, className = "" }: Props) {
  return (
    <div className={`flex items-center justify-between gap-4 pb-5 border-b border-gray-100 mb-6 ${className}`}>
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
