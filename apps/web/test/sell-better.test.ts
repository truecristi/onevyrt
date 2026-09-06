import test from "node:test";
import assert from "node:assert/strict";
import { buildSellBetterPrompt, parseSellBetter, overallScore, SELL_BETTER_SYSTEM } from "../lib/studio/sell-better";
import type { MessageInput } from "../lib/studio/message-copy";

const MSG: MessageInput = {
  oneLiner: { problem: "Founders waste ad spend", solution: "OneVYRT maps the funnel", result: "they fix leaks first" },
  character: "First-time founders",
  wants: "Predictable customers",
  failure: "Burning the budget",
};

test("system prompt pins the JSON contract", () => {
  assert.match(SELL_BETTER_SYSTEM, /ONLY minified JSON/);
  assert.match(SELL_BETTER_SYSTEM, /"scores"/);
  assert.match(SELL_BETTER_SYSTEM, /"rewrite"/);
  assert.match(SELL_BETTER_SYSTEM, /\{"scores":\{"hook":0,"clarity":0,"emotion":0,"cta":0\},"rewrite":"","tips":\["",""\]\}/);
});

test("system prompt maps each of the four scores to a named framework", () => {
  assert.match(SELL_BETTER_SYSTEM, /hook \(Russell Brunson/);
  assert.match(SELL_BETTER_SYSTEM, /clarity \(Don Miller's StoryBrand/);
  assert.match(SELL_BETTER_SYSTEM, /emotion \(Tony Robbins' certainty/);
  assert.match(SELL_BETTER_SYSTEM, /cta \(Ryan Deiss's Customer Value Journey/);
});

test("buildSellBetterPrompt includes the asset, its kind, and Message grounding", () => {
  const p = buildSellBetterPrompt("Welcome to our funnel builder.", "headline", MSG);
  assert.match(p, /This is a headline/);
  assert.match(p, /Welcome to our funnel builder\./);
  assert.match(p, /Business one-liner: Founders waste ad spend\. OneVYRT maps the funnel, so they fix leaks first\./);
  assert.match(p, /Failure they avoid: Burning the budget/);
});

test("buildSellBetterPrompt works with no Message (no grounding block)", () => {
  const p = buildSellBetterPrompt("Buy now", "ad", null);
  assert.doesNotMatch(p, /Business message for grounding/);
  assert.match(p, /This is an ad/);
});

test("buildSellBetterPrompt folds in a strategy brief when given one", () => {
  const p = buildSellBetterPrompt("Buy the sprint", "landing", null, "Overall strategy: lead with a $47 teardown, profit on the retainer.");
  assert.match(p, /Business message for grounding/); // strategy alone opens the grounding block
  assert.match(p, /\$47 teardown/);
  assert.match(p, /profit on the retainer/);
});

test("overallScore averages the four dimensions to 0–100", () => {
  assert.equal(overallScore({ hook: 10, clarity: 10, emotion: 10, cta: 10 }), 100);
  assert.equal(overallScore({ hook: 5, clarity: 5, emotion: 5, cta: 5 }), 50);
  assert.equal(overallScore({ hook: 8, clarity: 6, emotion: 7, cta: 5 }), 65);
});

test("parseSellBetter parses a clean reply, clamps scores, computes overall", () => {
  const reply = JSON.stringify({ scores: { hook: 12, clarity: 7, emotion: -3, cta: 6 }, rewrite: "Know your funnel prints profit — before you spend.", tips: ["Lead with the outcome", "Cut the jargon"] });
  const r = parseSellBetter(reply);
  assert.ok(r);
  assert.deepEqual(r!.scores, { hook: 10, clarity: 7, emotion: 0, cta: 6 }); // clamped to 0–10
  assert.equal(r!.overall, overallScore(r!.scores));
  assert.equal(r!.rewrite, "Know your funnel prints profit — before you spend.");
  assert.equal(r!.tips.length, 2);
});

test("parseSellBetter tolerates code fences and surrounding prose", () => {
  const reply = "Sure! ```json\n{\"scores\":{\"hook\":8,\"clarity\":8,\"emotion\":7,\"cta\":9},\"rewrite\":\"Stop guessing. Start selling.\",\"tips\":[\"Nice\"]}\n``` hope that helps";
  const r = parseSellBetter(reply);
  assert.ok(r);
  assert.equal(r!.rewrite, "Stop guessing. Start selling.");
  assert.equal(r!.scores.cta, 9);
});

test("parseSellBetter returns null without a usable rewrite", () => {
  assert.equal(parseSellBetter("sorry, can't help"), null);
  assert.equal(parseSellBetter(JSON.stringify({ scores: { hook: 5 }, rewrite: "   " })), null);
  assert.equal(parseSellBetter("{not json"), null);
});

test("parseSellBetter defaults missing scores/tips gracefully", () => {
  const r = parseSellBetter(JSON.stringify({ rewrite: "Better copy here." }));
  assert.ok(r);
  assert.deepEqual(r!.scores, { hook: 0, clarity: 0, emotion: 0, cta: 0 });
  assert.deepEqual(r!.tips, []);
});
