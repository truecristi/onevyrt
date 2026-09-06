/**
 * Tiny ETag helper for JSON GET responses. A content hash lets a client (or a
 * CDN) send If-None-Match and get a bodyless 304 when nothing changed —
 * cheaper on the wire and on the client at repeat reads. Weak validators
 * aren't needed here: the body is deterministic JSON, so a strong hash is exact.
 */
import { createHash } from "node:crypto";

/** A quoted strong ETag for the given response body. */
export function etagFor(body: string): string {
  return `"${createHash("sha1").update(body).digest("base64url")}"`;
}

/** True when the request's If-None-Match matches `etag` (so a 304 is correct). */
export function ifNoneMatch(req: Request, etag: string): boolean {
  const header = req.headers.get("if-none-match");
  if (!header) return false;
  if (header.trim() === "*") return true;
  return header.split(",").map((t) => t.trim()).includes(etag);
}

/**
 * Build a JSON GET response with an ETag: a bodyless 304 when the client's
 * If-None-Match already matches, otherwise a 200 carrying the body and the
 * ETag. `extraHeaders` (e.g. rate-limit headers) ride along on both.
 */
export function jsonWithETag(req: Request, body: string, extraHeaders: Record<string, string> = {}): Response {
  const etag = etagFor(body);
  if (ifNoneMatch(req, etag)) {
    return new Response(null, { status: 304, headers: { etag, ...extraHeaders } });
  }
  return new Response(body, { status: 200, headers: { "content-type": "application/json", etag, ...extraHeaders } });
}
