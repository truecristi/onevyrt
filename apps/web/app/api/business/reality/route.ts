/**
 * Business Reality Map API — the first business-OS system. Core to the
 * workspace (not behind the Campaign Studio add-on): any member can read,
 * owner/manager can edit. Stored via lib/reality.ts under the `realityMap`
 * section (lib/business.ts).
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getReality, patchReality, type BusinessRealityMap, type RealityNow, type RealityGap } from "../../../../lib/reality";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the reality map" }, 403);
  return { wsId, role };
}

export const GET = withRouteLogging("api/business/reality:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  return json(await getReality(scope.wsId));
});

const S = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : undefined);
/** Only the sub-keys actually present in `v` survive — used for the
 *  PATCH body's `now`/`gaps`, so a caller sending just `{now: {revenue}}`
 *  doesn't implicitly clear the other `now` fields (patchReality() merges
 *  this object onto the stored one; an absent key here means "leave it",
 *  matching the top-level `body.X !== undefined` checks below). */
function pickPartialStrings(v: unknown, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (v && typeof v === "object") for (const k of keys) { const s = S((v as Record<string, unknown>)[k]); if (s !== undefined) out[k] = s; }
  return out;
}

export const PATCH = withRouteLogging("api/business/reality:PATCH", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  // Only the fields actually present in the request body land in the
  // patch — patchReality() merges this onto whatever's already stored,
  // so an omitted field is left untouched rather than wiped.
  const patch: Partial<BusinessRealityMap> = {};
  if (body.businessIn !== undefined) patch.businessIn = S(body.businessIn) ?? "";
  if (body.businessReallyIn !== undefined) patch.businessReallyIn = S(body.businessReallyIn) ?? "";
  if (body.businessNeedToBeIn !== undefined) patch.businessNeedToBeIn = S(body.businessNeedToBeIn) ?? "";
  if (body.now !== undefined) patch.now = pickPartialStrings(body.now, ["revenue", "profit", "customers", "team", "stage"]) as RealityNow;
  if (body.want12m !== undefined) patch.want12m = S(body.want12m) ?? "";
  if (body.want36m !== undefined) patch.want36m = S(body.want36m) ?? "";
  if (body.targetRevenue !== undefined) patch.targetRevenue = S(body.targetRevenue) ?? "";
  if (body.gaps !== undefined) patch.gaps = pickPartialStrings(body.gaps, ["revenue", "capability", "acquisition", "product", "team", "system"]) as RealityGap;

  return json(await patchReality(scope.wsId, patch));
});
