import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../lib/workspaces";
import { getOffer, saveOffer, patchOffer } from "../lib/offer";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

/**
 * lib/offer.ts's patchOffer() — a true partial merge, added so the Brand
 * Brain route (Workstream B of the Section 1 write-path merge) can
 * redirect just `audience`/`guarantee`/`priceAnchor` into this store
 * without wiping the rest of the offer (saveOffer()/sanitizeOffer()
 * always rebuild a full OfferData from whatever's present, so a caller
 * touching one field must go through patchOffer, never saveOffer
 * directly with a partial object).
 */

const PREFIX = uid("offer-test");

after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

test("patchOffer: touching one field never wipes an untouched sibling", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-sibling`);
  await saveOffer(ws.id, { name: "The Funnel Fix Sprint", audience: "coaches under $10k/mo", guarantee: "double your leads or free" });

  const patched = await patchOffer(ws.id, { audience: "agency owners under $20k/mo" });
  assert.equal(patched.audience, "agency owners under $20k/mo");
  assert.equal(patched.name, "The Funnel Fix Sprint", "an untouched sibling field must survive the patch");
  assert.equal(patched.guarantee, "double your leads or free", "another untouched sibling field must survive the patch");

  const reread = await getOffer(ws.id);
  assert.equal(reread.audience, "agency owners under $20k/mo");
  assert.equal(reread.name, "The Funnel Fix Sprint");
});

test("patchOffer: an explicit empty string clears a field", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-clear`);
  await saveOffer(ws.id, { name: "The Funnel Fix Sprint", audience: "coaches under $10k/mo" });
  const patched = await patchOffer(ws.id, { audience: "" });
  assert.equal(patched.audience, "");
  assert.equal(patched.name, "The Funnel Fix Sprint");
});

test("patchOffer: creates the row on first save (no prior saveOffer call)", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-first`);
  const patched = await patchOffer(ws.id, { audience: "coaches under $10k/mo" });
  assert.equal(patched.audience, "coaches under $10k/mo");
  const reread = await getOffer(ws.id);
  assert.equal(reread.audience, "coaches under $10k/mo");
});

test("patchOffer: touching multiple fields at once patches all of them together", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-multi`);
  await saveOffer(ws.id, { name: "The Funnel Fix Sprint" });
  const patched = await patchOffer(ws.id, { guarantee: "double your leads or free", priceAnchor: "normally £2,000" });
  assert.equal(patched.guarantee, "double your leads or free");
  assert.equal(patched.priceAnchor, "normally £2,000");
  assert.equal(patched.name, "The Funnel Fix Sprint");
});

test("patchOffer: two truly concurrent patches to different fields both survive (advisory-lock regression)", async () => {
  // Without a lock serializing patchOffer's read-merge-write, two
  // concurrent patches would both read the SAME pre-write `current`, and
  // whichever write lands last would silently discard the other's
  // change — the exact race found in app/api/campaign-studio/brand/route.ts,
  // which fires patchOffer alongside patchReality/patchMessage on every
  // Brand Brain save, racing against a user's own direct edit on
  // /psychology/offer at the same moment.
  const ws = await createWorkspace("u1", `${PREFIX}-concurrent`);
  await saveOffer(ws.id, { name: "The Funnel Fix Sprint", audience: "coaches under $10k/mo", guarantee: "double your leads or free" });

  await Promise.all([
    patchOffer(ws.id, { audience: "agency owners under $20k/mo" }),
    patchOffer(ws.id, { guarantee: "triple your leads or free" }),
  ]);

  const reread = await getOffer(ws.id);
  assert.equal(reread.audience, "agency owners under $20k/mo", "the first concurrent patch's change must survive");
  assert.equal(reread.guarantee, "triple your leads or free", "the second concurrent patch's change must survive");
  assert.equal(reread.name, "The Funnel Fix Sprint", "an untouched sibling must survive both concurrent patches");
});

test("patchOffer: a concurrent direct saveOffer() can't land between a patch's read and write", async () => {
  // The demonstrated real-world shape of the race: a direct full-replace
  // save (the Offer tool's own PUT route) firing at the same moment as a
  // patch (the Brand route's redirect). Real concurrency means either
  // order is possible, so this can't assert one fixed final state — but
  // it CAN assert the one invariant that only holds when the lock is
  // working: patchOffer's merge base is only ever read/written atomically
  // w.r.t. the direct save, so if the patch's own field (guarantee) made
  // it into the final state, that means the patch's read (and therefore
  // its merge base) happened AFTER the save committed — so the save's
  // field (priceAnchor) must be there too. The buggy, unlocked version
  // could produce guarantee-present-but-priceAnchor-absent: the patch
  // reads a STALE pre-save `current`, then its write lands AFTER the
  // save's write and clobbers priceAnchor with that stale merge.
  const ws = await createWorkspace("u1", `${PREFIX}-vs-direct-save`);
  await saveOffer(ws.id, { name: "The Funnel Fix Sprint", audience: "coaches under $10k/mo" });

  await Promise.all([
    patchOffer(ws.id, { guarantee: "double your leads or free" }),
    saveOffer(ws.id, { name: "The Funnel Fix Sprint", audience: "coaches under $10k/mo", priceAnchor: "normally £2,000" }),
  ]);

  const reread = await getOffer(ws.id);
  if (reread.guarantee) {
    assert.equal(reread.priceAnchor, "normally £2,000", "if the patch's field survived, the concurrent direct save's field must too — otherwise the patch clobbered it with a stale (pre-save) merge base");
  }
});
