"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, clearSession } from "@/lib/auth";
import clsx from "clsx";
import {
  HomeIcon,
  ShieldCheckIcon,
  ClipboardDocumentListIcon,
  PaperClipIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
  ServerStackIcon,
  BoltIcon,
  ScaleIcon,
  DocumentCheckIcon,
  ArchiveBoxXMarkIcon,
  ShieldExclamationIcon,
  Cog6ToothIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

const nav = [
  { href: "/dashboard",    label: "Dashboard",        icon: HomeIcon },
  { href: "/controls",     label: "Control Library",  icon: ShieldCheckIcon },
  { href: "/sox",          label: "SOX Scoping",      icon: DocumentCheckIcon },
  { href: "/test-cycles",  label: "Test Cycles",      icon: ClipboardDocumentListIcon },
  { href: "/evidence",     label: "Evidence",         icon: PaperClipIcon },
  { href: "/deficiencies", label: "Deficiencies",     icon: ExclamationTriangleIcon },
  { href: "/exceptions",   label: "Exceptions",       icon: ArchiveBoxXMarkIcon },
  { href: "/approvals",    label: "My Approvals",     icon: ShieldExclamationIcon },
];

const riskNav = [
  { href: "/assets",       label: "Assets",        icon: ServerStackIcon  },
  { href: "/threats",      label: "Threats",        icon: BoltIcon         },
  { href: "/risks",        label: "Risks",          icon: ScaleIcon        },
  { href: "/risk-reviews", label: "Risk Reviews",   icon: CalendarDaysIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  return (
    <aside className="flex flex-col w-64 bg-brand-900 text-white min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-brand-700">
        <p className="text-lg font-bold tracking-tight">GRC Demo</p>
        <p className="text-xs text-blue-300 mt-0.5">Control Testing Platform</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-brand-600 text-white"
                : "text-blue-100 hover:bg-brand-700"
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Admin Settings section */}
        {user?.role === "admin" && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Settings
              </p>
            </div>
            {[
              { href: "/settings/users",     label: "Users",             icon: ShieldCheckIcon  },
              { href: "/settings/approvals", label: "Approval Policies", icon: Cog6ToothIcon    },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "bg-brand-600 text-white"
                    : "text-blue-100 hover:bg-brand-700"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}

        {/* Risk Management section */}
        <div className="pt-4 pb-1">
          <p className="px-3 text-xs font-semibold text-blue-400 uppercase tracking-wider">
            Risk Management
          </p>
        </div>
        {riskNav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-brand-600 text-white"
                : "text-blue-100 hover:bg-brand-700"
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* User footer */}
      {user && (
        <div className="px-4 py-4 border-t border-brand-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-sm font-bold uppercase">
              {user.display_name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.display_name}</p>
              <p className="text-xs text-blue-300 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-blue-300 hover:text-white transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
