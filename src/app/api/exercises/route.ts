import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const sb = supabaseAdmin();
  let query = sb
    .from("exercises")
    .select(
      "id,name,split_tag,pattern,angle,primary_muscles,secondary_muscles,equipment,rest_seconds_default,setup_seconds_default,set_seconds_default,is_unilateral"
    )
    .order("name", { ascending: true })
    .limit(200);

  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data ?? []);
}
