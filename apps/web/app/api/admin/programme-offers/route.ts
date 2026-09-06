import { requireAdmin } from "../../../../lib/admin";
import { listOffers, updateOffer } from "../../../../lib/programme-offers";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";
import type { DeliveryMode } from "@onevyrt/engine";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });
const VALID_IDS: DeliveryMode[] = ["self_paced", "cohort", "premium_1to1"];

export const GET = withRouteLogging("api/admin/programme-offers:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  return json({ offers: await listOffers() });
});

export const POST = withRouteLogging("api/admin/programme-offers:POST", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const body = await req.json().catch(() => null) as { id?: string; name?: string; priceLabel?: string; description?: string; active?: boolean } | null;
  if (!body?.id || !VALID_IDS.includes(body.id as DeliveryMode)) return json({ error: "id must be one of self_paced, cohort, premium_1to1" }, 400);
  try {
    const updated = await updateOffer(body.id as DeliveryMode, body);
    await recordAudit({ actorEmail: admin.email, action: "programme-offer.update", targetType: "programme-offer", detail: `${updated.id}: ${updated.name} (${updated.active ? "active" : "inactive"})` });
    return json({ offer: updated });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Could not save offer." }, 400);
  }
});
