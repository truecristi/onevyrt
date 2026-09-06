import test, { after } from "node:test";
import assert from "node:assert/strict";
import {
  saveProject, listProjects, loadProject, deleteProject,
  listDeletedProjects, restoreProject, purgeProject, purgeExpiredProjects,
} from "../lib/store";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

// uid() yields [a-z0-9-_] only, so safeId() is the identity here and cleanup can
// match on the raw scope key.
const WS = uid("bin-ws");

after(async () => {
  await pgPool().query("DELETE FROM projects WHERE scope_key = $1", [WS]);
});

test("delete soft-deletes into the bin; library + load see only live funnels", async () => {
  await saveProject(WS, "f1", "Funnel One", "{}");
  await saveProject(WS, "f2", "Funnel Two", "{}");
  assert.equal((await listProjects(WS)).length, 2);

  assert.equal(await deleteProject(WS, "f1"), true);
  assert.equal((await listProjects(WS)).length, 1, "binned funnel leaves the library");
  assert.equal(await loadProject(WS, "f1"), null, "binned funnel is not loadable as live");

  const bin = await listDeletedProjects(WS);
  assert.equal(bin.length, 1);
  assert.equal(bin[0]!.id, "f1");
  assert.equal(bin[0]!.name, "Funnel One");

  assert.equal(await deleteProject(WS, "f1"), false, "double-delete is a no-op");
});

test("restore brings a binned funnel back to the library", async () => {
  assert.equal(await restoreProject(WS, "f1"), true);
  assert.equal((await listProjects(WS)).length, 2);
  assert.equal((await listDeletedProjects(WS)).length, 0);
  assert.ok(await loadProject(WS, "f1"));
  assert.equal(await restoreProject(WS, "f1"), false, "restoring a live funnel is a no-op");
});

test("purgeProject only ever removes a binned funnel, never a live one", async () => {
  assert.equal(await purgeProject(WS, "f1"), false, "f1 is live — must not be destroyed");
  await deleteProject(WS, "f2");
  assert.equal(await purgeProject(WS, "f2"), true, "f2 is binned — permanently removed");
  assert.equal((await listDeletedProjects(WS)).length, 0);
});

test("saving over a binned id resurrects it as live", async () => {
  await saveProject(WS, "reuse", "First", "{}");
  await deleteProject(WS, "reuse");
  assert.equal((await listProjects(WS)).some((p) => p.id === "reuse"), false);
  await saveProject(WS, "reuse", "Second", "{}");
  assert.equal((await listProjects(WS)).some((p) => p.id === "reuse"), true, "re-saved id is live again");
  assert.equal((await listDeletedProjects(WS)).some((p) => p.id === "reuse"), false);
});

test("purgeExpiredProjects removes only funnels past the 30-day window", async () => {
  await saveProject(WS, "old", "Old", "{}");
  await saveProject(WS, "recent", "Recent", "{}");
  await deleteProject(WS, "old");
  await deleteProject(WS, "recent");
  await pgPool().query("UPDATE projects SET deleted_at = now() - interval '40 days' WHERE scope_key = $1 AND id = $2", [WS, "old"]);

  const purged = await purgeExpiredProjects();
  assert.ok(purged >= 1);

  const ids = (await pgPool().query("SELECT id FROM projects WHERE scope_key = $1", [WS])).rows.map((r) => r.id as string);
  assert.equal(ids.includes("old"), false, "expired bin entry is gone");
  assert.equal(ids.includes("recent"), true, "recent bin entry is still recoverable");
  // The still-binned 'recent' is beyond the library but inside the window.
  assert.equal((await listDeletedProjects(WS)).some((p) => p.id === "recent"), true);
});
