import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  generateCsrfToken,
  verifyCsrfToken,
} from "@onevyrt/security";

/** Issues a CSRF cookie for the current response if one isn't already set (readable by JS - it's the value that gets echoed back, not a secret). */
export function ensureCsrfCookie(): string {
  const existing = cookies().get(CSRF_COOKIE_NAME)?.value;
  if (existing) return existing;

  const token = generateCsrfToken();
  cookies().set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return token;
}

/** §11: verify on every cookie-authenticated mutation. Route handlers call this before touching the database. */
export function requireCsrf(request: NextRequest): boolean {
  const cookieToken = cookies().get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  return verifyCsrfToken(cookieToken, headerToken);
}
