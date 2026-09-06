import test, { after } from "node:test";
import assert from "node:assert/strict";
import { publishCreative, listSharedCreatives, recordCreativeUse, unpublishCreative } from "../lib/campaign/shared-creatives";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const AUTHOR = uid("swipe-ws");
const OTHER = uid("swipe-ws2");
const H_A = uid("Headline A");
const H_B = uid("Headline B");

after(async () => {
  await pgPool().query("DELETE FROM shared_creatives WHERE author_workspace_id = ANY($1)", [[AUTHOR, OTHER]]);
});

test("publishing keeps the ad copy and clamps the score", async () => {
  const c = await publishCreative(AUTHOR, { headline: H_A, primaryText: "Body copy", cta: "Book now", angle: "Urgency", score: 250 });
  assert.equal(c.headline, H_A);
  assert.equal(c.primaryText, "Body copy");
  assert.equal(c.cta, "Book now");
  assert.equal(c.angle, "Urgency");
  assert.equal(c.score, 100, "score is clamped to 0..100");
  assert.equal(c.uses, 0);
  assert.equal(c.authorWorkspaceId, AUTHOR);
});

test("a blank headline is rejected", async () => {
  await assert.rejects(() => publishCreative(AUTHOR, { headline: "   " }), /headline/i);
});

test("the swipe file lists most-copied first, then newest", async () => {
  const b = await publishCreative(OTHER, { headline: H_B, primaryText: "B body" });
  await recordCreativeUse(b.id);
  await recordCreativeUse(b.id);

  const list = await listSharedCreatives();
  const mine = list.filter((c) => c.authorWorkspaceId === AUTHOR || c.authorWorkspaceId === OTHER);
  const idxB = mine.findIndex((c) => c.id === b.id);
  const idxA = mine.findIndex((c) => c.headline === H_A);
  assert.ok(idxB >= 0 && idxA >= 0, "both listed");
  assert.ok(idxB < idxA, "the more-copied creative sorts ahead");
  assert.equal(mine.find((c) => c.id === b.id)!.uses, 2);
});

test("recordCreativeUse bumps the counter", async () => {
  const c = await publishCreative(AUTHOR, { headline: uid("Counter") });
  await recordCreativeUse(c.id);
  await recordCreativeUse(c.id);
  const found = (await listSharedCreatives()).find((x) => x.id === c.id)!;
  assert.equal(found.uses, 2);
});

test("unpublish is scoped to the author", async () => {
  const c = await publishCreative(AUTHOR, { headline: uid("Scoped") });
  assert.equal(await unpublishCreative(OTHER, c.id), false, "a stranger can't remove it");
  assert.equal(await unpublishCreative(AUTHOR, c.id), true, "the author removes it");
  assert.equal((await listSharedCreatives()).some((x) => x.id === c.id), false, "gone");
});
