"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WeightChart } from "./weightChart";
import { SleepActivityChart } from "@/app/dashboard/sleepActivityChart";
import { NutritionChart } from "@/app/dashboard/nutritionChart";
import { HealthScoreChart } from "@/app/dashboard/healthScoreChart";
import { clearToken, getToken } from "@/lib/clientAuth";
import TopNav from "@/components/TopNav";

type DailyMetricsRow = {
  date: string;
  weight_lbs: number | null;
  steps: number | null;
  sleep_minutes: number | null;
  calories_in: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  active_calories_out: number | null;
  exercise_minutes: number | null;
  resting_hr: number | null;
  updated_at: string | null;
};

type SleepTimelineEntry = {
  id: string;
  date_time: string;
  type: string;
  duration_minutes: number;
  source?: string | null;
};

export type WeightRow = {
  date: string;
  weight_lbs: number;
};

export default function WeightsPage() {
  const pickTimelineDate = (rows: DailyMetricsRow[]) => {
    if (!rows.length) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() - 1);
      return fallback.toISOString().slice(0, 10);
    }
    const today = new Date().toISOString().slice(0, 10);
    const completed = rows.filter((row) => row.date < today && (row.sleep_minutes ?? 0) > 0);
    if (completed.length) return completed[completed.length - 1].date;
    return rows[rows.length - 1].date;
  };


  const router = useRouter();
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [metrics, setMetrics] = useState<DailyMetricsRow[]>([]);
  const [sleepTimeline, setSleepTimeline] = useState<SleepTimelineEntry[]>([]);
  const [sleepTotalMinutes, setSleepTotalMinutes] = useState<number | null>(null);
  const fetchTimeline = async (authToken: string, rows: DailyMetricsRow[]) => {
    const targetDate = pickTimelineDate(rows);
    const res = await fetch(`/api/sleep/timeline?date=${targetDate}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const body = await res.json();
      const entries = (body.entries ?? []).map((entry: SleepTimelineEntry) => ({
        ...entry,
        duration_minutes: entry.duration_minutes ?? 0,
      }));
      setSleepTimeline(entries);
      setSleepTotalMinutes(body.total_sleep_minutes ?? null);
    }
  };

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const token = useMemo(() => getToken(), []);

  useEffect(() => {
    async function run() {
      if (!token) {
        router.replace("/login?next=/dashboard");
        return;
      }
      setLoading(true);
      setErr(null);
      const res = await fetch("/api/weights", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (res.status === 401) {
        clearToken();
        router.replace("/login?next=/dashboard");
        return;
      }
      if (!res.ok) {
        setErr(await res.text());
        setLoading(false);
        return;
      }
      const data = (await res.json()) as WeightRow[];
      setWeights(data);

      const mres = await fetch("/api/metrics", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (mres.ok) {
        const payload = (await mres.json()) as DailyMetricsRow[];
        setMetrics(payload);
        await fetchTimeline(token, payload);
      }

      setLoading(false);
    }
    run();
  }, [router, token]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      router.replace("/login?next=/dashboard");
      return;
    }
    setErr(null);
    const res = await fetch("/api/weights", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date, weight_lbs: weight }),
    });
    if (res.status === 401) {
      clearToken();
      router.replace("/login?next=/dashboard");
      return;
    }
    if (!res.ok) {
      setErr(await res.text());
      return;
    }

    // Refresh list
    const refreshed = await fetch("/api/weights", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (refreshed.ok) setWeights(await refreshed.json());

    const mres = await fetch("/api/metrics", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (mres.ok) {
      const payload = await mres.json();
      setMetrics(payload);
      await fetchTimeline(token, payload);
    }

    setWeight("");
  }

  const latestMetrics = metrics.length
    ? metrics
        .filter((m) =>
          m.sleep_minutes != null ||
          m.steps != null ||
          m.resting_hr != null ||
          m.calories_in != null
        )
        .pop() ?? metrics[metrics.length - 1]
    : null;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <TopNav />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <h1 className="text-lg font-semibold">Weight</h1>
          <p className="text-sm text-zinc-600">lbs + 7-day average</p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Add / update</h2>

          {err ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
          ) : null}

          <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={onSave}>
            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="date">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                className="h-10 rounded-md border border-zinc-300 px-3"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="weight_lbs">Weight (lbs)</label>
              <input
                id="weight_lbs"
                name="weight_lbs"
                inputMode="decimal"
                className="h-10 w-40 rounded-md border border-zinc-300 px-3"
                placeholder="215.4"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
            <button
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              type="submit"
              disabled={loading}
            >
              Save
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Today / latest sync</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Date</div>
              <div className="text-sm font-semibold">{latestMetrics?.date ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Steps</div>
              <div className="text-sm font-semibold">{latestMetrics?.steps ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Sleep (hrs)</div>
              <div className="text-sm font-semibold">
                {latestMetrics?.sleep_minutes != null
                  ? (latestMetrics.sleep_minutes / 60).toFixed(1)
                  : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Resting HR</div>
              <div className="text-sm font-semibold">{latestMetrics?.resting_hr ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Calories in</div>
              <div className="text-sm font-semibold">{latestMetrics?.calories_in ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Protein (g)</div>
              <div className="text-sm font-semibold">{latestMetrics?.protein_g ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Carbs (g)</div>
              <div className="text-sm font-semibold">{latestMetrics?.carbs_g ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Fat (g)</div>
              <div className="text-sm font-semibold">{latestMetrics?.fat_g ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Calories burned</div>
              <div className="text-sm font-semibold">{latestMetrics?.active_calories_out ?? "—"}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Exercise (min)</div>
              <div className="text-sm font-semibold">{latestMetrics?.exercise_minutes ?? "—"}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Updated: {latestMetrics?.updated_at ?? "—"}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Weight trend</h2>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : (
              <WeightChart weights={weights} />
            )}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Sleep & Activity Timeline</h2>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : (
              <SleepActivityChart sleepTimeline={sleepTimeline} totalSleepMinutes={sleepTotalMinutes ?? undefined} />
            )}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Nutrition Dashboard</h2>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : (
              <NutritionChart metrics={metrics} />
            )}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Health Score Analysis</h2>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : (
              <HealthScoreChart metrics={metrics} />
            )}
          </div>
        </section>

      </main>
    </div>
  );
}
