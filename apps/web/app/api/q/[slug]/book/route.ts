import { scoreLead, type QualAnswers } from "@onevyrt/engine";
import { resolveFunnelConfig } from "../../../../../lib/studio/funnel-store";
import { DEMO_AVAILABILITY, isSlotBookable } from "../../../../../lib/acquisition/availability";
import { bookedStarts, createBooking, SlotTakenError } from "../../../../../lib/acquisition/bookings";
import { funnelOwner, markLeadVerified } from "../../../../../lib/acquisition/leads";
import { notifyFunnelWorkspace } from "../../../../../lib/acquisition/notify";
import { isVerified } from "../../../../../lib/acquisition/otp";
import { buildCapiEvent, sendCapiEvent, metaCapiConfigured } from "../../../../../lib/acquisition/meta-capi";
import type { Attribution } from "../../../../../lib/acquisition/attribution";
import { checkRateLimit, clientIp, retryAfterHeader } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const LIMIT = { windowMs: 60 * 1000, max: 20 };

function pad(n: number): string { return String(n).padStart(2, "0"); }
function nowLocal(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
const SLOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

// A qualified visitor books their call slot. The calendar is intentionally
// AFTER qualification: we re-score the answers here (never trust the client's
// verdict) and refuse a booking for anyone who doesn't qualify, then re-check
// the slot is still open against the live bookings before persisting — the
// UNIQUE (funnel_slug, slot_start) constraint is the final race guard. A
// successful booking fires the Meta `Schedule` conversion for the qualified
// lead so Meta optimises toward booked calls, not just form-fills.
export const POST = withRouteLogging("api/q/book:POST", async (req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> => {
  const limit = await checkRateLimit(`book:ip:${clientIp(req)}`, LIMIT);
  if (!limit.allowed) return json({ error: "Too many requests." }, 429, retryAfterHeader(limit.retryAfterMs!));

  const { slug } = await ctx.params;
  const config = await resolveFunnelConfig(slug);
  if (!config) return json({ error: "unknown funnel" }, 404);

  let body: { slot?: unknown; answers?: unknown; attribution?: unknown; contact?: unknown; eventId?: unknown; verificationId?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const slot = typeof body.slot === "string" ? body.slot : "";
  if (!SLOT_RE.test(slot)) return json({ error: "a valid slot is required" }, 400);

  // Qualification gate — the calendar is only for leads who actually qualify.
  const answers = (body.answers && typeof body.answers === "object" ? body.answers : {}) as QualAnswers;
  const result = scoreLead(answers, config.rules);
  if (result.status !== "qualified") return json({ error: "This calendar is only available to qualified leads.", status: result.status }, 403);

  const contact = (body.contact && typeof body.contact === "object" ? body.contact : {}) as { name?: string; email?: string; phone?: string };

  // Verification gate — when the funnel requires it, the booker must present a
  // verification id that's verified for the contact they gave (proving they own
  // that email/phone). Never trust a client "verified" flag.
  if (config.verification?.enabled) {
    const vid = typeof body.verificationId === "string" ? body.verificationId : "";
    const channel = config.verification.channel;
    const dest = channel === "sms" ? contact.phone : contact.email;
    if (!vid || !dest || !(await isVerified(vid, channel, dest))) {
      return json({ error: "Please verify your contact details before booking.", needsVerification: true }, 403);
    }
  }
  const attribution = (body.attribution && typeof body.attribution === "object" ? body.attribution : {}) as Attribution;
  const eventId = typeof body.eventId === "string" ? body.eventId : undefined;

  // Re-check the slot is still open (it may have filled since the picker
  // loaded, or fallen outside the notice/advance window).
  const day = slot.slice(0, 10);
  const taken = await bookedStarts(slug, day, day + "T99");
  if (!isSlotBookable(DEMO_AVAILABILITY, slot, taken, nowLocal())) {
    return json({ error: "That time is no longer available — please pick another." }, 409);
  }

  let booking;
  try {
    booking = await createBooking({
      funnelSlug: slug, slotStart: slot,
      name: typeof contact.name === "string" ? contact.name : undefined,
      email: typeof contact.email === "string" ? contact.email : undefined,
      phone: typeof contact.phone === "string" ? contact.phone : undefined,
      attribution,
      workspaceId: await funnelOwner(slug),
    });
  } catch (e) {
    if (e instanceof SlotTakenError) return json({ error: e.message }, 409);
    throw e;
  }

  // Booking implies a verified contact when verification is on — badge the lead.
  if (config.verification?.enabled && contact.email) {
    try { await markLeadVerified(slug, contact.email); } catch { /* non-fatal */ }
  }

  // Tell the owner a call was booked (in-app bell).
  const who = (typeof contact.name === "string" && contact.name) || (typeof contact.email === "string" && contact.email) || "A lead";
  await notifyFunnelWorkspace(slug, {
    type: "call_booked",
    title: "New call booked 📅",
    body: `${who} booked a call for ${slot.slice(0, 10)} at ${slot.slice(11)}.`,
    linkUrl: "/business/leads",
    dedupeKey: `booking:${booking.id}`,
  });

  // A booked call is the strongest qualified signal — send Meta `Schedule`.
  let capi: { sent: boolean; skipped?: string; error?: string } = { sent: false, skipped: "no meta creds" };
  const event = buildCapiEvent({
    eventName: "Schedule",
    user: {
      email: typeof contact.email === "string" ? contact.email : undefined,
      phone: typeof contact.phone === "string" ? contact.phone : undefined,
      clientIp: clientIp(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    attribution,
    eventSourceUrl: attribution.landingUrl,
    customData: { slot_start: slot, qualification_score: result.score, route: result.route },
    eventId,
  });
  capi = await sendCapiEvent(event);

  return json({ ok: true, booking: { id: booking.id, slotStart: booking.slotStart }, capiConfigured: metaCapiConfigured(), capi });
});
