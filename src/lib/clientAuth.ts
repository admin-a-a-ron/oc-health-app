export const AUTH_STORAGE_KEY = "oc_token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_STORAGE_KEY);
}

export function setToken(token: string) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}
