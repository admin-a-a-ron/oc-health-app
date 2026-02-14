import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("weights")
    .select("date,weight_lbs")
    .order("date", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: any = null;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    payload = await req.json();
  } else {
    const form = await req.formData();
    payload = Object.fromEntries(form.entries());
  }

  const date = String(payload?.date ?? "");
  const weight = Number(payload?.weight_lbs);

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new NextResponse("Bad date", { status: 400 });
  }
  if (!Number.isFinite(weight) || weight <= 0 || weight > 2000) {
    return new NextResponse("Bad weight", { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("weights").upsert(
    {
      date,
      weight_lbs: Math.round(weight * 10) / 10,
    },
    { onConflict: "date" }
  );

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
