import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, getWorkspace, roleOf } from "../../../../../lib/workspaces";
import { connectConfigured, getConnectedAccount } from "../../../../../lib/stripe-connect";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/**
 * Report a workspace's Stripe Connect status: "none" (never started),
 * or the live onboarding/restricted/active state from Stripe. Owner-only, since
 * it reflects the account that receives the workspace's money.
 */
export const GET = withRouteLogging("api/billing/connect/status:GET", async (req: Request): Promise<Response> => {
  if (!connectConfigured()) return json({ configured: false, status: "none" });

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const url = new URL(req.url);
  const wsId = url.searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can view payment settings." }, 403);

  const ws = await getWorkspace(wsId);
  if (!ws?.stripeConnectAccountId) return json({ configured: true, status: "none" });

  const result = await getConnectedAccount(ws.stripeConnectAccountId);
  if ("error" in result) return json({ error: result.error }, 502);
  return json({ configured: true, status: result.status, flags: result.flags });
});
