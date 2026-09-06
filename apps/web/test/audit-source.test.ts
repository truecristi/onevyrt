import test from "node:test";
import assert from "node:assert/strict";
import { blockAuditText, hasAuditableCopy, isAuditablePage, funnelAuditTargets } from "../lib/studio/audit-source";

test("isAuditablePage: only traffic/step/offer are pages", () => {
  assert.equal(isAuditablePage("step"), true);
  assert.equal(isAuditablePage("offer"), true);
  assert.equal(isAuditablePage("traffic"), true);
  assert.equal(isAuditablePage("split"), false);
});

test("blockAuditText: folds name, note and offer context", () => {
  const t = blockAuditText({ id: "1", kind: "offer", label: "Core Offer", note: "Buy the thing now", price: 9700, conversionRate: 0.1 });
  assert.match(t, /Page: Core Offer/);
  assert.match(t, /Buy the thing now/);
  assert.match(t, /offer price \$97/);
  assert.match(t, /current conversion 10%/);
});

test("blockAuditText: bare block with no copy is empty", () => {
  assert.equal(blockAuditText({ id: "1", kind: "step" }), "");
});

test("hasAuditableCopy: needs real text", () => {
  assert.equal(hasAuditableCopy({ id: "1", kind: "step", label: "Landing Page", note: "Headline here and a subhead" }), true);
  assert.equal(hasAuditableCopy({ id: "1", kind: "step" }), false);
  assert.equal(hasAuditableCopy({ id: "1", kind: "step", label: "X" }), false);
});

test("funnelAuditTargets: keeps page blocks with copy, in order, drops others", () => {
  const targets = funnelAuditTargets([
    { id: "a", kind: "traffic", label: "Cold Traffic", note: "Meta ads to founders" },
    { id: "b", kind: "split", label: "Decision", note: "irrelevant to a page audit" },
    { id: "c", kind: "offer", label: "Core Offer", note: "The pitch and the price" },
    { id: "d", kind: "step", label: "Bare" }, // no copy → dropped
  ]);
  assert.deepEqual(targets.map((t) => t.id), ["a", "c"]);
  assert.equal(targets[0]!.kind, "traffic");
});
