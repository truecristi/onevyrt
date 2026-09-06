/**
 * CSRF Token Implementation (Security Wave 1).
 * Prevents Cross-Site Request Forgery attacks by:
 * 1. Generating a cryptographically secure token per session
 * 2. Storing it in an httpOnly, Secure cookie
 * 3. Requiring the token in the x-csrf-token header for state-changing requests
 * 4. Validating against the session's stored token
 *
 * This follows the "double-submit cookie" pattern, but with server-side
 * validation: the server generates and validates tokens, not relying on the
 * client to echo the cookie value back.
 */

import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { getSecret } from "../auth";

export const CSRF_COOKIE = "gb_csrf_token";
export const CSRF_HEADER = "x-csrf-token";

/** Generate a new CSRF token for a session. Each session gets one token
 *  that's good for the lifetime of that session. */
export function generateCsrfToken(): string {
  // 32 bytes = 256 bits of entropy, plenty for CSRF protection
  return randomBytes(32).toString("hex");
}

/** Sign a CSRF token with the auth secret so we can verify it was issued
 *  by this server and hasn't been tampered with. Returns base64url for safe
 *  transmission in headers/cookies. */
export function signCsrfToken(token: string): string {
  const sig = createHmac("sha256", getSecret()).update(token).digest("base64url");
  return `${token}.${sig}`;
}

/** Verify a CSRF token by checking its signature. Returns the token (without
 *  signature) on success, null if the signature is invalid or the token is
 *  malformed. */
export function verifyCsrfToken(signedToken: string): string | null {
  if (!signedToken || !signedToken.includes(".")) return null;
  const [token, sig] = signedToken.split(".");
  if (!token || !sig) return null;
  try {
    const expected = createHmac("sha256", getSecret()).update(token).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return token;
  } catch {
    return null;
  }
}

/** Format a CSRF token into a Set-Cookie header value. httpOnly prevents
 *  JavaScript from reading it (but the browser still sends it on same-site
 *  requests), and Secure requires HTTPS. SameSite=Strict is the strongest
 *  protection, preventing the cookie from being sent even on same-site
 *  cross-origin requests — but we use Lax (same as session cookies) to be
 *  consistent with the session cookie policy and allow reasonable navigation. */
export function csrfTokenCookie(token: string, maxAgeSec = 30 * 24 * 3600): string {
  return `${CSRF_COOKIE}=${token}; HttpOnly; Secure; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}

export function clearCsrfTokenCookie(): string {
  return `${CSRF_COOKIE}=; HttpOnly; Secure; Path=/; Max-Age=0; SameSite=Lax`;
}

/** Read the CSRF token from a Set-Cookie or Cookie header. The header should
 *  be a raw cookie string like "gb_csrf_token=abc123; gb_session=xyz789". */
export function readCsrfToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  // Split on the separator with whitespace on EITHER side — a real browser
  // only ever sends "; " between pairs, but splitting on trailing whitespace
  // only (the previous `/;\s*/`) left a stray leading space on whichever
  // pair sat right before a "name ; name2" style separator, corrupting the
  // token value by one character.
  const c = cookieHeader.split(/\s*;\s*/).find((x) => x.startsWith(`${CSRF_COOKIE}=`));
  return c ? c.slice(CSRF_COOKIE.length + 1) : null;
}

/** Read the CSRF token from an x-csrf-token header. */
export function readCsrfTokenFromHeader(headerValue: string | null): string | null {
  return headerValue ? headerValue.trim() : null;
}

/**
 * Middleware-like helper to validate CSRF on state-changing requests.
 * Returns null on success, or a Response to return immediately on failure.
 * Typical usage:
 *
 *   export const POST = withRouteLogging("api/foo:POST", async (req) => {
 *     const csrfError = await validateCsrf(req);
 *     if (csrfError) return csrfError;
 *     // proceed with the request
 *   });
 *
 * This checks both the cookie (stored by the server when the session was
 * created) and the header (sent by the client with every POST/PUT/DELETE).
 * They must match for the request to proceed.
 */
export async function validateCsrf(req: Request): Promise<Response | null> {
  const method = req.method.toUpperCase();

  // CSRF only applies to state-changing methods. GET, HEAD, OPTIONS are safe.
  // (And some frameworks have special handling for TRACE, but we don't.)
  if (!["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    return null;
  }

  const cookieHeader = req.headers.get("cookie");
  const storedToken = readCsrfToken(cookieHeader);

  if (!storedToken) {
    // No token in the cookie — either the session is brand new (hasn't loaded
    // the initial page yet to set it), or the cookie was lost. Either way,
    // we can't validate. For a fresh session this is expected (return 403 and
    // the client will reload or refresh). For a lost session, this is the
    // right security boundary — require re-login or a fresh page load.
    return new Response(JSON.stringify({ error: "CSRF token missing or invalid" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  const headerValue = req.headers.get(CSRF_HEADER);
  const clientToken = readCsrfTokenFromHeader(headerValue);

  if (!clientToken) {
    return new Response(JSON.stringify({ error: "CSRF token not provided in request" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  // Verify that the client's token is correctly signed and matches what we
  // have on record in the cookie.
  const verifiedToken = verifyCsrfToken(clientToken);
  if (!verifiedToken) {
    return new Response(JSON.stringify({ error: "CSRF token verification failed" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  // The cookie holds the unsigned token; the header holds the signed version.
  // They should match after verification.
  if (verifiedToken !== storedToken) {
    return new Response(JSON.stringify({ error: "CSRF token mismatch" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }

  // Token is valid.
  return null;
}
