/**
 * Workspace-scope enforcement for API routes (Wave 2 Lane 2 foundation).
 * Every app/api/projects/* route currently hand-rolls the same
 * `resolveScope`: read the session cookie, resolve the caller, find the
 * target workspace (a `ws` query param, or fall back to their personal
 * workspace), confirm membership, and hand back {wsId, role, email} or the
 * 401/403 Response to return as-is. This module is that logic pulled out
 * once so Wave 3+ routes call it instead of re-copying it — see
 * requireWorkspaceMember and WorkspaceScoped below.
 *
 * This is prep work: nothing here is wired into an existing route yet.
 *
 * On "decorator": this codebase's route handlers are plain exported
 * functions (GET/POST/...), not class methods, and tsconfig.json does not
 * enable experimentalDecorators — so `@WorkspaceScoped()` class-decorator
 * syntax has nowhere to attach. WorkspaceScoped is instead a higher-order
 * function that wraps a handler, the same shape lib/logger.ts's
 * withRouteLogging already uses in every route file; the two compose
 * directly (see WorkspaceScoped's own doc comment below).
 */
import { currentUser, type User } from "../auth";
import { ensurePersonalWorkspace, roleOf, type Role } from "../workspaces";
import { roleMeets } from "../auth/permission-check";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

export interface WorkspaceScope {
  userId: string;
  email: string;
  workspaceId: string;
  role: Role;
}

/** Shared by requireWorkspaceMember and WorkspaceScoped so a route using the
 *  HOF form never pays for currentUser() twice (once to find which
 *  workspace, once to check membership in it). */
async function checkMembership(user: User, workspaceId: string, requiredRole?: Role): Promise<WorkspaceScope | Response> {
  const role = await roleOf(workspaceId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (requiredRole && !roleMeets(role, requiredRole)) {
    return json({ error: `requires ${requiredRole} access or higher` }, 403);
  }
  return { userId: user.id, email: user.email, workspaceId, role };
}

/**
 * Validates that the request's signed-in user is a member of `workspaceId`
 * — and, when `requiredRole` is given, that their role is at or above it
 * (owner > manager > editor > viewer, see lib/auth/permission-check.ts).
 * Returns the resolved scope on success, or the exact Response the route
 * should `return` as-is on failure: 401 if there's no signed-in user, 403
 * if they aren't a member or their role isn't high enough.
 *
 *   const scope = await requireWorkspaceMember(req, workspaceId, "editor");
 *   if (scope instanceof Response) return scope;
 *   // scope.userId / scope.role / scope.workspaceId are now trustworthy
 *
 * Takes workspaceId explicitly rather than guessing it from the request —
 * callers decide where it comes from (a `ws` query param, a route param, a
 * body field). resolveWorkspaceId below covers the common case.
 */
export async function requireWorkspaceMember(req: Request, workspaceId: string, requiredRole?: Role): Promise<WorkspaceScope | Response> {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  return checkMembership(user, workspaceId, requiredRole);
}

/**
 * Reads a workspace id off a request the way every project route currently
 * does by hand: an explicit `?ws=` query param, falling back to the
 * caller's personal workspace (auto-provisioned) when absent — see
 * app/api/projects/route.ts's resolveScope, which this generalizes.
 */
export async function resolveWorkspaceId(req: Request, userId: string): Promise<string> {
  const wsParam = new URL(req.url).searchParams.get("ws");
  if (wsParam) return wsParam;
  const personal = await ensurePersonalWorkspace(userId);
  return personal.id;
}

export interface WorkspaceScopedOptions {
  /** Minimum role the caller must hold in the resolved workspace. Omit to
   *  only require membership (any role). */
  requiredRole?: Role;
  /** How to find the workspace id for this request. Defaults to
   *  resolveWorkspaceId (the `?ws=` query param / personal-workspace
   *  fallback described above). */
  getWorkspaceId?: (req: Request, userId: string) => Promise<string> | string;
}

type WorkspaceScopedHandler<A extends unknown[]> = (req: Request, scope: WorkspaceScope, ...rest: A) => Promise<Response>;

/**
 * HOF "decorator" that wraps a route handler so it only ever runs for an
 * authenticated member whose role meets `options.requiredRole` — every
 * rejection (401 unauthenticated, 403 not a member / role too low) is
 * handled here and never reaches the wrapped handler. Composes with
 * withRouteLogging (lib/logger.ts) the same way every route already nests
 * its own auth check inside that wrapper:
 *
 *   export const POST = withRouteLogging("api/campaigns:POST",
 *     WorkspaceScoped({ requiredRole: "editor" })(async (req, scope) => {
 *       // scope: { userId, email, workspaceId, role }
 *       return json(await createCampaign(scope.workspaceId, ...));
 *     }));
 *
 * For a route with extra handler arguments (e.g. Next's `ctx: { params }`),
 * give the type argument explicitly so they type-check through:
 *
 *   WorkspaceScoped<[{ params: Promise<{ id: string }> }]>()(async (req, scope, ctx) => { ... })
 */
export function WorkspaceScoped<A extends unknown[] = []>(options: WorkspaceScopedOptions = {}) {
  const getWorkspaceId = options.getWorkspaceId ?? resolveWorkspaceId;
  return (handler: WorkspaceScopedHandler<A>) =>
    async (req: Request, ...rest: A): Promise<Response> => {
      const user = await currentUser(req.headers.get("cookie"));
      if (!user) return json({ error: "not authenticated" }, 401);
      const workspaceId = await getWorkspaceId(req, user.id);
      const scope = await checkMembership(user, workspaceId, options.requiredRole);
      if (scope instanceof Response) return scope;
      return handler(req, scope, ...rest);
    };
}
