/**
 * CSRF Token Initializer (Server Component)
 * Sets up CSRF tokens for the session.
 * Should be rendered in the root layout to ensure CSRF tokens are available.
 *
 * The cookie and the header carry DIFFERENT values on purpose — this is what
 * lib/middleware/csrf.ts's validateCsrf() actually checks:
 *   - Cookie `gb_csrf_token`  = the RAW token (the shared secret; sent
 *     automatically by the browser, same-origin only under SameSite=Lax).
 *   - Header `x-csrf-token`   = the SIGNED token (token + "." + HMAC),
 *     exposed via the meta tag below for client JS to read and echo back.
 * validateCsrf() reads the cookie as-is (expects the raw token) and verifies
 * the header's signature before comparing the two — so the cookie must never
 * hold the signed value. It previously did (this script wrote the meta tag's
 * `signed` content into the cookie), which made every request's raw/signed
 * comparison fail unconditionally — a bug that had no visible symptom yet
 * only because no route called validateCsrf() yet. Fixed by writing the raw
 * `token` (already known here, no DOM round-trip needed) into the cookie
 * directly, matching what useCSRFToken()'s headerValue now sources from the
 * meta tag instead of the cookie — see lib/hooks/use-csrf-token.ts.
 *
 * Also patches window.fetch, below, to attach the x-csrf-token header to
 * every same-origin POST/PUT/PATCH/DELETE automatically. useCSRFToken()
 * exists for a component that wants the token directly, but nothing in the
 * app actually calls it — every page's fetch() calls are plain, header-less
 * fetches (e.g. app/programme/chapter-4/growth-plan/page.tsx's
 * generateShareLink). Without this patch, proxy.ts's validateCsrf() — which
 * now runs on every mutating /api/* request — would 403 every one of them:
 * confirmed live, not just in theory (a real POST /api/growth-plan/share
 * from a real page load returned exactly that 403 before this patch was
 * added). One fetch patch here covers every existing and future call site,
 * rather than threading useCSRFToken() through each one individually.
 *
 * Reads any EXISTING cookie via next/headers before minting a token, and
 * reuses it if present, rather than always generating a fresh one. This
 * component reruns on every full page navigation (the App Router root
 * layout re-renders server-side per navigation, even though it doesn't
 * remount client-side), and generateCsrfToken() is pure randomness with no
 * link back to any prior token — so unconditionally generating a new one
 * every render, while the inline script below only ever sets the cookie
 * ONCE ("if it doesn't already exist"), meant the meta tag's signed token
 * matched the cookie only on a browser's very first page load ever; every
 * later navigation minted an unrelated token for the meta tag while the
 * cookie kept the original, so validateCsrf() would 403 every mutating
 * request from a session's second page onward. Confirmed live: a real
 * multi-page learner flow's second lesson submission
 * (POST /api/programme/lessons/m-bottleneck/submit) returned a 403, while
 * an otherwise-identical single-page-then-submit flow succeeded.
 */

import { cookies } from "next/headers";
import { generateCsrfToken, signCsrfToken, CSRF_COOKIE } from "../lib/middleware/csrf";

export default async function CsrfTokenInitializer() {
  // Reuse the existing session's token if the request already carries one —
  // only a brand-new session (no cookie yet) gets a freshly generated one.
  // Either way, the signed token in the meta tag is always derived from
  // whatever raw token the cookie holds (or will hold) for THIS request.
  const existing = (await cookies()).get(CSRF_COOKIE)?.value;
  const token = existing || generateCsrfToken();
  const signed = signCsrfToken(token);

  return (
    <>
      {/* Meta tag containing the signed CSRF token, for client-side access
          (lib/hooks/use-csrf-token.ts reads this for the x-csrf-token header) */}
      <meta name="csrf-token" content={signed} />
      {/* Inline script sets the CSRF token cookie immediately, to the RAW
          token — embedded directly rather than re-read from the meta tag, so
          the cookie can never accidentally end up holding the signed value. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              if (!document.cookie.includes('gb_csrf_token=')) {
                document.cookie = 'gb_csrf_token=${token}; Path=/; Secure; SameSite=Lax; Max-Age=' + (30 * 24 * 3600);
              }
              // Attach x-csrf-token to every same-origin state-changing fetch —
              // see this file's header comment for why this exists.
              var CSRF_METHODS = { POST: 1, PUT: 1, PATCH: 1, DELETE: 1 };
              var originalFetch = window.fetch.bind(window);
              window.fetch = function(input, init) {
                try {
                  var request = new Request(input, init);
                  if (
                    CSRF_METHODS[request.method.toUpperCase()] &&
                    new URL(request.url, window.location.href).origin === window.location.origin
                  ) {
                    var meta = document.querySelector('meta[name="csrf-token"]');
                    var signedToken = meta && meta.getAttribute('content');
                    if (signedToken && !request.headers.has('x-csrf-token')) {
                      var headers = new Headers(request.headers);
                      headers.set('x-csrf-token', signedToken);
                      request = new Request(request, { headers: headers });
                    }
                  }
                  return originalFetch(request);
                } catch (e) {
                  return originalFetch(input, init);
                }
              };
            })();
          `,
        }}
      />
    </>
  );
}
