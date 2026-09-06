import test from "node:test";
import assert from "node:assert/strict";
import { assembleMyBusiness, myBusinessCompleteness, type MyBusinessInputs } from "../src/my-business.ts";

test("assemble: empty inputs -> an all-blank profile, 0% complete", () => {
  const mb = assembleMyBusiness({});
  assert.equal(mb.identity.name, undefined);
  assert.equal(mb.numbers.revenue, undefined);
  const c = myBusinessCompleteness(mb);
  assert.equal(c.filled, 0);
  assert.equal(c.percent, 0);
  assert.ok(c.total > 0);
  assert.equal(Object.values(c.bySection).every((v) => v === false), true);
});

test("assemble: pulls each fact from its authoritative source", () => {
  const inputs: MyBusinessInputs = {
    definition: { businessName: "Acme Co", whoServe: "coaches under $10k/mo", mainOffer: "90-day funnel rebuild", vision: "£1m/yr, runs without me", strategy: "one offer, one channel", mainConstraint: "lead flow", weeklyFocus: "ship the VSL" },
    reality: { businessReallyIn: "predictable client acquisition", now: { revenue: "5000", profit: "2000", customers: "8" }, want12m: "20k/mo", targetRevenue: "30000" },
    brand: { industry: "coaching", audience: "should-not-win", guarantees: "double your leads or free", messageOneLiner: "Funnels that fill your calendar", brandVoice: "direct, no fluff", customerProblem: "empty pipeline", customerSuccess: "booked out" },
  };
  const mb = assembleMyBusiness(inputs);
  assert.equal(mb.identity.name, "Acme Co");
  assert.equal(mb.identity.industry, "coaching");
  assert.equal(mb.identity.businessYouAreReallyIn, "predictable client acquisition");
  assert.equal(mb.customer.whoYouServe, "coaches under $10k/mo"); // definition wins over brand.audience
  assert.equal(mb.customer.theirProblem, "empty pipeline");
  assert.equal(mb.offer.mainOffer, "90-day funnel rebuild");
  assert.equal(mb.offer.guarantees, "double your leads or free");
  assert.equal(mb.direction.vision, "£1m/yr, runs without me");
  assert.equal(mb.direction.want12m, "20k/mo");
  assert.equal(mb.strategy.mainConstraint, "lead flow");
  assert.equal(mb.message.oneLiner, "Funnels that fill your calendar");
  assert.equal(mb.numbers.revenue, "5000");
  assert.equal(mb.numbers.targetRevenue, "30000");
  assert.equal(mb.next90.weeklyFocus, "ship the VSL");
});

test("assemble: the Growth Constraint tool's chosen bottleneck wins over the guided definition's one-time mainConstraint", () => {
  const mb = assembleMyBusiness({
    definition: { mainConstraint: "lead flow" },
    constraint: { chosen: "Sales & closing" },
  });
  assert.equal(mb.strategy.mainConstraint, "Sales & closing");
});

test("assemble: mainConstraint falls back to the definition when the Growth Constraint tool has nothing chosen yet", () => {
  const mb = assembleMyBusiness({ definition: { mainConstraint: "lead flow" }, constraint: { chosen: "" } });
  assert.equal(mb.strategy.mainConstraint, "lead flow");
});

test("assemble: the Offer tool's own fields win over Brand Brain's, and fill in when the definition is blank", () => {
  const mb = assembleMyBusiness({
    definition: {}, // no mainOffer
    brand: { guarantees: "brand-level guarantee" },
    offer: { name: "The Funnel Fix Sprint", guarantee: "double your leads or free", priceAnchor: "normally £2,000" },
  });
  assert.equal(mb.offer.mainOffer, "The Funnel Fix Sprint"); // no definition.mainOffer -> falls to offer.name
  assert.equal(mb.offer.guarantees, "double your leads or free"); // offer tool wins over brand
  assert.equal(mb.offer.pricingNotes, "normally £2,000"); // no brand.pricingNotes -> falls to offer.priceAnchor
});

test("assemble: the Message tool's composed one-liner wins over Brand Brain's own messageOneLiner", () => {
  const mb = assembleMyBusiness({
    brand: { messageOneLiner: "Funnels that fill your calendar" },
    message: { oneLiner: "You're losing leads to slow follow-up. We fix that, so you close more deals." },
  });
  assert.equal(mb.message.oneLiner, "You're losing leads to slow follow-up. We fix that, so you close more deals.");
});

test("assemble: falls back to the brand's audience when the definition has no whoServe", () => {
  const mb = assembleMyBusiness({ definition: { businessName: "X" }, brand: { audience: "local gyms" } });
  assert.equal(mb.customer.whoYouServe, "local gyms");
});

test("assemble: name falls back from definition to brand company name", () => {
  const mb = assembleMyBusiness({ brand: { companyName: "Brand LLC" } });
  assert.equal(mb.identity.name, "Brand LLC");
});

test("assemble: blank/whitespace strings are treated as empty (do not win precedence)", () => {
  const mb = assembleMyBusiness({ definition: { businessName: "   " }, brand: { companyName: "Real Name" } });
  assert.equal(mb.identity.name, "Real Name");
});

test("completeness: rises as more of the profile is filled, and flags filled sections", () => {
  const partial = assembleMyBusiness({ definition: { businessName: "A", vision: "V" } });
  const c = myBusinessCompleteness(partial);
  assert.ok(c.filled >= 2 && c.filled < c.total);
  assert.ok(c.percent > 0 && c.percent < 100);
  assert.equal(c.bySection.identity, true);
  assert.equal(c.bySection.direction, true);
  assert.equal(c.bySection.numbers, false);
});
