import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as ws from "../lib/workspaces";
import * as auth from "../lib/auth";
import { uid, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix } from "./helpers/pg";

type M = { userId: string; role: string };

const PREFIX = uid("roles-test");
const email = (n: string) => `${PREFIX}+${n}@example.com`;

after(async () => {
  await purgeWorkspacesByNamePrefix(PREFIX);
  await purgeUsersByEmailPrefix(PREFIX);
});

test("renameWorkspace: a manager can rename, an editor cannot", async () => {
  const owner = await auth.registerUser(email("owner1"), "correct-horse-1");
  const manager = await auth.registerUser(email("manager1"), "correct-horse-2");
  const editor = await auth.registerUser(email("editor1"), "correct-horse-3");

  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Team WS 1`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, manager.id, "manager");
  workspace = await ws.addMember(workspace.id, owner.id, editor.id, "editor");

  const renamed = await ws.renameWorkspace(workspace.id, manager.id, "Renamed by manager");
  assert.equal(renamed.name, "Renamed by manager");

  await assert.rejects(() => ws.renameWorkspace(workspace.id, editor.id, "Nope"), /owner or a manager/i);
});

test("addMember: a manager can add editors/viewers", async () => {
  const owner = await auth.registerUser(email("owner2"), "correct-horse-1");
  const manager = await auth.registerUser(email("manager2"), "correct-horse-2");
  const newbie = await auth.registerUser(email("newbie2"), "correct-horse-3");

  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Team WS 2`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, manager.id, "manager");

  workspace = await ws.addMember(workspace.id, manager.id, newbie.id, "editor");
  assert.equal(workspace.members.find((m: M) => m.userId === newbie.id)?.role, "editor");
});

test("removeMember: a manager can remove a member, but not the owner", async () => {
  const owner = await auth.registerUser(email("owner3"), "correct-horse-1");
  const manager = await auth.registerUser(email("manager3"), "correct-horse-2");
  const editor = await auth.registerUser(email("editor3"), "correct-horse-3");

  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Team WS 3`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, manager.id, "manager");
  workspace = await ws.addMember(workspace.id, owner.id, editor.id, "editor");

  workspace = await ws.removeMember(workspace.id, manager.id, editor.id);
  assert.equal(workspace.members.some((m: M) => m.userId === editor.id), false);

  await assert.rejects(() => ws.removeMember(workspace.id, manager.id, owner.id), /owner can't be removed/i);
});

test("removeMember: an editor cannot remove anyone", async () => {
  const owner = await auth.registerUser(email("owner4"), "correct-horse-1");
  const editor = await auth.registerUser(email("editor4"), "correct-horse-2");
  const other = await auth.registerUser(email("other4"), "correct-horse-3");

  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Team WS 4`);
  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, editor.id, "editor");
  workspace = await ws.addMember(workspace.id, owner.id, other.id, "viewer");

  await assert.rejects(() => ws.removeMember(workspace.id, editor.id, other.id), /owner or a manager/i);
});

test("addMember: pro and free are single-profile — blocked until upgraded to business", async () => {
  const owner = await auth.registerUser(email("owner5"), "correct-horse-1");
  const teammate = await auth.registerUser(email("teammate5"), "correct-horse-2");

  let workspace = await ws.createWorkspace(owner.id, `${PREFIX} Solo WS 5`); // defaults to "free"
  await assert.rejects(() => ws.addMember(workspace.id, owner.id, teammate.id, "editor"), /single-profile/i);

  workspace = await ws.adminSetPlan(workspace.id, "pro");
  await assert.rejects(() => ws.addMember(workspace.id, owner.id, teammate.id, "editor"), /single-profile/i);

  workspace = await ws.adminSetPlan(workspace.id, "business");
  workspace = await ws.addMember(workspace.id, owner.id, teammate.id, "editor");
  assert.equal(workspace.members.find((m: M) => m.userId === teammate.id)?.role, "editor");
});
