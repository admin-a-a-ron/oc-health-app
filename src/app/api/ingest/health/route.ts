import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import { dateToUtcStart, replaceSamplesForDate } from "@/lib/sleepSamples";

type Payload = {
  date: string;
  weight_lbs?: number;
  steps?: number;
  sleep_minutes?: number;
  calories_in?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  active_calories_out?: number;
  exercise_minutes?: number;
  resting_hr?: number;
  // Optional raw passthrough
  raw?: unknown;
};

function numOrNull(v: any): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(v: any): number | null {
  const n = numOrNull(v);
  if (n === null) return null;
  return Math.round(n);
}

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const payload = (await req.json()) as Payload;

  const date = String(payload?.date ?? "");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new NextResponse("Bad date", { status: 400 });
  }

  const sb = supabaseAdmin();

  // Upsert into daily_metrics
  const sleepMinutes = intOrNull(payload.sleep_minutes);
  const { error: metricsError } = await sb.from("daily_metrics").upsert(
    {
      date,
      weight_lbs: numOrNull(payload.weight_lbs),
      steps: intOrNull(payload.steps),
      calories_in: intOrNull(payload.calories_in),
      protein_g: numOrNull(payload.protein_g),
      carbs_g: numOrNull(payload.carbs_g),
      fat_g: numOrNull(payload.fat_g),
      active_calories_out: numOrNull(payload.active_calories_out),
      exercise_minutes: intOrNull(payload.exercise_minutes),
      resting_hr: numOrNull(payload.resting_hr),
      raw: payload.raw ?? payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "date" }
  );

  if (metricsError) return new NextResponse(metricsError.message, { status: 500 });

  if (sleepMinutes !== null) {
    const startIso = dateToUtcStart(date).toISOString();
    const sample = {
      sample_ts: startIso,
      stage: "total" as const,
      duration_minutes: sleepMinutes,
      raw: { source: "ingest/health", sleep_minutes: sleepMinutes },
    };

    try {
      await replaceSamplesForDate(sb, date, "ingest_health", [sample]);
    } catch (error: any) {
      return new NextResponse(error.message || "Failed to save sleep samples", { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
