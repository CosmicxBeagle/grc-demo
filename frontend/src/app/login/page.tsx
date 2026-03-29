"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";

// MSAL for Entra ID (loaded only when configured)
import { msalEnabled, msalInstance, loginRequest } from "@/lib/msal-config";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthConfig {
  mode:           "demo" | "idp";
  entra_enabled:  boolean;
  okta_enabled:   boolean;
  azure_client_id?: string;
  azure_tenant_id?: string;
  okta_domain?:     string;
  okta_client_id?:  string;
}

// ── Demo users (local mode only) ──────────────────────────────────────────────

const DEMO_USERS = [
  { username: "alice@example.com", label: "Alice Admin",    role: "admin"       },
  { username: "bob@example.com",   label: "Bob Tester",     role: "tester"      },
  { username: "carol@example.com", label: "Carol Tester",   role: "tester"      },
  { username: "dave@example.com",  label: "Dave Reviewer",  role: "reviewer"    },
  { username: "erin@example.com",  label: "Erin Reviewer",  role: "reviewer"    },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [config,  setConfig]  = useState<AuthConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // Load auth config from backend on mount
  useEffect(() => {
    authApi.config()
      .then(r => setConfig(r.data))
      .catch(() => setConfig({ mode: "demo", entra_enabled: false, okta_enabled: false }));
  }, []);

  // Initialize MSAL when Entra is enabled
  useEffect(() => {
    if (msalEnabled && msalInstance) {
      msalInstance.initialize().catch(console.error);
    }
  }, []);

  const finish = (token: string, user: any) => {
    saveSession(token, user);
    router.push("/dashboard");
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

  // ── Entra ID login ────────────────────────────────────────────────────────

  const entraLogin = async () => {
    if (!msalInstance) return;
    setLoading(true);
    setError("");
    try {
      const result = await msalInstance.loginPopup(loginRequest);
      const res = await authApi.azureLogin(result.accessToken);
      finish(res.data.access_token, res.data.user);
    } catch (err: any) {
      if (err?.errorCode === "user_cancelled") {
        setError("Sign-in was cancelled.");
      } else {
        setError("Microsoft sign-in failed.");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Okta login ────────────────────────────────────────────────────────────

  const oktaLogin = async () => {
    if (!config?.okta_domain || !config?.okta_client_id) return;
    setLoading(true);
    setError("");
    try {
      // Dynamic import so @okta/okta-auth-js is only loaded when needed
      const { OktaAuth } = await import("@okta/okta-auth-js");
      const oktaAuth = new OktaAuth({
        issuer:   `https://${config.okta_domain}/oauth2/default`,
        clientId: config.okta_client_id,
        redirectUri: window.location.origin + "/login/okta-callback",
        scopes: ["openid", "profile", "email"],
      });
      // Use popup flow (same UX as MSAL)
      const tokens = await oktaAuth.token.getWithPopup({
        responseType: ["token", "id_token"],
      });
      const accessToken = tokens.tokens.accessToken?.accessToken;
      if (!accessToken) throw new Error("No access token returned");
      const res = await authApi.oktaLogin(accessToken);
      finish(res.data.access_token, res.data.user);
    } catch (err: any) {
      if (err?.name === "OAuthError" && err?.message?.includes("cancel")) {
        setError("Sign-in was cancelled.");
      } else {
        setError("Okta sign-in failed.");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const isIdpMode = config?.mode === "idp";

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">

        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <ShieldCheckIcon className="w-12 h-12 text-brand-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">GRC Platform</h1>
          <p className="text-sm text-gray-500 mt-1">Control Testing &amp; Compliance</p>
        </div>

        {/* Loading config */}
        {!config && (
          <p className="text-sm text-center text-gray-400">Loading…</p>
        )}

        {/* IdP mode — show SSO buttons */}
        {config && isIdpMode && (
          <div className="space-y-3">
            <p className="text-sm text-center text-gray-500 mb-4">
              Sign in with your corporate account
            </p>

            {config.entra_enabled && (
              <button
                onClick={entraLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 px-4 py-3 hover:bg-gray-50 transition-colors disabled:opacity-50 font-medium text-sm"
              >
                {/* Microsoft logo */}
                <svg width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
                  <rect x="1"  y="1"  width="9" height="9" fill="#f25022"/>
                  <rect x="11" y="1"  width="9" height="9" fill="#7fba00"/>
                  <rect x="1"  y="11" width="9" height="9" fill="#00a4ef"/>
                  <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                </svg>
                {loading ? "Signing in…" : "Sign in with Microsoft"}
              </button>
            )}

            {config.okta_enabled && (
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
                {loading ? "Signing in…" : "Sign in with Okta"}
              </button>
            )}
          </div>
        )}

        {/* Demo mode — show user picker */}
        {config && !isIdpMode && (
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
                  <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-6 text-xs text-center text-gray-400">
              Local demo — auth is a username-only bypass
            </p>
          </>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
