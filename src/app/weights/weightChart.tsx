"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeightRow } from "./page";

function rollingAvg(values: number[], window: number) {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push(Number.isFinite(avg) ? avg : null);
  }
  return out;
}

export function WeightChart({ weights }: { weights: WeightRow[] }) {
  const values = weights.map((w) => Number(w.weight_lbs));
  const avg7 = rollingAvg(values, 7);

  const data = weights.map((w, i) => ({
    date: w.date.slice(5), // MM-DD
    weight: Number(w.weight_lbs),
    avg7: avg7[i] ? Number(avg7[i]!.toFixed(2)) : null,
  }));

  if (data.length === 0) {
    return <p className="text-sm text-zinc-600">No data yet. Add your first weigh-in.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
          <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="#0f172a"
            strokeWidth={2}
            dot={false}
            name="Weight"
          />
          <Line
            type="monotone"
            dataKey="avg7"
            stroke="#64748b"
            strokeDasharray="6 4"
            strokeWidth={2}
            dot={false}
            name="7-day avg"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
