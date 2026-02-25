import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import { durationToMinutes, normalizeStage } from "@/lib/sleepSamples";

const FALLBACK_TIMEZONE = "T00:00:00-08:00";

const parseDateTime = (date: string, value?: string | null) => {
  if (value) {
    const tryDirect = Date.parse(value);
    if (!Number.isNaN(tryDirect)) return new Date(tryDirect);
  }
  return new Date(`${date}${FALLBACK_TIMEZONE}`);
};

type SleepStage = {
  type: string;
  duration_minutes: number | string;
  start_time?: string; // RFC 2822 / ISO string
  end_time?: string; // RFC 2822 / ISO string
  raw_text?: string;
};

type SleepImportRequest = {
  date: string; // YYYY-MM-DD
  stages: SleepStage[];
  source?: string;
};

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { date, stages, source = "apple_health" }: SleepImportRequest = await req.json();

    if (!date || !stages || !Array.isArray(stages)) {
      return new NextResponse("Missing date or stages array", { status: 400 });
    }

    const sb = supabaseAdmin();

    // Remove existing rows for this sample_date
    const { error: deleteError } = await sb.from("sleep_data").delete().eq("sample_date", date);
    if (deleteError) {
      console.warn("Could not delete existing sleep data:", deleteError);
    }

    const nowIso = new Date().toISOString();

    const records = stages.map((stage, idx) => {
      const duration = Math.max(0, durationToMinutes(stage.duration_minutes as any));
      const normalizedStage = normalizeStage(stage.type);
      const startDate = parseDateTime(date, stage.start_time);
      const payload = {
        date_time: startDate.toISOString(),
        type: normalizedStage,
        duration_minutes: duration,
        source,
        raw: {
          idx,
          provided_start: stage.start_time ?? null,
          provided_end: stage.end_time ?? null,
          raw_text: stage.raw_text ?? null,
        },
        created_at: nowIso,
      };
      return payload;
    });

    const { data, error } = await sb.from("sleep_data").insert(records).select("id,type,duration_minutes");
    if (error) throw error;

    const summary = stages.reduce(
      (acc, stage) => {
        const minutes = Math.max(0, durationToMinutes(stage.duration_minutes as any));
        const normalizedStage = normalizeStage(stage.type);
        if (["core", "rem", "deep", "asleep"].includes(normalizedStage)) {
          acc.totalSleep += minutes;
        }
        if (normalizedStage === "core") acc.core += minutes;
        if (normalizedStage === "rem") acc.rem += minutes;
        if (normalizedStage === "deep") acc.deep += minutes;
        if (normalizedStage === "awake") acc.awake += minutes;
        if (normalizedStage === "in_bed") acc.inBed += minutes;
        return acc;
      },
      {
        totalSleep: 0,
        core: 0,
        rem: 0,
        deep: 0,
        awake: 0,
        inBed: 0,
      }
    );

    const sleepEfficiency = summary.inBed > 0 ? Math.round((summary.totalSleep / summary.inBed) * 100) : null;

    const { data: existingMetric } = await sb
      .from("daily_metrics")
      .select("id")
      .eq("date", date)
      .maybeSingle();

    if (existingMetric) {
      await sb
        .from("daily_metrics")
        .update({
          sleep_minutes: summary.totalSleep,
          sleep_efficiency: sleepEfficiency,
          updated_at: nowIso,
        })
        .eq("id", existingMetric.id);
    } else {
      await sb.from("daily_metrics").insert([
        {
          date,
          sleep_minutes: summary.totalSleep,
          sleep_efficiency: sleepEfficiency,
          updated_at: nowIso,
        },
      ]);
    }

    return NextResponse.json({
      message: "Sleep data imported successfully",
      inserted: data?.length ?? 0,
      summary: {
        ...summary,
        sleepEfficiency,
      },
    });
  } catch (error: any) {
    console.error("Sleep import error:", error);
    return new NextResponse(error.message || "Internal error", { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const limit = Number(searchParams.get("limit") || "100");

  const sb = supabaseAdmin();

  let query = sb
    .from("sleep_data")
    .select("id,date_time,type,duration_minutes,source,raw,sample_date")
    .order("sample_date", { ascending: false })
    .order("date_time", { ascending: true })
    .limit(limit);

  if (date) {
    query = query.eq("sample_date", date);
  }

  const { data, error } = await query;

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data ?? []);
}
