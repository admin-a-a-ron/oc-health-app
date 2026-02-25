"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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
}

export function NutritionChart({ metrics }: NutritionChartProps) {
  // Get latest metrics for macro breakdown
  const latestMetrics = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  // Calculate macro percentages
  const macroData = latestMetrics
    ? [
        { name: 'Protein', value: latestMetrics.protein_g ?? 0, color: '#0088FE' },
        { name: 'Carbs', value: latestMetrics.carbs_g ?? 0, color: '#00C49F' },
        { name: 'Fat', value: latestMetrics.fat_g ?? 0, color: '#FFBB28' },
      ]
    : [];

  const totalMacros = macroData.reduce((sum, item) => sum + item.value, 0);

  // Prepare data for calorie balance chart (last 7 days)
  const recentMetrics = metrics.slice(-7);
  const calorieData = recentMetrics
    .filter((m) => m.calories_in != null && m.active_calories_out != null)
    .map((m) => ({
      date: new Date(m.date).toLocaleDateString('en-US', { weekday: 'short' }),
      caloriesIn: m.calories_in ?? 0,
      caloriesOut: m.active_calories_out ?? 0,
      netCalories: (m.calories_in ?? 0) - (m.active_calories_out ?? 0),
    }));

  const avgDailyCalories = (() => {
    const valid = recentMetrics.filter((m) => typeof m.calories_in === 'number');
    if (!valid.length) return null;
    const total = valid.reduce((sum, m) => sum + (m.calories_in ?? 0), 0);
    return Math.round(total / valid.length);
  })();

  // Calculate nutrition score
  const calculateNutritionScore = () => {
    if (!latestMetrics) return 0;
    
    let score = 0;
    const protein = latestMetrics.protein_g || 0;
    const carbs = latestMetrics.carbs_g || 0;
    const fat = latestMetrics.fat_g || 0;
    const calories = latestMetrics.calories_in || 0;
    
    // Score based on protein intake (aim for 0.8g per lb of body weight)
    const targetProtein = 160; // Example: 200lbs * 0.8g
    const proteinScore = Math.min(protein / targetProtein * 100, 100);
    
    // Score based on calorie balance (aim for slight deficit for weight loss)
    const targetCalories = 2200; // Example maintenance
    const calorieScore = Math.max(0, 100 - Math.abs((calories - targetCalories) / targetCalories * 100));
    
    // Score based on macro balance (40% carbs, 30% protein, 30% fat ideal)
    const total = protein + carbs + fat;
    if (total > 0) {
      const proteinPercent = (protein * 4) / calories * 100;
      const carbPercent = (carbs * 4) / calories * 100;
      const fatPercent = (fat * 9) / calories * 100;
      
      const balanceScore = 100 - (
        Math.abs(proteinPercent - 30) + 
        Math.abs(carbPercent - 40) + 
        Math.abs(fatPercent - 30)
      ) / 3;
      
      score = (proteinScore * 0.4 + calorieScore * 0.3 + balanceScore * 0.3);
    }
    
    return Math.round(Math.min(score, 100));
  };

  const nutritionScore = calculateNutritionScore();

  if (!latestMetrics) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
        No nutrition data recorded yet. Add an entry to unlock the nutrition dashboard.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Nutrition Score Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">Nutrition Score</h3>
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
                borderTopColor: nutritionScore >= 80 ? '#10B981' : nutritionScore >= 60 ? '#F59E0B' : '#EF4444',
                transform: 'rotate(45deg)',
              }}
            />
          </div>
          <div className="flex-1">
            <div className="text-sm text-zinc-600 mb-2">
              {nutritionScore >= 80 ? 'Excellent! Keep it up!' : 
               nutritionScore >= 60 ? 'Good balance!' : 
               'Room for improvement'}
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Protein:</span>
                <span className="font-medium">{latestMetrics?.protein_g ?? 0}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Carbs:</span>
                <span className="font-medium">{latestMetrics?.carbs_g ?? 0}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Fat:</span>
                <span className="font-medium">{latestMetrics?.fat_g ?? 0}g</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Calories (today):</span>
                <span className="font-medium">{latestMetrics?.calories_in ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Avg daily calories (7d):</span>
                <span className="font-medium">
                  {avgDailyCalories !== null ? avgDailyCalories : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Macro Breakdown */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">Macro Breakdown</h3>
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
          <div className="h-40 flex items-center justify-center rounded-lg bg-zinc-50">
            <p className="text-zinc-500">No nutrition data available</p>
          </div>
        )}
      </div>

      {/* Calorie Balance */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">Calorie Balance (Last 7 Days)</h3>
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
          <div className="h-40 flex items-center justify-center rounded-lg bg-zinc-50">
            <p className="text-zinc-500">No calorie data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
