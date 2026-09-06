import test from "node:test";
import assert from "node:assert/strict";
import { parseGoldenExample, buildGoldenPrompt, GOLDEN_SYSTEM, GOLDEN_SAMPLES, sanitizeGoldenExample, strategyContext, type GoldenExample } from "../lib/studio/golden-example";
import { EMPTY_OFFER } from "../lib/studio/offer-coach";

test("the built-in samples (McDonald's, ClickFunnels) are complete, valid examples", () => {
  assert.ok(GOLDEN_SAMPLES.length >= 2);
  const ids = GOLDEN_SAMPLES.map((s) => s.id);
  assert.ok(ids.includes("mcdonalds"));
  assert.ok(ids.includes("clickfunnels"));
  for (const s of GOLDEN_SAMPLES) {
    assert.ok(s.title && s.subtitle, `${s.id} needs a title + subtitle`);
    // each sample survives the same sanitiser the AI output goes through
    assert.ok(sanitizeGoldenExample(s.example), `${s.id} is not a valid example`);
    assert.ok(s.example.ladder.length >= 3, `${s.id} should show a full ladder`);
    assert.ok(s.example.usp && s.example.insight && s.example.firstStep, `${s.id} is missing headline fields`);
    // and yields a usable strategy brief for the other generators
    assert.ok(strategyContext(s.example).length > 0);
  }
});

test("parseGoldenExample reads a clean worked example", () => {
  const raw = JSON.stringify({
    insight: "The profit isn't the audit — it's the monthly retainer after it.",
    ladder: [
      { stage: "Driving product", name: "$47 Funnel Teardown", price: "$47", role: "Cheap way in that proves value fast" },
      { stage: "Core offer", name: "Funnel Fix Sprint", price: "$1,500", role: "The main build they came for" },
      { stage: "Profit engine", name: "Growth Retainer", price: "$800/mo", role: "Where the real money is made" },
    ],
    usp: "We fix your funnel for the price of lunch — then keep it winning.",
    salesAngle: "Most agencies want $5k up front. Start with a $47 teardown instead.",
    ad: "Your funnel is leaking money. Find out where for $47.",
    firstStep: "Package your teardown as a $47 driving product.",
  });
  const g = parseGoldenExample(raw);
  assert.ok(g);
  assert.equal(g!.ladder.length, 3);
  assert.equal(g!.ladder[0]!.stage, "Driving product");
  assert.equal(g!.ladder[2]!.price, "$800/mo");
  assert.match(g!.usp, /lunch/);
  assert.ok(g!.firstStep.length > 0);
});

test("parseGoldenExample tolerates code fences and surrounding prose", () => {
  const raw = 'Here is your example:\n```json\n{"ladder":[{"stage":"Driving product","name":"Free trial","price":"Free","role":"way in"}],"usp":"x","insight":"y"}\n```\nHope that helps!';
  const g = parseGoldenExample(raw);
  assert.ok(g);
  assert.equal(g!.ladder[0]!.name, "Free trial");
  assert.equal(g!.ladder[0]!.price, "Free");
  assert.equal(g!.ad, ""); // missing fields become empty strings, not undefined
});

test("parseGoldenExample returns null without a usable ladder", () => {
  assert.equal(parseGoldenExample('{"usp":"nice line","ladder":[]}'), null);
  assert.equal(parseGoldenExample("not json at all"), null);
  assert.equal(parseGoldenExample('{"ladder":"oops"}'), null);
  assert.equal(parseGoldenExample('{"ladder":[{"price":"$5"}]}'), null); // rung with no name or stage is dropped
});

test("parseGoldenExample caps the ladder at 4 rungs and clips long fields", () => {
  const rungs = Array.from({ length: 7 }, (_, i) => ({ stage: `S${i}`, name: `N${i}`, price: "$1", role: "r" }));
  const g = parseGoldenExample(JSON.stringify({ ladder: rungs, usp: "u".repeat(500) }));
  assert.ok(g);
  assert.equal(g!.ladder.length, 4);
  assert.equal(g!.usp.length, 300);
});

test("buildGoldenPrompt grounds in the offer + asks for a specific example", () => {
  const offer = { ...EMPTY_OFFER, name: "SEO Sprint", promise: "rank page one in 90 days", audience: "local dentists", price: "$2,000" };
  const p = buildGoldenPrompt(offer, null);
  assert.match(p, /SEO Sprint/);
  assert.match(p, /local dentists/);
  assert.match(p, /\$2,000/);
  assert.match(p, /specific to this business/);
});

test("strategyContext turns a saved example into a compact brief for other generators", () => {
  const g: GoldenExample = {
    insight: "Profit is the retainer, not the audit.",
    ladder: [
      { stage: "Driving product", name: "$47 Teardown", price: "$47", role: "way in" },
      { stage: "Core offer", name: "Fix Sprint", price: "$1,500", role: "main" },
      { stage: "Profit engine", name: "Retainer", price: "$800/mo", role: "back end" },
    ],
    usp: "Fix your funnel for the price of lunch.",
    salesAngle: "", ad: "", firstStep: "",
  };
  const ctx = strategyContext(g);
  assert.match(ctx, /\$47 Teardown/);   // leads with the driving product
  assert.match(ctx, /Retainer/);        // profit on the back end
  assert.match(ctx, /Core USP: Fix your funnel/);
  assert.match(ctx, /Key insight: Profit is the retainer/);
});

test("strategyContext is empty (no-op) when there's no usable example", () => {
  assert.equal(strategyContext(null), "");
  assert.equal(strategyContext(undefined), "");
  assert.equal(strategyContext({ ladder: [] } as unknown as GoldenExample), "");
});

test("buildGoldenPrompt still works with nothing saved", () => {
  const p = buildGoldenPrompt(null, null);
  assert.match(p, /general small-business/);
  // and the system prompt teaches the strategy + demands JSON only
  assert.match(GOLDEN_SYSTEM, /driving product/i);
  assert.match(GOLDEN_SYSTEM, /profit engine/i);
  assert.match(GOLDEN_SYSTEM, /minified JSON/);
});

test("buildGoldenPrompt folds in the business strategy when given", () => {
  const p = buildGoldenPrompt(null, null, "12-month goal: $40k MRR");
  assert.match(p, /BUSINESS STRATEGY[\s\S]*12-month goal: \$40k MRR/);
  assert.doesNotMatch(buildGoldenPrompt(null, null, "  "), /BUSINESS STRATEGY/);
});
