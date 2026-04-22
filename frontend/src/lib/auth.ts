import { User } from "@/types";

const TOKEN_KEY     = "grc_token";
const USER_KEY      = "grc_user";
const AUTH_MODE_KEY = "grc_auth_mode";

type AuthMode = "demo" | "cookie";

// ── One-time migration: localStorage → sessionStorage ────────────────────────
// Remove once we're confident no users have old localStorage sessions.
function _migrateToSession() {
  if (typeof window === "undefined") return;
  const oldToken = localStorage.getItem(TOKEN_KEY);
  const oldUser  = localStorage.getItem(USER_KEY);
  if (oldToken) { sessionStorage.setItem(TOKEN_KEY, oldToken); localStorage.removeItem(TOKEN_KEY); }
  if (oldUser)  { sessionStorage.setItem(USER_KEY, oldUser);   localStorage.removeItem(USER_KEY); }
}
_migrateToSession();

// ── Auth mode ─────────────────────────────────────────────────────────────────

export function getAuthMode(): AuthMode | null {
  if (typeof window === "undefined") return null;
  const mode = sessionStorage.getItem(AUTH_MODE_KEY);
  return mode === "demo" || mode === "cookie" ? mode : null;
}

// ── Save session ──────────────────────────────────────────────────────────────

/**
 * Demo/local login: store the real JWT token alongside the user profile.
 * The token is sent as X-Auth-Token on every API request.
 */
export function saveDemoSession(token: string, user: User): void {
  sessionStorage.setItem(AUTH_MODE_KEY, "demo");
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Cookie/Okta login: store only the user profile.
 * The real credential is the HttpOnly session cookie — we never put it in
 * JS-accessible storage.  Auth for subsequent navigations is verified by
 * calling GET /users/me (the browser sends the cookie automatically via
 * withCredentials: true).
 */
export function saveCookieSession(user: User): void {
  sessionStorage.setItem(AUTH_MODE_KEY, "cookie");
  sessionStorage.removeItem(TOKEN_KEY); // no token in JS storage — intentional
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

// ── Read session ──────────────────────────────────────────────────────────────

/**
 * Returns the JWT token for demo mode only.
 * Cookie mode always returns null — auth comes from the HttpOnly cookie,
 * so the X-Auth-Token header must not be sent.
 */
export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  if (getAuthMode() !== "demo") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

// ── Auth state checks ─────────────────────────────────────────────────────────

/**
 * True if the user has any stored session (demo or cookie mode).
 * Used by the root redirect — does NOT validate with the server.
 * Always pair this with AppShell, which does the real validation.
 */
export function isLoggedIn(): boolean {
  return getAuthMode() !== null && getUser() !== null;
}

/**
 * True only for demo/local sessions with a real JWT token in storage.
 *
 * AppShell uses this to decide whether to skip the /users/me network call.
 * Cookie-mode sessions always return false — they must validate server-side
 * on every navigation because the real credential (the cookie) may have
 * expired without the frontend knowing.
 */
export function isDemoSession(): boolean {
  return getAuthMode() === "demo" && !!sessionStorage.getItem(TOKEN_KEY);
}

// ── Clear session ─────────────────────────────────────────────────────────────

export function clearSession(): void {
  sessionStorage.removeItem(AUTH_MODE_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}
