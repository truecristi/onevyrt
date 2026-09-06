import { currentUser } from "../../../../lib/auth";
import { listOffers } from "../../../../lib/programme-offers";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** The three commercial offers, readable by any signed-in user — pricing
 *  page material, not sensitive. Editing is admin-only (see
 *  /api/admin/programme-offers). */
export const GET = withRouteLogging("api/programme/offers:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  return json({ offers: await listOffers() });
});
