import { resolveFunnelConfig } from "../../../../../lib/studio/funnel-store";
import { recordFunnelEvent, type FunnelEventType } from "../../../../../lib/acquisition/funnel-events";
import type { Attribution } from "../../../../../lib/acquisition/attribution";
import { checkRateLimit, clientIp } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Top-of-funnel analytics beacon: a `view` when the funnel loads, a `start`
// when the visitor begins. Fire-and-forget from the client — generously
// rate-limited, and a limit hit just silently drops the beacon (200) so it
// never disrupts the visitor.
const LIMIT = { windowMs: 60 * 1000, max: 40 };

export const POST = withRouteLogging("api/q/event:POST", async (req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> => {
  const limit = await checkRateLimit(`fevent:${clientIp(req)}`, LIMIT);
  if (!limit.allowed) return json({ ok: true, dropped: true });

  const { slug } = await ctx.params;
  if (!(await resolveFunnelConfig(slug))) return json({ error: "unknown funnel" }, 404);

  let body: { type?: unknown; attribution?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const type: FunnelEventType | null = body.type === "view" ? "view" : body.type === "start" ? "start" : null;
  if (!type) return json({ error: "type must be view or start" }, 400);
  const attribution = (body.attribution && typeof body.attribution === "object" ? body.attribution : undefined) as Attribution | undefined;

  try { await recordFunnelEvent({ funnelSlug: slug, type, attribution }); } catch { /* analytics is best effort */ }
  return json({ ok: true });
});
