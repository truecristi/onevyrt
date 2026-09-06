/**
 * Campaign Studio — website text scraper for AI brand generation. The browser
 * can't fetch an arbitrary third-party site (CORS), so this does it
 * server-side and returns cleaned visible text; the client then feeds that to
 * OpenRouter (with the user's own key) to structure it into a brand profile —
 * the key never touches our server, same posture as the funnel-studio Copilot.
 *
 * Reuses checkPublicHttpUrl (lib/url-safety.ts) as an SSRF guard: a user
 * could otherwise point this at an internal address and read the response
 * back. Gated behind the campaign_studio entitlement like the rest of the
 * feature.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { hasEntitlement } from "../../../../lib/entitlements";
import { checkPublicHttpUrl } from "../../../../lib/url-safety";
import { withRouteLogging } from "../../../../lib/logger";
import { fetchFollowingSafely, SsrfRedirectError } from "../../../../lib/campaign-studio/scan-site-fetch";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 600_000; // enough for the visible copy of a normal marketing page
const MAX_TEXT_OUT = 12_000; // what we hand back to the client for the AI prompt

/** Strips scripts/styles/tags from HTML and collapses whitespace — a crude
 *  but dependency-free "visible text" extraction, good enough to feed an LLM. */
function htmlToText(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = noScript.replace(/<\/(p|div|br|li|h[1-6]|tr|section)>/gi, "\n");
  const text = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = text
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rsquo;/g, "’").replace(/&mdash;/g, "—");
  return decoded.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export const POST = withRouteLogging("api/campaign-studio/scan-site:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (!(await hasEntitlement(wsId, "campaign_studio"))) return json({ error: "Campaign Studio isn't enabled for this workspace" }, 403);

  let body: { url?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.url !== "string" || !body.url.trim()) return json({ error: "a website URL is required" }, 400);
  const rawUrl = /^https?:\/\//i.test(body.url.trim()) ? body.url.trim() : `https://${body.url.trim()}`;

  const safety = await checkPublicHttpUrl(rawUrl);
  if (!safety.safe) return json({ error: `That URL can't be scanned: ${safety.reason}` }, 400);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchFollowingSafely(rawUrl, controller.signal);
    if (!res.ok) return json({ error: `The site returned HTTP ${res.status}.` }, 400);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return json({ error: "That URL isn't an HTML page." }, 400);
    const buf = await res.arrayBuffer();
    const html = Buffer.from(buf.slice(0, MAX_BYTES)).toString("utf8");
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const text = htmlToText(html).slice(0, MAX_TEXT_OUT);
    if (!text) return json({ error: "Couldn't read any text from that page." }, 400);
    return json({ url: rawUrl, title: titleMatch ? htmlToText(titleMatch[1] ?? "").slice(0, 200) : "", text });
  } catch (e) {
    const msg = e instanceof SsrfRedirectError ? `That URL can't be scanned: ${e.message}`
      : e instanceof Error && e.name === "AbortError" ? "The site took too long to respond."
      : "Couldn't reach that site.";
    return json({ error: msg }, 400);
  } finally {
    clearTimeout(timer);
  }
});
