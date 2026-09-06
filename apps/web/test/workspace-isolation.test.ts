/**
 * Wave 2 Lane 2: workspace isolation middleware + scope-enforcement helpers.
 * Exercises the real stack (Postgres, real sessions, real workspaces/roles)
 * rather than mocks — same convention as test/workspace-roles.test.ts — so a
 * pass here means the guard actually holds against the real schema, not
 * just a stubbed one.
 *
 * Note on file location: the lane spec named apps/web/__tests__/..., but this
 * project's test runner only discovers test/**\/*.test.ts (see package.json's
 * "test" script) — a file under __tests__/ would simply never run. Filed here
 * instead so it's actually exercised by `pnpm test`.
 */
import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import * as wsLib from "../lib/workspaces";
import { pgPool } from "../lib/db";
import { requireWorkspaceMember, resolveWorkspaceId, WorkspaceScoped, type WorkspaceScope } from "../lib/middleware/workspace-scope";
import { canUserAccessWorkspace, canUserAccess, roleMeets } from "../lib/auth/permission-check";
import { scopedQuery, scopedSelect, assertBelongsToWorkspace } from "../lib/db/scope-helpers";
import { uid, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix } from "./helpers/pg";

const PREFIX = uid("wsiso-test");
const email = (n: string) => `${PREFIX}+${n}@example.com`;

// campaigns is exercised directly (canUserAccess / scopedQuery both need a
// real workspace-scoped table with a globally-unique id) but has no purge
// helper in helpers/pg.ts, since account/workspace deletion doesn't cascade
// to it at the DB level either (see lib/workspaces.ts adminDeleteWorkspace's
// manual cascade) — cleaned up here directly instead of touching shared
// test infra for one file's fixtures.
const campaignIds: string[] = [];
async function insertCampaign(workspaceId: string, name: string): Promise<string> {
  const id = uid("campaign");
  campaignIds.push(id);
  const now = new Date().toISOString();
  await pgPool().query(
    `INSERT INTO campaigns (id, workspace_id, name, created_at, updated_at) VALUES ($1, $2, $3, $4, $4)`,
    [id, workspaceId, name, now],
  );
  return id;
}

after(async () => {
  if (campaignIds.length) await pgPool().query("DELETE FROM campaigns WHERE id = ANY($1)", [campaignIds]);
  await purgeWorkspacesByNamePrefix(PREFIX);
  await purgeUsersByEmailPrefix(PREFIX);
});

function cookieFor(token: string): string {
  return `gb_session=${token}`;
}
async function requestAs(userId: string, url = "http://x/test"): Promise<Request> {
  const token = await auth.createSession(userId);
  return new Request(url, { headers: { cookie: cookieFor(token) } });
}

// ---------------------------------------------------------------------------
// requireWorkspaceMember
// ---------------------------------------------------------------------------

test("requireWorkspaceMember: 401 when the request carries no session", async () => {
  const req = new Request("http://x/test");
  const result = await requireWorkspaceMember(req, "some-workspace-id");
  assert.ok(result instanceof Response);
  assert.equal((result as Response).status, 401);
});

test("requireWorkspaceMember: 403 — a user cannot access a workspace they don't belong to", async () => {
  const owner = await auth.registerUser(email("owner1"), "correct-horse-1");
  const outsider = await auth.registerUser(email("outsider1"), "correct-horse-2");
  const workspace = await wsLib.createWorkspace(owner.id, `${PREFIX} WS 1`);

  const req = await requestAs(outsider.id);
  const result = await requireWorkspaceMember(req, workspace.id);
  assert.ok(result instanceof Response);
  assert.equal((result as Response).status, 403);
  const body = await (result as Response).json();
  assert.match(body.error, /not a member/i);
});

test("requireWorkspaceMember: resolves scope for a real member, and enforces requiredRole (viewer can't edit)", async () => {
  const owner = await auth.registerUser(email("owner2"), "correct-horse-1");
  const viewer = await auth.registerUser(email("viewer2"), "correct-horse-2");
  let workspace = await wsLib.createWorkspace(owner.id, `${PREFIX} WS 2`);
  workspace = await wsLib.adminSetPlan(workspace.id, "business");
  workspace = await wsLib.addMember(workspace.id, owner.id, viewer.id, "viewer");

  const viewerReq = await requestAs(viewer.id);
  const membershipOnly = await requireWorkspaceMember(viewerReq, workspace.id);
  assert.ok(!(membershipOnly instanceof Response));
  assert.equal((membershipOnly as WorkspaceScope).role, "viewer");
  assert.equal((membershipOnly as WorkspaceScope).workspaceId, workspace.id);

  // The core RBAC assertion: a viewer is a real member, but editing requires
  // "editor" or above — this must be a 403, not a pass-through.
  const editAttempt = await requireWorkspaceMember(viewerReq, workspace.id, "editor");
  assert.ok(editAttempt instanceof Response);
  assert.equal((editAttempt as Response).status, 403);

  const ownerReq = await requestAs(owner.id);
  const ownerEdit = await requireWorkspaceMember(ownerReq, workspace.id, "editor");
  assert.ok(!(ownerEdit instanceof Response));
  assert.equal((ownerEdit as WorkspaceScope).role, "owner");
});

test("resolveWorkspaceId: uses the ?ws= param when present, else the caller's personal workspace", async () => {
  const user = await auth.registerUser(email("resolve1"), "correct-horse-1");

  const withParam = await resolveWorkspaceId(new Request("http://x/test?ws=explicit-id-123"), user.id);
  assert.equal(withParam, "explicit-id-123");

  const fallback = await resolveWorkspaceId(new Request("http://x/test"), user.id);
  const personal = await wsLib.ensurePersonalWorkspace(user.id);
  assert.equal(fallback, personal.id);
});

test("WorkspaceScoped: the wrapped handler runs only for an authorized member, and receives the resolved scope", async () => {
  const owner = await auth.registerUser(email("owner3"), "correct-horse-1");
  const editor = await auth.registerUser(email("editor3"), "correct-horse-2");
  const outsider = await auth.registerUser(email("outsider3"), "correct-horse-3");
  let workspace = await wsLib.createWorkspace(owner.id, `${PREFIX} WS 3`);
  workspace = await wsLib.adminSetPlan(workspace.id, "business");
  workspace = await wsLib.addMember(workspace.id, owner.id, editor.id, "editor");

  let handlerCalls = 0;
  const handler = WorkspaceScoped({ requiredRole: "editor", getWorkspaceId: () => workspace.id })(
    async (_req, scope) => {
      handlerCalls += 1;
      return new Response(JSON.stringify({ role: scope.role }), { status: 200 });
    },
  );

  const unauthed = await handler(new Request("http://x/test"));
  assert.equal(unauthed.status, 401);

  const outsiderRes = await handler(await requestAs(outsider.id));
  assert.equal(outsiderRes.status, 403);

  const editorRes = await handler(await requestAs(editor.id));
  assert.equal(editorRes.status, 200);
  assert.deepEqual(await editorRes.json(), { role: "editor" });

  assert.equal(handlerCalls, 1, "the wrapped handler must not run for the rejected requests, only the authorized one");
});

// ---------------------------------------------------------------------------
// permission-check
// ---------------------------------------------------------------------------

test("roleMeets: ranks owner > manager > editor > viewer", () => {
  assert.equal(roleMeets("owner", "viewer"), true);
  assert.equal(roleMeets("manager", "editor"), true);
  assert.equal(roleMeets("editor", "manager"), false);
  assert.equal(roleMeets("viewer", "editor"), false);
  assert.equal(roleMeets("owner", "owner"), true);
});

test("canUserAccessWorkspace: membership and role-gated access", async () => {
  const owner = await auth.registerUser(email("owner4"), "correct-horse-1");
  const viewer = await auth.registerUser(email("viewer4"), "correct-horse-2");
  const outsider = await auth.registerUser(email("outsider4"), "correct-horse-3");
  let workspace = await wsLib.createWorkspace(owner.id, `${PREFIX} WS 4`);
  workspace = await wsLib.adminSetPlan(workspace.id, "business");
  workspace = await wsLib.addMember(workspace.id, owner.id, viewer.id, "viewer");

  assert.equal(await canUserAccessWorkspace(outsider.id, workspace.id), false);
  assert.equal(await canUserAccessWorkspace(viewer.id, workspace.id), true);
  assert.equal(await canUserAccessWorkspace(viewer.id, workspace.id, "editor"), false);
  assert.equal(await canUserAccessWorkspace(owner.id, workspace.id, "editor"), true);
});

test("canUserAccess: resolves a resource's owning workspace and fails closed across tenants", async () => {
  const ownerA = await auth.registerUser(email("ownerA5"), "correct-horse-1");
  const viewerA = await auth.registerUser(email("viewerA5"), "correct-horse-2");
  const ownerB = await auth.registerUser(email("ownerB5"), "correct-horse-3");
  let wsA = await wsLib.createWorkspace(ownerA.id, `${PREFIX} WS 5A`);
  wsA = await wsLib.adminSetPlan(wsA.id, "business");
  wsA = await wsLib.addMember(wsA.id, ownerA.id, viewerA.id, "viewer");
  const wsB = await wsLib.createWorkspace(ownerB.id, `${PREFIX} WS 5B`);

  const campaignId = await insertCampaign(wsA.id, "A's campaign");

  assert.equal(await canUserAccess(ownerA.id, "campaign", campaignId), true);
  assert.equal(await canUserAccess(viewerA.id, "campaign", campaignId), true);
  assert.equal(await canUserAccess(viewerA.id, "campaign", campaignId, "editor"), false, "a viewer cannot edit even a resource in their own workspace");
  // The cross-tenant case: B genuinely owns a workspace of their own (real
  // membership, not just a stray id) — that still grants nothing over A's campaign.
  assert.equal(await canUserAccessWorkspace(ownerB.id, wsB.id, "owner"), true);
  assert.equal(await canUserAccess(ownerB.id, "campaign", campaignId), false);
  // Fails closed, never throws, for an unrecognized type or a missing row.
  assert.equal(await canUserAccess(ownerA.id, "not-a-real-resource-type", campaignId), false);
  assert.equal(await canUserAccess(ownerA.id, "campaign", "no-such-campaign-id"), false);
});

// ---------------------------------------------------------------------------
// scope-helpers
// ---------------------------------------------------------------------------

test("scopedQuery: appends a correctly-numbered guard, WHERE vs AND", () => {
  const withExistingWhere = scopedQuery({ text: "SELECT id FROM campaigns WHERE status = $1", values: ["draft"] }, "ws-1");
  assert.equal(withExistingWhere.text, "SELECT id FROM campaigns WHERE status = $1 AND workspace_id = $2");
  assert.deepEqual(withExistingWhere.values, ["draft", "ws-1"]);

  const withNoWhereYet = scopedQuery({ text: "SELECT id FROM campaigns", values: [] }, "ws-1");
  assert.equal(withNoWhereYet.text, "SELECT id FROM campaigns WHERE workspace_id = $1");

  // projects predates the workspace_id convention and uses scope_key instead
  // (see lib/store.ts) — the column is configurable for exactly this case.
  const projectsShaped = scopedQuery({ text: "SELECT id FROM projects", values: [] }, "ws-1", "scope_key");
  assert.equal(projectsShaped.text, "SELECT id FROM projects WHERE scope_key = $1");

  const withSuffix = scopedQuery({ text: "SELECT id FROM campaigns", values: [] }, "ws-1", "workspace_id", "ORDER BY created_at DESC");
  assert.equal(withSuffix.text, "SELECT id FROM campaigns WHERE workspace_id = $1 ORDER BY created_at DESC");

  assert.throws(() => scopedQuery({ text: "SELECT 1", values: [] }, "ws-1", "workspace_id; DROP TABLE users"), /plain SQL identifier/);
});

test("scopedSelect: query results are filtered to the given workspace, even when the base query's own predicate spans both", async () => {
  const ownerA = await auth.registerUser(email("ownerA6"), "correct-horse-1");
  const ownerB = await auth.registerUser(email("ownerB6"), "correct-horse-2");
  const wsA = await wsLib.createWorkspace(ownerA.id, `${PREFIX} WS 6A`);
  const wsB = await wsLib.createWorkspace(ownerB.id, `${PREFIX} WS 6B`);
  const campaignA = await insertCampaign(wsA.id, "campaign in A");
  const campaignB = await insertCampaign(wsB.id, "campaign in B");

  // The base predicate alone would return BOTH rows — proving the guard is
  // what narrows it, not the base query happening to already be scoped.
  const base = { text: "SELECT id, name, workspace_id FROM campaigns WHERE id = ANY($1)", values: [[campaignA, campaignB]] };

  const rowsForA = await scopedSelect<{ id: string; name: string; workspace_id: string }>(pgPool(), base, wsA.id);
  assert.equal(rowsForA.length, 1);
  assert.equal(rowsForA[0]!.id, campaignA);

  const rowsForB = await scopedSelect<{ id: string; name: string; workspace_id: string }>(pgPool(), base, wsB.id);
  assert.equal(rowsForB.length, 1);
  assert.equal(rowsForB[0]!.id, campaignB);
});

test("assertBelongsToWorkspace: passes for a matching row, throws for a mismatched one", () => {
  assert.doesNotThrow(() => assertBelongsToWorkspace({ workspace_id: "ws-1" }, "ws-1"));
  assert.doesNotThrow(() => assertBelongsToWorkspace({ scope_key: "ws-1" }, "ws-1", "project"));
  assert.throws(() => assertBelongsToWorkspace({ workspace_id: "ws-2" }, "ws-1"), /isolation violation/);
  assert.throws(() => assertBelongsToWorkspace(null, "ws-1"), /isolation violation/);
});
