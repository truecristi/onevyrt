import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Double-submit-cookie CSRF protection (§11) for cookie-authenticated
 * mutations: the server sets a readable cookie with a random token; the
 * client must echo it back in a request header. A cross-site form post
 * can't read the cookie to copy it into the header, so this blocks CSRF
 * without needing server-side session storage of the token.
 */
export const CSRF_COOKIE_NAME = "onevyrt_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function verifyCsrfToken(
  cookieToken: string | undefined,
  headerToken: string | null,
): boolean {
  if (!cookieToken || !headerToken) return false;
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
