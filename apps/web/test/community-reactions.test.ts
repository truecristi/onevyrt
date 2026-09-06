import test, { after } from "node:test";
import assert from "node:assert/strict";
import { toggleReaction, reactionStates } from "../lib/community/reactions";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS_A = uid("react-ws");
const WS_B = uid("react-ws2");
const ART1 = uid("art");
const ART2 = uid("art");

after(async () => {
  await pgPool().query("DELETE FROM community_reactions WHERE workspace_id = ANY($1)", [[WS_A, WS_B]]);
});

test("toggle adds then removes the caller's endorsement", async () => {
  const on = await toggleReaction(WS_A, "template", ART1);
  assert.deepEqual(on, { count: 1, mine: true });
  const off = await toggleReaction(WS_A, "template", ART1);
  assert.deepEqual(off, { count: 0, mine: false });
});

test("count is a headcount — one per workspace, distinct workspaces add up", async () => {
  await toggleReaction(WS_A, "template", ART1);
  await toggleReaction(WS_A, "template", ART1); // A reacts again → no-op-ish (toggles off then this leaves it on? no)
  // Re-assert a clean state: ensure A is on.
  const stateA = await reactionStates(WS_A, "template", [ART1]);
  // After two toggles A is back off; toggle once more to be on.
  if (!stateA[ART1]?.mine) await toggleReaction(WS_A, "template", ART1);
  const b = await toggleReaction(WS_B, "template", ART1);
  assert.equal(b.count, 2, "two distinct workspaces endorsing → count 2");
});

test("batched state reports count and whether the caller reacted, per artifact", async () => {
  await toggleReaction(WS_A, "creative", ART2); // only A on ART2
  const forA = await reactionStates(WS_A, "template", [ART1, ART2]);
  assert.equal(forA[ART1]?.count, 2);
  assert.equal(forA[ART1]?.mine, true, "A reacted to ART1");
  assert.equal(forA[ART2] ?? undefined, undefined, "ART2 is a creative, not a template");

  const cForB = await reactionStates(WS_B, "creative", [ART2]);
  assert.equal(cForB[ART2]?.count, 1);
  assert.equal(cForB[ART2]?.mine, false, "B did not react to ART2");

  assert.deepEqual(await reactionStates(WS_A, "template", []), {}, "empty batch → empty map");
});
