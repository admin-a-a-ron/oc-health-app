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
}

const pickLatest = (rows: DailyMetricsRow[], predicate: (row: DailyMetricsRow) => boolean) => {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (predicate(rows[i])) return rows[i];
  }
  return null;
};

const average = (values: number[]) => {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export function HealthScoreChart({ metrics }: HealthScoreChartProps) {
  const calculateScores = () => {
    if (metrics.length === 0) return null;

    const recent7 = metrics.slice(-7);
    const recent30 = metrics.slice(-30);

    const latestSleep = pickLatest(metrics, (m) => m.sleep_minutes != null);
    const sleepHours = latestSleep ? (latestSleep.sleep_minutes ?? 0) / 60 : 0;
    const sleepScore = Math.min(100, Math.max(0, (sleepHours / 8) * 100));

    const activityEntries = recent7.filter((m) => m.steps != null || m.exercise_minutes != null);
    const avgSteps = average(activityEntries.map((m) => m.steps ?? 0)) ?? 0;
    const avgExercise = average(activityEntries.map((m) => m.exercise_minutes ?? 0)) ?? 0;
    const stepsScore = Math.min(100, (avgSteps / 10000) * 100);
    const exerciseScore = Math.min(100, (avgExercise / 30) * 100);
    const activityScore = Math.round(stepsScore * 0.6 + exerciseScore * 0.4);

    const latestNutrition = pickLatest(metrics, (m) => [m.protein_g, m.carbs_g, m.fat_g, m.calories_in].some((v) => v != null));
    const protein = latestNutrition?.protein_g ?? 0;
    const carbs = latestNutrition?.carbs_g ?? 0;
    const fat = latestNutrition?.fat_g ?? 0;
    const calories = latestNutrition?.calories_in ?? 0;
    let nutritionScore = 0;
    if (calories > 0) {
      const proteinPercent = (protein * 4) / calories;
      const carbPercent = (carbs * 4) / calories;
      const fatPercent = (fat * 9) / calories;
      const balanceScore = 100 - (Math.abs(proteinPercent - 0.3) + Math.abs(carbPercent - 0.4) + Math.abs(fatPercent - 0.3)) * 50;
      const proteinScore = Math.min(100, (protein / 0.8 / 200) * 100);
      nutritionScore = Math.round(Math.max(0, Math.min(100, balanceScore * 0.5 + proteinScore * 0.5)));
    }

    const heartEntries = metrics.filter((m) => m.resting_hr != null).slice(-5);
    const restingAvg = average(heartEntries.map((m) => m.resting_hr ?? 0)) ?? null;
    const restingHR = restingAvg ?? 70;
    let heartHealth = 0;
    if (restingHR >= 60 && restingHR <= 80) {
      heartHealth = 100 - Math.abs(restingHR - 70) * 3;
    } else {
      heartHealth = Math.max(0, 100 - Math.abs(restingHR - 70) * 2);
    }
    heartHealth = Math.round(Math.max(0, Math.min(100, heartHealth)));

    const daysWithData = recent7.filter((m) =>
      [m.steps, m.sleep_minutes, m.exercise_minutes, m.calories_in, m.resting_hr].some((v) => v != null)
    ).length;
    const consistency = Math.round((daysWithData / 7) * 100);

    let weightTrend = 50;
    if (recent30.length >= 14) {
      const recent = recent30.slice(-7).filter((m) => m.weight_lbs != null);
      const prior = recent30.slice(0, -7).filter((m) => m.weight_lbs != null);
      const avgRecent = average(recent.map((m) => m.weight_lbs ?? 0));
      const avgPrior = average(prior.map((m) => m.weight_lbs ?? 0));
      if (avgRecent != null && avgPrior != null && avgPrior !== 0) {
        const change = ((avgPrior - avgRecent) / avgPrior) * 100;
        weightTrend = Math.max(0, Math.min(100, 50 + change * 5));
      }
    }

    return {
      sleep: Math.round(sleepScore),
      activity: Math.round(activityScore),
      nutrition: Math.round(nutritionScore),
      heartHealth,
      consistency,
      weightTrend: Math.round(weightTrend),
    };
  };

  const scores = calculateScores();

  if (!scores) {
    return (
      <div className="h-80 flex items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50">
        <p className="text-zinc-500">No data available for health score calculation</p>
      </div>
    );
  }

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
            <p className="mt-1 text-xs text-zinc-500">Comprehensive assessment of your health metrics</p>
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
              {Object.entries(scores).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-zinc-200 p-2">
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
                </div>
              ))}
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
