/**
 * Business Diagnostic API (platform spec Section 2, first slice). Any
 * member reads; owner/manager edits. Writes are per-category (PATCH), not
 * a whole-blob PUT like /api/business/constraint — see lib/business-
 * diagnostic.ts's comment on patchDiagnosticCategory for why a category-
 * at-a-time edit unit fits this page's UI better. Shares the
 * workspace_business blob with the rest of the Business OS.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../../../../lib/workspaces";
import { getDiagnostic, patchDiagnosticCategory, DIAGNOSTIC_CATEGORY_ORDER, type DiagnosticCategoryId, type DiagnosticCategoryEntry } from "../../../../lib/business-diagnostic";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

async function resolveScope(req: Request, requireManage: boolean): Promise<{ wsId: string; role: Role } | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requireManage && role !== "owner" && role !== "manager") return json({ error: "only an owner or manager can edit the diagnostic" }, 403);
  return { wsId, role };
}

function isCategoryId(v: unknown): v is DiagnosticCategoryId {
  return typeof v === "string" && (DIAGNOSTIC_CATEGORY_ORDER as string[]).includes(v);
}

export const GET = withRouteLogging("api/business/diagnostic:GET", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, false);
  if (scope instanceof Response) return scope;
  return json(await getDiagnostic(scope.wsId));
});

export const PATCH = withRouteLogging("api/business/diagnostic:PATCH", async (req: Request): Promise<Response> => {
  const scope = await resolveScope(req, true);
  if (scope instanceof Response) return scope;
  let body: unknown;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isCategoryId(b.categoryId)) return json({ error: `categoryId must be one of: ${DIAGNOSTIC_CATEGORY_ORDER.join(", ")}` }, 400);
  try {
    return json(await patchDiagnosticCategory(scope.wsId, b.categoryId, (b.entry ?? {}) as Partial<DiagnosticCategoryEntry>));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "could not save" }, 400);
  }
});
