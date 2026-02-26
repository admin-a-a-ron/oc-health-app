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
  const targetDate = searchParams.get("date") || getDefaultDate();

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("sleep_data_processed")
    .select("date_bucket,value,total_minutes,sample_count")
    .eq("date_bucket", targetDate)
    .order("value", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  const entries = (data || [])
    .map((row, idx) => {
      const stage = normalizeStage(row.value);
      if (!VALID_STAGES.has(stage)) return null;
      return {
        id: `${row.date_bucket}-${stage}-${idx}`,
        date_time: `${row.date_bucket}T00:00:00Z`,
        type: stage,
        duration_minutes: row.total_minutes || 0,
        source: "sleep_data_processed",
        raw: { sample_count: row.sample_count ?? 0 },
      };
    })
    .filter(Boolean);

  return NextResponse.json({ date: targetDate, entries });
}
