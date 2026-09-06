/**
 * Community swipe file API. GET lists shared ad creatives (any authed member).
 * POST publishes one (owner/manager). PATCH ?id= bumps the use counter when a
 * creative is copied (any member). DELETE ?id= unpublishes one you authored.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { hasEntitlement } from "../../../../lib/entitlements";
import { publishCreative, listSharedCreatives, recordCreativeUse, unpublishCreative } from "../../../../lib/campaign/shared-creatives";
import { resolveDisplayName } from "../../../../lib/community/profile";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

// Keyed by workspace id — see community/comments/route.ts for why. Publishing
// is rare relative to browsing, so a tight-but-livable budget; copying ("use")
// is as frequent as a reaction, so it gets the same generous budget — the
// per-workspace dedupe in shared-creatives.ts is what actually bounds a loop
// against one item, this is just a backstop against write-spam in general.
const PUBLISH_LIMIT = { windowMs: 3_600_000, max: 10 };
const USE_LIMIT = { windowMs: 60_000, max: 30 };

async function resolveWs(req: Request, requireManage: boolean): Promise<{ wsId: string } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can do this" }, 403);
  if (!(await hasEntitlement(wsId, "campaign_studio"))) return json({ error: "Campaign Studio isn't enabled for this workspace" }, 403);
  return { wsId };
}

export const GET = withRouteLogging("api/community/creatives:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const creatives = await listSharedCreatives();
  return json({ creatives: creatives.map((c) => ({ ...c, mine: c.authorWorkspaceId === scope.wsId })) });
});

export const POST = withRouteLogging("api/community/creatives:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const rl = await checkRateLimit(`community:creative:publish:${scope.wsId}`, PUBLISH_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again later" }, 429, retryAfterHeader(rl.retryAfterMs!));
  let body: { headline?: unknown; primaryText?: unknown; cta?: unknown; angle?: unknown; score?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const headline = typeof body.headline === "string" ? body.headline : "";
  if (!headline.trim()) return json({ error: "a headline is required" }, 400);
  try {
    const c = await publishCreative(scope.wsId, {
      headline,
      primaryText: typeof body.primaryText === "string" ? body.primaryText : undefined,
      cta: typeof body.cta === "string" ? body.cta : undefined,
      angle: typeof body.angle === "string" ? body.angle : undefined,
      score: typeof body.score === "number" ? body.score : undefined,
      authorName: await resolveDisplayName(scope.wsId),
    });
    return json({ ok: true, creative: c });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not publish" }, 400);
  }
});

export const PATCH = withRouteLogging("api/community/creatives:PATCH", async (req: Request): Promise<Response> => {
  // Copying a creative is a "use" — any authed member can bump the counter.
  const scope = await resolveWs(req, false);
  if (scope instanceof Response) return scope;
  const rl = await checkRateLimit(`community:creative:use:${scope.wsId}`, USE_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "id is required" }, 400);
  await recordCreativeUse(id, scope.wsId);
  return json({ ok: true });
});

export const DELETE = withRouteLogging("api/community/creatives:DELETE", async (req: Request): Promise<Response> => {
  const scope = await resolveWs(req, true);
  if (scope instanceof Response) return scope;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return json({ error: "id is required" }, 400);
  return json({ ok: await unpublishCreative(scope.wsId, id) });
});
