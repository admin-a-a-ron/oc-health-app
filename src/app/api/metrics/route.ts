import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("daily_metrics")
    .select(
      "date,weight_lbs,steps,sleep_minutes,calories_in,protein_g,carbs_g,fat_g,active_calories_out,exercise_minutes,resting_hr,updated_at"
    )
    .order("date", { ascending: true });

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data ?? []);
}
