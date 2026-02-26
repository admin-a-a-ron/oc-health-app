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
    .from("sleep_data_processed")
    .select("date_bucket,value,total_minutes")
    .gte("date_bucket", earliestDate)
    .lte("date_bucket", latestDate);

  if (sleepError) return new NextResponse(sleepError.message, { status: 500 });

  const sleepTotals = new Map<string, number>();
  (sleepRows || []).forEach((row) => {
    const stage = normalizeStage(row.value);
    if (!SLEEP_STAGES.has(stage)) return;
    const date = row.date_bucket;
    if (!date) return;
    sleepTotals.set(date, (sleepTotals.get(date) || 0) + (row.total_minutes || 0));
  });

  const enriched = metrics.map((row) => ({
    ...row,
    sleep_minutes: sleepTotals.get(row.date) ?? null,
  }));

  return NextResponse.json(enriched);
}
