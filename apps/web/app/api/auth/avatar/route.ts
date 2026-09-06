import { currentUser, updateAvatar, removeAvatar } from "../../../../lib/auth";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/auth/avatar:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  let body: { dataUrl?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.dataUrl !== "string" || !body.dataUrl) return json({ error: "dataUrl is required" }, 400);
  try {
    const updated = await updateAvatar(user.id, body.dataUrl);
    return json({ avatarUrl: updated.avatarUrl });
  } catch (e) { return json({ error: e instanceof Error ? e.message : "could not update photo" }, 400); }
});

export const DELETE = withRouteLogging("api/auth/avatar:DELETE", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  await removeAvatar(user.id);
  return json({ ok: true });
});
