import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import { normalizeStage } from "@/lib/sleepSamples";

const SLEEP_STAGES = new Set(["core", "rem", "deep", "asleep"]);

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
    .lte("date_time", `${latestDate}T23:59:59Z`);

  if (sleepError) return new NextResponse(sleepError.message, { status: 500 });

  const sleepTotals = new Map<string, number>();
  (sleepRows || []).forEach((row) => {
    const stage = normalizeStage(row.type);
    if (!SLEEP_STAGES.has(stage)) return;
    const date = row.date_time?.slice(0, 10);
    if (!date) return;
    sleepTotals.set(date, (sleepTotals.get(date) || 0) + (row.duration_minutes || 0));
  });

  const enriched = metrics.map((row) => ({
    ...row,
    sleep_minutes: sleepTotals.get(row.date) ?? null,
  }));

  return NextResponse.json(enriched);
}
