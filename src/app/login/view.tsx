"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { setToken } from "@/lib/clientAuth";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") ?? "/weights";

  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Login failed");
      }
      const json = (await res.json()) as { token: string };
      setToken(json.token);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">oc-health-app</h1>
        <p className="mt-1 text-sm text-zinc-600">Enter the app passcode to continue.</p>

        {err ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
        ) : null}

        <form className="mt-6 flex flex-col gap-3" onSubmit={onSubmit}>
          <label className="text-sm font-medium" htmlFor="password">
            Passcode
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="h-11 rounded-md border border-zinc-300 px-3 outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="••••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="mt-2 h-11 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-800 disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-xs text-zinc-500">
          This stores a token in your browser localStorage (MVP). We can upgrade to OAuth later.
        </div>
      </div>
    </div>
  );
}
