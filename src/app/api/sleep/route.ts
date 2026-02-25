import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import {
  addMinutes,
  dateToUtcStart,
  ensureDailyMetricRow,
  replaceSamplesForDate,
  SleepSampleInsert,
} from "@/lib/sleepSamples";

type SleepData = {
  date: string; // YYYY-MM-DD
  total_minutes?: number;
  core_minutes?: number;
  rem_minutes?: number;
  deep_minutes?: number;
  awake_minutes?: number;
  in_bed_minutes?: number;
  sleep_efficiency?: number; // Percentage
  source?: string;
  raw_data?: any; // Original Apple Health data
};

const SAMPLE_SOURCE = "sleep_json";

const clampMinutes = (value?: number | null) => {
  if (value === undefined || value === null) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
};

function buildSamples(date: string, data: SleepData) {
  const samples: SleepSampleInsert[] = [];
  const start = dateToUtcStart(date);
  let cursor = new Date(start);

  const core = clampMinutes(data.core_minutes);
  const rem = clampMinutes(data.rem_minutes);
  const deep = clampMinutes(data.deep_minutes);
  const awake = clampMinutes(data.awake_minutes);

  const knownSleep = core + rem + deep;
  const total = clampMinutes(data.total_minutes);
  const unknown = total > knownSleep ? total - knownSleep : 0;

  const orderedStages: Array<{ stage: SleepSampleInsert["stage"]; minutes: number; label: string }> = [
    { stage: "core", minutes: core, label: "core_minutes" },
    { stage: "rem", minutes: rem, label: "rem_minutes" },
    { stage: "deep", minutes: deep, label: "deep_minutes" },
    { stage: "unknown", minutes: unknown, label: "unknown_minutes" },
  ];

  for (const entry of orderedStages) {
    if (!entry.minutes) continue;
    samples.push({
      sample_ts: cursor.toISOString(),
      stage: entry.stage,
      duration_minutes: entry.minutes,
      raw: {
        stage: entry.stage,
        minutes: entry.minutes,
        source: data.source || SAMPLE_SOURCE,
        label: entry.label,
      },
    });
    cursor = addMinutes(cursor, entry.minutes);
  }

  if (awake) {
    samples.push({
      sample_ts: cursor.toISOString(),
      stage: "awake",
      duration_minutes: awake,
      raw: {
        stage: "awake",
        minutes: awake,
        source: data.source || SAMPLE_SOURCE,
        label: "awake_minutes",
      },
    });
  }

  const totalSleep = core + rem + deep + unknown;
  const inBed = totalSleep + awake;

  return {
    samples,
    totals: {
      core,
      rem,
      deep,
      unknown,
      awake,
      totalSleep,
      inBed,
    },
  };
}

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const data: SleepData = await req.json();

    if (!data.date) {
      return new NextResponse("Missing date", { status: 400 });
    }

    const sb = supabaseAdmin();

    const { samples, totals } = buildSamples(data.date, data);

    await replaceSamplesForDate(sb, data.date, SAMPLE_SOURCE, samples, ["sleep_parse", "ingest_health"]);
    await ensureDailyMetricRow(sb, data.date);

    const computedEfficiency =
      data.sleep_efficiency ?? (totals.inBed > 0 ? Math.round((totals.totalSleep / totals.inBed) * 100) : null);

    // Delete existing sleep data for this date first
    const { error: deleteError } = await sb
      .from("sleep_data")
      .delete()
      .eq("date", data.date);
      
    if (deleteError) console.warn("Could not delete existing sleep data:", deleteError);
    
    // Insert individual sleep stage records into sleep_data table
    const sleepRecords = [
      { date: data.date, sleep_type: 'core', duration_minutes: totals.core },
      { date: data.date, sleep_type: 'rem', duration_minutes: totals.rem },
      { date: data.date, sleep_type: 'deep', duration_minutes: totals.deep },
      { date: data.date, sleep_type: 'awake', duration_minutes: totals.awake },
    ].filter(record => record.duration_minutes > 0);
    
    if (sleepRecords.length > 0) {
      const { error: sleepError } = await sb
        .from("sleep_data")
        .insert(sleepRecords);
        
      if (sleepError) console.warn("Failed to save sleep data:", sleepError);
    }

    return NextResponse.json({
      message: "Sleep data saved",
      total_minutes: totals.totalSleep,
      awake_minutes: totals.awake,
      sleep_efficiency: computedEfficiency,
      sample_count: samples.length,
    });
  } catch (error: any) {
    console.error("Sleep API error:", error);
    return new NextResponse(error.message || "Internal error", { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("daily_sleep_summary")
    .select("*")
    .order("date", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data ?? []);
}
