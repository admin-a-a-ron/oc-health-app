"use client";

import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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

interface HealthScoreChartProps {
  metrics: DailyMetricsRow[];
  onCategoryClick?: (category: string) => void;
}

const average = (values: number[]) => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const clampScore = (value: number) => Math.max(0, Math.min(100, value));

export function HealthScoreChart({ metrics, onCategoryClick }: HealthScoreChartProps) {
  const windowed = metrics.slice(-7);
  if (!windowed.length) {
    return (
      <div className="h-80 flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
        <p className="text-zinc-500">No data available for health score calculation</p>
      </div>
    );
  }

  const sleepHours = average(windowed.map((m) => (m.sleep_minutes ?? 0) / 60)) ?? 0;
  const sleepScore = Math.max(0, Math.min(100, (sleepHours / 8) * 100));

  const avgSteps = average(windowed.map((m) => m.steps ?? 0)) ?? 0;
  const avgExercise = average(windowed.map((m) => m.exercise_minutes ?? 0)) ?? 0;
  const activityScore = Math.round(Math.min(100, (avgSteps / 8000) * 100) * 0.6 + Math.min(100, (avgExercise / 30) * 100) * 0.4);

  const avgProtein = average(windowed.map((m) => m.protein_g ?? 0)) ?? 0;
  const avgCalories = average(windowed.map((m) => m.calories_in ?? 0)) ?? 0;
  let nutritionScore = 0;
  if (avgCalories > 0) {
    const proteinPercent = (avgProtein * 4) / avgCalories;
    const proteinScore = Math.min(100, (avgProtein / 0.8 / 200) * 100);
    const balanceScore = Math.max(0, 100 - Math.abs(proteinPercent - 0.3) * 200);
    nutritionScore = Math.round((proteinScore + balanceScore) / 2);
  }

  const avgResting = average(windowed.map((m) => m.resting_hr ?? 0));
  let heartHealth = 0;
  if (avgResting != null) {
    if (avgResting >= 60 && avgResting <= 80) {
      heartHealth = 100 - Math.abs(avgResting - 70) * 3;
    } else {
      heartHealth = Math.max(0, 100 - Math.abs(avgResting - 70) * 2);
    }
  }

  const daysWithData = windowed.filter((m) =>
    [m.steps, m.sleep_minutes, m.exercise_minutes, m.calories_in, m.resting_hr].some((v) => v != null)
  ).length;
  const consistency = Math.round((daysWithData / windowed.length) * 100);

  const weightEntries = metrics
    .map((row) => ({ date: row.date, weight: toNumber(row.weight_lbs) }))
    .filter((entry): entry is { date: string; weight: number } => entry.weight != null && entry.weight > 0);

  let weightTrend: number | null = null;
  if (weightEntries.length >= 14) {
    const recent = weightEntries.slice(-7);
    const prior = weightEntries.slice(-14, -7);
    const avgRecent = average(recent.map((m) => m.weight));
    const avgPrior = average(prior.map((m) => m.weight));
    if (avgRecent != null && avgPrior != null && avgPrior !== 0) {
      const change = ((avgPrior - avgRecent) / avgPrior) * 100;
      weightTrend = clampScore(50 + change * 5);
    }
  } else if (weightEntries.length >= 2) {
    const first = weightEntries[0].weight;
    const last = weightEntries[weightEntries.length - 1].weight;
    if (first !== 0) {
      const change = ((first - last) / first) * 100;
      weightTrend = clampScore(50 + change * 4);
    }
  }

  const resolvedWeightTrend = weightTrend ?? 50;

  const scores = {
    sleep: Math.round(sleepScore),
    activity: Math.round(activityScore),
    nutrition: Math.round(nutritionScore),
    heartHealth: Math.round(Math.max(0, Math.min(100, heartHealth))),
    consistency,
    weightTrend: Math.round(resolvedWeightTrend),
  };

  const radarData = [
    { subject: 'Sleep', score: scores.sleep, fullMark: 100 },
    { subject: 'Activity', score: scores.activity, fullMark: 100 },
    { subject: 'Nutrition', score: scores.nutrition, fullMark: 100 },
    { subject: 'Heart Health', score: scores.heartHealth, fullMark: 100 },
    { subject: 'Consistency', score: scores.consistency, fullMark: 100 },
    { subject: 'Weight Trend', score: scores.weightTrend, fullMark: 100 },
  ];

  const overallScore = Math.round(
    scores.sleep * 0.2 +
      scores.activity * 0.2 +
      scores.nutrition * 0.2 +
      scores.heartHealth * 0.15 +
      scores.consistency * 0.15 +
      scores.weightTrend * 0.1
  );

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const getOverallStatus = (score: number) => {
    if (score >= 80) return 'Excellent Health';
    if (score >= 60) return 'Good Health';
    if (score >= 40) return 'Needs Improvement';
    return 'At Risk';
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-700">Overall Health Score</h3>
            <p className="mt-1 text-xs text-zinc-500">Based on 7-day averages</p>
          </div>
          <div className={`rounded-full ${getScoreBgColor(overallScore)} px-3 py-1`}>
            <span className={`text-sm font-bold ${getScoreColor(overallScore)}`}>
              {getOverallStatus(overallScore)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-6">
          <div className="relative h-32 w-32">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-4xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}</div>
                <div className="text-xs text-zinc-500">out of 100</div>
              </div>
            </div>
            <div className="h-32 w-32 rounded-full border-8 border-zinc-200"></div>
            <div
              className="absolute top-0 left-0 h-32 w-32 rounded-full border-8 border-transparent"
              style={{
                borderTopColor: overallScore >= 80 ? '#10B981' : overallScore >= 60 ? '#F59E0B' : '#EF4444',
                transform: `rotate(${45 + overallScore * 2.7}deg)`,
              }}
            />
          </div>

          <div className="flex-1">
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(scores).map(([key, value]) => {
                const categoryMap: Record<string, string> = {
                  sleep: 'sleep',
                  activity: 'workouts',
                  nutrition: 'nutrition',
                  heartHealth: 'heart',
                  consistency: 'consistency',
                  weightTrend: 'weight',
                };
                const category = categoryMap[key];
                const isClickable = ['sleep', 'nutrition', 'workouts', 'weight', 'heart'].includes(category);

                return (
                  <button
                    key={key}
                    onClick={() => isClickable && onCategoryClick?.(category)}
                    disabled={!isClickable}
                    className={`rounded-lg border border-zinc-200 p-2 text-left transition ${
                      isClickable ? 'cursor-pointer hover:border-zinc-300 hover:bg-zinc-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <span className={`text-xs font-bold ${getScoreColor(value)}`}>{value}</span>
                    </div>
                    <div className="mt-1 h-1 w-full rounded-full bg-zinc-200">
                      <div
                        className={`h-full rounded-full ${value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">Health Dimension Analysis</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart outerRadius={90} data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" stroke="#888" />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#888" />
              <Radar
                name="Your Score"
                dataKey="score"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
