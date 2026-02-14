import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCookieName, verifyAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const secret = process.env.APP_COOKIE_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login?err=missing_cookie_secret", req.url), 303);
  }

  const cookie = (await cookies()).get(getCookieName())?.value;
  const ok = await verifyAuthCookie(cookie, secret);
  if (!ok) {
    return NextResponse.redirect(new URL("/login?next=/weights", req.url), 303);
  }
  const form = await req.formData();
  const date = String(form.get("date") ?? "");
  const weightStr = String(form.get("weight_lbs") ?? "");

  const weight = Number(weightStr);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.redirect(new URL("/weights?err=bad_date", req.url), 303);
  }
  if (!Number.isFinite(weight) || weight <= 0 || weight > 2000) {
    return NextResponse.redirect(new URL("/weights?err=bad_weight", req.url), 303);
  }

  const sb = supabaseAdmin();

  // date is unique, so we can upsert by date
  const { error } = await sb.from("weights").upsert(
    {
      date,
      weight_lbs: Math.round(weight * 10) / 10,
    },
    { onConflict: "date" }
  );

  if (error) {
    return NextResponse.redirect(new URL(`/weights?err=${encodeURIComponent(error.code ?? "db")}`, req.url), 303);
  }

  return NextResponse.redirect(new URL("/weights", req.url), 303);
}
