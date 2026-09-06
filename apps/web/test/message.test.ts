import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../lib/workspaces";
import { getMessage, saveMessage, patchMessage, sanitizeMessage } from "../lib/message";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

/**
 * lib/message.ts's patchMessage() — a true partial merge, added so the
 * Brand Brain route (Workstream B of the Section 1 write-path merge) can
 * redirect just `internalProblem`/`success`/`failure`/`plan` (and
 * oneLiner's own `problem`/`result`) into this store without wiping the
 * rest of the message (saveMessage()/sanitizeMessage() always rebuild a
 * full MessageData from whatever's present, so a caller touching one
 * field must go through patchMessage, never saveMessage directly with a
 * partial object).
 */

const PREFIX = uid("message-test");

after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

test("patchMessage: touching one top-level field never wipes an untouched sibling", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-sibling`);
  await saveMessage(ws.id, sanitizeMessage({
    oneLiner: { problem: "Leads go cold fast", solution: "We ship a 24-hour follow-up system", result: "you close more" },
    success: "A calendar full of booked calls", plan: "Map -> follow up -> close", failure: "Losing leads to slow response",
  }));

  const patched = await patchMessage(ws.id, { internalProblem: "Anxious that every lead slips away" });
  assert.equal(patched.internalProblem, "Anxious that every lead slips away");
  assert.equal(patched.success, "A calendar full of booked calls", "an untouched sibling field must survive the patch");
  assert.equal(patched.plan, "Map -> follow up -> close", "another untouched sibling field must survive the patch");
  assert.equal(patched.oneLiner.problem, "Leads go cold fast", "oneLiner must survive a patch that never mentions it");

  const reread = await getMessage(ws.id);
  assert.equal(reread.internalProblem, "Anxious that every lead slips away");
  assert.equal(reread.oneLiner.problem, "Leads go cold fast");
});

test("patchMessage: a narrow oneLiner.* patch never wipes other oneLiner sub-fields or the rest of the message", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-oneliner`);
  await saveMessage(ws.id, sanitizeMessage({
    oneLiner: { problem: "Leads go cold fast", solution: "We ship a 24-hour follow-up system", result: "you close more" },
    success: "A calendar full of booked calls",
  }));

  // This mirrors the Brand route's redirect: patching just problem/result
  // (Brand's problem/success fields), never touching `solution` at all.
  const patched = await patchMessage(ws.id, { oneLiner: { problem: "Leads go cold within an hour", result: "you close what you already pay for" } });
  assert.deepEqual(patched.oneLiner, {
    problem: "Leads go cold within an hour",
    solution: "We ship a 24-hour follow-up system",
    result: "you close what you already pay for",
  });
  assert.equal(patched.success, "A calendar full of booked calls", "a field outside oneLiner entirely must survive too");
});

test("patchMessage: an explicit empty string clears a top-level field", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-clear`);
  await saveMessage(ws.id, sanitizeMessage({ success: "A calendar full of booked calls", failure: "Losing leads to slow response" }));
  const patched = await patchMessage(ws.id, { success: "" });
  assert.equal(patched.success, "");
  assert.equal(patched.failure, "Losing leads to slow response");
});

test("patchMessage: creates the row on first save (no prior saveMessage call)", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-first`);
  const patched = await patchMessage(ws.id, { internalProblem: "Anxious that every lead slips away" });
  assert.equal(patched.internalProblem, "Anxious that every lead slips away");
  const reread = await getMessage(ws.id);
  assert.equal(reread.internalProblem, "Anxious that every lead slips away");
});

test("patchMessage: two truly concurrent patches to different fields both survive (advisory-lock regression)", async () => {
  // Without a lock serializing patchMessage's read-merge-write, two
  // concurrent patches would both read the SAME pre-write `current`, and
  // whichever write lands last would silently discard the other's
  // change — the exact race found in app/api/campaign-studio/brand/route.ts,
  // which fires patchMessage alongside patchOffer/patchReality on every
  // Brand Brain save, racing against a user's own direct edit on
  // /business/message at the same moment.
  const ws = await createWorkspace("u1", `${PREFIX}-concurrent`);
  await saveMessage(ws.id, sanitizeMessage({ success: "A calendar full of booked calls", failure: "Losing leads to slow response" }));

  await Promise.all([
    patchMessage(ws.id, { internalProblem: "Anxious that every lead slips away" }),
    patchMessage(ws.id, { plan: "Map -> follow up -> close" }),
  ]);

  const reread = await getMessage(ws.id);
  assert.equal(reread.internalProblem, "Anxious that every lead slips away", "the first concurrent patch's change must survive");
  assert.equal(reread.plan, "Map -> follow up -> close", "the second concurrent patch's change must survive");
  assert.equal(reread.success, "A calendar full of booked calls", "an untouched sibling must survive both concurrent patches");
});
