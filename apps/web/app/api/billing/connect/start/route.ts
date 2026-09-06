import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, getWorkspace, roleOf, setWorkspaceStripeConnectAccount } from "../../../../../lib/workspaces";
import { connectConfigured, createConnectedAccount, createAccountLink } from "../../../../../lib/stripe-connect";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/**
 * Start (or resume) Stripe Connect onboarding for a workspace so it can collect
 * payments from its own customers. Creates an Express account on first use,
 * stores only the account id, and returns a one-time onboarding URL to redirect
 * the owner to. Never touches card data.
 */
export const POST = withRouteLogging("api/billing/connect/start:POST", async (req: Request): Promise<Response> => {
  if (!connectConfigured()) return json({ error: "Payments aren't configured on this server yet." }, 503);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  let body: { ws?: unknown; returnUrl?: unknown; refreshUrl?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const wsId = typeof body.ws === "string" && body.ws ? body.ws : (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (role !== "owner") return json({ error: "Only the workspace owner can connect payments." }, 403);

  // Only allow onboarding links back to our own origin.
  const origin = new URL(req.url).origin;
  const safeUrl = (v: unknown, fallbackPath: string): string => {
    if (typeof v === "string") { try { const u = new URL(v, origin); if (u.origin === origin) return u.toString(); } catch { /* fall through */ } }
    return `${origin}${fallbackPath}`;
  };
  const returnUrl = safeUrl(body.returnUrl, "/business?connect=done");
  const refreshUrl = safeUrl(body.refreshUrl, "/business?connect=refresh");

  const ws = await getWorkspace(wsId);
  let accountId = ws?.stripeConnectAccountId;
  if (!accountId) {
    const created = await createConnectedAccount(user.email, wsId);
    if ("error" in created) return json({ error: created.error }, 502);
    accountId = created.accountId;
    await setWorkspaceStripeConnectAccount(wsId, accountId);
  }

  const link = await createAccountLink(accountId, refreshUrl, returnUrl);
  if ("error" in link) return json({ error: link.error }, 502);
  return json({ url: link.url });
});
