import { FRAMEWORK_BADGE } from "@/lib/design-tokens";

export default function FrameworkBadge({ framework, version, className = "" }: {
  framework: string;
  version?: string;
  className?: string;
}) {
  const classes = FRAMEWORK_BADGE[framework] ?? "bg-gray-100 text-gray-600";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${classes} ${className}`}
    >
      {framework}
      {version && <span className="font-normal opacity-70">{version}</span>}
    </span>
  );
}
