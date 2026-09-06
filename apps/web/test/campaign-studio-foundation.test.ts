import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace, adminSetPlan } from "../lib/workspaces";
import { hasEntitlement, listEntitlements, grantEntitlement, revokeEntitlement } from "../lib/entitlements";
import { getBrandProfile, upsertBrandProfile } from "../lib/brand";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

const PREFIX = uid("campaign-studio-test");

after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

test("hasEntitlement: false with neither a qualifying plan nor an addon grant", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-a`);
  assert.equal(await hasEntitlement(ws.id, "campaign_studio"), false);
  assert.deepEqual(await listEntitlements(ws.id), []);
});

test("grantEntitlement / revokeEntitlement: addon grant is independent of plan", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-b`);
  await grantEntitlement(ws.id, "campaign_studio", "si_test_123");
  assert.equal(await hasEntitlement(ws.id, "campaign_studio"), true);
  const list = await listEntitlements(ws.id);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.source, "addon");
  assert.equal(list[0]!.status, "active");

  await revokeEntitlement(ws.id, "campaign_studio");
  assert.equal(await hasEntitlement(ws.id, "campaign_studio"), false);
  const afterRevoke = await listEntitlements(ws.id);
  assert.equal(afterRevoke.length, 0, "a canceled addon entitlement shouldn't appear in the active list");
});

test("grantEntitlement: re-granting an already-active entitlement is a harmless no-op", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-c`);
  await grantEntitlement(ws.id, "campaign_studio");
  await grantEntitlement(ws.id, "campaign_studio", "si_test_456");
  const list = await listEntitlements(ws.id);
  assert.equal(list.length, 1, "granting twice must not create a duplicate row");
});

test("hasEntitlement: plan-included (performance) works with no addon row at all", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-d`);
  await adminSetPlan(ws.id, "performance");
  assert.equal(await hasEntitlement(ws.id, "campaign_studio"), true);
  const list = await listEntitlements(ws.id);
  assert.equal(list.length, 1);
  assert.equal(list[0]!.source, "plan");
});

test("listEntitlements: a plan-included entitlement isn't duplicated by a redundant addon row", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-e`);
  await adminSetPlan(ws.id, "performance");
  await grantEntitlement(ws.id, "campaign_studio"); // redundant — plan already covers it
  const list = await listEntitlements(ws.id);
  assert.equal(list.length, 1, "plan coverage should win, not stack with the addon row");
  assert.equal(list[0]!.source, "plan");
});

test("getBrandProfile: null for a workspace with no profile yet", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-f`);
  assert.equal(await getBrandProfile(ws.id), null);
});

test("upsertBrandProfile: creates on first call, returns what was set", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-g`);
  const profile = await upsertBrandProfile(ws.id, { companyName: "Acme Co", industry: "SaaS", prohibitedWords: ["guaranteed", "cure"] });
  assert.equal(profile.companyName, "Acme Co");
  assert.equal(profile.industry, "SaaS");
  assert.deepEqual(profile.prohibitedWords, ["guaranteed", "cure"]);
  assert.deepEqual(profile.products, []);
  const fetched = await getBrandProfile(ws.id);
  assert.equal(fetched?.companyName, "Acme Co");
});

test("upsertBrandProfile: a partial patch preserves fields not included in it", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-h`);
  await upsertBrandProfile(ws.id, { companyName: "Acme Co", websiteUrl: "https://acme.example" });
  const updated = await upsertBrandProfile(ws.id, { industry: "E-commerce" });
  assert.equal(updated.companyName, "Acme Co", "companyName from the first save must survive a patch that doesn't mention it");
  assert.equal(updated.websiteUrl, "https://acme.example");
  assert.equal(updated.industry, "E-commerce");
});

test("upsertBrandProfile: array fields (products/testimonials) replace wholesale, not merge item-by-item", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-i`);
  await upsertBrandProfile(ws.id, { products: [{ name: "Starter" }, { name: "Pro" }] });
  const updated = await upsertBrandProfile(ws.id, { products: [{ name: "Enterprise" }] });
  assert.deepEqual(updated.products, [{ name: "Enterprise" }]);
});
