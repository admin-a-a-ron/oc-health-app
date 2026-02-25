"use client";

import { useMemo } from "react";

type SleepTimelineEntry = {
  id: string;
  date_time: string;
  type: string;
  duration_minutes: number;
  source?: string | null;
};

interface SleepActivityChartProps {
  sleepTimeline: SleepTimelineEntry[];
}

const STAGE_COLORS: Record<string, string> = {
  core: "bg-indigo-400",
  rem: "bg-pink-400",
  deep: "bg-sky-500",
  asleep: "bg-teal-400",
  awake: "bg-orange-400",
  in_bed: "bg-slate-400",
  unknown: "bg-zinc-300",
};

const SLEEP_STAGES = new Set(["core", "rem", "deep", "asleep"]);

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

export function SleepActivityChart({ sleepTimeline }: SleepActivityChartProps) {
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
        No sleep timeline data for yesterday yet. Import your sleep entry to see the full breakdown.
      </div>
    );
  }

  const timelineTotal = timeline.reduce((sum, entry) => sum + entry.duration_minutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">Last night</p>
          <p className="text-2xl font-semibold text-zinc-900">{totalSleepHours} hrs asleep</p>
          <p className="text-sm text-zinc-500">(excludes Awake / In Bed segments)</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-4 text-sm font-semibold text-zinc-700">Sleep timeline</div>
        <div className="flex h-10 overflow-hidden rounded-full border border-zinc-200">{
          timeline.map((entry) => {
            const color = STAGE_COLORS[entry.type] ?? STAGE_COLORS.unknown;
            const width = timelineTotal ? `${(entry.duration_minutes / timelineTotal) * 100}%` : "0%";
            return (
              <div
                key={entry.id}
                className={`${color} relative text-[10px] text-white flex items-center justify-center`}
                style={{ width }}
                title={`${entry.type.toUpperCase()} • ${entry.duration_minutes} min`}
              >
                {entry.duration_minutes >= 20 ? entry.type.toUpperCase() : null}
              </div>
            );
          })
        }</div>

        <div className="mt-4 space-y-2 text-sm text-zinc-700">
          {timeline.map((entry) => (
            <div key={`${entry.id}-details`} className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2">
              <div className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${STAGE_COLORS[entry.type] ?? STAGE_COLORS.unknown}`}></span>
                <span className="font-medium capitalize">{entry.type.replace("_", " ")}</span>
              </div>
              <div className="text-sm text-zinc-500 flex gap-3">
                <span>{formatTime(entry.date_time)}</span>
                <span>•</span>
                <span>{entry.duration_minutes} min</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
