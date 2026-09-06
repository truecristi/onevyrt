import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeOffer, scoreOffer, parseOfferDraft, parseOfferPrice, buildOfferDraftPrompt, OFFER_DRAFT_SYSTEM, buildObjectionsPrompt, parseObjections, OBJECTIONS_SYSTEM, EMPTY_OFFER, composePositioning, scorePositioning, buildPositioningPrompt, parsePositioning, POSITIONING_SYSTEM, type OfferData } from "../lib/studio/offer-coach";
import type { MessageInput } from "../lib/studio/message-copy";

const STRONG: OfferData = {
  name: "The Funnel Fix Sprint",
  promise: "A funnel that turns cold traffic into booked calls in 14 days",
  deliverables: ["Funnel audit", "Rebuilt qualification funnel", "Two weeks of optimisation"],
  price: "$2,000",
  priceAnchor: "Agencies charge $8k+ for the same build",
  guarantee: "Booked calls in 30 days or your money back",
  objections: [{ q: "I've tried funnels before", a: "This one is scored and simulated before spend" }, { q: "Too expensive", a: "One client covers it" }],
  audience: "Coaches doing $5–20k/mo who want more booked calls",
  alternative: "hiring an agency on retainer",
  edge: "we score and simulate the funnel before you spend a dollar on ads",
};

test("sanitizeOffer clips fields and caps/cleans arrays", () => {
  const dirty = { name: "x".repeat(500), deliverables: ["a", "", "  ", ...Array(20).fill("d")], objections: [{ q: "q", a: "a" }, { q: "", a: "" }, ...Array(20).fill({ q: "x", a: "y" })] };
  const o = sanitizeOffer(dirty);
  assert.equal(o.name.length, 120);
  assert.ok(o.deliverables.length <= 12);
  assert.ok(o.deliverables.every((d) => d.trim().length > 0));
  assert.ok(o.objections.length <= 10);
  assert.ok(o.objections.every((x) => x.q.trim() || x.a.trim()));
});

test("a complete offer scores high with no fixes", () => {
  const { score, findings } = scoreOffer(STRONG);
  assert.ok(score >= 90, `expected high, got ${score}`);
  assert.equal(findings.filter((f) => f.severity === "fix").length, 0);
});

test("an empty offer flags the essentials as fixes and scores low", () => {
  const { score, findings } = scoreOffer(EMPTY_OFFER);
  assert.ok(score < 50, `expected low, got ${score}`);
  const fixIds = findings.filter((f) => f.severity === "fix").map((f) => f.id);
  assert.ok(fixIds.includes("name"));
  assert.ok(fixIds.includes("promise"));
  assert.ok(fixIds.includes("deliv"));
});

test("a completely untouched offer is 0/not-started, not the leftover-penalty score", () => {
  // Before this fix, an empty offer's lighter ('warn') penalties on price,
  // anchor, guarantee and objections left 23 points of unearned credit — an
  // untouched form reading as if it were 23% of the way to a real offer.
  const { score, started } = scoreOffer(EMPTY_OFFER);
  assert.equal(started, false);
  assert.equal(score, 0);
});

test("filling in even one offer field marks it started and restores real scoring", () => {
  const barely: OfferData = { ...EMPTY_OFFER, name: "My Offer" };
  const { score, started } = scoreOffer(barely);
  assert.equal(started, true);
  assert.ok(score > 0, "a touched offer scores on its actual completeness, not forced to 0");
});

test("findings are ordered worst-first", () => {
  const partial: OfferData = { ...EMPTY_OFFER, name: "Named", promise: "A clear specific promise of the outcome" };
  const sev = scoreOffer(partial).findings.map((f) => f.severity);
  const firstGood = sev.indexOf("good");
  const lastNonGood = Math.max(sev.lastIndexOf("fix"), sev.lastIndexOf("warn"));
  if (firstGood !== -1 && lastNonGood !== -1) assert.ok(lastNonGood < firstGood || sev.slice(firstGood).every((s) => s === "good"));
});

test("thin deliverables / promise produce warnings, not fixes", () => {
  const thin: OfferData = { ...STRONG, promise: "Get results", deliverables: ["Just one thing"] };
  const ids = scoreOffer(thin).findings;
  assert.ok(ids.some((f) => f.id === "promise-thin" && f.severity === "warn"));
  assert.ok(ids.some((f) => f.id === "deliv-thin" && f.severity === "warn"));
});

test("buildOfferDraftPrompt grounds in the message, falls back cleanly", () => {
  const p = buildOfferDraftPrompt({ oneLiner: { problem: "p", solution: "OneVYRT maps it", result: "r" }, wants: "Predictable customers" } as MessageInput);
  assert.match(p, /One-liner: p\. OneVYRT maps it, so r\./);
  assert.match(p, /They want: Predictable customers/);
  assert.match(p, /Draft the offer now\./);
  assert.match(buildOfferDraftPrompt(null), /general small-business service offer/i);
});

test("the offer builders fold in the business strategy when given", () => {
  const strat = "Current #1 growth constraint: Lead capture";
  assert.match(buildOfferDraftPrompt(null, strat), /BUSINESS STRATEGY[\s\S]*Lead capture/);
  assert.match(buildObjectionsPrompt(STRONG, null, strat), /BUSINESS STRATEGY[\s\S]*Lead capture/);
  assert.match(buildPositioningPrompt(STRONG, null, strat), /BUSINESS STRATEGY[\s\S]*Lead capture/);
  // Blank strategy adds nothing.
  assert.doesNotMatch(buildOfferDraftPrompt(null, "  "), /BUSINESS STRATEGY/);
});

test("parseOfferPrice pulls a number from a free-form price string", () => {
  assert.equal(parseOfferPrice("$2,000"), 2000);
  assert.equal(parseOfferPrice("£79/mo"), 79);
  assert.equal(parseOfferPrice("1495"), 1495);
  assert.equal(parseOfferPrice("$1,299.99"), 1299.99);
  assert.equal(parseOfferPrice("contact us"), 0);
  assert.equal(parseOfferPrice(""), 0);
  assert.equal(parseOfferPrice(undefined), 0);
});

test("buildObjectionsPrompt grounds in the offer + message; system pins JSON", () => {
  assert.match(OBJECTIONS_SYSTEM, /ONLY minified JSON/);
  assert.match(OBJECTIONS_SYSTEM, /"objections"/);
  const p = buildObjectionsPrompt(STRONG, { character: "First-time founders" });
  assert.match(p, /Offer: The Funnel Fix Sprint/);
  assert.match(p, /Guarantee: Booked calls in 30 days/);
  assert.match(p, /Customer: First-time founders/);
  assert.match(p, /List the objections and answers now\./);
});

test("OFFER_DRAFT_SYSTEM names its frameworks and keeps the JSON contract unchanged", () => {
  assert.match(OFFER_DRAFT_SYSTEM, /Brunson/);
  assert.match(OFFER_DRAFT_SYSTEM, /StoryBrand/);
  assert.match(OFFER_DRAFT_SYSTEM, /Deiss/);
  assert.match(OFFER_DRAFT_SYSTEM, /Robbins/);
  assert.match(OFFER_DRAFT_SYSTEM, /certainty/i);
  assert.match(OFFER_DRAFT_SYSTEM, /ONLY minified JSON/);
  assert.match(OFFER_DRAFT_SYSTEM, /\{"name":"","promise":"","deliverables":\["",""\],"price":"","priceAnchor":"","guarantee":"","objections":\[\{"q":"","a":""\}\]\}/);
});

test("OBJECTIONS_SYSTEM names its frameworks and keeps the JSON contract unchanged", () => {
  assert.match(OBJECTIONS_SYSTEM, /Robbins/);
  assert.match(OBJECTIONS_SYSTEM, /Brunson/);
  assert.match(OBJECTIONS_SYSTEM, /Deiss/);
  assert.match(OBJECTIONS_SYSTEM, /certainty/i);
  assert.match(OBJECTIONS_SYSTEM, /ONLY minified JSON/);
  assert.match(OBJECTIONS_SYSTEM, /\{"objections":\[\{"q":"the objection, in the customer's voice","a":"your answer"\}\]\}/);
});

test("POSITIONING_SYSTEM names its frameworks and keeps the JSON contract unchanged", () => {
  assert.match(POSITIONING_SYSTEM, /StoryBrand/);
  assert.match(POSITIONING_SYSTEM, /Brunson/);
  assert.match(POSITIONING_SYSTEM, /Robbins/);
  assert.match(POSITIONING_SYSTEM, /certainty/i);
  assert.match(POSITIONING_SYSTEM, /ONLY minified JSON/);
  assert.match(POSITIONING_SYSTEM, /\{"audience":"","alternative":"","edge":""\}/);
});

test("parseObjections parses, dedupes, caps, drops empties, tolerates fences/array", () => {
  const reply = "```json\n" + JSON.stringify({ objections: [
    { q: "Too expensive", a: "One client covers it" },
    { q: "too expensive", a: "dup lowercased" }, // dup by question → dropped
    { q: "", a: "" }, // empty → dropped
    { q: "I've tried before", a: "This one is scored first" },
  ] }) + "\n```";
  const out = parseObjections(reply);
  assert.equal(out.length, 2);
  assert.equal(out[0]!.q, "Too expensive");
  assert.equal(out[1]!.q, "I've tried before");

  // bare array form also works
  assert.equal(parseObjections(JSON.stringify([{ q: "x", a: "y" }])).length, 1);
  // garbage → []
  assert.deepEqual(parseObjections("sorry"), []);
});

test("sanitizeOffer keeps and clips the positioning fields", () => {
  const o = sanitizeOffer({ audience: "a".repeat(300), alternative: "b".repeat(300), edge: "c".repeat(500) });
  assert.equal(o.audience.length, 160);
  assert.equal(o.alternative.length, 200);
  assert.equal(o.edge.length, 300);
  // absent → empty strings, never undefined
  const empty = sanitizeOffer({});
  assert.equal(empty.audience, "");
  assert.equal(empty.alternative, "");
  assert.equal(empty.edge, "");
});

test("scorePositioning: full is high with no fixes, empty flags audience+edge", () => {
  const strong = scorePositioning(STRONG);
  assert.ok(strong.score >= 90, `strong ${strong.score}`);
  assert.equal(strong.findings.filter((f) => f.severity === "fix").length, 0);

  const empty = scorePositioning(EMPTY_OFFER);
  assert.ok(empty.score < 70, `empty ${empty.score}`);
  const fixIds = empty.findings.filter((f) => f.severity === "fix").map((f) => f.id);
  assert.ok(fixIds.includes("audience"));
  assert.ok(fixIds.includes("edge"));
});

test("a completely untouched positioning section is 0/not-started", () => {
  // Before this fix an empty positioning read as 62 (100 minus only the
  // audience+edge 'fix' penalties, with alternative's lighter 'warn' left as
  // unearned credit) — as if it were most of the way to done.
  const { score, started } = scorePositioning(EMPTY_OFFER);
  assert.equal(started, false);
  assert.equal(score, 0);
});

test("positioning starts independently of the offer half of the form", () => {
  // Filling in the offer (name/promise/etc.) must not make positioning look
  // started — they're scored, and shown, separately.
  const offerOnly: OfferData = { ...EMPTY_OFFER, name: "My Offer", promise: "A clear result" };
  assert.equal(scorePositioning(offerOnly).started, false);

  const positioningOnly: OfferData = { ...EMPTY_OFFER, audience: "Independent coaches" };
  const p = scorePositioning(positioningOnly);
  assert.equal(p.started, true);
  assert.ok(p.score > 0);
});

test("composePositioning builds a sentence, empty until there's enough", () => {
  assert.equal(composePositioning(EMPTY_OFFER), "");
  const s = composePositioning(STRONG);
  assert.match(s, /^For Coaches/);
  assert.match(s, /Unlike hiring an agency on retainer/);
  // audience alone (no promise/edge) → still empty
  assert.equal(composePositioning({ ...EMPTY_OFFER, audience: "Coaches" }), "");
});

test("buildPositioningPrompt grounds in offer + message; system pins JSON", () => {
  assert.match(POSITIONING_SYSTEM, /ONLY minified JSON/);
  assert.match(POSITIONING_SYSTEM, /"audience"/);
  const p = buildPositioningPrompt(STRONG, { character: "First-time founders", wants: "steady leads" });
  assert.match(p, /Offer: The Funnel Fix Sprint/);
  assert.match(p, /Customer: First-time founders/);
  assert.match(p, /Write the positioning now\./);
});

test("parsePositioning parses fences/prose, trims, and rejects empty", () => {
  const reply = "```json\n" + JSON.stringify({ audience: "  Coaches  ", alternative: "DIY", edge: "scored first" }) + "\n```";
  const out = parsePositioning(reply);
  assert.ok(out);
  assert.equal(out!.audience, "Coaches");
  assert.equal(out!.edge, "scored first");
  assert.equal(parsePositioning("nothing here"), null);
  assert.equal(parsePositioning(JSON.stringify({ audience: "", alternative: "", edge: "" })), null);
});

test("parseOfferDraft parses + sanitises a reply and rejects unusable ones", () => {
  const reply = "```json\n" + JSON.stringify({ name: "The Sprint", promise: "Outcome in 14 days", deliverables: ["A", "B", "C"], price: "$2k", priceAnchor: "worth $8k", guarantee: "or refund", objections: [{ q: "cost?", a: "worth it" }] }) + "\n```";
  const o = parseOfferDraft(reply);
  assert.ok(o);
  assert.equal(o!.name, "The Sprint");
  assert.equal(o!.deliverables.length, 3);
  assert.equal(parseOfferDraft("no json here"), null);
  assert.equal(parseOfferDraft(JSON.stringify({ deliverables: ["x"] })), null); // no name/promise → unusable
});
