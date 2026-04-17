"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { WeightChart } from "./weightChart";
import { SleepActivityChart } from "@/app/dashboard/sleepActivityChart";
import { NutritionChart } from "@/app/dashboard/nutritionChart";
import { HealthScoreChart } from "@/app/dashboard/healthScoreChart";
import { clearToken, getToken } from "@/lib/clientAuth";
import TopNav from "@/components/TopNav";
import CategoryDetailsModal from "@/components/CategoryDetailsModal";

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



type SummaryTabKey = "yesterday" | "today" | "avg7";

type SummaryData = {
  dateLabel: string;
  data: Partial<DailyMetricsRow> | null;
};

const TAB_OPTIONS: Array<{ id: SummaryTabKey; label: string }> = [
  { id: "yesterday", label: "Yesterday" },
  { id: "today", label: "Today so far" },
  { id: "avg7", label: "7 Day Average" },
];

const AVERAGE_FIELDS: (keyof DailyMetricsRow)[] = [
  "steps",
  "sleep_minutes",
  "resting_hr",
  "calories_in",
  "protein_g",
  "carbs_g",
  "fat_g",
  "active_calories_out",
];

const computeAverageRow = (rows: DailyMetricsRow[]): Partial<DailyMetricsRow> | null => {
  if (!rows.length) return null;
  const avgRow: Partial<DailyMetricsRow> = {};
  
  // Fields that should exclude 0 values (treat as missed logs)
  const excludeZeroFields = new Set(["sleep_minutes", "calories_in", "protein_g", "carbs_g", "fat_g", "resting_hr"]);
  
  AVERAGE_FIELDS.forEach((field) => {
    let values = rows
      .map((row) => row[field])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    
    // For certain fields, exclude 0 values (missed logs)
    if (excludeZeroFields.has(field)) {
      values = values.filter((value) => value > 0);
    }
    
    if (!values.length) {
      avgRow[field] = null as any;
    } else {
      const sum = values.reduce((acc, value) => acc + value, 0);
      avgRow[field] = Math.round((sum / values.length) * 100) / 100 as any;
    }
  });
  return avgRow;
};
export type WeightRow = {
  date: string;
  weight_lbs: number;
};

const defaultRangeDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};

export default function WeightsPage() {
  const router = useRouter();
  const [weights, setWeights] = useState<WeightRow[]>([]);
  const [metrics, setMetrics] = useState<DailyMetricsRow[]>([]);
  const [sleepTimeline, setSleepTimeline] = useState<SleepTimelineEntry[]>([]);
  const fetchTimeline = async (authToken: string, start: string, end: string) => {
    if (!start || !end) return;
    const params = new URLSearchParams();
    params.set("start", start);
    params.set("end", end);
    const res = await fetch(`/api/sleep/timeline?${params.toString()}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: "no-store",
    });
    if (res.ok) {
      const body = await res.json();
      setSleepTimeline(body.entries ?? []);
    }
  };

  const tabSummaries = useMemo(() => {
    const defaults: Record<SummaryTabKey, SummaryData> = {
      yesterday: { dateLabel: "—", data: null },
      today: { dateLabel: "—", data: null },
      avg7: { dateLabel: "—", data: null },
    };

    if (!metrics.length) return defaults;

    const today = new Date().toISOString().slice(0, 10);
    const yesterdayDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    const findByDate = (date: string) => metrics.find((row) => row.date === date) ?? null;

    const priorDays = metrics.filter((row) => row.date < today);
    const fallbackYesterday = priorDays.length ? priorDays[priorDays.length - 1] : null;

    const yesterdayRow = findByDate(yesterdayDate) ?? fallbackYesterday;
    const todayRow = findByDate(today);

    const lastSeven = metrics.slice(-7);
    const averageRow = computeAverageRow(lastSeven);

    const rangeLabel = lastSeven.length ? `${lastSeven[0].date} – ${lastSeven[lastSeven.length - 1].date}` : "—";

    return {
      yesterday: { dateLabel: yesterdayRow?.date ?? "—", data: yesterdayRow },
      today: { dateLabel: todayRow?.date ?? today, data: todayRow },
      avg7: { dateLabel: rangeLabel, data: averageRow },
    };
  }, [metrics]);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SummaryTabKey>("yesterday");
  const [rangeStart, setRangeStart] = useState(defaultRangeDate);
  const [rangeEnd, setRangeEnd] = useState(defaultRangeDate);
  const [modalCategory, setModalCategory] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const token = useMemo(() => getToken(), []);

  const handleCategoryClick = (category: string) => {
    setModalCategory(category);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalCategory(null);
  };

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
        await fetchTimeline(token, rangeStart, rangeEnd);
      }

      setLoading(false);
    }
    run();
  }, [router, token]);

  useEffect(() => {
    if (!token) return;
    fetchTimeline(token, rangeStart, rangeEnd);
  }, [token, rangeStart, rangeEnd]);

  const filteredMetrics = useMemo(() => {
    if (!metrics.length) return [];
    if (!rangeStart || !rangeEnd) return metrics;
    return metrics.filter((row) => row.date >= rangeStart && row.date <= rangeEnd);
  }, [metrics, rangeStart, rangeEnd]);

  const nutritionMetrics = filteredMetrics.length ? filteredMetrics : metrics;
  const nutritionAverage = filteredMetrics.length ? computeAverageRow(filteredMetrics) : null;

  const activeSummary = tabSummaries[activeTab] ?? { dateLabel: "—", data: null };
  const summaryData = activeSummary.data;
  const getNumericValue = (key: keyof DailyMetricsRow): number | null => {
    const value = summaryData?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  const formatNumberValue = (value: number | null) => (value == null ? "—" : value.toLocaleString());
  const formatSleepHours = (minutes: number | null) => (minutes == null ? "—" : (minutes / 60).toFixed(1));
  const handleRangeStartChange = (value: string) => {
    if (!value) return;
    setRangeStart(value);
    if (rangeEnd && value > rangeEnd) {
      setRangeEnd(value);
    }
  };

  const handleRangeEndChange = (value: string) => {
    if (!value) return;
    setRangeEnd(value);
    if (rangeStart && value < rangeStart) {
      setRangeStart(value);
    }
  };

  const summaryTiles = [
    { label: "Date", value: activeSummary.dateLabel ?? "—" },
    { label: "Steps", value: formatNumberValue(getNumericValue("steps")) },
    { label: "Sleep (hrs)", value: formatSleepHours(getNumericValue("sleep_minutes")) },
    { label: "Resting HR", value: formatNumberValue(getNumericValue("resting_hr")) },
    { label: "Calories in", value: formatNumberValue(getNumericValue("calories_in")) },
    { label: "Protein (g)", value: formatNumberValue(getNumericValue("protein_g")) },
    { label: "Carbs (g)", value: formatNumberValue(getNumericValue("carbs_g")) },
    { label: "Fat (g)", value: formatNumberValue(getNumericValue("fat_g")) },
    { label: "Active Burn", value: formatNumberValue(getNumericValue("active_calories_out")) },
  ];

  const sleepRangeLabel = rangeStart === rangeEnd ? rangeStart : `${rangeStart} – ${rangeEnd}`;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <TopNav />


      <main className="mx-auto max-w-4xl px-6 py-6">
        {err ? (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
        ) : null}

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">Latest Data</h2>
            <div className="flex flex-wrap gap-2">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    activeTab === tab.id
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500">Range: {activeSummary.dateLabel ?? "—"}</div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summaryTiles.map((tile) => (
              <div key={tile.label} className="rounded-lg border border-zinc-200 p-3">
                <div className="text-xs text-zinc-500">{tile.label}</div>
                <div className="text-sm font-semibold">{tile.value}</div>
              </div>
            ))}
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
          <h2 className="text-sm font-semibold text-zinc-700">Health Score Analysis</h2>
          <p className="mt-1 text-xs text-zinc-500">Click on any category to see detailed breakdown</p>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : (
              <HealthScoreChart metrics={metrics} onCategoryClick={handleCategoryClick} />
            )}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Sleep & Nutrition Range</h2>
          <p className="mt-1 text-xs text-zinc-500">Adjust the date range to update the sleep breakdown and nutrition charts below.</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600" htmlFor="range_start">Start</label>
              <input
                id="range_start"
                type="date"
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                value={rangeStart}
                max={rangeEnd}
                onChange={(e) => handleRangeStartChange(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs font-medium text-zinc-600" htmlFor="range_end">End</label>
              <input
                id="range_end"
                type="date"
                className="h-10 rounded-md border border-zinc-300 px-3 text-sm"
                value={rangeEnd}
                min={rangeStart}
                onChange={(e) => handleRangeEndChange(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">Sleep Timeline</h2>
            <p className="text-xs text-zinc-500">Range: {sleepRangeLabel}</p>
          </div>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : (
              <SleepActivityChart sleepTimeline={sleepTimeline} rangeLabel={sleepRangeLabel} />
            )}
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-700">Nutrition Dashboard</h2>
            <p className="text-xs text-zinc-500">Range: {sleepRangeLabel}</p>
          </div>
          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-zinc-600">Loading…</p>
            ) : (
              <NutritionChart metrics={nutritionMetrics} averageRow={nutritionAverage ?? undefined} rangeLabel={sleepRangeLabel} />
            )}
          </div>
        </section>

      </main>

      <CategoryDetailsModal 
        isOpen={modalOpen} 
        category={modalCategory} 
        onClose={handleCloseModal} 
      />
    </div>
  );
}
