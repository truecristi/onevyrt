/**
 * Campaign Studio — campaigns API. GET lists a workspace's campaigns; POST
 * creates one (optionally seeded from a built-in template); PATCH updates one;
 * DELETE removes one. Gated behind the campaign_studio entitlement; writes
 * require owner/manager. Every operation is workspace-scoped in the store, so a
 * caller can never touch another workspace's campaigns.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { hasEntitlement } from "../../../../lib/entitlements";
import {
  listCampaigns, createCampaign, updateCampaign, deleteCampaign,
  isStatus, sanitizeFlow, type CampaignPatch,
} from "../../../../lib/campaigns";
import { TEMPLATES } from "../../../../lib/templates";
import { purgeRow } from "../../../../lib/soft-delete";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can manage campaigns" }, 403);
  if (!(await hasEntitlement(wsId, "campaign_studio"))) return json({ error: "Campaign Studio isn't enabled for this workspace" }, 403);
  return { wsId, role };
}

const S = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

export const GET = withRouteLogging("api/campaign-studio/campaigns:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  const campaigns = await listCampaigns(scope.wsId);
  // Ship the template catalogue alongside so the client renders "start from a
  // template" without a second round-trip.
  return json({ campaigns, templates: TEMPLATES });
});

export const POST = withRouteLogging("api/campaign-studio/campaigns:POST", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const name = S(body.name)?.trim() ?? "";
  const templateId = S(body.templateId);
  if (!name && !templateId) return json({ error: "a campaign name or a template is required" }, 400);
  const campaign = await createCampaign(scope.wsId, {
    name, objective: S(body.objective), channel: S(body.channel), templateId,
  });
  return json({ campaign });
});

export const PATCH = withRouteLogging("api/campaign-studio/campaigns:PATCH", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const id = S(body.id);
  if (!id) return json({ error: "a campaign id is required" }, 400);

  const patch: CampaignPatch = {};
  if (body.name !== undefined) patch.name = S(body.name) ?? "";
  if (body.objective !== undefined) patch.objective = S(body.objective) ?? "";
  if (body.status !== undefined) { if (!isStatus(body.status)) return json({ error: "invalid status" }, 400); patch.status = body.status; }
  if (body.channel !== undefined) patch.channel = S(body.channel) ?? "";
  if (body.budget !== undefined) patch.budget = S(body.budget) ?? "";
  if (body.startsAt !== undefined) patch.startsAt = S(body.startsAt) ?? "";
  if (body.endsAt !== undefined) patch.endsAt = S(body.endsAt) ?? "";
  if (body.flow !== undefined) patch.flow = sanitizeFlow(body.flow);

  let campaign;
  try { campaign = await updateCampaign(scope.wsId, id, patch); }
  catch (e) { return json({ error: e instanceof Error ? e.message : "could not save" }, 400); }
  if (!campaign) return json({ error: "campaign not found" }, 404);
  return json({ campaign });
});

export const DELETE = withRouteLogging("api/campaign-studio/campaigns:DELETE", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return json({ error: "a campaign id is required" }, 400);
  // ?permanent=1 empties this from the bin (irreversible); default soft-deletes
  // it → recoverable for 30 days.
  if (url.searchParams.get("permanent") === "1") {
    const purged = await purgeRow("campaigns", scope.wsId, id);
    if (!purged) return json({ error: "campaign not found in the bin" }, 404);
    return json({ ok: true, permanent: true });
  }
  const ok = await deleteCampaign(scope.wsId, id);
  if (!ok) return json({ error: "campaign not found" }, 404);
  return json({ ok: true });
});
