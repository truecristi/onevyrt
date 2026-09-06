import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "../lib/studio/templates";

const golden = TEMPLATES.filter((t) => t.category === "Golden Examples");

test("Golden Examples category is present and first", () => {
  assert.equal(TEMPLATE_CATEGORIES[0], "Golden Examples");
  const keys = golden.map((t) => t.key);
  assert.ok(keys.includes("golden-mcdonalds"), "McDonald's template missing");
  assert.ok(keys.includes("golden-clickfunnels"), "ClickFunnels template missing");
});

test("each golden template is a well-formed funnel graph", () => {
  for (const t of golden) {
    assert.ok(t.name && t.blurb.length > 40, `${t.key}: needs a name + descriptive blurb`);
    const ids = new Set(t.nodes.map((n) => n.id));
    assert.equal(ids.size, t.nodes.length, `${t.key}: duplicate node id`);
    // every edge connects two real nodes
    for (const [a, b] of t.edges) {
      assert.ok(ids.has(a) && ids.has(b), `${t.key}: edge ${a}->${b} references a missing node`);
    }
    // starts at traffic, ends at an offer
    assert.equal(t.nodes[0]!.kind, "traffic", `${t.key}: should start with traffic`);
    assert.equal(t.nodes[t.nodes.length - 1]!.kind, "offer", `${t.key}: should end on an offer`);
    // has at least two offer rungs (a driving product + a back end)
    const offers = t.nodes.filter((n) => n.kind === "offer");
    assert.ok(offers.length >= 2, `${t.key}: a value ladder needs >= 2 offer rungs`);
  }
});

test("the driving product is a genuine loss-leader (price below unit cost)", () => {
  for (const t of golden) {
    const firstOffer = t.nodes.find((n) => n.kind === "offer")!;
    const price = firstOffer.extra?.price ?? 0;
    const unitCost = firstOffer.extra?.unitCost ?? 0;
    assert.ok(price > 0 && unitCost > 0, `${t.key}: driving product needs a price and unit cost`);
    assert.ok(price < unitCost, `${t.key}: the driving product "${firstOffer.label}" should lose money (price ${price} < unitCost ${unitCost})`);
  }
});

test("a later rung carries real margin (the profit lives on the back end)", () => {
  for (const t of golden) {
    const offers = t.nodes.filter((n) => n.kind === "offer");
    const backEnd = offers.slice(1); // everything after the driving product
    const anyProfitable = backEnd.some((o) => (o.extra?.price ?? 0) > (o.extra?.unitCost ?? 0));
    assert.ok(anyProfitable, `${t.key}: at least one back-end rung must be profitable`);
  }
});
