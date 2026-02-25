import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import {
  addMinutes,
  dateToUtcStart,
  durationToMinutes,
  ensureDailyMetricRow,
  normalizeStage,
  replaceSamplesForDate,
  SleepSampleInsert,
} from "@/lib/sleepSamples";

const FALLBACK_TIMEZONE = "T00:00:00-08:00";

const parseDateTime = (value?: string | null, fallbackDate?: string) => {
  if (value) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  if (fallbackDate) {
    return new Date(`${fallbackDate}${FALLBACK_TIMEZONE}`);
  }
  return null;
};

type SleepEntry = {
  date_time?: string;
  sleep_type?: string;
  duration?: string | number;
};

type Body = {
  text?: string;
  date: string;
  entries?: SleepEntry[];
};

const SOURCE_TEXT = "sleep_parse";
const SOURCE_ENTRIES = "sleep_entries";

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body: Body = await req.json();
    const date = body.date;
    const hasEntries = Array.isArray(body.entries) && body.entries.length > 0;
    const text = body.text?.trim();

    if (!date) {
      return new NextResponse("Missing date", { status: 400 });
    }
    if (!hasEntries && !text) {
      return new NextResponse("Missing text or entries", { status: 400 });
    }

    const sb = supabaseAdmin();
    const source = hasEntries ? SOURCE_ENTRIES : SOURCE_TEXT;
    const samples: SleepSampleInsert[] = [];
    const totals = { core: 0, rem: 0, deep: 0, awake: 0, unknown: 0 };

    const sequentialStart = dateToUtcStart(date);
    let cursor = new Date(sequentialStart);

    const addSample = (stageValue: string | null | undefined, minutes: number, raw: any, ts?: Date | null) => {
      const normalized = normalizeStage(stageValue);
      const stage = normalized === "total" ? "unknown" : normalized;
      if (!minutes) return;
      const timestamp = ts ?? new Date(cursor);
      if (!ts) {
        cursor = addMinutes(cursor, Math.max(1, minutes));
      }
      samples.push({
        sample_ts: timestamp.toISOString(),
        stage,
        duration_minutes: minutes,
        raw,
      });
      if (stage === "awake") {
        totals.awake += minutes;
      } else if (stage === "core" || stage === "rem" || stage === "deep") {
        totals[stage] += minutes;
      } else {
        totals.unknown += minutes;
      }
    };

    if (hasEntries) {
      for (const entry of body.entries!) {
        const minutes = durationToMinutes(entry.duration);
        if (!minutes) continue;
        const parsed = parseDateTime(entry.date_time, date);
        addSample(entry.sleep_type ?? "unknown", minutes, entry, parsed ?? undefined);
      }
    } else if (text) {
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      for (const line of lines) {
        const [stagePart, durationPart, ...rest] = line.split(",");
        if (!stagePart || !durationPart) continue;

        const stage = stagePart.trim();
        const duration = durationPart.trim();
        const minutes = durationToMinutes(duration);
        if (!minutes) continue;

        const meta: Record<string, any> = { line };
        let startTs: Date | null = null;
        let endTs: Date | null = null;

        rest.forEach((chunk) => {
          const [key, value] = chunk.split("=").map((s) => s.trim());
          if (!key || !value) return;
          const normalizedKey = key.toLowerCase();
          if (normalizedKey === "start") {
            startTs = parseDateTime(date, value);
            meta.start = value;
          } else if (normalizedKey === "end") {
            endTs = parseDateTime(date, value);
            meta.end = value;
          } else {
            meta[key] = value;
          }
        });

        addSample(stage, minutes, meta, startTs ?? undefined);
      }
    }

    await replaceSamplesForDate(
      sb,
      date,
      source,
      samples,
      source === SOURCE_ENTRIES ? [SOURCE_TEXT, "sleep_json", "ingest_health"] : ["ingest_health"]
    );
    await ensureDailyMetricRow(sb, date);

    const totalSleep = totals.core + totals.rem + totals.deep + totals.unknown;
    const inBed = totalSleep + totals.awake;
    const sleepEfficiency = inBed > 0 ? Math.round((totalSleep / inBed) * 100) : null;

    // Delete existing sleep data for this date first
    const { error: deleteError } = await sb
      .from("sleep_data")
      .delete()
      .eq("date", date);
      
    if (deleteError) console.warn("Could not delete existing sleep data:", deleteError);
    
    // Insert individual sleep stage records into sleep_data table
    const sleepRecords = [
      { date, sleep_type: 'core', duration_minutes: totals.core },
      { date, sleep_type: 'rem', duration_minutes: totals.rem },
      { date, sleep_type: 'deep', duration_minutes: totals.deep },
      { date, sleep_type: 'awake', duration_minutes: totals.awake },
    ].filter(record => record.duration_minutes > 0);
    
    if (sleepRecords.length > 0) {
      const { error: sleepError } = await sb
        .from("sleep_data")
        .insert(sleepRecords);
        
      if (sleepError) console.warn("Failed to save sleep data:", sleepError);
    }

    return NextResponse.json({
      message: "Sleep data parsed and saved",
      totals,
      total_sleep_minutes: totalSleep,
      in_bed_minutes: inBed,
      sleep_efficiency: sleepEfficiency,
      sample_count: samples.length,
    });
  } catch (error: any) {
    console.error("Sleep parse error:", error);
    return new NextResponse(error.message || "Internal error", { status: 500 });
  }
}
