import { User } from "@/types";

const TOKEN_KEY = "grc_token";
const USER_KEY  = "grc_user";

// One-time migration: move any existing localStorage sessions to sessionStorage
// so users aren't logged out abruptly on first load after this change.
function _migrateToSession() {
  if (typeof window === "undefined") return;
  const oldToken = localStorage.getItem(TOKEN_KEY);
  const oldUser  = localStorage.getItem(USER_KEY);
  if (oldToken) {
    sessionStorage.setItem(TOKEN_KEY, oldToken);
    localStorage.removeItem(TOKEN_KEY);
  }
  if (oldUser) {
    sessionStorage.setItem(USER_KEY, oldUser);
    localStorage.removeItem(USER_KEY);
  }
}
_migrateToSession();

export function saveSession(token: string, user: User) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getSession(): { token: string; user: User } | null {
  const token = getToken();
  const user  = getUser();
  if (!token || !user) return null;
  return { token, user };
}
