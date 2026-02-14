const COOKIE_NAME = "oc_auth";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function toBase64Url(bytes: ArrayBuffer) {
  // Edge-safe base64url (no Node Buffer)
  const arr = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]!);
  const b64 = btoa(binary);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function hmacSha256Base64Url(input: string, secret: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(input));
  return toBase64Url(sig);
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function getCookieName() {
  return COOKIE_NAME;
}

export function getCookieMaxAgeSeconds() {
  return COOKIE_MAX_AGE_SECONDS;
}

export async function signAuthCookie(secret: string) {
  const ts = Date.now().toString();
  const payload = `v1.${ts}`;
  const sig = await hmacSha256Base64Url(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyAuthCookie(value: string | undefined, secret: string) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [v, ts, sig] = parts;
  if (v !== "v1") return false;
  if (!ts || !sig) return false;

  const payload = `${v}.${ts}`;
  const expected = await hmacSha256Base64Url(payload, secret);
  if (!constantTimeEqual(sig, expected)) return false;

  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs)) return false;
  if (ageMs > 1000 * 60 * 60 * 24 * 90) return false;

  return true;
}
