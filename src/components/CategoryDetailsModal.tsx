"use client";

import { useEffect, useState } from "react";
import styles from "./CategoryDetailsModal.module.css";

interface CategoryDetailsModalProps {
  isOpen: boolean;
  category: string | null;
  onClose: () => void;
}

interface SleepRow {
  date: string;
  core: number;
  deep: number;
  rem: number;
  total_minutes: number;
  total_hours: string;
}

interface NutritionRow {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface WorkoutRow {
  date: string;
  exercise: string;
  duration: number;
  steps: number;
}

interface WeightRow {
  date: string;
  weight: number;
  trend: string;
}

interface HeartRow {
  date: string;
  resting_hr: number;
}

type DataRow = SleepRow | NutritionRow | WorkoutRow | WeightRow | HeartRow | Record<string, any>;

export default function CategoryDetailsModal({
  isOpen,
  category,
  onClose,
}: CategoryDetailsModalProps) {
  const [data, setData] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !category) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/health/category-details?category=${category}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch ${category} details`);
        }
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, category]);

  if (!isOpen || !category) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>
            {category === "heart"
              ? "Heart Health Details"
              : category.charAt(0).toUpperCase() + category.slice(1) + " Details"}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {loading && <p className={styles.loading}>Loading...</p>}
          {error && <p className={styles.error}>{error}</p>}

          {!loading && !error && data.length > 0 && (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {category === "sleep" && (
                      <>
                        <th>Date</th>
                        <th>Core</th>
                        <th>Deep</th>
                        <th>REM</th>
                        <th>Total Minutes</th>
                        <th>Total Hours</th>
                      </>
                    )}
                    {category === "nutrition" && (
                      <>
                        <th>Date</th>
                        <th>Calories</th>
                        <th>Protein (g)</th>
                        <th>Carbs (g)</th>
                        <th>Fat (g)</th>
                      </>
                    )}
                    {category === "workouts" && (
                      <>
                        <th>Date</th>
                        <th>Exercise</th>
                        <th>Duration (min)</th>
                        <th>Steps</th>
                      </>
                    )}
                    {category === "weight" && (
                      <>
                        <th>Date</th>
                        <th>Weight (lbs)</th>
                        <th>Trend</th>
                      </>
                    )}
                    {category === "heart" && (
                      <>
                        <th>Date</th>
                        <th>Resting HR (bpm)</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, idx) => (
                    <tr key={idx}>
                      {category === "sleep" && (
                        <>
                          <td>{(row as SleepRow).date}</td>
                          <td>{(row as SleepRow).core}</td>
                          <td>{(row as SleepRow).deep}</td>
                          <td>{(row as SleepRow).rem}</td>
                          <td>{(row as SleepRow).total_minutes}</td>
                          <td>{(row as SleepRow).total_hours}</td>
                        </>
                      )}
                      {category === "nutrition" && (
                        <>
                          <td>{(row as NutritionRow).date}</td>
                          <td>{Math.round((row as NutritionRow).calories)}</td>
                          <td>{((row as NutritionRow).protein || 0).toFixed(1)}</td>
                          <td>{((row as NutritionRow).carbs || 0).toFixed(1)}</td>
                          <td>{((row as NutritionRow).fat || 0).toFixed(1)}</td>
                        </>
                      )}
                      {category === "workouts" && (
                        <>
                          <td>{(row as WorkoutRow).date}</td>
                          <td>{(row as WorkoutRow).exercise}</td>
                          <td>{(row as WorkoutRow).duration}</td>
                          <td>{(row as WorkoutRow).steps.toLocaleString()}</td>
                        </>
                      )}
                      {category === "weight" && (
                        <>
                          <td>{(row as WeightRow).date}</td>
                          <td>{((row as WeightRow).weight || 0).toFixed(1)}</td>
                          <td>{(row as WeightRow).trend}</td>
                        </>
                      )}
                      {category === "heart" && (
                        <>
                          <td>{(row as HeartRow).date}</td>
                          <td>{(row as HeartRow).resting_hr}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && data.length === 0 && (
            <p className={styles.noData}>No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
