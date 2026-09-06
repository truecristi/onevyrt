import { NextResponse, type NextRequest } from "next/server";
import { homeRedirect, deprecatedRouteRedirect } from "./lib/route-redirects";
import { SESSION_COOKIE } from "./lib/auth";
import { validateCsrf } from "./lib/middleware/csrf";

/**
 * Multi-purpose proxy (formerly "middleware" — Next 16 renamed the file/hook;
 * see https://nextjs.org/docs/messages/middleware-to-proxy. Functionally
 * identical (NextProxy is a type alias for the old NextMiddleware), but a
 * `proxy.ts` file always runs on the Node.js runtime rather than Edge, which
 * is what makes it safe to import lib/auth.ts here directly now — previously
 * this file hardcoded a copy of SESSION_COOKIE specifically because lib/auth's
 * Node-only deps couldn't load on Edge):
 *
 * 0. CSRF enforcement on state-changing API requests (see docs/CSRF_ROUTE_AUDIT.md
 *    for the full route-by-route audit this exemption list is built from —
 *    every one of the 155 mutating API routes was individually read and
 *    classified before this was turned on).
 *
 * 1. Canonical-home redirect (proposal §3): "/" (authenticated, no params) → "/command-center"
 *    Scoped carefully to "/" only, so it never touches /api, /_next, static assets, etc.
 *    Uses temporary 307 (reversible until verified in production).
 *
 * 2. Deprecated route redirects: Consolidate old routes to canonical ones.
 *    Uses permanent 308 redirects for SEO and cache purposes.
 *    - /app → /studio (legacy alias)
 *    - /businesses → /coaching (route consolidation)
 *    - /my-business → /business (route consolidation)
 */

// Exact API paths that authenticate WITHOUT the session cookie (a one-time
// token, a pending pre-login token, or nothing at all by design) — CSRF
// makes no sense for these, and would break the flow if applied. See
// docs/CSRF_ROUTE_AUDIT.md's "EXEMPT_PRE_SESSION_AUTH"/"EXEMPT_PUBLIC_NO_SESSION"
// rows for the evidence behind each one.
const CSRF_EXEMPT_EXACT_PATHS = new Set<string>([
  "/api/auth/login", // no session exists yet — this is what creates one
  "/api/auth/register", // ditto
  "/api/auth/forgot-password", // always replies {ok:true}; no cookie read
  "/api/auth/reset-password", // one-time emailed token instead of a session
  "/api/auth/2fa/login-verify", // mid-login pending token, not the real session yet
  "/api/unsubscribe", // one-click emailed-link token (RFC 8058), not a session
  "/api/client-error", // explicitly unauthenticated (reachable from a broken page)
  "/api/track", // deliberately cross-origin embeddable; a same-site cookie can't apply
]);

// Path prefixes that are ENTIRELY exempt — every route under them
// authenticates a non-cookie way (a signature, a shared secret, or nothing
// at all). /api/cron/ is the one prefix with a caveat: cron/tick is
// shared-secret-only, but cron/digest falls back to an admin session cookie
// when the secret is absent — that fallback branch gets its own inline
// validateCsrf() call inside the route itself (see that file), since a
// prefix-level rule can't see a route's internal branching.
const CSRF_EXEMPT_PREFIXES: readonly string[] = [
  "/api/webhooks/", // Stripe (x3) + our own HMAC scheme — signature-verified, no cookie
  "/api/cron/", // shared-secret cron trigger; digest's session fallback is handled in-route
  "/api/q/", // the public qualification-funnel API — anonymous site visitors, no account
];

function isCsrfExemptApiPath(pathname: string): boolean {
  if (CSRF_EXEMPT_EXACT_PATHS.has(pathname)) return true;
  return CSRF_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export async function proxy(req: NextRequest): Promise<NextResponse | Response> {
  const pathname = req.nextUrl.pathname;
  const search = req.nextUrl.search;

  // 0. CSRF check, API routes only. validateCsrf() itself is a no-op for
  // GET/HEAD/OPTIONS, so this only ever actually blocks a state-changing
  // request — safe to run ahead of exemption-checking every request's cost.
  if (pathname.startsWith("/api/") && !isCsrfExemptApiPath(pathname)) {
    const csrfError = await validateCsrf(req);
    if (csrfError) return csrfError;
  }

  // 1. Check for deprecated route redirects first (more specific).
  // These are permanent (308) and should run before home redirect.
  const deprecatedTarget = deprecatedRouteRedirect({
    pathname,
    search,
  });
  if (deprecatedTarget) {
    const url = req.nextUrl.clone();
    url.pathname = deprecatedTarget.split("?")[0]!;
    url.search = deprecatedTarget.includes("?") ? "?" + deprecatedTarget.split("?")[1] : "";
    // Permanent redirect for route consolidation (for SEO and caching)
    return NextResponse.redirect(url, 308);
  }

  // 2. Check for home redirect (only on "/" path, only for authenticated users).
  // Root-only ("/command-center" and "/studio" are NOT matched, so no redirect loop).
  const homeTarget = homeRedirect({
    pathname,
    search,
    hasSession: req.cookies.has(SESSION_COOKIE),
  });
  if (homeTarget) {
    const url = req.nextUrl.clone();
    url.pathname = homeTarget;
    url.search = "";
    // Temporary redirect — not permanent until verified in production
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

// Match "/" (home redirect), deprecated routes (/app, /businesses*, /my-business*),
// and now every /api/* path (CSRF check — exemptions handled inside proxy()
// itself, not via the matcher, since they need per-path logic finer than a
// route pattern).
export const config = {
  matcher: [
    "/",              // Home redirect
    "/app",           // /app → /studio
    "/app/:path*",    // /app/...
    "/businesses",    // /businesses → /coaching
    "/businesses/:path*", // /businesses/...
    "/my-business",   // /my-business → /business
    "/my-business/:path*", // /my-business/...
    "/api/:path*",    // CSRF check on state-changing API requests
  ],
};
