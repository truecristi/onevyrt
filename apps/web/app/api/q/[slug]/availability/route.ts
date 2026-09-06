import { resolveFunnelConfig } from "../../../../../lib/studio/funnel-store";
import { rangeAvailability, DEMO_AVAILABILITY } from "../../../../../lib/acquisition/availability";
import { bookedStarts } from "../../../../../lib/acquisition/bookings";
import { withRouteLogging } from "../../../../../lib/logger";
export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

function pad(n: number): string { return String(n).padStart(2, "0"); }
function todayISO(): string { const d = new Date(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
function nowLocal(): string { const d = new Date(); return `${todayISO()}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; }
function addDays(iso: string, n: number): string { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(Date.UTC(y ?? NaN, (m ?? NaN) - 1, (d ?? NaN) + n)); return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; }

// Open booking slots for a qualification funnel over the next `days` days. The
// booked slots are subtracted so the picker never offers a taken time.
export const GET = withRouteLogging("api/q/availability:GET", async (req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> => {
  const { slug } = await ctx.params;
  if (!(await resolveFunnelConfig(slug))) return json({ error: "unknown funnel" }, 404);
  const url = new URL(req.url);
  const start = url.searchParams.get("start") || todayISO();
  const days = Math.min(21, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const taken = await bookedStarts(slug, start, addDays(start, days));
  const availability = rangeAvailability(DEMO_AVAILABILITY, start, days, taken, nowLocal())
    .filter((d) => d.slots.length > 0); // only surface days that have openings
  return json({ slug, availability });
});
