export function getExpectedToken() {
  const token = process.env.APP_SESSION_TOKEN;
  if (!token) throw new Error("Missing env APP_SESSION_TOKEN");
  return token;
}

export function verifyBearerAuth(authHeader: string | null | undefined) {
  if (!authHeader) return false;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const token = m[1];
  return token === getExpectedToken();
}
