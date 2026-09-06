import test from "node:test";
import assert from "node:assert/strict";
import { strategyBriefFrom } from "../lib/business-brief";

test("strategyBriefFrom: empty / null blob yields has:false and no text", () => {
  assert.deepEqual(strategyBriefFrom(null), { text: "", has: false });
  assert.deepEqual(strategyBriefFrom(undefined), { text: "", has: false });
  assert.deepEqual(strategyBriefFrom({}), { text: "", has: false });
  // A blob with only empty section objects still counts as nothing to ground on.
  assert.equal(strategyBriefFrom({ realityMap: {}, constraint: {}, driverTree: {} }).has, false);
});

test("strategyBriefFrom: surfaces the core reality-map fields", () => {
  const { text, has } = strategyBriefFrom({
    realityMap: { businessReallyIn: "predictable revenue for coaches", want12m: "$40k MRR", targetRevenue: "$40,000/mo", gaps: { acquisition: "no repeatable lead source" } },
  });
  assert.equal(has, true);
  assert.match(text, /Really in the business of: predictable revenue for coaches/);
  assert.match(text, /12-month goal: \$40k MRR/);
  assert.match(text, /Biggest gaps: acquisition — no repeatable lead source/);
});

test("strategyBriefFrom: includes the current constraint with its reason", () => {
  const { text } = strategyBriefFrom({
    constraint: { chosen: "Lead capture", why: "under 1% opt in", relieve: "add a quiz funnel", stopDoing: "cold DMs" },
  });
  assert.match(text, /Current #1 growth constraint: Lead capture \(because under 1% opt in\)/);
  assert.match(text, /The move to relieve it: add a quiz funnel/);
  assert.match(text, /Deprioritised for now: cold DMs/);
});

test("strategyBriefFrom: summarises the driver tree and caps levers at four", () => {
  const drivers = Array.from({ length: 6 }, (_, i) => ({ label: `Lever ${i}`, current: String(i), target: String(i * 10) }));
  const { text } = strategyBriefFrom({ driverTree: { outcomeLabel: "Monthly revenue", outcomeTarget: "$40,000", drivers } });
  assert.match(text, /Outcome the plan drives: Monthly revenue → \$40,000/);
  assert.match(text, /Key growth levers: /);
  assert.match(text, /Lever 0 \(0→0\)/);
  // Only the first four levers are listed.
  assert.ok(!text.includes("Lever 4"));
  assert.ok(!text.includes("Lever 5"));
});

test("strategyBriefFrom: a driver with no target is skipped", () => {
  const { text } = strategyBriefFrom({ driverTree: { outcomeLabel: "Rev", outcomeTarget: "1", drivers: [{ label: "No target", current: "5", target: "" }, { label: "Has target", current: "5", target: "9" }] } });
  assert.ok(!text.includes("No target"));
  assert.match(text, /Has target \(5→9\)/);
});

test("strategyBriefFrom: long free-text fields are clipped with an ellipsis", () => {
  const long = "x".repeat(500);
  const { text } = strategyBriefFrom({ realityMap: { businessReallyIn: long } });
  const line = text.split("\n").find((l) => l.startsWith("Really in the business of:"))!;
  assert.ok(line.length < 300, "expected the field to be clipped well under its raw length");
  assert.ok(line.endsWith("…"));
});
