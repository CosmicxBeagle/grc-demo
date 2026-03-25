"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { saveSession } from "@/lib/auth";
import { ShieldCheckIcon } from "@heroicons/react/24/solid";

const DEMO_USERS = [
  { username: "alice@example.com", label: "Alice Admin",    role: "admin" },
  { username: "bob@example.com",   label: "Bob Tester",     role: "tester" },
  { username: "carol@example.com", label: "Carol Tester",   role: "tester" },
  { username: "dave@example.com",  label: "Dave Reviewer",  role: "reviewer" },
  { username: "erin@example.com",  label: "Erin Reviewer",  role: "reviewer" },
];

export default function LoginPage() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const login = async (username: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(username);
      saveSession(res.data.access_token, res.data.user);
      router.push("/dashboard");
    } catch {
      setError("Login failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-900">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex flex-col items-center mb-8">
          <ShieldCheckIcon className="w-12 h-12 text-brand-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">GRC Demo</h1>
          <p className="text-sm text-gray-500 mt-1">Control Testing Platform</p>
        </div>

        <p className="text-sm text-center text-gray-500 mb-6">
          Select a demo user to log in — no password required
        </p>

        <div className="space-y-2">
          {DEMO_USERS.map((u) => (
            <button
              key={u.username}
              onClick={() => login(u.username)}
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

        {error && (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        )}

        <p className="mt-6 text-xs text-center text-gray-400">
          Local demo — auth is a username-only bypass
        </p>
      </div>
    </div>
  );
}
