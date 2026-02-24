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

export function HealthScoreChart({ metrics }: HealthScoreChartProps) {
  // Calculate scores for each category (0-100)
  const calculateScores = () => {
    if (metrics.length === 0) return null;
    
    const latest = metrics[metrics.length - 1];
    const last7Days = metrics.slice(-7).filter(m => m.date);
    
    // Sleep Score (based on 7-9 hours ideal)
    const sleepHours = latest.sleep_minutes ? latest.sleep_minutes / 60 : 0;
    const sleepScore = Math.min(100, Math.max(0, (sleepHours / 9) * 100));
    
    // Activity Score (based on 10k steps + 30min exercise)
    const stepsScore = Math.min(100, (latest.steps || 0) / 10000 * 100);
    const exerciseScore = Math.min(100, (latest.exercise_minutes || 0) / 30 * 100);
    const activityScore = (stepsScore * 0.6 + exerciseScore * 0.4);
    
    // Nutrition Score (simplified - based on protein intake)
    const nutritionScore = Math.min(100, (latest.protein_g || 0) / 160 * 100);
    
    // Heart Health Score (resting HR 60-80 ideal)
    const restingHR = latest.resting_hr || 80;
    let hrScore = 0;
    if (restingHR >= 60 && restingHR <= 80) {
      hrScore = 100 - Math.abs(restingHR - 70) * 5;
    } else {
      hrScore = Math.max(0, 100 - Math.abs(restingHR - 70) * 2);
    }
    
    // Consistency Score (days with data in last 7)
    const daysWithData = last7Days.filter(d => 
      d.steps != null || d.sleep_minutes != null || d.exercise_minutes != null
    ).length;
    const consistencyScore = (daysWithData / 7) * 100;
    
    // Weight Trend Score (based on 7-day average vs 30-day average)
    let weightScore = 50; // Neutral
    if (metrics.length >= 30) {
      const last30Days = metrics.slice(-30).filter(m => m.weight_lbs != null);
      const last7DaysWeight = metrics.slice(-7).filter(m => m.weight_lbs != null);
      
      if (last30Days.length > 0 && last7DaysWeight.length > 0) {
        const avg30Day = last30Days.reduce((sum, m) => sum + (m.weight_lbs || 0), 0) / last30Days.length;
        const avg7Day = last7DaysWeight.reduce((sum, m) => sum + (m.weight_lbs || 0), 0) / last7DaysWeight.length;
        
        // If losing weight (good for health), score increases
        const weightChangePercent = ((avg30Day - avg7Day) / avg30Day) * 100;
        weightScore = Math.min(100, Math.max(0, 50 + weightChangePercent * 10));
      }
    }
    
    return {
      sleep: Math.round(sleepScore),
      activity: Math.round(activityScore),
      nutrition: Math.round(nutritionScore),
      heartHealth: Math.round(hrScore),
      consistency: Math.round(consistencyScore),
      weightTrend: Math.round(weightScore),
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
  
  // Format data for radar chart
  const radarData = [
    { subject: 'Sleep', score: scores.sleep, fullMark: 100 },
    { subject: 'Activity', score: scores.activity, fullMark: 100 },
    { subject: 'Nutrition', score: scores.nutrition, fullMark: 100 },
    { subject: 'Heart Health', score: scores.heartHealth, fullMark: 100 },
    { subject: 'Consistency', score: scores.consistency, fullMark: 100 },
    { subject: 'Weight Trend', score: scores.weightTrend, fullMark: 100 },
  ];
  
  // Calculate overall health score
  const overallScore = Math.round(
    (scores.sleep * 0.2 +
     scores.activity * 0.2 +
     scores.nutrition * 0.2 +
     scores.heartHealth * 0.15 +
     scores.consistency * 0.15 +
     scores.weightTrend * 0.1)
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
      {/* Overall Health Score */}
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
                transform: `rotate(${45 + (overallScore * 2.7)}deg)`,
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
      
      {/* Radar Chart */}
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
              <Tooltip 
                formatter={(value: any) => [`${value}`, 'Score']}
                labelFormatter={(label) => `${label}`}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-600">
          <div>
            <div className="font-medium">Areas of Strength:</div>
            <ul className="mt-1 space-y-1">
              {radarData.filter(d => d.score >= 80).map(d => (
                <li key={d.subject} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  {d.subject} ({d.score})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium">Areas for Improvement:</div>
            <ul className="mt-1 space-y-1">
              {radarData.filter(d => d.score < 60).map(d => (
                <li key={d.subject} className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  {d.subject} ({d.score})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Recommendations */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-zinc-700 mb-3">Personalized Recommendations</h3>
        <div className="space-y-2">
          {scores.sleep < 70 && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
              <div className="mt-0.5 h-4 w-4 rounded-full bg-blue-500"></div>
              <div>
                <div className="text-sm font-medium text-blue-700">Improve Sleep</div>
                <div className="text-xs text-blue-600">Aim for 7-9 hours of quality sleep nightly. Try consistent bedtimes and reduce screen time before bed.</div>
              </div>
            </div>
          )}
          
          {scores.activity < 70 && (
            <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3">
              <div className="mt-0.5 h-4 w-4 rounded-full bg-green-500"></div>
              <div>
                <div className="text-sm font-medium text-green-700">Increase Activity</div>
                <div className="text-xs text-green-600">Target 10,000 daily steps and 30 minutes of moderate exercise most days.</div>
              </div>
            </div>
          )}
          
          {scores.nutrition < 70 && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 p-3">
              <div className="mt-0.5 h-4 w-4 rounded-full bg-yellow-500"></div>
              <div>
                <div className="text-sm font-medium text-yellow-700">Optimize Nutrition</div>
                <div className="text-xs text-yellow-600">Focus on protein intake (0.8g per lb of body weight) and balanced macros.</div>
              </div>
            </div>
          )}
          
          {scores.heartHealth < 70 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3">
              <div className="mt-0.5 h-4 w-4 rounded-full bg-red-500"></div>
              <div>
                <div className="text-sm font-medium text-red-700">Monitor Heart Health</div>
                <div className="text-xs text-red-600">Aim for resting HR between 60-80 BPM through regular cardio exercise and stress management.</div>
              </div>
            </div>
          )}
          
          {scores.consistency < 70 && (
            <div className="flex items-start gap-2 rounded-lg bg-purple-50 p-3">
              <div className="mt-0.5 h-4 w-4 rounded-full bg-purple-500"></div>
              <div>
                <div className="text-sm font-medium text-purple-700">Improve Consistency</div>
                <div className="text-xs text-purple-600">Track your metrics daily. Even partial data is better than skipping days.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
