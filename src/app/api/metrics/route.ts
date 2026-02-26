import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import { normalizeStage } from "@/lib/sleepSamples";

const SLEEP_STAGES = new Set(["core", "rem", "deep", "asleep"]);
const SESSION_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours between sessions
const SLEEP_TIMEZONE = "America/Los_Angeles";
const HALF_DAY_MS = 12 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SLEEP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const toDateInSleepTz = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = dateFormatter.formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    lookup[part.type] = part.value;
  }
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
};

type SleepRow = {
  date_time: string;
  type: string;
  duration_minutes: number | null;
};

const buildSessionTotals = (rows: SleepRow[]) => {
  const totals = new Map<string, number>();
  const sorted = [...rows].sort((a, b) => Date.parse(a.date_time) - Date.parse(b.date_time));

  type Session = {
    date: string;
    lastTs: number;
    sleepMinutes: number;
    awakeMinutes: number;
    inBedMinutes: number;
  };

  let current: Session | null = null;
  const flush = () => {
    if (!current) return;
    const direct = current.sleepMinutes;
    const inferred = current.inBedMinutes > 0 ? Math.max(current.inBedMinutes - current.awakeMinutes, 0) : 0;
    const total = Math.max(direct, inferred);
    if (total > 0) {
      totals.set(current.date, (totals.get(current.date) || 0) + total);
    }
  };

  for (const row of sorted) {
    const ts = Date.parse(row.date_time);
    if (Number.isNaN(ts)) continue;

    if (!current || ts - current.lastTs > SESSION_GAP_MS) {
      flush();
      current = {
        date: toDateInSleepTz(new Date(ts + HALF_DAY_MS)),
        lastTs: ts,
        sleepMinutes: 0,
        awakeMinutes: 0,
        inBedMinutes: 0,
      };
    } else {
      current.lastTs = ts;
    }

    const stage = normalizeStage(row.type);
    const minutes = row.duration_minutes ?? 0;
    if (SLEEP_STAGES.has(stage)) {
      current.sleepMinutes += minutes;
    } else if (stage === "awake") {
      current.awakeMinutes += minutes;
    } else if (stage === "in_bed") {
      current.inBedMinutes += minutes;
    }
  }

  flush();
  return totals;
};

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: metrics, error } = await sb
    .from("daily_metrics")
    .select(
      "date,weight_lbs,steps,calories_in,protein_g,carbs_g,fat_g,active_calories_out,exercise_minutes,resting_hr,updated_at"
    )
    .order("date", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });
  if (!metrics || metrics.length === 0) return NextResponse.json([]);

  const earliestDate = metrics[0].date;
  const latestDate = metrics[metrics.length - 1].date;

  const { data: sleepRows, error: sleepError } = await sb
    .from("sleep_data")
    .select("date_time,type,duration_minutes")
    .gte("date_time", `${earliestDate}T00:00:00Z`)
    .lte("date_time", `${latestDate}T23:59:59Z`)
    .order("date_time", { ascending: true });

  if (sleepError) return new NextResponse(sleepError.message, { status: 500 });

  const sleepTotals = buildSessionTotals(sleepRows ?? []);

  const enriched = metrics.map((row) => ({
    ...row,
    sleep_minutes: sleepTotals.get(row.date) ?? null,
  }));

  return NextResponse.json(enriched);
}
