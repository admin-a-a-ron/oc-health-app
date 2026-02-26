import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

const VALID_STAGES = new Set(["core", "rem", "deep", "awake", "in_bed", "asleep"]);
const SESSION_GAP_MS = 6 * 60 * 60 * 1000; // 6 hours between sleep sessions
const SLEEP_TIMEZONE = "America/Los_Angeles";
const HALF_DAY_MS = 12 * 60 * 60 * 1000;
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SLEEP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatDate = (date: Date) => {
  const parts = dateFormatter.formatToParts(date);
  const lookup: Record<string, string> = {};
  parts.forEach((part) => {
    lookup[part.type] = part.value;
  });
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
};

const toSleepDate = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const shifted = new Date(date.getTime() + HALF_DAY_MS);
  return formatDate(shifted);
};

const getDefaultDate = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return toSleepDate(d);
};

type SleepRow = {
  id: string;
  date_time: string;
  type: string;
  duration_minutes: number | null;
  source?: string | null;
  raw?: any;
};

const annotateSessions = (rows: SleepRow[]) => {
  const annotated: (SleepRow & { sleep_date: string })[] = [];
  let currentDate: string | null = null;
  let lastTs = 0;

  for (const row of rows) {
    const ts = Date.parse(row.date_time);
    if (Number.isNaN(ts)) continue;

    if (!currentDate || ts - lastTs > SESSION_GAP_MS) {
      currentDate = toSleepDate(row.date_time);
    }

    lastTs = ts;
    annotated.push({ ...row, sleep_date: currentDate });
  }

  return annotated;
};

const buildWindowForDate = (dateString?: string) => {
  if (!dateString) {
    const end = new Date();
    const start = new Date(end.getTime() - 5 * 24 * 60 * 60 * 1000);
    return { start, end };
  }

  const anchor = new Date(`${dateString}T18:00:00Z`);
  const start = new Date(anchor.getTime() - 24 * 60 * 60 * 1000);
  const end = new Date(anchor.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
};

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const requestedDate = searchParams.get("date");
  const { start, end } = buildWindowForDate(requestedDate ?? undefined);

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("sleep_data")
    .select("id,date_time,type,duration_minutes,source,raw")
    .gte("date_time", start.toISOString())
    .lt("date_time", end.toISOString())
    .order("date_time", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });

  const annotated = annotateSessions((data || []).filter((row) => VALID_STAGES.has(row.type)));

  if (!annotated.length) {
    return NextResponse.json({ date: requestedDate ?? getDefaultDate(), entries: [] });
  }

  let targetDate = requestedDate;
  if (!targetDate) {
    targetDate = annotated[annotated.length - 1]?.sleep_date ?? getDefaultDate();
  }

  const entries = annotated.filter((row) => row.sleep_date === targetDate);

  return NextResponse.json({ date: targetDate, entries });
}
