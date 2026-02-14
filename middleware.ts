import { NextResponse, type NextRequest } from "next/server";
import { getCookieName, verifyAuthCookie } from "./src/lib/auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/login",
  "/api/logout",
  "/favicon.ico",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow next internals + static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(getCookieName())?.value;
  const ok = await verifyAuthCookie(cookie);

  if (!ok) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Only protect page routes; API routes do their own auth.
  // This avoids redirecting POSTs to /api/* (which can cause 405 loops).
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};
