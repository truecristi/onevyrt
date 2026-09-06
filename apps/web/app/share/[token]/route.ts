import { getSharedHtml } from "../../../lib/report-shares";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";

/**
 * A shared report is owner-authored HTML served on our own origin. To stop it
 * from being a stored-XSS / same-origin-JS vector (any user can create a share,
 * and a signed-in viewer's cookies would otherwise be in reach), lock the
 * response down hard:
 *   - `sandbox` with NO allow-tokens → the document loads in an opaque origin
 *     and scripts/forms/popups are disabled, so even a script tag can't run or
 *     touch cookies/`/api/*`.
 *   - `default-src 'none'` + narrow allowances → only inline styles, images and
 *     fonts load (what a static report legitimately needs); no script origin.
 *   - `nosniff` so a mislabelled body can't be reinterpreted as script.
 * This neutralises arbitrary owner HTML without needing to parse/sanitise it.
 */
const SHARE_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "content-security-policy":
    "sandbox; default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline'; font-src data: https:; base-uri 'none'; form-action 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
} as const;

const NOT_FOUND_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Link unavailable</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;color:#0f172a;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px">
<div><h1 style="font-size:20px;margin-bottom:8px">This link is no longer available</h1>
<p style="color:#64748b;font-size:14px">It may have expired or been revoked by its owner.</p></div>
</body></html>`;

/** Public, unauthenticated — deliberately so; a share link's entire point is
 *  that the recipient doesn't need an OneVYRT account. Serves the stored
 *  snapshot as-is: no auth check beyond the token itself being valid,
 *  unexpired, and unrevoked (see lib/report-shares.ts). */
export const GET = withRouteLogging("share/[token]:GET", async (_req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> => {
  const { token } = await ctx.params;
  const html = await getSharedHtml(token);
  if (!html) return new Response(NOT_FOUND_HTML, { status: 404, headers: SHARE_HEADERS });
  return new Response(html, { status: 200, headers: SHARE_HEADERS });
});
