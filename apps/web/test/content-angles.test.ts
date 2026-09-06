import test from "node:test";
import assert from "node:assert/strict";
import { CONTENT_SYSTEM, buildContentPrompt, parseContentAngles } from "../lib/studio/content-angles";
import type { OfferData } from "../lib/studio/offer-coach";

const OFFER: OfferData = { name: "The Funnel Fix Sprint", promise: "booked calls in 14 days", audience: "coaches", edge: "scored before you spend", deliverables: [], price: "", priceAnchor: "", guarantee: "", objections: [], alternative: "" };

test("system pins JSON + the angle discipline", () => {
  assert.match(CONTENT_SYSTEM, /ONLY minified JSON/);
  assert.match(CONTENT_SYSTEM, /"ideas"/);
  assert.match(CONTENT_SYSTEM, /contrarian|mistake|before\/after/i);
});

test("buildContentPrompt grounds in offer + message, falls back cleanly", () => {
  const p = buildContentPrompt(OFFER, { character: "coaches", internalProblem: "every pound is a guess", failure: "another dead month" });
  assert.match(p, /Offer: The Funnel Fix Sprint/);
  assert.match(p, /Who it's for: coaches/);
  assert.match(p, /afraid of: another dead month/);
  assert.match(p, /Generate 6 distinct post ideas now\./);
  assert.match(buildContentPrompt(null, null), /general small-business service/i);
});

test("parseContentAngles keeps hook-bearing ideas, dedupes, caps, tolerates fences/array/garbage", () => {
  const reply = "```json\n" + JSON.stringify({ ideas: [
    { hook: "Most funnels fail before the first click.", idea: "Explain the scoring step." },
    { hook: "most funnels fail before the first click.", idea: "dup by hook" }, // dropped
    { idea: "no hook" }, // dropped
    { hook: "Stop boosting posts.", idea: "" },
  ] }) + "\n```";
  const out = parseContentAngles(reply);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.hook, "Most funnels fail before the first click.");
  assert.equal(out[1]!.idea, ""); // idea optional
  // bare array works
  assert.equal(parseContentAngles(JSON.stringify([{ hook: "x", idea: "y" }])).length, 1);
  // garbage → []
  assert.deepEqual(parseContentAngles("nope"), []);
});
