import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

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

  const start = new Date(`${targetDate}T00:00:00Z`).toISOString();
  const endDate = new Date(`${targetDate}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const end = endDate.toISOString();

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("sleep_data")
    .select("id,date_time,type,duration_minutes,source,raw")
    .gte("date_time", start)
    .lt("date_time", end)
    .order("date_time", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  const entries = (data || [])
    .filter((row) => VALID_STAGES.has(row.type))
    .map((row) => ({
      ...row,
      date_time: row.date_time,
      duration_minutes: row.duration_minutes || 0,
    }));

  return NextResponse.json({ date: targetDate, entries });
}
