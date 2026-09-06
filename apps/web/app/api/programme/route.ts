import { currentUser } from "../../../lib/auth";
import { getDefaultProgramme } from "../../../lib/curriculum-store";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/** The programme's content (stages, lessons, assignments) — any signed-in
 *  user can read it, same bar as reading a project's comments. */
export const GET = withRouteLogging("api/programme:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const programme = await getDefaultProgramme();
  return json({ programme });
});
