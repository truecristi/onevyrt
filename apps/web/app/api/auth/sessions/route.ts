import { currentUser, currentSessionId, listSessions, revokeOtherSessions } from "../../../../lib/auth";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** Lists the signed-in user's own active sessions, most recent first. */
export const GET = withRouteLogging("api/auth/sessions:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const sessions = await listSessions(user.id);
  const currentId = currentSessionId(req.headers.get("cookie"));
  return json({ sessions, currentId });
});

/** "Log out everywhere else": revokes every session for this account except
 *  the one making the request. */
export const DELETE = withRouteLogging("api/auth/sessions:DELETE", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const currentId = currentSessionId(req.headers.get("cookie"));
  const revoked = await revokeOtherSessions(user.id, currentId ?? undefined);
  return json({ revoked });
});
