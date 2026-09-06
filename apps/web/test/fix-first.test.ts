import test from "node:test";
import assert from "node:assert/strict";
import { rankFixes, scoreSignal, type FixSignal } from "../lib/studio/fix-first";

test("scoreSignal: a big money leak outscores a soft benchmark nudge", () => {
  const leak: FixSignal = { kind: "leak", title: "Leak", detail: "", impact: -400000, weight: 50 };
  const bench: FixSignal = { kind: "benchmark", title: "Below", detail: "", weight: 40 };
  assert.ok(scoreSignal(leak) > scoreSignal(bench));
});

test("rankFixes: orders highest-urgency first and stamps a 1-based rank", () => {
  const ranked = rankFixes([
    { kind: "benchmark", title: "Opt-in low", detail: "", weight: 40 },
    { kind: "leak", title: "Checkout leak", detail: "", impact: -250000, weight: 60 },
    { kind: "decision", title: "Overdue", detail: "", weight: 70 },
  ]);
  assert.equal(ranked[0]!.kind, "leak");
  assert.equal(ranked[0]!.rank, 1);
  assert.equal(ranked[ranked.length - 1]!.kind, "benchmark");
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3]);
});

test("rankFixes: empty in, empty out", () => {
  assert.deepEqual(rankFixes([]), []);
});

test("scoreSignal: an overdue action item (7 Systems/Goals/Experiments) ranks alongside risk, above a benchmark nudge", () => {
  const actionItem: FixSignal = { kind: "actionItem", title: "Overdue force action", detail: "", weight: 70 };
  const risk: FixSignal = { kind: "risk", title: "High risk", detail: "", weight: 75 };
  const bench: FixSignal = { kind: "benchmark", title: "Below", detail: "", weight: 40 };
  assert.ok(scoreSignal(actionItem) > scoreSignal(bench), "an overdue action item must outrank a soft benchmark nudge");
  // Same KIND_WEIGHT (70) as risk — close scores expected, not required to be identical.
  assert.ok(Math.abs(scoreSignal(actionItem) - scoreSignal(risk)) < 10);
});
