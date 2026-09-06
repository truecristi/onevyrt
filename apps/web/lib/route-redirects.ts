/**
 * Redirect policy — pure and edge-safe so it runs in middleware AND is
 * unit-testable without a browser. Handles two distinct redirect scenarios:
 *
 * 1. HOME REDIRECT (proposal §3)
 *    Contract (temporary 307s, reversible):
 *     - Anonymous "/" is left alone — it is the sign-in page for signed-out users.
 *     - A "/" URL carrying ANY query string is left alone — this preserves the
 *       ?resetToken password-reset flow and any other legacy/deep-link parameter
 *       exactly (the audit found ?resetToken is the only param "/" reads, and it is
 *       used while signed out). Leaving param-carrying roots untouched also covers
 *       the "preserve legacy studio link parameters" requirement without guessing
 *       which params mean "studio".
 *     - An AUTHENTICATED, param-less "/" → canonical Home "/command-center".
 *
 *    Per proposal §3 the Command Center is the ONE Home for a signed-in owner: the
 *    guided dashboard that shows where they are and the single next action. The
 *    Funnel Studio (the canvas) is a distinct destination and keeps its own stable
 *    URL "/studio" (also reachable at "/app"); in-app "open the Studio" links point
 *    there directly so they are never bounced by this redirect. Root-only matcher,
 *    and "/command-center" is not matched, so there is no redirect loop.
 *
 * 2. DEPRECATED ROUTE REDIRECTS (Wave 1 route consolidation)
 *    Contract (permanent 308s to canonical routes):
 *     - /app → /studio (legacy alias, studio is canonical)
 *     - /businesses → /coaching (consolidation, coaching is canonical)
 *     - /my-business → /business (consolidation, business is canonical)
 */
export interface HomeRedirectInput {
  pathname: string;
  /** The raw query string including leading "?", or "" when none. */
  search: string;
  /** Whether the request carries the session cookie (presence, not validity —
   *  an invalid cookie still lands on the auth-aware Home, which shows sign-in,
   *  so presence is a safe signal for a 307). */
  hasSession: boolean;
}

export interface RouteRedirectInput {
  pathname: string;
  /** The raw query string including leading "?", or "" when none. */
  search: string;
}

/** Returns the path to redirect to, or null to leave the request untouched.
 *  Handles authentication-based home redirect ("/"). */
export function homeRedirect(input: HomeRedirectInput): string | null {
  if (input.pathname !== "/") return null;      // root-only
  if (!input.hasSession) return null;           // anon stays on sign-in
  if (input.search && input.search !== "?") return null; // any param → leave untouched (preserves ?resetToken etc.)
  return "/command-center";                     // authed, param-less root → canonical Home
}

/**
 * Returns the path to redirect to, or null to leave the request untouched.
 * Handles deprecation redirects (consolidating old routes to canonical ones).
 *
 * Permanent (308) redirects for route consolidation:
 * - Deprecated aliases (/app → /studio)
 * - Route consolidations (/businesses → /coaching)
 * - Query strings and hashes are preserved
 */
export function deprecatedRouteRedirect(input: RouteRedirectInput): string | null {
  const redirects: Record<string, string | ((pathname: string) => string | null)> = {
    "/app": "/studio",
    "/businesses": "/coaching",
    "/my-business": "/business",
    // Prefix-based redirects for subpaths
    "/businesses/": "/coaching/",
    "/my-business/": "/business/",
  };

  const direct = redirects[input.pathname];
  if (direct && typeof direct === "string") {
    return direct + input.search; // Preserve query string
  }

  // Check for prefix-based redirects (e.g., /businesses/* → /coaching/*, /my-business/* → /business/*)
  for (const [deprecated, canonical] of Object.entries(redirects)) {
    if (typeof canonical === "string" && input.pathname.startsWith(deprecated + "/")) {
      const relative = input.pathname.slice(deprecated.length);
      return canonical + relative + input.search;
    }
  }

  return null;
}
