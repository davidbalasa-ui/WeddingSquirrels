import { SignJWT } from "jose";

export const SESSION_COOKIE = "ws_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, outlasts the wedding
/** Re-issue the session cookie once the token is older than this. */
export const SESSION_RENEW_AFTER = 60 * 60 * 24; // 1 day

export function sessionSecret() {
  const value = process.env.PIN_SESSION_SECRET || "dev-wedding-squirrels-secret-change-me";
  return new TextEncoder().encode(value);
}

export function signSessionToken(accountId: string) {
  return new SignJWT({ accountId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(sessionSecret());
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

/** True when a verified token (iat in seconds) is old enough to be re-issued. */
export function shouldRenewSession(issuedAt: number | undefined, nowSeconds: number) {
  if (typeof issuedAt !== "number") return true;
  return nowSeconds - issuedAt > SESSION_RENEW_AFTER;
}
