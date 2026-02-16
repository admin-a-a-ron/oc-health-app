import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await ctx.params;
  const sb = supabaseAdmin();

  const { data: sess, error: sessErr } = await sb
    .from("workout_sessions")
    .select("id,date,plan_type,plan_subtype,target_minutes,gym_id,started_at,ended_at,duration_seconds")
    .eq("id", id)
    .limit(1);

  if (sessErr) return new NextResponse(sessErr.message, { status: 500 });
  if (!sess?.[0]) return new NextResponse("Not found", { status: 404 });

  const { data: exRows, error: exErr } = await sb
    .from("session_exercises")
    .select("id,role,planned_sets,rep_min,rep_max,rest_seconds, exercise:exercises(id,name,rest_seconds_default)")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (exErr) return new NextResponse(exErr.message, { status: 500 });

  const sessionExerciseIds = (exRows ?? []).map((r: any) => r.id);
  let sets: any[] = [];
  if (sessionExerciseIds.length) {
    const { data: setRows, error: setErr } = await sb
      .from("session_sets")
      .select("id,session_exercise_id,set_index,weight_lbs,reps,created_at")
      .in("session_exercise_id", sessionExerciseIds)
      .order("created_at", { ascending: true });
    if (setErr) return new NextResponse(setErr.message, { status: 500 });
    sets = setRows ?? [];
  }

  const bySe: Record<string, any[]> = {};
  for (const s of sets) {
    const k = s.session_exercise_id;
    bySe[k] = bySe[k] ?? [];
    bySe[k].push(s);
  }

  const payload = {
    ...sess[0],
    exercises: (exRows ?? []).map((r: any) => ({ ...r, sets: bySe[r.id] ?? [] })),
  };

  return NextResponse.json(payload);
}
