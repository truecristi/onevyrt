import type { NextRequest } from "next/server";

/**
 * Best-effort client identifier for rate-limiting keys.
 *
 * **Known limitation, flagged by code review and tracked in ADR-0004
 * rather than silently left as-is:** `x-forwarded-for` is set by whatever
 * reverse proxy sits in front of this app - it is not something Next.js
 * validates, and this app trusts it unconditionally. Until this is
 * deployed behind a specific, known proxy chain (see ADR-0021), a caller
 * can set an arbitrary `x-forwarded-for` value on every request and get a
 * fresh rate-limit bucket each time, defeating §11's per-IP limits
 * entirely. Fixing this for real requires knowing the actual deployment
 * topology (e.g. "trust exactly the first hop, because our own reverse
 * proxy always overwrites this header before forwarding") - a decision
 * that belongs with whoever picks the deployment target, not something to
 * guess at here. Do not treat this function's output as a verified client
 * IP for anything security-critical beyond "best-effort rate-limit key."
 */
export function getClientIdentifier(request: NextRequest): string {
  return request.headers.get("x-forwarded-for") ?? "unknown";
}
