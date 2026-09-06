import test from "node:test";
import assert from "node:assert/strict";
import { outcomeOf, closeDecision, summarizeDecisions, approveDecision, revokeApproval, type Decision } from "../src/loop.ts";

test("outcomeOf: hit when observed meets/exceeds expected in the right direction", () => {
  assert.equal(outcomeOf(10, 15, 16), "hit");   // wanted +5, got +6
  assert.equal(outcomeOf(10, 15, 15), "hit");   // exactly on target
});
test("outcomeOf: partial when it moves the right way but falls short", () => {
  assert.equal(outcomeOf(10, 15, 13), "partial");
});
test("outcomeOf: missed when it doesn't move or moves the wrong way", () => {
  assert.equal(outcomeOf(10, 15, 10), "missed");
  assert.equal(outcomeOf(10, 15, 8), "missed");
});
test("outcomeOf: downward targets work too", () => {
  assert.equal(outcomeOf(100, 80, 75), "hit");     // wanted -20, got -25
  assert.equal(outcomeOf(100, 80, 90), "partial"); // wanted -20, got -10
  assert.equal(outcomeOf(100, 80, 110), "missed"); // went up
});
test("outcomeOf: inconclusive when there is no target", () => {
  assert.equal(outcomeOf(10, 10, 12), "inconclusive");
});

const base: Decision = {
  id: "d1", createdAt: "t0", problem: "p", hypothesis: "h", move: "m", reason: "r",
  expectedImpact: "+5", confidence: "high", owner: "o", dueDate: "2026-02-01", status: "open",
};

test("closeDecision: sets status, attaches measurement, computes outcome, no mutation", () => {
  const closed = closeDecision(base, { baseline: 10, expected: 15, observed: 16, learning: "worked", measuredAt: "t1" });
  assert.equal(closed.status, "measured");
  assert.equal(closed.measurement?.outcome, "hit");
  assert.equal(base.status, "open"); // original untouched
  assert.equal(base.measurement, undefined);
});

test("summarizeDecisions: counts open/measured and outcomes", () => {
  const measured = closeDecision(base, { baseline: 10, expected: 15, observed: 13, learning: "", measuredAt: "t1" });
  const s = summarizeDecisions([base, measured]);
  assert.equal(s.total, 2);
  assert.equal(s.open, 1);
  assert.equal(s.measured, 1);
  assert.equal(s.partial, 1);
});

test("approveDecision: attaches a sign-off without mutating the original", () => {
  const approved = approveDecision(base, "alice", "2026-01-05T00:00:00.000Z");
  assert.equal(approved.approvedBy, "alice");
  assert.equal(approved.approvedAt, "2026-01-05T00:00:00.000Z");
  assert.equal(base.approvedBy, undefined); // original untouched
});

test("approveDecision: defaults approvedAt to now when omitted", () => {
  const before = Date.now();
  const approved = approveDecision(base, "bob");
  const at = new Date(approved.approvedAt!).getTime();
  assert.ok(at >= before && at <= Date.now());
});

test("revokeApproval: removes the sign-off without mutating the input", () => {
  const approved = approveDecision(base, "alice");
  const revoked = revokeApproval(approved);
  assert.equal(revoked.approvedBy, undefined);
  assert.equal(revoked.approvedAt, undefined);
  assert.equal(approved.approvedBy, "alice"); // input untouched
});
