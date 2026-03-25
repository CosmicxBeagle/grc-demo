import clsx from "clsx";

const STYLES: Record<string, string> = {
  PCI:  "bg-purple-100 text-purple-700",
  NIST: "bg-cyan-100 text-cyan-700",
  CIS:  "bg-orange-100 text-orange-700",
  SOX:  "bg-rose-100 text-rose-700",
};

export default function FrameworkBadge({ framework, version }: { framework: string; version?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold",
        STYLES[framework] ?? "bg-gray-100 text-gray-600"
      )}
    >
      {framework}
      {version && <span className="font-normal opacity-70">{version}</span>}
    </span>
  );
}
