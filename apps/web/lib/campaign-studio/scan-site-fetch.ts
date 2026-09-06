/**
 * SSRF-safe redirect-following fetch for the Campaign Studio site scanner.
 *
 * Pulled out of `app/api/campaign-studio/scan-site/route.ts` (rather than
 * exported from the route file itself) because Next.js's App Router route
 * files may only export HTTP method handlers and a small fixed set of route
 * segment config (`runtime`, `dynamic`, etc.) — any other named export fails
 * Next's route type validation at build time. `fetchFollowingSafely` and
 * `SsrfRedirectError` are exported here instead, purely so
 * `test/scan-site-ssrf.test.ts` can exercise the redirect logic directly with
 * injectable fetch/validate implementations.
 */
import { checkPublicHttpUrl } from "../url-safety";
import { pinnedFetch, type PinnedResponse } from "../safe-fetch";

const MAX_REDIRECTS = 5;

/**
 * Fetch that follows redirects MANUALLY, re-running the SSRF guard on every
 * hop. With redirect:"follow" the guard only vets the first URL — a public URL
 * that 302s to http://169.254.169.254/ (cloud metadata) or loopback would be
 * followed straight past the check. Here each Location is resolved and
 * re-validated before we chase it, and the hop count is capped.
 */
export class SsrfRedirectError extends Error {}

type FetchLike = (url: string, init: { signal: AbortSignal; redirect: "manual"; headers: Record<string, string> }) => Promise<PinnedResponse>;
type ValidateLike = (url: string) => Promise<{ safe: boolean; reason?: string }>;

export async function fetchFollowingSafely(
  startUrl: string,
  signal: AbortSignal,
  // Injectable for tests; defaults to the DNS-pinned fetcher (closes the
  // resolve-then-connect rebinding window) plus per-hop URL re-validation.
  fetchImpl: FetchLike = (u, init) => pinnedFetch(u, { signal: init.signal, headers: init.headers }),
  validate: ValidateLike = checkPublicHttpUrl,
): Promise<PinnedResponse> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchImpl(current, { signal, redirect: "manual", headers: { "user-agent": "OneVYRT-BrandScan/1.0" } });
    // Not a redirect (or an opaque one with no Location) → this is the response.
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get("location");
    if (!location) return res;
    const next = new URL(location, current).toString();
    const safety = await validate(next);
    if (!safety.safe) throw new SsrfRedirectError(safety.reason ?? "redirect target is not allowed");
    current = next;
  }
  throw new SsrfRedirectError("too many redirects");
}
