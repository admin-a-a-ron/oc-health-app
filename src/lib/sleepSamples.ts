import type { SupabaseClient } from "@supabase/supabase-js";

export type SleepStage = "core" | "rem" | "deep" | "awake" | "unknown" | "total" | "in_bed" | "asleep";

export type SleepSampleInsert = {
  sample_ts: string;
  stage: SleepStage;
  duration_minutes: number;
  raw?: any;
  start_ts?: string;
};

const ONE_MINUTE_MS = 60 * 1000;

export function normalizeStage(value?: string | null): SleepStage {
  const stage = (value ?? "").toLowerCase();
  if (stage.includes("core")) return "core";
  if (stage.includes("rem")) return "rem";
  if (stage.includes("deep")) return "deep";
  if (stage.includes("awake") || stage.includes("wake")) return "awake";
  if (stage.includes("in bed") || stage === "bed") return "in_bed";
  if (stage.includes("asleep")) return "asleep";
  if (stage.includes("total")) return "total";
  return "unknown";
}

export function durationToMinutes(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;

  const toMinutes = (minutes: number, seconds: number = 0) => minutes + seconds / 60;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Treat numeric payloads as seconds if reasonably large, otherwise minutes
    if (value > 180) {
      return Math.max(0, Math.round(value / 60));
    }
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    const parts = trimmed.split(":").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts.map(Number);
      if ([hours, minutes, seconds].every(Number.isFinite)) {
        return Math.max(0, Math.round(hours * 60 + toMinutes(minutes, seconds)));
      }
    }
    if (parts.length === 2) {
      const [minutes, seconds] = parts.map(Number);
      if ([minutes, seconds].every(Number.isFinite)) {
        return Math.max(0, Math.round(toMinutes(minutes, seconds)));
      }
    }
    if (parts.length === 1 && parts[0]) {
      const single = Number(parts[0]);
      if (Number.isFinite(single)) {
        // Assume seconds for single numeric strings
        return Math.max(0, Math.round(single / 60));
      }
    }
  }

  return 0;
}

export function dateToUtcStart(date: string): Date {
  const [year, month, day] = date.split("-").map((part) => Number(part));
  if (
    Number.isFinite(year) &&
    Number.isFinite(month) &&
    Number.isFinite(day)
  ) {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }
  return new Date(date);
}

export function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * ONE_MINUTE_MS);
}

export async function ensureDailyMetricRow(sb: SupabaseClient, date: string) {
  const { error } = await sb
    .from("daily_metrics")
    .upsert({ date, updated_at: new Date().toISOString() }, { onConflict: "date" });
  if (error) throw error;
}

export async function replaceSamplesForDate(
  sb: SupabaseClient,
  date: string,
  source: string,
  samples: SleepSampleInsert[],
  alsoDeleteSources: string[] = []
) {
  const sources = Array.from(new Set([source, ...alsoDeleteSources].filter(Boolean)));
  let deleteQuery = sb.from("sleep_samples").delete().eq("sample_date", date);
  if (sources.length === 1) {
    deleteQuery = deleteQuery.eq("source", sources[0]);
  } else if (sources.length > 1) {
    deleteQuery = deleteQuery.in("source", sources);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) throw deleteError;

  if (!samples.length) return;

  const rows = samples.map(({ start_ts, ...sample }) => ({
    ...sample,
    source,
    raw: sample.raw ?? null,
  }));

  const { error: insertError } = await sb.from("sleep_samples").insert(rows);
  if (insertError) throw insertError;
}
