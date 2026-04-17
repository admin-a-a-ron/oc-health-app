"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/clientAuth";

function cls(active: boolean) {
  return active
    ? "rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
    : "rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100";
}

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  const onDashboard = pathname === "/dashboard" || pathname === "/weights";

  return (
    <div className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className={cls(onDashboard)}>
            Health Dashboard
          </Link>
        </div>

        <button
          className="text-sm underline"
          onClick={() => {
            clearToken();
            router.replace("/login");
          }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
