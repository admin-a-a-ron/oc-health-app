const COOKIE_NAME = "oc_auth";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function getCookieName() {
  return COOKIE_NAME;
}

export function getCookieMaxAgeSeconds() {
  return COOKIE_MAX_AGE_SECONDS;
}

/**
 * MVP auth: cookie contains a random session token stored in env.
 *
 * Why so simple?
 * - Works in Edge middleware without Node crypto quirks.
 * - Single-user app behind a passcode.
 *
 * Security note: treat APP_SESSION_TOKEN like a secret. Rotate to log out all sessions.
 */
export function getSessionToken() {
  return process.env.APP_SESSION_TOKEN ?? process.env.APP_COOKIE_SECRET;
}

export async function signAuthCookie() {
  const token = getSessionToken();
  if (!token) throw new Error("Missing env APP_SESSION_TOKEN (or APP_COOKIE_SECRET)");
  return token;
}

export async function verifyAuthCookie(value: string | undefined) {
  const token = getSessionToken();
  if (!token) return false;
  if (!value) return false;
  return value === token;
}
