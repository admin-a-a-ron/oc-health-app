import { NextResponse } from "next/server";
import { getCookieMaxAgeSeconds, getCookieName, signAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/weights");

  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.redirect(new URL(`/login?err=missing_env`, req.url), 303);
  }

  if (password !== expected) {
    return NextResponse.redirect(new URL(`/login?err=bad_passcode`, req.url), 303);
  }

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  let cookieValue: string;
  try {
    cookieValue = await signAuthCookie();
  } catch {
    return NextResponse.redirect(new URL(`/login?err=missing_cookie_secret`, req.url), 303);
  }

  res.cookies.set({
    name: getCookieName(),
    value: cookieValue,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getCookieMaxAgeSeconds(),
  });
  return res;
}
