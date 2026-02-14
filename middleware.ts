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

  const secret = process.env.APP_COOKIE_SECRET;
  if (!secret) {
    // Fail closed if misconfigured
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("err", "missing_cookie_secret");
    return NextResponse.redirect(url);
  }

  const cookie = req.cookies.get(getCookieName())?.value;
  const ok = await verifyAuthCookie(cookie, secret);

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
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
