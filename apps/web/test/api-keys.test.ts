import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from "../lib/api-keys";
import { createWorkspace } from "../lib/workspaces";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

const PREFIX = uid("apikey-test");

after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

test("createApiKey: the raw key verifies, and only the hash is ever listed back", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-a`);
  const created = await createApiKey(ws.id, "u1", "My integration");
  assert.match(created.key, /^ovk_/);
  const scope = await verifyApiKey(created.key);
  assert.deepEqual(scope, { workspaceId: ws.id, userId: "u1", keyId: created.id });
  const list = await listApiKeys(ws.id);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.name, "My integration");
  assert.equal(list[0]!.prefix, created.prefix);
  assert.equal((list[0] as unknown as { key?: string }).key, undefined);
});

test("verifyApiKey: rejects an unknown key", async () => {
  assert.equal(await verifyApiKey("ovk_not_a_real_key"), null);
  assert.equal(await verifyApiKey("garbage"), null);
});

test("revokeApiKey: a revoked key no longer verifies", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-b`);
  const created = await createApiKey(ws.id, "u1", "Zapier");
  await revokeApiKey(ws.id, created.id);
  assert.equal(await verifyApiKey(created.key), null);
  const list = await listApiKeys(ws.id);
  assert.equal(list[0]!.revoked, true);
});

test("revokeApiKey: scoped to the owning workspace — another workspace's id can't revoke it", async () => {
  const ws1 = await createWorkspace("u1", `${PREFIX}-c1`);
  const ws2 = await createWorkspace("u1", `${PREFIX}-c2`);
  const created = await createApiKey(ws1.id, "u1", "Dashboard");
  await revokeApiKey(ws2.id, created.id);
  const scope = await verifyApiKey(created.key);
  assert.equal(scope?.workspaceId, ws1.id);
});
