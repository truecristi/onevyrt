/**
 * Public unsubscribe endpoint — the working opt-out mechanism required by
 * CAN-SPAM and by the RFC 8058 one-click List-Unsubscribe header that broadcast
 * emails now carry. Deliberately unauthenticated: the only credential is the
 * signed token in the link (it encodes workspace + channel + address and can't
 * be forged), and the sole effect is adding an opt-out, which only ever
 * suppresses future marketing to that address. Fail safe: a missing/invalid
 * token changes nothing and is never treated as success.
 *
 *   GET  ?token=…   a person clicks the link in the email → opt out, show a
 *                   plain confirmation page.
 *   POST ?token=…   the mail client's one-click unsubscribe
 *                   (List-Unsubscribe-Post: List-Unsubscribe=One-Click) → opt
 *                   out, return 200. No body is required.
 */
import { verifyUnsubscribeToken, addOptOut } from "../../../lib/outreach/broadcasts";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";

/** Process a token: verify it, then record the opt-out. Returns whether an
 *  opt-out was actually recorded. Never throws. */
async function optOutFromToken(token: string | null): Promise<boolean> {
  const claim = verifyUnsubscribeToken(token);
  if (!claim) return false;
  try {
    await addOptOut(claim.workspaceId, claim.channel, claim.address);
    return true;
  } catch {
    // If we can't write the opt-out, don't tell the recipient they're
    // unsubscribed — surface a soft failure instead so they can retry.
    return false;
  }
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function page(heading: string, message: string, ok: boolean): Response {
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(heading)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         font: 16px/1.5 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
         background: #f6f7f9; color: #1a1d21; padding: 24px; }
  @media (prefers-color-scheme: dark) { body { background: #14161a; color: #e7e9ec; } .card { background: #1d2026 !important; border-color: #2b2f36 !important; } }
  .card { background: #fff; border: 1px solid #e4e7eb; border-radius: 12px;
          padding: 32px; max-width: 460px; width: 100%; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0; color: #5b6572; }
  .mark { font-size: 32px; line-height: 1; margin-bottom: 12px; }
</style>
</head><body>
  <div class="card">
    <div class="mark">${ok ? "✓" : "•"}</div>
    <h1>${esc(heading)}</h1>
    <p>${esc(message)}</p>
  </div>
</body></html>`;
  return new Response(html, {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export const GET = withRouteLogging("api/unsubscribe:GET", async (req: Request): Promise<Response> => {
  const token = new URL(req.url).searchParams.get("token");
  const ok = await optOutFromToken(token);
  return ok
    ? page("You're unsubscribed", "You won't receive further marketing messages from this sender. It can take a little while for any already-scheduled message to stop.", true)
    : page("This link didn't work", "This unsubscribe link is invalid or couldn't be processed. If you keep receiving unwanted messages, reply to one and ask to be removed.", false);
});

// RFC 8058 one-click: the mail client POSTs to the URL (token in the query) with
// a `List-Unsubscribe=One-Click` body we don't need to read. Return 200 on
// success, per the spec; a bad token is a 400.
export const POST = withRouteLogging("api/unsubscribe:POST", async (req: Request): Promise<Response> => {
  const token = new URL(req.url).searchParams.get("token");
  const ok = await optOutFromToken(token);
  return new Response(ok ? "unsubscribed\n" : "invalid or missing token\n", {
    status: ok ? 200 : 400,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
});
