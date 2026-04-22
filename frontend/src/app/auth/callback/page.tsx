"use client";

/**
 * /auth/callback — Okta OIDC redirect landing page.
 *
 * Actual Okta OIDC flow (backend-redirect model built by Codex):
 *
 * 1. User clicks "Sign in with Okta" → frontend redirects to GET /api/v1/auth/okta/login
 * 2. Backend generates state, sets okta_oauth_state cookie, redirects to Okta
 * 3. User authenticates at Okta
 * 4. Okta redirects back to GET /api/v1/auth/okta/callback (backend)
 * 5. Backend validates state, exchanges code for token, creates session cookie,
 *    then redirects browser to APP_BASE_URL/dashboard
 *
 * This page is the frontend landing if the backend is configured to redirect
 * here instead of directly to /dashboard, OR if there's an error during auth
 * (e.g. user cancelled at Okta, invalid state, token exchange failure).
 *
 * On success: reads the session via /users/me, then routes based on role.
 * On error: shows a friendly message with a link back to login.
 */

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveCookieSession } from "@/lib/auth";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";

function CallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const returnTo = searchParams.get("return_to") || "/dashboard";
    const error = searchParams.get("error");

    // If Okta sent back an error (e.g. user cancelled), show it.
    if (error) {
      setStatus("error");
      setErrorMsg(searchParams.get("error_description") || "Sign-in was cancelled or failed.");
      return;
    }

    // Verify the session cookie the backend just set, and get the user profile.
    authApi.me()
      .then((res) => {
        const user = res.data;
        // Store user info locally so Sidebar and other components can read it.
        // No token is stored — the real credential is the HttpOnly session cookie.
        saveCookieSession(user);

        // Role-based landing: risk_owner always goes to My Work.
        // Everyone else goes to the requested return_to (default: dashboard).
        const dest = user.role === "risk_owner" ? "/my-work" : returnTo;
        router.replace(dest);
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("We couldn't verify your session. Please try signing in again.");
      });
  }, [router, searchParams]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-900">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <ShieldCheckIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-lg font-semibold text-gray-900 mb-2">Sign-in failed</h1>
          <p className="text-sm text-gray-500 mb-6">{errorMsg}</p>
          <a
            href="/login"
            className="inline-block px-5 py-2.5 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
        <ShieldCheckIcon className="w-12 h-12 text-brand-600 mx-auto mb-4 animate-pulse" />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Signing you in…</h1>
        <p className="text-sm text-gray-500">Verifying your identity, please wait.</p>
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-brand-900">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
            <ShieldCheckIcon className="w-12 h-12 text-brand-600 mx-auto mb-4 animate-pulse" />
            <p className="text-sm text-gray-500">Loading…</p>
          </div>
        </div>
      }
    >
      <CallbackPageContent />
    </Suspense>
  );
}
