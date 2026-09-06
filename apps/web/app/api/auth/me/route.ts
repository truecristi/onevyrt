import { currentUser, currentImpersonator } from "../../../../lib/auth";
import { isAdminEmail } from "../../../../lib/admin";
import { computeUserRole } from "../../../../lib/navigation/user-role";
import { withRouteLogging } from "../../../../lib/logger";
export const runtime = "nodejs";
export const GET = withRouteLogging("api/auth/me:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return new Response(JSON.stringify({ error: "not authenticated" }), { status: 401, headers: { "content-type": "application/json" } });
  const impersonator = await currentImpersonator(req.headers.get("cookie"));
  // Instance admins are automatically super-admins: every feature, every plan
  // capability, unlocked instance-wide, without ever touching their
  // workspace's stored plan — see lib/admin.
  const role = await computeUserRole(user.id, user.email);
  const body = { id: user.id, email: user.email, role, ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}), ...(impersonator ? { impersonatedBy: impersonator.email } : {}), superAdmin: isAdminEmail(user.email) };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
});
