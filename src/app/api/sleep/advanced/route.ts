import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyBearerAuth } from "@/lib/auth";

type SleepStage = {
  type: 'core' | 'rem' | 'deep' | 'awake' | 'in_bed' | 'asleep';
  duration_minutes: number;
  start_time?: string; // ISO string
  end_time?: string; // ISO string
};

type SleepImportRequest = {
  date: string; // YYYY-MM-DD
  stages: SleepStage[];
  source?: string;
};

export async function POST(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { date, stages, source = 'apple_health' }: SleepImportRequest = await req.json();
    
    if (!date || !stages || !Array.isArray(stages)) {
      return new NextResponse("Missing date or stages array", { status: 400 });
    }

    const sb = supabaseAdmin();
    
    // Delete existing sleep data for this date (if re-importing)
    const { error: deleteError } = await sb
      .from("sleep_data")
      .delete()
      .eq("date", date);
      
    if (deleteError) {
      console.warn("Could not delete existing sleep data:", deleteError);
    }

    // Prepare records for insertion
    const records = stages.map(stage => ({
      date,
      sleep_type: stage.type,
      duration_minutes: stage.duration_minutes,
      start_time: stage.start_time || null,
      end_time: stage.end_time || null,
      source,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Insert all sleep stage records
    const { data, error } = await sb
      .from("sleep_data")
      .insert(records)
      .select("id, sleep_type, duration_minutes");

    if (error) throw error;
    
    // Calculate summary for daily_metrics
    const summary = stages.reduce((acc, stage) => {
      if (stage.type === 'core' || stage.type === 'rem' || stage.type === 'deep') {
        acc.totalSleep += stage.duration_minutes;
        
        if (stage.type === 'core') acc.core += stage.duration_minutes;
        if (stage.type === 'rem') acc.rem += stage.duration_minutes;
        if (stage.type === 'deep') acc.deep += stage.duration_minutes;
      }
      if (stage.type === 'awake') acc.awake += stage.duration_minutes;
      if (stage.type === 'in_bed') acc.inBed += stage.duration_minutes;
      
      return acc;
    }, {
      totalSleep: 0,
      core: 0,
      rem: 0,
      deep: 0,
      awake: 0,
      inBed: 0,
    });
    
    const sleepEfficiency = summary.inBed > 0 
      ? Math.round((summary.totalSleep / summary.inBed) * 100) 
      : 0;

    // Update daily_metrics with sleep summary
    const { data: existingMetric } = await sb
      .from("daily_metrics")
      .select("id")
      .eq("date", date)
      .maybeSingle();

    if (existingMetric) {
      await sb
        .from("daily_metrics")
        .update({
          sleep_minutes: summary.totalSleep,
          sleep_efficiency: sleepEfficiency,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingMetric.id);
    } else {
      await sb
        .from("daily_metrics")
        .insert([{
          date,
          sleep_minutes: summary.totalSleep,
          sleep_efficiency: sleepEfficiency,
          updated_at: new Date().toISOString(),
        }]);
    }

    return NextResponse.json({
      message: "Sleep data imported successfully",
      inserted: data.length,
      summary: {
        ...summary,
        sleepEfficiency,
      },
      records: data,
    });
    
  } catch (error: any) {
    console.error("Sleep import error:", error);
    return new NextResponse(error.message || "Internal error", { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!verifyBearerAuth(req.headers.get("authorization"))) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const limit = searchParams.get("limit") || "100";

  const sb = supabaseAdmin();
  
  let query = sb
    .from("sleep_data")
    .select("*")
    .order("date", { ascending: false })
    .order("start_time", { ascending: true })
    .limit(parseInt(limit));
    
  if (date) {
    query = query.eq("date", date);
  }

  const { data, error } = await query;

  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json(data ?? []);
}
