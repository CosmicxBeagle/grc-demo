/**
 * Frontend telemetry — structured error and event tracking.
 *
 * Three modes, selected automatically:
 *
 *  "console"    — development (NODE_ENV !== "production")
 *                 Logs everything to the browser console. Zero network calls.
 *
 *  "backend"    — production default
 *                 POSTs errors to /api/v1/telemetry/errors so the backend can
 *                 forward them to Application Insights / structured logs.
 *                 Falls back silently if the endpoint is unavailable.
 *
 *  "appinsights" — future / direct Azure wiring
 *                 When NEXT_PUBLIC_APPINSIGHTS_KEY is set, ships directly to
 *                 Azure Application Insights via the JS SDK (not yet installed).
 *                 Placeholder ready for when Codex wires up the Azure side.
 *
 * Privacy rules:
 *  - Never send email addresses, display names, or any PII.
 *  - User role is safe (it's a system label, not personal data).
 *  - Session ID is a random UUID generated at page load, not tied to identity.
 */

import { getUser } from "./auth";

// ── Session ID ────────────────────────────────────────────────────────────────
// A random ID that lives for the duration of the browser session.
// Lets us group all errors from one user visit together in logs.
function makeSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const SESSION_ID: string =
  (typeof sessionStorage !== "undefined" && sessionStorage.getItem("grc_session_id")) ||
  (() => {
    const id = makeSessionId();
    try { sessionStorage.setItem("grc_session_id", id); } catch { /* ignore */ }
    return id;
  })();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ErrorPayload {
  message: string;
  stack?: string;
  component?: string;       // which React component boundary caught it
  request_id?: string;      // correlation ID from the API call, if relevant
  url: string;
  user_role?: string;       // safe to send — not PII
  session_id: string;
  timestamp: string;
  severity: "error" | "warning" | "info";
}

// ── Mode detection ────────────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV !== "production";
const HAS_APPINSIGHTS = !!process.env.NEXT_PUBLIC_APPINSIGHTS_KEY;

// ── Core track function ───────────────────────────────────────────────────────

async function send(payload: ErrorPayload): Promise<void> {
  if (IS_DEV) {
    // In development just log — no network noise
    console.error(
      `[telemetry:${payload.severity}]`,
      payload.component ? `<${payload.component}>` : payload.url,
      payload.message,
      payload.stack ?? ""
    );
    return;
  }

  if (HAS_APPINSIGHTS) {
    // Future: wire up @microsoft/applicationinsights-web here
    // const appInsights = getAppInsightsClient();
    // appInsights.trackException({ exception: new Error(payload.message), ... });
    console.warn("[telemetry] AppInsights key found but SDK not yet configured.");
  }

  // Default production mode: POST to backend, which forwards to structured logs
  try {
    await fetch(
      "/api/v1/telemetry/errors",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        // Use keepalive so the request completes even if the page is unloading
        keepalive: true,
      }
    );
  } catch {
    // Telemetry must never throw — silently swallow network failures
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Report a caught or uncaught error.
 * Call this from ErrorBoundary, API error handlers, etc.
 */
export function trackError(
  error: Error | string,
  options: { component?: string; request_id?: string; severity?: "error" | "warning" } = {}
): void {
  const user = getUser();
  const msg = typeof error === "string" ? error : error.message;
  const stack = typeof error === "string" ? undefined : error.stack;

  send({
    message: msg,
    stack,
    component: options.component,
    request_id: options.request_id,
    url: typeof window !== "undefined" ? window.location.href : "",
    user_role: user?.role,
    session_id: SESSION_ID,
    timestamp: new Date().toISOString(),
    severity: options.severity ?? "error",
  });
}

/**
 * Track a page view. Call this from a top-level layout or route change handler.
 * Useful for understanding which pages are most used and where errors cluster.
 */
export function trackPageView(path: string): void {
  if (IS_DEV) {
    console.debug("[telemetry:pageview]", path);
    return;
  }
  // POST page view event — low priority, fire and forget
  fetch(
    "/api/v1/telemetry/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "page_view",
        path,
        session_id: SESSION_ID,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }
  ).catch(() => {});
}

/**
 * Track an arbitrary named event (e.g. "bulk_assign_applied", "export_triggered").
 * Useful for understanding feature usage without full analytics infrastructure.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>
): void {
  if (IS_DEV) {
    console.debug("[telemetry:event]", name, properties ?? "");
    return;
  }
  fetch(
    "/api/v1/telemetry/events",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: name,
        properties,
        session_id: SESSION_ID,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }
  ).catch(() => {});
}
