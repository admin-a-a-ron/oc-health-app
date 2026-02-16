"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/clientAuth";

type PlanType = "ppl" | "framework" | "full_body";

export default function WorkoutsPage() {
  const router = useRouter();
  const token = useMemo(() => getToken(), []);
  const [planType, setPlanType] = useState<PlanType>("framework");
  const [minutes, setMinutes] = useState(60);
  const [gymId, setGymId] = useState<string>("");
  const [gyms, setGyms] = useState<Array<{ id: string; name: string; is_default: boolean }>>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function loadGyms() {
      if (!token) return;
      const res = await fetch("/api/gyms", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const data = (await res.json()) as Array<{ id: string; name: string; is_default: boolean }>;
      setGyms(data);
      const def = data.find((g) => g.is_default) ?? data[0];
      if (def) setGymId(def.id);
    }
    loadGyms();
  }, [token]);

  async function generate() {
    if (!token) {
      router.replace("/login?next=/workouts");
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_type: planType, target_minutes: minutes, gym_id: gymId || null }),
      });
      if (res.status === 401) {
        clearToken();
        router.replace("/login?next=/workouts");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as { id: string };
      router.push(`/workouts/${json.id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to generate workout");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">Workouts</h1>
            <p className="text-sm text-zinc-600">Generate a time-boxed session (strength-first)</p>
          </div>
          <button
            className="text-sm underline"
            onClick={() => {
              clearToken();
              router.replace("/login?next=/workouts");
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Suggested workout</h2>

          {err ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Plan type</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3"
                value={planType}
                onChange={(e) => setPlanType(e.target.value as PlanType)}
              >
                <option value="framework">Framework (your emphasis days)</option>
                <option value="ppl">Push / Pull / Legs</option>
                <option value="full_body">Full body</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Gym</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-zinc-300 px-3"
                value={gymId}
                onChange={(e) => setGymId(e.target.value)}
              >
                {gyms.length === 0 ? <option value="">(loading…)</option> : null}
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Target time (minutes)</label>
              <input
                type="range"
                min={30}
                max={90}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-1 text-sm text-zinc-600">{minutes} min</div>
            </div>
          </div>

          <button
            className="mt-5 h-11 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            disabled={loading}
            onClick={generate}
          >
            {loading ? "Generating…" : "Generate workout"}
          </button>
        </section>
      </main>
    </div>
  );
}
