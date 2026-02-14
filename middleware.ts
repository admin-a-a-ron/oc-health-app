import { NextResponse, type NextRequest } from "next/server";

// MVP: no cookie-based auth because some browsers/profiles refuse to persist cookies.
// We secure all data access via Authorization: Bearer <token> on API routes.

export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
