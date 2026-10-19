// Where to send someone after signing in. Only same-site paths ("/league/new"), never a
// full URL or a protocol-relative "//host", so a crafted link can't bounce people off-site.

export function safeNext(raw: unknown, fallback = "/account"): string {
  const s = String(raw ?? "");
  if (!s.startsWith("/") || s.startsWith("//") || /[\\\s\x00-\x1f]/.test(s) || s.length > 200) return fallback;
  if (s === "/signin" || s.startsWith("/signin?")) return fallback;
  return s;
}

/** The sign-in page, coming back to `path` afterwards. */
export function signInHref(path?: string | null): string {
  const next = safeNext(path, "");
  return next && next !== "/account" ? `/signin?callbackUrl=${encodeURIComponent(next)}` : "/signin";
}
