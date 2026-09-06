import { getSharedTransformationReportHtml } from "../../../../lib/reports/transformation-report-shares";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";

/**
 * A shared Transformation Report is server-rendered HTML (see
 * transformationReportToHtml) served on our own origin. Locked down exactly
 * like /share/[token] (report-shares.ts's project reports): sandboxed with
 * no allow-tokens so even inline content can't run script or touch cookies,
 * `default-src 'none'` with only the narrow allowances a static report
 * needs, and `nosniff` so the body can't be reinterpreted as script.
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
<p style="color:#64748b;font-size:14px">It may have expired (share links last 24 hours) or been revoked by its owner.</p></div>
</body></html>`;

/** Public, unauthenticated — a share link's entire point is that the
 *  recipient doesn't need a ONEVYRT account. Serves the stored snapshot
 *  as-is: no auth check beyond the token being valid and unexpired (see
 *  lib/reports/transformation-report-shares.ts). */
export const GET = withRouteLogging("share/transformation/[token]:GET", async (_req: Request, ctx: { params: Promise<{ token: string }> }): Promise<Response> => {
  const { token } = await ctx.params;
  const html = await getSharedTransformationReportHtml(token);
  if (!html) return new Response(NOT_FOUND_HTML, { status: 404, headers: SHARE_HEADERS });
  return new Response(html, { status: 200, headers: SHARE_HEADERS });
});
