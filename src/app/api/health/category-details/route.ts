import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "30", 10);

  if (!category) {
    return new NextResponse("Missing category parameter", { status: 400 });
  }

  const sb = supabaseAdmin();

  if (category === "sleep") {
    // Fetch last 30 days of sleep data grouped by date_bucket
    const { data, error } = await sb
      .from("sleep_data_processed")
      .select("date_bucket, value, total_minutes")
      .order("date_bucket", { ascending: false })
      .limit(limit * 10); // Over-fetch since we'll need to aggregate

    if (error) return new NextResponse(error.message, { status: 500 });

    // Aggregate by date and calculate totals
    const byDate = new Map<string, Record<string, number>>();
    for (const row of data || []) {
      if (!byDate.has(row.date_bucket)) {
        byDate.set(row.date_bucket, {});
      }
      const entry = byDate.get(row.date_bucket)!;
      entry[row.value] = (entry[row.value] || 0) + row.total_minutes;
    }

    const results = Array.from(byDate.entries())
      .slice(0, limit)
      .map(([date, metrics]) => {
        const core = metrics["core"] || 0;
        const deep = metrics["deep"] || 0;
        const rem = metrics["rem"] || 0;
        const totalMins = core + deep + rem;
        const hours = Math.floor(totalMins / 60);
        const mins = totalMins % 60;

        return {
          date,
          core,
          deep,
          rem,
          total_minutes: totalMins,
          total_hours: `${hours}h ${mins}m`,
        };
      });

    return NextResponse.json({ category: "sleep", data: results });
  }

  if (category === "nutrition") {
    // Fetch nutrition data from daily_metrics
    const { data, error } = await sb
      .from("daily_metrics")
      .select("date, calories_in, protein_g, carbs_g, fat_g")
      .order("date", { ascending: false })
      .limit(limit);

    if (error) return new NextResponse(error.message, { status: 500 });

    const results = (data || [])
      .filter((row) => row.calories_in != null)
      .map((row) => ({
        date: row.date,
        calories: row.calories_in || 0,
        protein: row.protein_g || 0,
        carbs: row.carbs_g || 0,
        fat: row.fat_g || 0,
      }));

    return NextResponse.json({ category: "nutrition", data: results });
  }

  if (category === "workouts") {
    // Fetch workouts from daily_metrics
    const { data, error } = await sb
      .from("daily_metrics")
      .select("date, exercise_minutes, steps")
      .order("date", { ascending: false })
      .limit(limit);

    if (error) return new NextResponse(error.message, { status: 500 });

    const results = (data || [])
      .filter((row) => row.exercise_minutes != null && row.exercise_minutes > 0)
      .map((row) => ({
        date: row.date,
        exercise: "Logged Exercise",
        duration: row.exercise_minutes || 0,
        steps: row.steps || 0,
      }));

    return NextResponse.json({ category: "workouts", data: results });
  }

  if (category === "weight") {
    // Fetch weight data from daily_metrics
    const { data, error } = await sb
      .from("daily_metrics")
      .select("date, weight_lbs")
      .not("weight_lbs", "is", null)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) return new NextResponse(error.message, { status: 500 });

    // Reverse to get chronological order for trend calculation
    const sorted = (data || []).reverse();
    
    const results = sorted.map((row, idx) => {
      const weight = row.weight_lbs || 0;
      let trend = "—";
      if (idx > 0) {
        const prevWeight = sorted[idx - 1].weight_lbs || 0;
        if (weight < prevWeight) trend = "↓ Down";
        else if (weight > prevWeight) trend = "↑ Up";
        else trend = "→ Stable";
      }
      return {
        date: row.date,
        weight,
        trend,
      };
    }).reverse(); // Reverse back to descending for display

    return NextResponse.json({ category: "weight", data: results });
  }

  if (category === "heart") {
    // Heart health: resting heart rate
    const { data, error } = await sb
      .from("daily_metrics")
      .select("date, resting_hr")
      .order("date", { ascending: false })
      .limit(limit);

    if (error) return new NextResponse(error.message, { status: 500 });

    const results = (data || [])
      .filter((row) => row.resting_hr != null)
      .map((row) => ({
        date: row.date,
        resting_hr: row.resting_hr || 0,
      }));

    return NextResponse.json({ category: "heart", data: results });
  }

  return new NextResponse("Unknown category", { status: 400 });
}
