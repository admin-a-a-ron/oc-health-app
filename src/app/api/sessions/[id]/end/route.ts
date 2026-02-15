import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;
  const sb = supabaseAdmin();

  const { data: sess, error: sErr } = await sb
    .from("workout_sessions")
    .select("started_at")
    .eq("id", id)
    .limit(1);
  if (sErr) return new NextResponse(sErr.message, { status: 500 });

  const startedAt = sess?.[0]?.started_at ? new Date(sess[0].started_at).getTime() : null;
  const endedAt = Date.now();
  const duration_seconds = startedAt ? Math.max(0, Math.floor((endedAt - startedAt) / 1000)) : null;

  const { error } = await sb
    .from("workout_sessions")
    .update({ ended_at: new Date(endedAt).toISOString(), duration_seconds })
    .eq("id", id);

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
