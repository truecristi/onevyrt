import test from "node:test";
import assert from "node:assert/strict";
import { SWIPES, SWIPE_CATEGORIES, swipesByCategory, fillSwipe } from "../lib/studio/swipe-library";
import type { MessageInput } from "../lib/studio/message-copy";

const FULL: MessageInput = {
  oneLiner: { problem: "Founders waste ad spend", solution: "OneVYRT maps the funnel first", result: "they fix leaks before spending" },
  character: "First-time founders",
  wants: "Predictable customers",
  internalProblem: "Anxious every pound is a guess",
  plan: "Map → simulate → fix → launch",
  success: "A funnel that prints profit",
  failure: "Burning the budget on a leaky funnel",
};

test("every category has at least one swipe, and every swipe has a known category", () => {
  for (const c of SWIPE_CATEGORIES) assert.ok(swipesByCategory(c).length >= 1, `${c} should have swipes`);
  for (const s of SWIPES) assert.ok(SWIPE_CATEGORIES.includes(s.category), `${s.id} has a valid category`);
});

test("swipe ids are unique", () => {
  const ids = SWIPES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every {token} in every template is a known Message token", () => {
  // Must mirror the TOKENS map in swipe-library.ts. An unknown token would
  // render literally (e.g. "{whoops}") in the UI, so guard against typos.
  const KNOWN = new Set(["problem", "solution", "result", "customer", "wants", "feeling", "plan", "success", "failure", "oneLiner"]);
  for (const s of SWIPES) {
    for (const m of s.template.matchAll(/\{(\w+)\}/g)) {
      assert.ok(KNOWN.has(m[1]!), `${s.id} uses unknown token {${m[1]}}`);
    }
  }
});

test("a full Message fills every token in every swipe (no [hints] left)", () => {
  for (const s of SWIPES) {
    const { text, filled, total } = fillSwipe(s.template, FULL);
    assert.equal(filled, total, `${s.id} left ${total - filled} token(s) unfilled`);
    assert.doesNotMatch(text, /\{\w+\}/, `${s.id} left a raw token`);
  }
});

test("fillSwipe substitutes Message words and lowercases mid-sentence", () => {
  const { text, filled, total } = fillSwipe("Stop {failure}. Start {wants}. {solution} shows you how.", FULL);
  assert.match(text, /Stop burning the budget on a leaky funnel\./);
  assert.match(text, /Start predictable customers\./);
  assert.match(text, /OneVYRT maps the funnel first shows you how\./); // ALL-CAPS acronym preserved
  assert.equal(total, 3);
  assert.equal(filled, 3);
});

test("fillSwipe leaves a bracketed hint for tokens the Message hasn't filled", () => {
  const { text, filled, total } = fillSwipe("How to {wants} — even if {feeling}.", { wants: "more clients" });
  assert.match(text, /How to more clients — even if \[how the problem feels\]\./);
  assert.equal(total, 2);
  assert.equal(filled, 1);
});

test("fillSwipe leaves unknown tokens untouched and counts only real ones", () => {
  const { text, total } = fillSwipe("Get {solution} for [your price] and {notatoken}.", FULL);
  assert.match(text, /\{notatoken\}/); // unknown token preserved verbatim
  assert.match(text, /\[your price\]/); // literal bracket placeholder untouched
  assert.equal(total, 1); // only {solution} is a real token
});

test("fillSwipe on an empty Message yields all-hint text with filled=0", () => {
  const { text, filled } = fillSwipe("{result} — without {failure}.", {});
  assert.equal(filled, 0);
  assert.match(text, /\[the result they get\] — without \[the failure they avoid\]\./);
});

test("the one-liner swipe composes the saved one-liner (bare token → no trailing period)", () => {
  const { text } = fillSwipe("{oneLiner}", FULL);
  // clean() strips the trailing period so tokens re-punctuate from the template;
  // a bare {oneLiner} swipe therefore has no final period (fine for a headline).
  assert.equal(text, "Founders waste ad spend. OneVYRT maps the funnel first, so they fix leaks before spending");
});
