import { scoreLead, type QualAnswers } from "@onevyrt/engine";
import { resolveFunnelConfig } from "../../../../lib/studio/funnel-store";
import { buildCapiEvent, sendCapiEvent, metaCapiConfigured } from "../../../../lib/acquisition/meta-capi";
import type { Attribution } from "../../../../lib/acquisition/attribution";
import { recordLead } from "../../../../lib/acquisition/leads";
import { notifyFunnelWorkspace } from "../../../../lib/acquisition/notify";
import { sendFollowUp } from "../../../../lib/acquisition/follow-up";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const LIMIT = { windowMs: 60 * 1000, max: 30 };

// A visitor finished a qualification funnel. Re-score their answers on the
// server (never trust the client's verdict), and — only when they qualify —
// fire the Meta `QualifiedLead` conversion event so Meta learns the good leads,
// not every form-fill. The event send no-ops without Meta credentials.
export const POST = withRouteLogging("api/q/qualified:POST", async (req: Request): Promise<Response> => {
  const limit = await checkRateLimit(`qualified:ip:${clientIp(req)}`, LIMIT);
  if (!limit.allowed) return json({ error: "Too many requests." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { slug?: unknown; answers?: unknown; attribution?: unknown; contact?: unknown; eventId?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.slug !== "string") return json({ error: "slug is required" }, 400);
  const config = await resolveFunnelConfig(body.slug);
  if (!config) return json({ error: "unknown funnel" }, 404);

  const answers = (body.answers && typeof body.answers === "object" ? body.answers : {}) as QualAnswers;
  const result = scoreLead(answers, config.rules);
  const attribution = (body.attribution && typeof body.attribution === "object" ? body.attribution : {}) as Attribution;
  const contact = (body.contact && typeof body.contact === "object" ? body.contact : {}) as { name?: string; email?: string; phone?: string };
  const eventId = typeof body.eventId === "string" ? body.eventId : undefined;

  // Record the lead (every status) so it shows in the owner's inbox. Best
  // effort — a store hiccup must not break the visitor's result screen.
  try {
    await recordLead({
      funnelSlug: body.slug, status: result.status, score: result.score, route: result.route ?? null,
      answers, attribution,
      name: typeof contact.name === "string" ? contact.name : undefined,
      email: typeof contact.email === "string" ? contact.email : undefined,
      phone: typeof contact.phone === "string" ? contact.phone : undefined,
    });
  } catch { /* non-fatal */ }

  // Only qualified leads become a conversion signal to Meta.
  let capi: { sent: boolean; skipped?: string; error?: string } = { sent: false, skipped: "not qualified" };
  if (result.status === "qualified") {
    const event = buildCapiEvent({
      eventName: "QualifiedLead",
      user: {
        email: typeof contact.email === "string" ? contact.email : undefined,
        phone: typeof contact.phone === "string" ? contact.phone : undefined,
        clientIp: clientIp(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
      },
      attribution,
      eventSourceUrl: attribution.landingUrl,
      customData: { qualification_score: result.score, qualification_percent: result.percent, route: result.route },
      eventId,
    });
    capi = await sendCapiEvent(event);
  } else if (config.followUp?.enabled && typeof contact.email === "string" && contact.email) {
    // Nurture / unqualified: auto-email them the resource their outcome
    // promised, so a lead who closes the tab still gets it. Best-effort.
    //
    // The recipient here is unauthenticated + attacker-supplied, and the route
    // is only IP-limited — so cap follow-ups PER RECIPIENT too, or this becomes
    // an email-amplification vector (spray mail to arbitrary addresses from our
    // domain by rotating IPs). A real lead needs one; 3/day is ample headroom.
    const fu = await checkRateLimit(`followup:to:${contact.email.toLowerCase()}`, { windowMs: 24 * 60 * 60 * 1000, max: 3 });
    if (fu.allowed) {
      await sendFollowUp({
        to: contact.email,
        funnelTitle: config.title,
        outcome: config.outcomes[result.status],
        recipientName: typeof contact.name === "string" ? contact.name : undefined,
      });
    }
  }

  if (result.status === "qualified") {
    // Tell the owner a hot lead just came in (in-app bell).
    const who = (typeof contact.name === "string" && contact.name) || (typeof contact.email === "string" && contact.email) || "A new lead";
    await notifyFunnelWorkspace(body.slug, {
      type: "qualified_lead",
      title: "New qualified lead 🎯",
      body: `${who} qualified (score ${result.score}) on ${config.title}.`,
      linkUrl: "/business/leads",
      dedupeKey: eventId ? `qlead:${eventId}` : undefined,
    });
  }

  return json({ ok: true, status: result.status, score: result.score, route: result.route, capiConfigured: metaCapiConfigured(), capi });
});
