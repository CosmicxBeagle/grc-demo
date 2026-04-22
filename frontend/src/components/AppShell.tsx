"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isDemoSession, saveCookieSession, clearSession } from "@/lib/auth";
import { authApi } from "@/lib/api";
import Sidebar from "./Sidebar";
import ErrorBoundary from "./ErrorBoundary";

// Minimum time between background re-validation checks (ms).
// Prevents hammering the server when the user rapidly alt-tabs.
const REVALIDATE_INTERVAL_MS = 60_000;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const lastCheckRef = useRef<number>(0);

  // ── Initial auth check (runs on every navigation) ──────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      // Fast path: demo/local mode only.
      // The JWT token is self-validating — no network call needed.
      if (isDemoSession()) {
        setReady(true);
        return;
      }

      // All other cases — including cookie/Okta mode — must validate with
      // the server on every navigation.  The HttpOnly session cookie is sent
      // automatically by the browser (axios withCredentials: true).
      // This is what makes cookie sessions actually secure: a revoked or
      // expired cookie is caught immediately rather than relying on a stale
      // local value.
      try {
        const res = await authApi.me();
        saveCookieSession(res.data);
        setReady(true);
        lastCheckRef.current = Date.now();
      } catch {
        // No valid session — send to login
        clearSession();
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    };

    checkAuth();
  }, [router, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Tab-focus re-validation ─────────────────────────────────────────────
  // When the user returns to this tab after being away, silently re-check
  // the session.  Catches cases where an admin deactivated the account or
  // the server-side session was revoked while the tab was in the background.
  // Only needed for cookie sessions — demo sessions validate via token.
  useEffect(() => {
    if (!ready) return;
    if (isDemoSession()) return; // demo tokens are self-validating

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastCheckRef.current < REVALIDATE_INTERVAL_MS) return;
      lastCheckRef.current = now;

      try {
        const res = await authApi.me();
        saveCookieSession(res.data);
      } catch {
        clearSession();
        router.replace(`/login?reason=expired&redirect=${encodeURIComponent(pathname)}`);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [ready, router, pathname]);

  if (!ready) return null;

  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
    </div>
  );
}
