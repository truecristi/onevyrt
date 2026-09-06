import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { otoConfig, createOtoCheckoutSession } from "../../../../lib/oto";
import { hasEntitlement } from "../../../../lib/entitlements";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Is a one-time offer configured on this server, and does this workspace
 *  already own it? Drives whether the OtoCard renders at all — returns
 *  `{ configured:false }` (never an error) when no OTO is set up, so the card
 *  simply stays hidden. */
export const GET = withRouteLogging("api/billing/oto:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const cfg = otoConfig();
  if (!cfg) return json({ configured: false });
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  const alreadyOwned = await hasEntitlement(wsId, cfg.entitlement);
  return json({ configured: true, alreadyOwned, isOwner: role === "owner", offer: { name: cfg.name, description: cfg.description, priceLabel: cfg.priceLabel } });
});

/** The workspace owner starts the one-time checkout. Returns a Stripe-hosted
 *  Checkout URL to redirect to; the entitlement is granted only later, by the
 *  isolated OTO webhook, once Stripe confirms the payment actually cleared —
 *  never here, so a started-but-unpaid checkout grants nothing. */
export const POST = withRouteLogging("api/billing/oto:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const cfg = otoConfig();
  if (!cfg) return json({ error: "No one-time offer is configured." }, 503);

  let body: { ws?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can buy add-ons." }, 403);
  if (await hasEntitlement(wsId, cfg.entitlement)) return json({ error: "This workspace already has it." }, 409);

  const origin = new URL(req.url).origin;
  const result = await createOtoCheckoutSession({
    customerEmail: user.email,
    workspaceId: wsId,
    successUrl: `${origin}/command-center?oto=success`,
    cancelUrl: `${origin}/command-center?oto=cancel`,
  });
  if ("error" in result) return json({ error: result.error }, 502);
  return json({ url: result.url });
});
