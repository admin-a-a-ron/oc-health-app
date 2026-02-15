import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

type PlanType = "ppl" | "framework" | "full_body";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = (await req.json()) as { plan_type?: PlanType; target_minutes?: number };
  const plan_type: PlanType = body.plan_type ?? "framework";
  const target_minutes = Math.max(30, Math.min(120, Number(body.target_minutes ?? 60)));

  const sb = supabaseAdmin();

  const { data: sessionRows, error: sessionErr } = await sb
    .from("workout_sessions")
    .insert({ date: todayDateString(), plan_type, target_minutes })
    .select("id")
    .limit(1);

  if (sessionErr) return new NextResponse(sessionErr.message, { status: 500 });
  const sessionId = sessionRows?.[0]?.id as string;

  // Strength-first: 1 main + 1 secondary + 1 accessory (optional core depending on time)
  // This is a simple v1 generator. We'll evolve this into a proper time-budget planner.
  const wantsCore = target_minutes >= 55;

  // Define role requirements by plan_type
  const roles: Array<{ role: string; split_tag: string; angle?: string | null; pattern?: string | null; sets: number; rep_min: number; rep_max: number; rest: number }> = [];

  if (plan_type === "ppl") {
    // Determine next day type by looking at last session
    const { data: last, error: lastErr } = await sb
      .from("workout_sessions")
      .select("plan_subtype")
      .eq("plan_type", "ppl")
      .order("date", { ascending: false })
      .limit(1);
    if (lastErr) return new NextResponse(lastErr.message, { status: 500 });
    const lastSubtype = (last?.[0]?.plan_subtype as string | null) ?? null;
    const nextSubtype = lastSubtype === "push" ? "pull" : lastSubtype === "pull" ? "legs" : "push";

    // store subtype
    await sb.from("workout_sessions").update({ plan_subtype: nextSubtype }).eq("id", sessionId);

    if (nextSubtype === "push") {
      roles.push(
        { role: "main_lift", split_tag: "push", angle: "flat", pattern: "horizontal", sets: 3, rep_min: 6, rep_max: 10, rest: 120 },
        { role: "secondary", split_tag: "push", angle: "incline", pattern: "horizontal", sets: 3, rep_min: 8, rep_max: 12, rest: 120 },
        { role: "accessory", split_tag: "push", angle: "vertical", pattern: "vertical", sets: 2, rep_min: 10, rep_max: 15, rest: 90 }
      );
    } else if (nextSubtype === "pull") {
      roles.push(
        { role: "main_lift", split_tag: "pull", angle: "vertical", pattern: "vertical", sets: 3, rep_min: 6, rep_max: 12, rest: 120 },
        { role: "secondary", split_tag: "pull", angle: "horizontal", pattern: "horizontal", sets: 3, rep_min: 8, rep_max: 12, rest: 120 },
        { role: "accessory", split_tag: "arms", angle: null, pattern: "isolation", sets: 2, rep_min: 10, rep_max: 15, rest: 90 }
      );
    } else {
      roles.push(
        { role: "main_lift", split_tag: "legs", angle: null, pattern: "squat", sets: 3, rep_min: 6, rep_max: 10, rest: 120 },
        { role: "secondary", split_tag: "legs", angle: null, pattern: "hinge", sets: 3, rep_min: 6, rep_max: 10, rest: 120 },
        { role: "accessory", split_tag: "legs", angle: null, pattern: "lunge", sets: 2, rep_min: 8, rep_max: 12, rest: 90 }
      );
    }
  } else if (plan_type === "full_body") {
    roles.push(
      { role: "main_lift", split_tag: "legs", angle: null, pattern: "squat", sets: 3, rep_min: 6, rep_max: 10, rest: 120 },
      { role: "secondary", split_tag: "push", angle: "incline", pattern: "horizontal", sets: 3, rep_min: 8, rep_max: 12, rest: 120 },
      { role: "accessory", split_tag: "pull", angle: "horizontal", pattern: "horizontal", sets: 3, rep_min: 8, rep_max: 12, rest: 120 }
    );
  } else {
    // framework emphasis day (simple default)
    roles.push(
      { role: "main_lift", split_tag: "legs", angle: null, pattern: "squat", sets: 3, rep_min: 6, rep_max: 10, rest: 120 },
      { role: "secondary", split_tag: "push", angle: "incline", pattern: "horizontal", sets: 3, rep_min: 8, rep_max: 12, rest: 120 },
      { role: "accessory", split_tag: "pull", angle: "horizontal", pattern: "horizontal", sets: 3, rep_min: 8, rep_max: 12, rest: 120 }
    );
  }

  if (wantsCore) {
    roles.push({ role: "core", split_tag: "core", angle: "na", pattern: "core", sets: 2, rep_min: 10, rep_max: 20, rest: 90 });
  }

  // Query candidate exercises for each role and pick one
  const sessionExercises: any[] = [];
  for (const r of roles) {
    let q = sb
      .from("exercises")
      .select("id,name,rest_seconds_default")
      .limit(50);

    // split_tag
    q = q.eq("split_tag", r.split_tag);

    if (r.pattern) q = q.eq("pattern", r.pattern);
    if (r.angle && r.angle !== "na") q = q.eq("angle", r.angle);

    const { data, error } = await q;
    if (error) return new NextResponse(error.message, { status: 500 });
    const chosen = data && data.length ? pick(data as any[]) : null;
    if (!chosen) continue;

    sessionExercises.push({
      session_id: sessionId,
      exercise_id: chosen.id,
      role: r.role,
      planned_sets: r.sets,
      rep_min: r.rep_min,
      rep_max: r.rep_max,
      rest_seconds: r.rest,
    });
  }

  if (sessionExercises.length) {
    const { error: seErr } = await sb.from("session_exercises").insert(sessionExercises);
    if (seErr) return new NextResponse(seErr.message, { status: 500 });
  }

  return NextResponse.json({ id: sessionId });
}
