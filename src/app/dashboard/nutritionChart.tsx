"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

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

interface NutritionChartProps {
  metrics: DailyMetricsRow[];
  averageRow?: Partial<DailyMetricsRow> | null;
  rangeLabel?: string;
}

const hasMacros = (m: Partial<DailyMetricsRow> | null | undefined) =>
  !!m && [m.protein_g, m.carbs_g, m.fat_g, m.calories_in].some((v) => typeof v === "number");

const formatCaloriesLabel = (isRange: boolean) => (isRange ? "Avg daily calories (range)" : "Avg daily calories (7d)");

const calculateNutritionScore = (source: Partial<DailyMetricsRow> | null | undefined) => {
  if (!source) return 0;
  let score = 0;
  const protein = source.protein_g || 0;
  const carbs = source.carbs_g || 0;
  const fat = source.fat_g || 0;
  const calories = source.calories_in || 0;

  const targetProtein = 160;
  const proteinScore = targetProtein ? Math.min((protein / targetProtein) * 100, 100) : 0;

  const targetCalories = 2200;
  const calorieScore = targetCalories ? Math.max(0, 100 - Math.abs(((calories - targetCalories) / targetCalories) * 100)) : 0;

  const totalMacros = protein + carbs + fat;
  if (totalMacros > 0 && calories > 0) {
    const proteinPercent = (protein * 4) / calories * 100;
    const carbPercent = (carbs * 4) / calories * 100;
    const fatPercent = (fat * 9) / calories * 100;
    const balanceScore =
      100 - (Math.abs(proteinPercent - 30) + Math.abs(carbPercent - 40) + Math.abs(fatPercent - 30)) / 3;
    score = proteinScore * 0.4 + calorieScore * 0.3 + balanceScore * 0.3;
  } else {
    score = (proteinScore + calorieScore) / 2;
  }

  return Math.round(Math.min(score, 100));
};

export function NutritionChart({ metrics, averageRow = null, rangeLabel }: NutritionChartProps) {
  const today = new Date().toISOString().slice(0, 10);

  const latestMetrics = (() => {
    if (!metrics.length) return null;
    const completed = metrics
      .filter((m) => m.date < today && hasMacros(m))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (completed.length) return completed.pop() ?? null;
    const withMacros = metrics.filter((m) => hasMacros(m));
    if (withMacros.length) return withMacros.sort((a, b) => a.date.localeCompare(b.date)).pop() ?? null;
    return metrics[metrics.length - 1] ?? null;
  })();

  const summarySource = averageRow ?? latestMetrics;
  const isRangeMode = Boolean(averageRow);
  const summaryLabel = summarySource
    ? isRangeMode
      ? `${rangeLabel ?? "Range"} avg`
      : `Most recent: ${summarySource.date ?? "—"}`
    : rangeLabel
      ? `${rangeLabel} avg`
      : "No data";

  if (!summarySource) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        {isRangeMode
          ? "No nutrition data found for the selected range."
          : "No nutrition data recorded yet. Add an entry to unlock the nutrition dashboard."}
      </div>
    );
  }

  const macroData = [
    { name: "Protein", value: summarySource.protein_g ?? 0, color: "#0088FE" },
    { name: "Carbs", value: summarySource.carbs_g ?? 0, color: "#00C49F" },
    { name: "Fat", value: summarySource.fat_g ?? 0, color: "#FFBB28" },
  ];
  const totalMacros = macroData.reduce((sum, item) => sum + item.value, 0);

  const calorieWindow = isRangeMode ? metrics : metrics.slice(-7);
  const calorieData = calorieWindow
    .filter((m) => m.calories_in != null && m.active_calories_out != null)
    .map((m) => ({
      date: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      caloriesIn: m.calories_in ?? 0,
      caloriesOut: m.active_calories_out ?? 0,
      netCalories: (m.calories_in ?? 0) - (m.active_calories_out ?? 0),
    }));

  const avgDailyCalories = (() => {
    const window = calorieWindow.filter((m) => typeof m.calories_in === "number");
    if (!window.length) return null;
    const total = window.reduce((sum, m) => sum + (m.calories_in ?? 0), 0);
    return Math.round(total / window.length);
  })();

  const nutritionScore = calculateNutritionScore(summarySource);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700">Nutrition Score</h3>
          <p className="text-xs text-zinc-500">{summaryLabel}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative h-24 w-24">
            <div className="h-24 w-24 rounded-full bg-zinc-100 p-2">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-green-50 to-blue-50">
                <div className="text-center">
                  <div className="text-2xl font-bold text-zinc-900">{nutritionScore}</div>
                  <div className="text-xs text-zinc-500">/100</div>
                </div>
              </div>
            </div>
            <div
              className="absolute inset-0 h-24 w-24 rounded-full border-8 border-transparent"
              style={{
                borderTopColor: nutritionScore >= 80 ? "#10B981" : nutritionScore >= 60 ? "#F59E0B" : "#EF4444",
                transform: "rotate(45deg)",
              }}
            />
          </div>
          <div className="flex-1">
            <div className="mb-2 text-sm text-zinc-600">
              {nutritionScore >= 80 ? "Excellent! Keep it up!" : nutritionScore >= 60 ? "Good balance!" : "Room for improvement"}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Protein:</span>
                <span className="font-medium">{summarySource?.protein_g ?? 0}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Carbs:</span>
                <span className="font-medium">{summarySource?.carbs_g ?? 0}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Fat:</span>
                <span className="font-medium">{summarySource?.fat_g ?? 0}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Calories ({isRangeMode ? "avg" : "today"}):</span>
                <span className="font-medium">{summarySource?.calories_in ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">{formatCaloriesLabel(isRangeMode)}:</span>
                <span className="font-medium">{avgDailyCalories ?? "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700">Macro Breakdown</h3>
          {isRangeMode && <p className="text-xs text-zinc-500">Averaged per day across range</p>}
        </div>
        {totalMacros > 0 ? (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={macroData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {macroData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg bg-zinc-50">
            <p className="text-zinc-500">No nutrition data available</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700">Calorie Balance {isRangeMode ? "(range)" : "(last 7 days)"}</h3>
          {isRangeMode && <p className="text-xs text-zinc-500">{rangeLabel}</p>}
        </div>
        {calorieData.length > 0 ? (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calorieData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Legend />
                <Bar dataKey="caloriesIn" fill="#0088FE" name="Calories In" />
                <Bar dataKey="caloriesOut" fill="#00C49F" name="Calories Out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg bg-zinc-50">
            <p className="text-zinc-500">No calorie data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
