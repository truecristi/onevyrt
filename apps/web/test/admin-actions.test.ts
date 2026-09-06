import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as ws from "../lib/workspaces";
import * as store from "../lib/store";
import * as auth from "../lib/auth";
import { uid, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix } from "./helpers/pg";

const PREFIX = uid("admin-actions-test");
const email = (n: string) => `${PREFIX}+${n}@example.com`;

after(async () => {
  await purgeWorkspacesByNamePrefix(PREFIX);
  await purgeUsersByEmailPrefix(PREFIX);
});

test("adminDeleteWorkspace: removes the workspace record and its project files", async () => {
  const owner = await auth.registerUser(email("owner1"), "correct-horse-1");
  const workspace = await ws.createWorkspace(owner.id, `${PREFIX} Team WS 1`);
  await store.saveProject(workspace.id, "proj1", "Proj One", "{}");
  assert.equal((await store.listProjects(workspace.id)).length, 1);

  await ws.adminDeleteWorkspace(workspace.id);

  assert.equal(await ws.getWorkspace(workspace.id), null);
  assert.equal((await store.listProjects(workspace.id)).length, 0);
});

test("adminReassignOwner: transfers ownership, demotes previous owner to editor", async () => {
  const owner = await auth.registerUser(email("owner2"), "correct-horse-1");
  const member = await auth.registerUser(email("member2"), "correct-horse-2");
  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Shared WS 2`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, member.id, "editor");

  const updated = await ws.adminReassignOwner(workspace.id, member.id);
  assert.equal(updated.ownerId, member.id);
  assert.equal(updated.members.find((m) => m.userId === member.id)?.role, "owner");
  assert.equal(updated.members.find((m) => m.userId === owner.id)?.role, "editor");
});

test("adminRemoveMember: refuses to remove the current owner", async () => {
  const owner = await auth.registerUser(email("owner3"), "correct-horse-1");
  const workspace = await ws.createWorkspace(owner.id, `${PREFIX} Solo WS 3`);
  await assert.rejects(() => ws.adminRemoveMember(workspace.id, owner.id), /reassign ownership/i);
});

test("adminRemoveMember: removes a non-owner member", async () => {
  const owner = await auth.registerUser(email("owner4"), "correct-horse-1");
  const member = await auth.registerUser(email("member4"), "correct-horse-2");
  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Team WS 4`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, member.id, "viewer");
  assert.equal(workspace.members.length, 2);

  const updated = await ws.adminRemoveMember(workspace.id, member.id);
  assert.equal(updated.members.length, 1);
});

test("adminSetPlan: records the plan on the workspace", async () => {
  const owner = await auth.registerUser(email("owner5"), "correct-horse-1");
  const workspace = await ws.createWorkspace(owner.id, `${PREFIX} Plan WS 5`);
  const updated = await ws.adminSetPlan(workspace.id, "business");
  assert.equal(updated.plan, "business");
});

test("setWorkspaceStripeCustomer: records the customer id, retrievable via getWorkspace", async () => {
  const owner = await auth.registerUser(email("owner6"), "correct-horse-1");
  const workspace = await ws.createWorkspace(owner.id, `${PREFIX} Billing WS 6`);
  await ws.setWorkspaceStripeCustomer(workspace.id, "cus_abc123");
  const fetched = await ws.getWorkspace(workspace.id);
  assert.equal(fetched?.stripeCustomerId, "cus_abc123");
});

test("purgeUser: blocked when the user owns a workspace with other members", async () => {
  const owner = await auth.registerUser(email("owner7"), "correct-horse-1");
  const member = await auth.registerUser(email("member7"), "correct-horse-2");
  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Shared WS 7`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, member.id, "editor");

  await assert.rejects(() => auth.purgeUser(owner.id), /other members/i);
  // Nothing should have been deleted by the failed attempt.
  assert.notEqual(await auth.getUserById(owner.id), null);
  assert.notEqual(await ws.getWorkspace(workspace.id), null);
});

test("purgeUser: succeeds for a solely-owned workspace, cascading its deletion", async () => {
  const owner = await auth.registerUser(email("owner8"), "correct-horse-1");
  const workspace = await ws.createWorkspace(owner.id, `${PREFIX} Solo WS 8`);
  await store.saveProject(workspace.id, "p1", "P1", "{}");

  const result = await auth.purgeUser(owner.id);
  assert.equal(result.deletedWorkspaces, 1);
  assert.equal(await auth.getUserById(owner.id), null);
  assert.equal(await ws.getWorkspace(workspace.id), null);
  assert.equal((await store.listProjects(workspace.id)).length, 0);
});

test("purgeUser: removes membership from other people's workspaces without deleting them", async () => {
  const owner = await auth.registerUser(email("owner9"), "correct-horse-1");
  const guest = await auth.registerUser(email("guest9"), "correct-horse-2");
  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Owner's WS 9`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, guest.id, "viewer");

  await auth.purgeUser(guest.id);
  assert.equal(await auth.getUserById(guest.id), null);
  const stillThere = await ws.getWorkspace(workspace.id);
  assert.notEqual(stillThere, null);
  assert.equal(stillThere?.members.some((m) => m.userId === guest.id), false);
  assert.equal(stillThere?.ownerId, owner.id);
});
