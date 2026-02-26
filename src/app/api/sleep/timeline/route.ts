import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import { normalizeStage } from "@/lib/sleepSamples";

const VALID_STAGES = new Set(["core", "rem", "deep", "awake", "in_bed", "asleep"]);

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateOnly(d);
};

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const singleDate = searchParams.get("date") || null;

  let rangeStart = startParam || endParam || singleDate || getDefaultDate();
  let rangeEnd = endParam || startParam || singleDate || rangeStart;

  if (rangeStart > rangeEnd) {
    const tmp = rangeStart;
    rangeStart = rangeEnd;
    rangeEnd = tmp;
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("sleep_data_processed")
    .select("date_bucket,value,total_minutes,sample_count")
    .gte("date_bucket", rangeStart)
    .lte("date_bucket", rangeEnd)
    .order("date_bucket", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  const aggregated = new Map<string, { minutes: number; samples: number }>();

  (data || []).forEach((row) => {
    const stage = normalizeStage(row.value);
    if (!VALID_STAGES.has(stage)) return;
    const entry = aggregated.get(stage) || { minutes: 0, samples: 0 };
    entry.minutes += row.total_minutes || 0;
    entry.samples += row.sample_count || 0;
    aggregated.set(stage, entry);
  });

  const entries = Array.from(aggregated.entries()).map(([stage, info], idx) => ({
    id: `${rangeStart}-${rangeEnd}-${stage}-${idx}`,
    date_time: `${rangeEnd}T00:00:00Z`,
    type: stage,
    duration_minutes: info.minutes,
    source: "sleep_data_processed",
    raw: { sample_count: info.samples, date_range: { start: rangeStart, end: rangeEnd } },
  }));

  return NextResponse.json({ date: rangeEnd, entries });
}
