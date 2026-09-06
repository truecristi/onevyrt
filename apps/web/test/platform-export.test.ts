import test from "node:test";
import assert from "node:assert/strict";
import { PLATFORMS, platformById, platformGuide, messageAssets, offerAssets, goldenAssets, composeSalesPage, type AssetKind } from "../lib/studio/platform-export";

const OFFER = {
  name: "The Funnel Fix Sprint",
  promise: "Booked calls in 14 days",
  deliverables: ["Audit", "Rebuild", "Two weeks of optimisation"],
  price: "$2,000",
  priceAnchor: "worth $8k",
  guarantee: "Booked calls or your money back",
  objections: [{ q: "Tried before?", a: "This one is scored first" }],
  positioning: "For coaches, we get you booked calls. Unlike agencies, we score it first.",
};

test("offerAssets emits each section + a full sales page, all 'web', empties dropped", () => {
  const assets = offerAssets(OFFER);
  assert.ok(assets.every((a) => a.kind === "web"));
  const keys = assets.map((a) => a.key);
  assert.ok(keys.includes("hero") && keys.includes("positioning") && keys.includes("salespage"));
  const deliv = assets.find((a) => a.key === "deliverables");
  assert.match(deliv!.value, /• Audit/);
  // an all-empty offer yields nothing
  assert.equal(offerAssets({}).length, 0);
  // a partial offer only pushes what it has (name only → hero + salespage)
  const partial = offerAssets({ name: "Just a name" });
  assert.deepEqual(partial.map((a) => a.key).sort(), ["hero", "salespage"]);
});

test("composeSalesPage assembles sections in order and omits empties", () => {
  const page = composeSalesPage(OFFER);
  assert.match(page, /^The Funnel Fix Sprint/);
  assert.match(page, /What's included:\n• Audit\n• Rebuild/);
  assert.match(page, /Investment: \$2,000 \(worth \$8k\)/);
  assert.match(page, /Our guarantee: Booked calls/);
  assert.match(page, /FAQ:\n\nQ: Tried before\?\nA: This one is scored first/);
  // no price/anchor/guarantee → those lines absent
  const bare = composeSalesPage({ name: "X", promise: "Y" });
  assert.doesNotMatch(bare, /Investment:/);
  assert.doesNotMatch(bare, /guarantee/i);
});


test("every platform has a bespoke guide for all three kinds", () => {
  const kinds: AssetKind[] = ["web", "email", "list"];
  for (const p of PLATFORMS) {
    for (const k of kinds) {
      const steps = platformGuide(p.id, k);
      assert.ok(steps.length >= 2, `${p.id}/${k} should have real steps`);
      assert.ok(steps.every((s) => s.trim().length > 0), `${p.id}/${k} steps must be non-empty`);
    }
  }
});

test("platformGuide falls back to a generic (still useful) guide for unknown platforms", () => {
  const steps = platformGuide("some-tool-we-dont-know", "email");
  assert.ok(steps.length >= 2);
  assert.match(steps.join(" ").toLowerCase(), /paste/);
});

test("platformById resolves known ids and returns undefined otherwise", () => {
  assert.equal(platformById("shopify")?.name, "Shopify");
  assert.equal(platformById("nope"), undefined);
});

test("messageAssets includes only non-empty blocks, all as 'web' kind", () => {
  const assets = messageAssets({
    oneLiner: "We map the funnel first, so you never waste ad spend.",
    wants: "  Predictable customers  ",
    success: "",
    plan: undefined,
  });
  assert.equal(assets.length, 2);
  assert.ok(assets.every((a) => a.kind === "web"));
  assert.equal(assets.find((a) => a.key === "wants")?.value, "Predictable customers"); // trimmed
  assert.equal(assets.find((a) => a.key === "success"), undefined);
  assert.equal(assets.find((a) => a.key === "plan"), undefined);
});

test("messageAssets returns [] when nothing is filled in", () => {
  assert.deepEqual(messageAssets({}), []);
  assert.deepEqual(messageAssets({ oneLiner: "   " }), []);
});

test("goldenAssets exports the value ladder, USP, sales angle and ad", () => {
  const assets = goldenAssets({
    insight: "Profit is the retainer, not the audit.",
    ladder: [
      { stage: "Driving product", name: "$47 Teardown", price: "$47", role: "way in" },
      { stage: "Core offer", name: "Fix Sprint", price: "$1,500", role: "main build" },
      { stage: "Profit engine", name: "Retainer", price: "$800/mo", role: "back end" },
    ],
    usp: "Fix your funnel for the price of lunch.",
    salesAngle: "Start with a $47 teardown, not a $5k retainer.",
    ad: "Your funnel is leaking. Find out where for $47.",
  });
  const labels = assets.map((a) => a.label);
  assert.ok(labels.includes("USP (one line)"));
  assert.ok(labels.includes("Value ladder (your strategy)"));
  assert.ok(labels.includes("Sales-page angle"));
  assert.ok(labels.includes("Ad"));
  const ladder = assets.find((a) => a.label === "Value ladder (your strategy)")!;
  assert.match(ladder.value, /Profit is the retainer/);
  assert.match(ladder.value, /1\. Driving product — \$47: \$47 Teardown/);
  assert.match(ladder.value, /3\. Profit engine — \$800\/mo: Retainer/);
});

test("goldenAssets returns [] without a usable ladder", () => {
  assert.deepEqual(goldenAssets(null), []);
  assert.deepEqual(goldenAssets({ usp: "nice", ladder: [] }), []);
  assert.deepEqual(goldenAssets({ ladder: [{ price: "$5" }] }), []); // rung with no name/stage
});
