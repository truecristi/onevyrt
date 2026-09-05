import { cookies } from "next/headers";
import { verifySessionToken, revokeSession, type AuthenticatedUser } from "@onevyrt/domain";
import { SESSION_TTL_MS } from "@onevyrt/auth";
import { getServerContext } from "./server";

export const SESSION_COOKIE_NAME = "onevyrt_session";

export function setSessionCookie(token: string): void {
  cookies().set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE_NAME);
}

/** Resolves the current request's session cookie to an authenticated user, or null. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const { env, db } = getServerContext();
  return verifySessionToken(db, env.AUTH_SECRET, token);
}

/**
 * Deletes the current session's row in the database (so the token stops
 * working immediately, not just after its cookie is gone - a code review
 * caught that logout previously only cleared the cookie) and then clears
 * the cookie itself. A no-op if there's no session cookie to begin with.
 */
export async function logout(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const { env, db } = getServerContext();
    await revokeSession(db, env.AUTH_SECRET, token);
  }
  clearSessionCookie();
}
