import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import { normalizeStage } from "@/lib/sleepSamples";

const SLEEP_STAGES = new Set(["core", "rem", "deep", "asleep"]);
const SESSION_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours between sessions

type SleepRow = {
  date_time: string;
  type: string;
  duration_minutes: number | null;
};

const buildSessionTotals = (rows: SleepRow[]) => {
  const totals = new Map<string, number>();
  const sorted = [...rows].sort((a, b) => Date.parse(a.date_time) - Date.parse(b.date_time));

  let current: { date: string; lastTs: number; total: number } | null = null;
  const flush = () => {
    if (current && current.total > 0) {
      totals.set(current.date, (totals.get(current.date) || 0) + current.total);
    }
  };

  for (const row of sorted) {
    const ts = Date.parse(row.date_time);
    if (Number.isNaN(ts)) continue;

    if (!current || ts - current.lastTs > SESSION_GAP_MS) {
      flush();
      current = {
        date: new Date(row.date_time).toISOString().slice(0, 10),
        lastTs: ts,
        total: 0,
      };
    } else {
      current.lastTs = ts;
    }

    const stage = normalizeStage(row.type);
    if (SLEEP_STAGES.has(stage)) {
      current.total += row.duration_minutes ?? 0;
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
