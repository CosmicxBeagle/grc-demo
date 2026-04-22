"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getUser, clearSession } from "@/lib/auth";
import { authApi } from "@/lib/api";
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
  Cog6ToothIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  UsersIcon,
  BriefcaseIcon,
} from "@heroicons/react/24/outline";

const nav = [
  { href: "/my-work",      label: "My Work",          icon: BriefcaseIcon },
  { href: "/dashboard",    label: "Dashboard",        icon: HomeIcon },
  { href: "/controls",     label: "Control Library",  icon: ShieldCheckIcon },
  { href: "/sox",          label: "SOX Scoping",      icon: DocumentCheckIcon },
  { href: "/test-cycles",  label: "Test Cycles",      icon: ClipboardDocumentListIcon },
  { href: "/evidence",     label: "Evidence",         icon: PaperClipIcon },
  { href: "/deficiencies", label: "Deficiencies",     icon: ExclamationTriangleIcon },
  { href: "/exceptions",   label: "Exceptions",       icon: ArchiveBoxXMarkIcon },
];

const riskNav = [
  { href: "/assets",       label: "Assets",        icon: ServerStackIcon  },
  { href: "/threats",      label: "Threats",       icon: BoltIcon         },
  { href: "/risks",        label: "Risks",         icon: ScaleIcon        },
  { href: "/risk-reviews", label: "Risk Reviews",  icon: CalendarDaysIcon },
];

function NavLink({ href, label, icon: Icon, active }: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-blue-600/90 text-white"
          : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {label}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-4 pb-1 border-t border-slate-700/50 mt-2">
      <p className="px-3 pt-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {children}
      </p>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getUser();

  const handleLogout = async () => {
    try {
      // Tell the server to clear the session cookie (Okta/cookie mode).
      // In demo/token mode the endpoint is a no-op but still returns 200.
      await authApi.logout();
    } catch {
      // If the server is unreachable, still log out locally.
    } finally {
      clearSession(); // clears demo token from sessionStorage if present
      router.push("/login");
    }
  };

  return (
    <aside className="flex flex-col w-64 bg-slate-800 text-white min-h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700/50">
        <p className="text-lg font-bold tracking-tight">GRC Demo</p>
        <p className="text-xs text-slate-400 mt-0.5">Control Testing Platform</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-0.5 overflow-y-auto">
        {user?.role === "risk_owner" ? (
          // Risk owners see only their work
          <>
            {[
              { href: "/my-work",      label: "My Work",      icon: BriefcaseIcon   },
              { href: "/risk-reviews", label: "Risk Reviews", icon: CalendarDaysIcon },
            ].map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
              />
            ))}
          </>
        ) : (
          // All other roles — full nav
          <>
            {nav.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
              />
            ))}

            {/* Risk Management section */}
            <SectionLabel>Risk Management</SectionLabel>
            {riskNav.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                active={pathname.startsWith(href)}
              />
            ))}

            {/* Admin section */}
            {user?.role === "admin" && (
              <>
                <SectionLabel>Admin</SectionLabel>
                {[
                  { href: "/audit-logs",         label: "Audit Trail",       icon: ClipboardDocumentCheckIcon },
                  { href: "/settings/users",     label: "Users",             icon: UsersIcon                  },
                  { href: "/settings/approvals", label: "Approval Policies", icon: Cog6ToothIcon              },
                ].map(({ href, label, icon }) => (
                  <NavLink
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    active={pathname.startsWith(href)}
                  />
                ))}
              </>
            )}
          </>
        )}
      </nav>

      {/* User footer */}
      {user && (
        <div className="px-4 py-4 border-t border-slate-700/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold uppercase">
              {user.display_name[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user.display_name}</p>
              <p className="text-xs text-slate-400 capitalize">{user.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
