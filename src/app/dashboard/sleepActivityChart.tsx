"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";

type SleepTimelineEntry = {
  id: string;
  date_time: string;
  type: string;
  duration_minutes: number;
  source?: string | null;
};

interface SleepActivityChartProps {
  sleepTimeline: SleepTimelineEntry[];
  rangeLabel?: string;
}

const STAGE_COLORS: Record<string, string> = {
  core: "#818CF8",
  rem: "#F472B6",
  deep: "#38BDF8",
  asleep: "#14B8A6",
  awake: "#FB923C",
  in_bed: "#94A3B8",
  unknown: "#CBD5F5",
};

const SLEEP_STAGES = new Set(["core", "rem", "deep", "asleep"]);

export function SleepActivityChart({ sleepTimeline, rangeLabel = "Last night" }: SleepActivityChartProps) {
  const labelText = rangeLabel ? `${rangeLabel} · avg/night` : "avg/night";
  const timeline = useMemo(
    () => sleepTimeline.filter((entry) => entry.duration_minutes > 0 && entry.type !== "in_bed"),
    [sleepTimeline]
  );

  const totalSleep = timeline
    .filter((entry) => SLEEP_STAGES.has(entry.type))
    .reduce((sum, entry) => sum + entry.duration_minutes, 0);

  const totalSleepHours = (totalSleep / 60).toFixed(2);

  if (!timeline.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        No sleep timeline data for {rangeLabel} yet. Import your sleep entry to see the full breakdown.
      </div>
    );
  }

  const summary = useMemo(() => {
    const bucket = new Map<string, number>();
    timeline
      .filter((entry) => SLEEP_STAGES.has(entry.type))
      .forEach((entry) => {
        bucket.set(entry.type, (bucket.get(entry.type) || 0) + entry.duration_minutes);
      });
    return Array.from(bucket.entries()).map(([type, minutes]) => ({
      type,
      minutes,
      label: type.replace("_", " ").toUpperCase(),
      color: STAGE_COLORS[type] ?? STAGE_COLORS.unknown,
    }));
  }, [timeline]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">{labelText}</p>
          <p className="text-2xl font-semibold text-zinc-900">{totalSleepHours} hrs asleep</p>
          <p className="text-sm text-zinc-500">(excludes Awake / In Bed segments)</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 space-y-6">
        <div>
          <div className="mb-2 text-sm font-semibold text-zinc-700">Stage breakdown</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={summary}
                  dataKey="minutes"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  label={({ name, percent }) => `${name ?? ""} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                >
                  {summary.map((entry) => (
                    <Cell key={entry.type} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-zinc-600">
          {summary.map((entry) => (
            <div key={entry.type} className="flex items-center justify-between rounded border border-zinc-100 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="font-medium capitalize">{entry.type.replace("_", " ")}</span>
              </div>
              <div className="text-zinc-500">{entry.minutes} min</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
