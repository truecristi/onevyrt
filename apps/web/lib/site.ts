/** The canonical public origin. Mirrors `metadataBase` in app/layout.tsx —
 *  used by robots.ts / sitemap.ts to emit absolute, correct URLs. */
export const SITE_ORIGIN = "https://onevyrt.masteryresearch.com";

/** Public, indexable marketing/legal pages (paths relative to the origin).
 *  Everything else — the signed-in app, admin, and the API — is deliberately
 *  kept out of search results (see robots.ts). */
export const PUBLIC_PATHS = ["/", "/privacy", "/terms"] as const;

/** App surfaces and the API that must never be indexed. */
export const PRIVATE_PREFIXES = ["/api/", "/admin", "/business", "/campaign-studio"] as const;
