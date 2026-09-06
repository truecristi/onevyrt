import test from "node:test";
import assert from "node:assert/strict";
import { composeOneLiner, outcomesFromMessage, MESSAGE_DRAFT_SYSTEM, buildMessageDraftPrompt } from "../lib/studio/message-copy";

test("composeOneLiner builds one sentence and strips stray periods", () => {
  assert.equal(
    composeOneLiner({ problem: "Founders waste ad spend.", solution: "OneVYRT simulates the funnel", result: "they fix leaks first" }),
    "Founders waste ad spend. OneVYRT simulates the funnel, so they fix leaks first.",
  );
});

test("composeOneLiner returns empty until all three parts are present", () => {
  assert.equal(composeOneLiner({ problem: "x", solution: "y" }), "");
  assert.equal(composeOneLiner(undefined), "");
});

test("outcomesFromMessage seeds all three screens in the owner's words", () => {
  const out = outcomesFromMessage({
    oneLiner: { problem: "p", solution: "OneVYRT maps the funnel", result: "r" },
    wants: "Predictable customers without wasting spend",
    success: "A funnel that prints profit on demand",
    plan: "Map → simulate → fix → launch",
    internalProblem: "Anxious that every pound is a guess",
    failure: "Burning the budget on a leaky funnel",
  });

  // qualified: heading references success, body references what they want.
  assert.match(out.qualified?.heading ?? "", /You're a great fit — let's get you a funnel that prints profit on demand/);
  assert.match(out.qualified?.body ?? "", /fastest path to predictable customers without wasting spend/);
  // nurture: hands them the plan as a playbook.
  assert.match(out.nurture?.body ?? "", /Map → simulate → fix → launch\. Get the playbook/);
  // unqualified: meets them at their internal problem, lowercased mid-sentence.
  assert.match(out.unqualified?.body ?? "", /plenty of people feel anxious that every pound is a guess at the start/);
});

test("outcomesFromMessage omits fields the Message is silent on (keeps defaults)", () => {
  // Only the one-liner solution is present → just the nurture body seeds; the
  // rest stay undefined so the funnel keeps its built-in defaults there.
  const out = outcomesFromMessage({ oneLiner: { solution: "We map and simulate first" } });
  assert.equal(out.qualified, undefined);
  assert.equal(out.unqualified, undefined);
  assert.match(out.nurture?.body ?? "", /We map and simulate first\. Get the playbook/);

  assert.deepEqual(outcomesFromMessage(undefined), {});
  assert.deepEqual(outcomesFromMessage({}), {});
});

test("outcomesFromMessage preserves ALL-CAPS acronyms mid-sentence", () => {
  const out = outcomesFromMessage({ wants: "ROI you can forecast" });
  assert.match(out.qualified?.body ?? "", /fastest path to ROI you can forecast/);
});

test("MESSAGE_DRAFT_SYSTEM names all four frameworks and pins the JSON contract", () => {
  assert.match(MESSAGE_DRAFT_SYSTEM, /StoryBrand/);
  assert.match(MESSAGE_DRAFT_SYSTEM, /Brunson/);
  assert.match(MESSAGE_DRAFT_SYSTEM, /Deiss/);
  assert.match(MESSAGE_DRAFT_SYSTEM, /Robbins/);
  assert.match(MESSAGE_DRAFT_SYSTEM, /hero/i);
  assert.match(MESSAGE_DRAFT_SYSTEM, /ONLY minified JSON/);
  assert.match(MESSAGE_DRAFT_SYSTEM, /"oneLiner":\{"problem":"","solution":"","result":""\}/);
});

test("buildMessageDraftPrompt grounds in the business description, falls back cleanly", () => {
  const p = buildMessageDraftPrompt("We help first-time founders run profitable Facebook ads");
  assert.match(p, /Business: We help first-time founders run profitable Facebook ads/);
  assert.match(p, /Write the full message JSON now\./);
  assert.match(buildMessageDraftPrompt(""), /No details yet — infer a strong message/i);
});

test("buildMessageDraftPrompt carries forward whatever's already filled in, so a redraft builds on it", () => {
  const p = buildMessageDraftPrompt("", {
    character: "First-time founders",
    wants: "predictable customers",
    oneLiner: { problem: "leads leak", solution: "", result: "" },
  });
  assert.match(p, /Customer: First-time founders/);
  assert.match(p, /They want: predictable customers/);
  assert.match(p, /Existing problem draft: leads leak/);
  // Untouched fields are simply omitted, not sent as empty noise.
  assert.doesNotMatch(p, /Existing solution draft/);
});

test("buildMessageDraftPrompt folds in the business strategy when given", () => {
  const p = buildMessageDraftPrompt("A coaching business", undefined, "12-month goal: $40k MRR");
  assert.match(p, /BUSINESS STRATEGY/);
  assert.match(p, /12-month goal: \$40k MRR/);
  assert.doesNotMatch(buildMessageDraftPrompt("A coaching business", undefined, "  "), /BUSINESS STRATEGY/);
});
