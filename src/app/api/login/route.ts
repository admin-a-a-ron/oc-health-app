import { NextResponse } from "next/server";
import { getExpectedToken } from "@/lib/auth";

export async function POST(req: Request) {
  const expectedPass = process.env.APP_PASSWORD;
  if (!expectedPass) {
    return new NextResponse("Missing env APP_PASSWORD", { status: 500 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const password = String(body?.password ?? "");
  if (password !== expectedPass) {
    return new NextResponse("Bad passcode", { status: 401 });
  }

  // Return the bearer token the client should store
  const token = getExpectedToken();
  return NextResponse.json({ token });
}
