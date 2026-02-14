import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { WeightChart } from "./weightChart";

export const dynamic = "force-dynamic";

export type WeightRow = {
  date: string; // yyyy-mm-dd
  weight_lbs: number;
};

async function loadWeights(): Promise<WeightRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("weights")
    .select("date,weight_lbs")
    .order("date", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WeightRow[];
}

export default async function WeightsPage() {
  const weights = await loadWeights();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold">Weight</h1>
            <p className="text-sm text-zinc-600">lbs + 7-day average</p>
          </div>
          <div className="flex items-center gap-3">
            <Link className="text-sm underline" href="/api/logout">
              Log out
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-6">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Add / update</h2>
          <form className="mt-3 flex flex-wrap items-end gap-3" action="/api/weights" method="post">
            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="date">Date</label>
              <input
                id="date"
                name="date"
                type="date"
                className="h-10 rounded-md border border-zinc-300 px-3"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm" htmlFor="weight_lbs">Weight (lbs)</label>
              <input
                id="weight_lbs"
                name="weight_lbs"
                inputMode="decimal"
                className="h-10 w-40 rounded-md border border-zinc-300 px-3"
                placeholder="215.4"
                required
              />
            </div>
            <button
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800"
              type="submit"
            >
              Save
            </button>
          </form>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Trend</h2>
          <div className="mt-4">
            <WeightChart weights={weights} />
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-700">Recent entries</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Weight (lbs)</th>
                </tr>
              </thead>
              <tbody>
                {weights
                  .slice()
                  .reverse()
                  .slice(0, 14)
                  .map((w) => (
                    <tr key={w.date} className="border-t border-zinc-100">
                      <td className="py-2 pr-4">{w.date}</td>
                      <td className="py-2 pr-4">{Number(w.weight_lbs).toFixed(1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
