import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCookieName } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const next = sp.next ?? "/weights";

  // If already authed, bounce
  const hasCookie = (await cookies()).get(getCookieName())?.value;
  if (hasCookie) redirect(next);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">oc-health-app</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Enter the app passcode to continue.
        </p>

        {sp.err ? (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Error: {sp.err}
          </p>
        ) : null}

        <form className="mt-6 flex flex-col gap-3" action="/api/login" method="post">
          <input type="hidden" name="next" value={next} />
          <label className="text-sm font-medium" htmlFor="password">
            Passcode
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="h-11 rounded-md border border-zinc-300 px-3 outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="••••••••••"
            required
          />
          <button
            className="mt-2 h-11 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-800"
            type="submit"
          >
            Sign in
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-600">
          <Link className="underline" href="/api/logout">
            Clear cookie
          </Link>
        </div>
      </div>
    </div>
  );
}
