"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/clientAuth";
import TopNav from "@/components/TopNav";

type SessionExercise = {
  id: string;
  role: string;
  exercise: { id: string; name: string; rest_seconds_default: number | null };
  planned_sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  sets: { id: string; set_index: number; weight_lbs: number | null; reps: number | null; created_at: string }[];
};

type Session = {
  id: string;
  date: string;
  plan_type: string;
  target_minutes: number;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  exercises: SessionExercise[];
};

function formatElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function WorkoutSessionPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const token = useMemo(() => getToken(), []);

  const [session, setSession] = useState<Session | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [restRemaining, setRestRemaining] = useState<number | null>(null);
  const restIntervalRef = useRef<number | null>(null);

  const [elapsed, setElapsed] = useState(0);
  const elapsedIntervalRef = useRef<number | null>(null);

  async function load() {
    if (!token) {
      router.replace("/login?next=/workouts");
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/sessions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) {
      clearToken();
      router.replace("/login?next=/workouts");
      return;
    }
    if (!res.ok) {
      setErr(await res.text());
      setLoading(false);
      return;
    }
    const json = (await res.json()) as Session;
    setSession(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Workout elapsed timer
  useEffect(() => {
    if (!session?.started_at || session.ended_at) {
      if (elapsedIntervalRef.current) window.clearInterval(elapsedIntervalRef.current);
      elapsedIntervalRef.current = null;
      return;
    }

    const startedAt = new Date(session.started_at).getTime();
    function tick() {
      const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
      setElapsed(sec);
    }
    tick();
    elapsedIntervalRef.current = window.setInterval(tick, 1000);
    return () => {
      if (elapsedIntervalRef.current) window.clearInterval(elapsedIntervalRef.current);
    };
  }, [session?.started_at, session?.ended_at]);

  // Rest timer
  useEffect(() => {
    if (restRemaining === null) return;
    if (restIntervalRef.current) window.clearInterval(restIntervalRef.current);

    restIntervalRef.current = window.setInterval(() => {
      setRestRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          window.clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;

          // Sound alert
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = 880;
            g.gain.value = 0.05;
            o.connect(g);
            g.connect(ctx.destination);
            o.start();
            setTimeout(() => {
              o.stop();
              ctx.close();
            }, 250);
          } catch {
            // ignore
          }

          // Notification
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Rest over", { body: "Next set" });
          }

          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (restIntervalRef.current) window.clearInterval(restIntervalRef.current);
    };
  }, [restRemaining]);

  async function requestNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
  }

  async function startWorkout() {
    if (!token) return;
    await requestNotifications();
    const res = await fetch(`/api/sessions/${id}/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await load();
  }

  async function endWorkout() {
    if (!token) return;
    const res = await fetch(`/api/sessions/${id}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await load();
  }

  async function addSet(sessionExerciseId: string, restSeconds: number, weight_lbs: string, reps: string) {
    if (!token) return;
    setErr(null);
    const res = await fetch(`/api/sessions/${id}/sets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ session_exercise_id: sessionExerciseId, weight_lbs, reps }),
    });
    if (!res.ok) {
      setErr(await res.text());
      return;
    }
    await load();
    setRestRemaining(restSeconds);
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (!session) return <div className="p-6">No session found.</div>;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <TopNav />
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">Workout</h1>
            <p className="text-sm text-zinc-600">
              {session.date} • {session.plan_type} • target {session.target_minutes} min
            </p>
          </div>
          <button className="text-sm underline" onClick={() => router.push("/workouts")}>
            Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        {err ? (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
        ) : null}

        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-zinc-500">Elapsed</div>
              <div className="text-2xl font-semibold">
                {session.ended_at
                  ? formatElapsed(session.duration_seconds ?? 0)
                  : formatElapsed(elapsed)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!session.started_at ? (
                <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white" onClick={startWorkout}>
                  Start
                </button>
              ) : null}
              {session.started_at && !session.ended_at ? (
                <button className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium" onClick={endWorkout}>
                  Finish
                </button>
              ) : null}
            </div>
          </div>

          {restRemaining !== null ? (
            <div className="mt-4 rounded-lg border border-zinc-200 p-3">
              <div className="text-xs text-zinc-500">Rest</div>
              <div className="text-xl font-semibold">{formatElapsed(restRemaining)}</div>
              <button className="mt-2 text-sm underline" onClick={() => setRestRemaining(null)}>
                Cancel
              </button>
            </div>
          ) : null}
        </section>

        <section className="mt-6 flex flex-col gap-4">
          {session.exercises.map((se) => (
            <ExerciseCard key={se.id} se={se} onAddSet={addSet} />
          ))}
        </section>
      </main>
    </div>
  );
}

function ExerciseCard({
  se,
  onAddSet,
}: {
  se: SessionExercise;
  onAddSet: (sessionExerciseId: string, restSeconds: number, weight_lbs: string, reps: string) => void;
}) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-zinc-500">{se.role}</div>
          <h2 className="text-lg font-semibold">{se.exercise.name}</h2>
          <p className="text-sm text-zinc-600">
            {se.planned_sets} sets • {se.rep_min}–{se.rep_max} reps • rest {Math.round(se.rest_seconds)}s
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm" htmlFor={`w-${se.id}`}>Weight (lbs)</label>
          <input
            id={`w-${se.id}`}
            className="h-10 w-36 rounded-md border border-zinc-300 px-3"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm" htmlFor={`r-${se.id}`}>Reps</label>
          <input
            id={`r-${se.id}`}
            className="h-10 w-24 rounded-md border border-zinc-300 px-3"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
          />
        </div>
        <button
          className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={() => {
            onAddSet(se.id, se.rest_seconds, weight, reps);
            setReps("");
          }}
        >
          Save set → start rest
        </button>
      </div>

      <div className="mt-4">
        <div className="text-sm font-medium text-zinc-700">Logged sets</div>
        {se.sets.length === 0 ? (
          <p className="mt-1 text-sm text-zinc-500">None yet.</p>
        ) : (
          <ul className="mt-2 text-sm text-zinc-700">
            {se.sets
              .slice()
              .sort((a, b) => a.set_index - b.set_index)
              .map((s) => (
                <li key={s.id} className="border-t border-zinc-100 py-2">
                  Set {s.set_index}: {s.weight_lbs ?? "—"} × {s.reps ?? "—"}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
