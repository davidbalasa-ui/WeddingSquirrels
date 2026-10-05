import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  sessionSecret,
  shouldRenewSession,
  signSessionToken,
} from "@/lib/session-token";

/**
 * Sliding session: server components cannot set cookies, so an active user's
 * session cookie is re-issued here once the token is more than a day old.
 * Account existence and permissions are still checked by getSession().
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return response;

  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    if (typeof payload.accountId !== "string") return response;
    if (!shouldRenewSession(payload.iat, Math.floor(Date.now() / 1000))) return response;

    response.cookies.set(
      SESSION_COOKIE,
      await signSessionToken(payload.accountId),
      sessionCookieOptions(),
    );
  } catch {
    // Invalid or expired token: leave it for getSession() to reject.
  }
  return response;
}

export const config = {
  // Skip API routes, Next internals, the service worker and static files.
  matcher: ["/((?!api|_next/static|_next/image|sw\\.js|.*\\..*).*)"],
};
