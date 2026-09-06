import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../lib/workspaces";
import { getReality, saveReality, patchReality } from "../lib/reality";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

/**
 * lib/reality.ts — the Business OS Reality Map store, extracted this
 * session from its former home inlined in app/api/business/reality/route.ts.
 * The regression test below proves the actual bug that extraction fixed:
 * the old route's PATCH rebuilt the whole map from whatever keys were in
 * ITS OWN request body, silently wiping any field a caller omitted.
 */

const PREFIX = uid("reality-test");

after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

test("getReality: an unsaved workspace returns an empty map, not an error", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-empty`);
  assert.deepEqual(await getReality(ws.id), {});
});

test("saveReality: full replace persists every field, sanitised", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-save`);
  const saved = await saveReality(ws.id, {
    businessIn: "  coaching  ", businessReallyIn: "predictable client acquisition",
    now: { revenue: "5000", profit: "2000", garbage: "dropped" },
    want12m: "20k/mo", targetRevenue: "30000",
  });
  assert.equal(saved.businessIn, "coaching"); // trimmed
  assert.equal(saved.businessReallyIn, "predictable client acquisition");
  assert.deepEqual(saved.now, { revenue: "5000", profit: "2000" }); // unknown key dropped
  assert.equal(saved.want12m, "20k/mo");
  assert.equal(saved.targetRevenue, "30000");
  assert.equal(saved.businessNeedToBeIn, undefined); // never set — present as undefined, not a mismatch

  // Re-read after the jsonb round-trip through Postgres: JSON.stringify
  // drops explicit-undefined keys, so compare the fields that matter
  // individually rather than the whole object (see the "creates the row
  // on first save" test below for the full explanation).
  const reread = await getReality(ws.id);
  assert.equal(reread.businessIn, "coaching");
  assert.equal(reread.businessReallyIn, "predictable client acquisition");
  assert.deepEqual(reread.now, { revenue: "5000", profit: "2000" });
  assert.equal(reread.want12m, "20k/mo");
  assert.equal(reread.targetRevenue, "30000");
});

test("patchReality: touching one top-level field never wipes a sibling — THE BUG FIX", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-patch-sibling`);
  await saveReality(ws.id, { businessIn: "coaching", businessReallyIn: "predictable client acquisition", want12m: "20k/mo" });

  // The old (buggy) behavior: PATCHing just businessReallyIn would have
  // rebuilt the whole map from a request body that only had that one key,
  // silently dropping businessIn and want12m. patchReality must not do this.
  const patched = await patchReality(ws.id, { businessReallyIn: "a different answer" });
  assert.equal(patched.businessReallyIn, "a different answer");
  assert.equal(patched.businessIn, "coaching", "an untouched sibling field must survive the patch");
  assert.equal(patched.want12m, "20k/mo", "another untouched sibling field must survive the patch");
});

test("patchReality: a narrow now.* patch never wipes other now sub-fields or the rest of the map", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-patch-now`);
  await saveReality(ws.id, {
    businessIn: "coaching",
    now: { revenue: "5000", profit: "2000", customers: "8" },
  });

  // This mirrors app/business/review/page.tsx's pushToReality(), which now
  // PATCHes only { now: { revenue, profit } } directly (no GET-first
  // workaround needed anymore).
  const patched = await patchReality(ws.id, { now: { revenue: "6000", profit: "2500" } });
  assert.deepEqual(patched.now, { revenue: "6000", profit: "2500", customers: "8" }, "customers must survive a patch that never mentions it");
  assert.equal(patched.businessIn, "coaching", "a field outside `now` entirely must survive too");
});

test("patchReality: an explicit empty string clears a top-level field", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-patch-clear`);
  await saveReality(ws.id, { businessIn: "coaching", businessReallyIn: "predictable client acquisition" });
  const patched = await patchReality(ws.id, { businessReallyIn: "" });
  assert.equal(patched.businessReallyIn, undefined);
  assert.equal(patched.businessIn, "coaching");
});

test("patchReality: creates the row on first save (no prior saveReality call)", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-patch-first`);
  const patched = await patchReality(ws.id, { businessIn: "coaching" });
  assert.equal(patched.businessIn, "coaching");
  assert.deepEqual(patched.now, {});
  // The in-memory return value carries every optional field explicitly (some
  // as `undefined`); a value read back after the jsonb round-trip through
  // Postgres omits undefined keys entirely (JSON.stringify drops them) — so
  // compare the fields that matter individually, not the whole object.
  const reread = await getReality(ws.id);
  assert.equal(reread.businessIn, "coaching");
  assert.deepEqual(reread.now, {});
});

test("patchReality: two truly concurrent patches to different fields both survive (advisory-lock regression)", async () => {
  // Without a lock serializing patchReality's read-merge-write, two
  // concurrent patches would both read the SAME pre-write `current`, and
  // whichever write lands last would silently discard the other's
  // change — the exact race found in app/api/campaign-studio/brand/route.ts,
  // which fires patchReality alongside patchOffer/patchMessage on every
  // Brand Brain save, racing against a user's own direct edit on
  // /business/reality at the same moment.
  const ws = await createWorkspace("u1", `${PREFIX}-concurrent`);
  await saveReality(ws.id, { businessIn: "coaching", want12m: "20k/mo" });

  await Promise.all([
    patchReality(ws.id, { businessReallyIn: "predictable client acquisition" }),
    patchReality(ws.id, { want36m: "100k/mo" }),
  ]);

  const reread = await getReality(ws.id);
  assert.equal(reread.businessReallyIn, "predictable client acquisition", "the first concurrent patch's change must survive");
  assert.equal(reread.want36m, "100k/mo", "the second concurrent patch's change must survive");
  assert.equal(reread.businessIn, "coaching", "an untouched sibling must survive both concurrent patches");
  assert.equal(reread.want12m, "20k/mo", "another untouched sibling must survive both concurrent patches");
});
