import test from "node:test";
import assert from "node:assert/strict";
import { messageCompleteness, persuasionScore } from "../lib/studio/persuasion-score";
import type { MessageInput } from "../lib/studio/message-copy";
import { PRESENTATION_ITEMS } from "../lib/studio/presentation";
import { EMPTY_OFFER, type OfferData } from "../lib/studio/offer-coach";

const FULL_MSG: MessageInput = {
  oneLiner: { problem: "leads leak", solution: "OneVYRT maps the funnel", result: "more booked calls" },
  character: "First-time founders",
  wants: "predictable customers",
  plan: "audit, rebuild, optimise",
  success: "a full calendar",
  internalProblem: "it feels random",
  failure: "another dead month",
};

const STRONG_OFFER: OfferData = {
  name: "The Funnel Fix Sprint",
  promise: "A funnel that turns cold traffic into booked calls in 14 days",
  deliverables: ["Audit", "Rebuild", "Two weeks of optimisation"],
  price: "$2,000",
  priceAnchor: "Agencies charge $8k+",
  guarantee: "Booked calls in 30 days or your money back",
  objections: [{ q: "tried before", a: "scored first" }, { q: "too dear", a: "one client covers it" }],
  audience: "Coaches who want more booked calls",
  alternative: "an agency retainer",
  edge: "scored before you spend",
};

test("messageCompleteness: empty is 0, full is 100, partial is between", () => {
  assert.equal(messageCompleteness(null), 0);
  assert.equal(messageCompleteness({}), 0);
  assert.equal(messageCompleteness(FULL_MSG), 100);
  const partial = messageCompleteness({ oneLiner: { problem: "x", solution: "y", result: "z" } });
  assert.ok(partial > 0 && partial < 100, `expected mid, got ${partial}`);
  assert.equal(partial, 40); // the one-liner is weighted 14+13+13
});

test("messageCompleteness ignores whitespace-only fields", () => {
  assert.equal(messageCompleteness({ character: "   ", wants: "\n" }), 0);
});

test("persuasionScore rolls the three parts with the documented weights", () => {
  const allChecked = PRESENTATION_ITEMS.map((i) => i.id);
  const s = persuasionScore({ message: FULL_MSG, offer: STRONG_OFFER, presentationChecked: allChecked });
  assert.equal(s.parts.message, 100);
  assert.ok(s.parts.offer >= 90, `offer ${s.parts.offer}`);
  assert.equal(s.parts.presentation, 100);
  assert.ok(s.score >= 96, `overall ${s.score}`);
  assert.equal(s.stage, "Dialed in");
});

test("positioning moves the offer part — same offer, no positioning scores lower", () => {
  const withPos = persuasionScore({ offer: STRONG_OFFER }).parts.offer;
  const noPos = persuasionScore({ offer: { ...STRONG_OFFER, audience: "", alternative: "", edge: "" } }).parts.offer;
  assert.ok(withPos > noPos, `expected positioning to raise the offer part (${withPos} vs ${noPos})`);
});

test("an empty pillar scores 0 and reads 'Just starting'", () => {
  const s = persuasionScore({});
  assert.equal(s.score, 0);
  assert.equal(s.parts.message, 0);
  assert.equal(s.parts.offer, 0);
  assert.equal(s.parts.presentation, 0);
  assert.equal(s.stage, "Just starting");
});

test("a real but completely untouched saved offer (EMPTY_OFFER, not null) scores 0 too", () => {
  // Before scoreOffer/scorePositioning tracked 'started', an all-blank saved
  // offer record (what a brand-new account's offer document actually looks
  // like — an object with every field "", not null) rolled up to 35/100 here
  // (23*0.7 + 62*0.3) purely from unearned partial credit, not null's clean 0.
  const s = persuasionScore({ offer: EMPTY_OFFER });
  assert.equal(s.parts.offer, 0);
});

test("weakest points at the biggest weighted shortfall", () => {
  // Message full, presentation full, offer empty → offer is weakest (0.4 weight, 100 gap).
  const s = persuasionScore({ message: FULL_MSG, offer: null, presentationChecked: PRESENTATION_ITEMS.map((i) => i.id) });
  assert.equal(s.weakest, "offer");
  // Everything empty → message wins the tie (message → offer → presentation order).
  assert.equal(persuasionScore({}).weakest, "message");
});

test("stages move through the thresholds", () => {
  // Only the one-liner (message 40, others 0) → overall 16 → Just starting.
  const low = persuasionScore({ message: { oneLiner: { problem: "a", solution: "b", result: "c" } } });
  assert.equal(low.score, 16);
  assert.equal(low.stage, "Just starting");
});
