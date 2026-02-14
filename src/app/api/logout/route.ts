import { NextResponse } from "next/server";

// Cookie-less MVP auth. Logout is client-side (clears localStorage).
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
