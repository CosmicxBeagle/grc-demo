"use client";

/**
 * TelemetryProvider — mounts global error handlers for the browser session.
 *
 * Catches two categories of errors that React's ErrorBoundary cannot:
 *
 * 1. window.onerror — synchronous JavaScript errors that happen outside of
 *    React's render cycle (e.g. in event listeners, setTimeout callbacks,
 *    third-party scripts).
 *
 * 2. unhandledrejection — Promise rejections that nobody caught with .catch().
 *    These are silent failures in production and very hard to diagnose without
 *    explicit capture.
 *
 * Mount this once at the root layout. It renders no UI — it's purely a
 * side-effect component.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackError, trackPageView } from "@/lib/telemetry";

export default function TelemetryProvider() {
  // ── Global error handler ───────────────────────────────────────────────────
  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      // Ignore cross-origin script errors (they have no useful detail anyway)
      if (event.message === "Script error.") return;

      trackError(
        event.error instanceof Error ? event.error : new Error(event.message),
        { component: "window.onerror" }
      );
    };

    // ── Unhandled promise rejection handler ──────────────────────────────────
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error =
        reason instanceof Error
          ? reason
          : new Error(typeof reason === "string" ? reason : "Unhandled promise rejection");

      trackError(error, { component: "unhandledrejection" });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  // ── Page view tracking ─────────────────────────────────────────────────────
  // Fires whenever the route changes. Next.js App Router handles navigation
  // client-side, so there's no traditional page load event after the first one.
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);

  // Renders nothing — purely a side-effect component
  return null;
}
