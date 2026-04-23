"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import type { AuthConfigResponse } from "@/lib/api";
import { saveDemoSession } from "@/lib/auth";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";

// ── Demo users (local mode only) ──────────────────────────────────────────────

const DEMO_USERS = [
  { username: "alice@example.com", label: "Alice Admin",    role: "admin"        },
  { username: "grace@example.com", label: "Grace Manager",  role: "grc_manager"  },
  { username: "henry@example.com", label: "Henry Analyst",  role: "grc_analyst"  },
  { username: "bob@example.com",   label: "Bob Tester",     role: "tester"       },
  { username: "carol@example.com", label: "Carol Tester",   role: "tester"       },
  { username: "dave@example.com",  label: "Dave Reviewer",  role: "reviewer"     },
  { username: "erin@example.com",  label: "Erin Reviewer",  role: "reviewer"     },
  { username: "frank@example.com", label: "Frank Owner",    role: "risk_owner"   },
];

// ── Page ──────────────────────────────────────────────────────────────────────

function LoginPageInner() {
  const searchParams   = useSearchParams();
  const redirectTo     = searchParams.get("redirect") || "/dashboard";
  const sessionExpired = searchParams.get("reason") === "expired";

  const [config,  setConfig]  = useState<AuthConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Load auth config from backend on mount
  useEffect(() => {
    authApi.config()
      .then(r => setConfig(r.data))
      .catch(() => setConfig({ mode: "disabled", entra_enabled: false, okta_enabled: false, demo_enabled: false }));
  }, []);

  const finish = (token: string, user: any) => {
    saveDemoSession(token, user);
    // Role-based landing: risk_owner → My Work, everyone else → requested page
    const dest = user?.role === "risk_owner" ? "/my-work" : redirectTo;
    window.location.href = dest; // hard navigate to flush any stale state
  };

  // ── Demo login ────────────────────────────────────────────────────────────

  const demoLogin = async (username: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(username);
      finish(res.data.access_token, res.data.user);
    } catch {
      setError("Login failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  // ── Okta login ────────────────────────────────────────────────────────────
  // Backend handles the full OIDC redirect flow (GET /auth/okta/login).
  // Entra ID is federated through Okta — no separate Microsoft/MSAL flow needed.
  // After Okta validates the user, it sets a session cookie and redirects back.

  const oktaLogin = () => {
    const returnTo = encodeURIComponent(redirectTo);
    window.location.href = `/api/v1/auth/okta/login?return_to=${returnTo}`;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isIdpMode  = config?.mode === "idp";
  const isDemoMode = config?.mode === "demo";

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <ShieldCheckIcon className="w-12 h-12 text-brand-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">GRC Platform</h1>
          <p className="text-sm text-gray-500 mt-1">Control Testing &amp; Compliance</p>
        </div>

        {/* Session expired banner */}
        {sessionExpired && (
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Your session expired. Please sign in again.
          </div>
        )}

        {/* Loading config */}
        {!config && (
          <p className="text-sm text-center text-gray-400">Loading…</p>
        )}

        {/* IdP mode — single Okta button (covers Entra via federation) */}
        {config && isIdpMode && (
          <div className="space-y-3">
            <p className="text-sm text-center text-gray-500 mb-4">
              Sign in with your corporate account
            </p>
            <button
              onClick={oktaLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium text-sm"
            >
              {/* Okta logo mark */}
              <svg width="20" height="20" viewBox="0 0 40 40" aria-hidden="true">
                <circle cx="20" cy="20" r="20" fill="#007DC1"/>
                <circle cx="20" cy="20" r="9" fill="white"/>
              </svg>
              {loading ? "Signing in…" : "Sign in with your company account"}
            </button>
            <p className="text-xs text-center text-gray-400 mt-2">
              Uses your existing company credentials
            </p>
          </div>
        )}

        {/* Demo mode — user picker */}
        {config && isDemoMode && (
          <>
            <p className="text-sm text-center text-gray-500 mb-6">
              Select a demo user to log in — no password required
            </p>
            <div className="space-y-2">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.username}
                  onClick={() => demoLogin(u.username)}
                  disabled={loading}
                  className="w-full flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 hover:bg-brand-50 hover:border-brand-300 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold uppercase">
                      {u.label[0]}
                    </div>
                    <span className="font-medium text-sm">{u.label}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {u.role.replace(/_/g, " ")}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-6 text-xs text-center text-gray-400">
              Local demo — auth is a username-only bypass
            </p>
          </>
        )}

        {config && config.mode === "disabled" && (
          <p className="text-sm text-center text-gray-500">
            Authentication is not configured. Contact your administrator.
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
