import test from "node:test";
import assert from "node:assert/strict";
import { creativePrompt, parseCreatives, creativeLink, slugifyCreative } from "../lib/campaign/creative";

test("creativePrompt asks for the count and structured JSON", () => {
  const { system, user } = creativePrompt("Sell agency retainers to founders", 4);
  assert.match(system, /4 variants/);
  assert.match(system, /ONLY compact JSON/);
  assert.match(user, /Sell agency retainers/);
});

test("creativePrompt clamps count to a sane range", () => {
  assert.match(creativePrompt("x", 99).system, /10 variants/);
  assert.match(creativePrompt("x", 0).system, /1 variants/);
});

test("creativePrompt seeds winning angles when provided (the learning loop)", () => {
  const withWinners = creativePrompt("brief", 4, ["Cost of inaction", "Social proof"]).system;
  assert.match(withWinners, /converted best/);
  assert.match(withWinners, /Cost of inaction, Social proof/);
  // No winners → no bias clause.
  assert.doesNotMatch(creativePrompt("brief", 4).system, /converted best/);
  assert.doesNotMatch(creativePrompt("brief", 4, []).system, /converted best/);
});

test("creativePrompt grounds in the brand brief when provided", () => {
  const withBrand = creativePrompt("brief", 4, [], "Brand: Acme\nVoice: warm, plain");
  assert.match(withBrand.system, /BRAND's voice/);
  assert.match(withBrand.user, /BRAND:\nBrand: Acme/);
  // No brand → no brand block or instruction.
  assert.doesNotMatch(creativePrompt("brief", 4).system, /BRAND's voice/);
  assert.doesNotMatch(creativePrompt("brief", 4).user, /BRAND:/);
  assert.doesNotMatch(creativePrompt("brief", 4, [], "   ").user, /BRAND:/); // blank brand ignored
});

test("parseCreatives extracts, sanitises and ranks by score", () => {
  const reply = 'Here you go:\n```json\n{"variants":[' +
    '{"angle":"Aspiration","headline":"Scale without the chaos","primaryText":"Grow calmly.","cta":"Book a call","score":72,"why":"clear promise"},' +
    '{"angle":"Cost of inaction","headline":"Every week you wait costs leads","primaryText":"Stop the leak.","cta":"See how","score":88,"why":"loss aversion"},' +
    '{"angle":"noheadline","primaryText":"skip me","score":50}' +
    ']}\n```';
  const v = parseCreatives(reply);
  assert.equal(v.length, 2, "the entry without a headline is dropped");
  assert.equal(v[0]!.score, 88, "highest score is first");
  assert.equal(v[0]!.angle, "Cost of inaction");
  assert.equal(v[1]!.headline, "Scale without the chaos");
  assert.match(v[0]!.creativeId, /^cost-of-inaction/);
});

test("parseCreatives gives unique creative ids when angles collide", () => {
  const reply = JSON.stringify({ variants: [
    { angle: "Urgency", headline: "A", score: 10 },
    { angle: "Urgency", headline: "B", score: 20 },
  ] });
  const v = parseCreatives(reply);
  const ids = v.map((x) => x.creativeId);
  assert.equal(new Set(ids).size, 2, "ids are unique");
  assert.ok(ids.includes("urgency") && ids.includes("urgency-2"));
});

test("parseCreatives returns [] on unparseable replies", () => {
  assert.deepEqual(parseCreatives("sorry, I can't do that"), []);
  assert.deepEqual(parseCreatives(""), []);
});

test("creativeLink points at the funnel with attribution that closes the loop", () => {
  const v = { angle: "Social proof", headline: "h", primaryText: "p", cta: "c", score: 50, why: "w", creativeId: "social-proof" };
  const url = creativeLink("demo", v, "meta");
  assert.match(url, /^\/q\/demo\?/);
  const qs = new URLSearchParams(url.split("?")[1]);
  assert.equal(qs.get("creative_id"), "social-proof");
  assert.equal(qs.get("utm_source"), "meta");
  assert.equal(qs.get("utm_campaign"), "social-proof");
  assert.equal(qs.get("utm_medium"), "paid");
});

test("slugifyCreative is URL-safe", () => {
  assert.equal(slugifyCreative("Cost of Inaction!"), "cost-of-inaction");
  assert.equal(slugifyCreative("***"), "creative");
});
