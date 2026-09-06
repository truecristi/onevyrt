import { currentUser } from "../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, getWorkspace } from "../../../lib/workspaces";
import { getOrCreateReferralCode, listReferralsForReferrer } from "../../../lib/referrals";
import { activeReferralCount, referralRewardAmount } from "@onevyrt/engine";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** A workspace's own referral link and the referrals it's earned — any
 *  member can see it (it's marketing material, not billing detail), same
 *  bar as the programme enrollment view. */
export const GET = withRouteLogging("api/referrals:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const [code, referrals] = await Promise.all([getOrCreateReferralCode(wsId), listReferralsForReferrer(wsId)]);
  const withNames = await Promise.all(referrals.map(async (r) => {
    const referred = await getWorkspace(r.referredWorkspaceId);
    return { id: r.id, workspaceName: referred?.name ?? "A referred workspace", status: r.status, createdAt: r.createdAt, qualifiedAt: r.qualifiedAt };
  }));
  const activeCount = activeReferralCount(referrals, wsId);
  const { amountCents, currency } = referralRewardAmount(referrals, wsId);
  return json({ code, referrals: withNames, activeCount, discountAmountCents: amountCents, discountCurrency: currency });
});
