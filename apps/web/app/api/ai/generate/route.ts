/**
 * Managed AI generation — POST { system, prompt, maxTokens } → { text, used,
 * quota }. Generates with the OWNER's server-side key (lib/managed-ai) so users
 * who haven't brought their own key can still use the AI, metered against a
 * per-workspace monthly quota (lib/ai-usage-store).
 *
 * Graceful-off: when MANAGED_AI_KEY isn't set this returns 501 { configured:
 * false } and the client falls back to the BYO path — nothing breaks.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { managedAiConfigured, managedGenerate, managedMonthlyQuota, ManagedAiError, MANAGED_PROMPT_MAX } from "../../../../lib/managed-ai";
import { getAiUsage, incrementAiUsage, decrementAiUsage } from "../../../../lib/ai-usage-store";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging("api/ai/generate:POST", async (req: Request): Promise<Response> => {
  if (!managedAiConfigured()) return json({ error: "Managed AI is not enabled on this server.", configured: false }, 501);

  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  let body: { system?: unknown; prompt?: unknown; maxTokens?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const system = typeof body.system === "string" ? body.system.slice(0, MANAGED_PROMPT_MAX) : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, MANAGED_PROMPT_MAX) : "";
  const maxTokens = typeof body.maxTokens === "number" ? body.maxTokens : 700;
  if (!prompt.trim()) return json({ error: "prompt is required" }, 400);

  const quota = managedMonthlyQuota();
  const now = new Date();
  // Reserve-before-generate: increment atomically FIRST, then check. Checking
  // usage and incrementing separately was TOCTOU-racy — a concurrent burst all
  // read count < quota and all generated on the owner's funded key, blowing
  // past the monthly cap. Now each request atomically claims a slot; anyone who
  // overshoots the quota (or whose generation fails) refunds it.
  const used = await incrementAiUsage(wsId, now);
  if (used > quota) {
    await decrementAiUsage(wsId, now);
    return json({ error: "You've reached this month's AI limit. Add your own API key in Connections for unlimited use.", used: quota, quota, limited: true }, 429);
  }

  try {
    const text = await managedGenerate(system, prompt, maxTokens);
    return json({ text, used, quota });
  } catch (e) {
    // Provider error shouldn't burn quota — refund the slot we reserved.
    await decrementAiUsage(wsId, now);
    if (e instanceof ManagedAiError) return json({ error: e.message }, e.status);
    return json({ error: "AI generation failed." }, 502);
  }
});

/** Usage read for the connection UI (used/quota + whether managed is on). */
export const GET = withRouteLogging("api/ai/generate:GET", async (req: Request): Promise<Response> => {
  const configured = managedAiConfigured();
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (!configured) return json({ configured: false, used: 0, quota: 0 });
  const usage = await getAiUsage(wsId, new Date());
  return json({ configured: true, used: usage.count, quota: managedMonthlyQuota() });
});
