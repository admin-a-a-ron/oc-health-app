import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";
import { formatSleepBucket } from "@/lib/sleepBuckets";

const SEEN_FIELDS = ["value", "duration", "start", "end", "start_rfc", "end_rfc", "date"];

const parseTimestamp = (row: any, key: "start" | "end") => {
  const candidates = [
    row[`${key}_rfc`],
    row[key],
    row[`${key}Time`],
    row[`${key}_time`],
  ].filter(Boolean);
  for (const candidate of candidates) {
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  if (row.date && row[key]) {
    const fallback = `${row.date}T${row[key]}`;
    const parsed = Date.parse(fallback);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }
  return null;
};

const parseDuration = (raw: any): number => {
  if (raw == null) return 0;
  if (typeof raw === "number") {
    return raw > 1000 ? Math.round(raw / 60) : Math.round(raw);
  }
  const str = String(raw).trim();
  if (!str) return 0;
  if (str.includes(":")) {
    const parts = str.split(":").map((part) => Number(part));
    if (parts.every((part) => Number.isFinite(part))) {
      if (parts.length === 3) {
        const [h, m, s] = parts;
        return Math.round(h * 60 + m + s / 60);
      }
      if (parts.length === 2) {
        const [m, s] = parts;
        return Math.round(m + s / 60);
      }
    }
  }
  const numeric = Number(str);
  if (Number.isFinite(numeric)) {
    return numeric > 1000 ? Math.round(numeric / 60) : Math.round(numeric);
  }
  return 0;
};

const buildDedupKey = (row: Record<string, any>) =>
  SEEN_FIELDS.map((field) => (row[field] ?? "").toString().trim()).join("|");

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: rawRows, error } = await sb.from("sleep_data_raw").select("*");
  if (error) return new NextResponse(error.message, { status: 500 });

  const seen = new Set<string>();
  const aggregates = new Map<string, { date_bucket: string; value: string; total_minutes: number; sample_count: number }>();

  for (const row of rawRows || []) {
    const key = buildDedupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);

    const startTs = parseTimestamp(row, "start");
    const endTs = parseTimestamp(row, "end");

    let minutes = parseDuration(row.duration);
    if (!minutes && startTs && endTs) {
      minutes = Math.max(0, Math.round((endTs.getTime() - startTs.getTime()) / 60000));
    }
    if (!minutes) continue;

    const bucketSource = startTs?.toISOString() ?? (row.date ? `${row.date}T00:00:00Z` : undefined);
    const dateBucket = bucketSource ? formatSleepBucket(bucketSource) : null;
    if (!dateBucket) continue;

    const value = (row.value ?? row.stage ?? row.type ?? "unknown").toString().toLowerCase();
    const mapKey = `${dateBucket}|${value}`;
    const current = aggregates.get(mapKey) || { date_bucket: dateBucket, value, total_minutes: 0, sample_count: 0 };
    current.total_minutes += minutes;
    current.sample_count += 1;
    aggregates.set(mapKey, current);
  }

  if (!aggregates.size) {
    return NextResponse.json({ processed: 0, rows: [] });
  }

  const rows = Array.from(aggregates.values());
  const { error: upsertError } = await sb.from("sleep_data_processed").upsert(rows, { onConflict: "date_bucket,value" });
  if (upsertError) return new NextResponse(upsertError.message, { status: 500 });

  return NextResponse.json({ processed: rows.length, rows });
}
