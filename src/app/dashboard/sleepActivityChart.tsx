"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type DailyMetricsRow = {
  date: string;
  weight_lbs: number | null;
  steps: number | null;
  sleep_minutes: number | null;
  calories_in: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  active_calories_out: number | null;
  exercise_minutes: number | null;
  resting_hr: number | null;
  updated_at: string | null;
};

interface SleepActivityChartProps {
  metrics: DailyMetricsRow[];
}

export function SleepActivityChart({ metrics }: SleepActivityChartProps) {
  // Filter and transform data for the last 30 days
  const chartData = metrics
    .filter(m => m.sleep_minutes != null && m.steps != null)
    .slice(-30) // Last 30 days
    .map(m => ({
      date: new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      sleepHours: m.sleep_minutes ? (m.sleep_minutes / 60).toFixed(1) : 0,
      steps: m.steps ? Math.round(m.steps / 1000) : 0, // Convert to thousands
      exerciseMinutes: m.exercise_minutes || 0,
      restingHR: m.resting_hr || 0,
    }));

  if (chartData.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
        <p className="text-zinc-500">No sleep/activity data available</p>
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            stroke="#888"
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 12 }}
            stroke="#888"
            label={{ value: 'Sleep (hrs)', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            tick={{ fontSize: 12 }}
            stroke="#888"
            label={{ value: 'Steps (k)', angle: 90, position: 'insideRight', offset: -10 }}
          />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="sleepHours"
            stroke="#8884d8"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            name="Sleep (hrs)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="steps"
            stroke="#82ca9d"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            name="Steps (k)"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="exerciseMinutes"
            stroke="#ffc658"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 6 }}
            name="Exercise (min)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}