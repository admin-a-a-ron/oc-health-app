import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    session_exercise_id: string;
    weight_lbs?: string | number;
    reps?: string | number;
  };

  const session_exercise_id = String(body.session_exercise_id ?? "");
  if (!session_exercise_id) return new NextResponse("Missing session_exercise_id", { status: 400 });

  const weight_lbs = body.weight_lbs === undefined || body.weight_lbs === null || body.weight_lbs === "" ? null : Number(body.weight_lbs);
  const reps = body.reps === undefined || body.reps === null || body.reps === "" ? null : Number(body.reps);

  if (weight_lbs !== null && (!Number.isFinite(weight_lbs) || weight_lbs < 0 || weight_lbs > 2000)) {
    return new NextResponse("Bad weight", { status: 400 });
  }
  if (reps !== null && (!Number.isFinite(reps) || reps < 0 || reps > 200)) {
    return new NextResponse("Bad reps", { status: 400 });
  }

  const sb = supabaseAdmin();

  // Verify the session_exercise belongs to this session id
  const { data: se, error: seErr } = await sb
    .from("session_exercises")
    .select("id")
    .eq("id", session_exercise_id)
    .eq("session_id", id)
    .limit(1);
  if (seErr) return new NextResponse(seErr.message, { status: 500 });
  if (!se?.[0]) return new NextResponse("Not found", { status: 404 });

  // Determine next set index
  const { data: existing, error: exErr } = await sb
    .from("session_sets")
    .select("set_index")
    .eq("session_exercise_id", session_exercise_id)
    .order("set_index", { ascending: false })
    .limit(1);
  if (exErr) return new NextResponse(exErr.message, { status: 500 });
  const nextIndex = (existing?.[0]?.set_index ?? 0) + 1;

  const { error } = await sb.from("session_sets").insert({
    session_exercise_id,
    set_index: nextIndex,
    weight_lbs,
    reps,
  });
  if (error) return new NextResponse(error.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
