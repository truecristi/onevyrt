import test from "node:test";
import assert from "node:assert/strict";
import { realityToDefinition, REALITY_FIELD_SOURCE } from "../lib/studio/reality-bridge";
import { brandToDefinition, BRAND_FIELD_SOURCE } from "../lib/studio/brand-bridge";
import { offerToDefinition, OFFER_FIELD_SOURCE } from "../lib/studio/offer-bridge";
import { constraintToDefinition, CONSTRAINT_FIELD_SOURCE } from "../lib/studio/constraint-bridge";

/**
 * The four Business-OS -> Studio "suggestion" bridges (lib/studio/*-bridge.ts).
 * Pure mapper tests only — no DB, no fetch — mirroring test/message-copy.test.ts's
 * style for a pure lib/studio module. Each bridge maps only its own genuine
 * 1:1 overlap into a Partial<BusinessDefinition>; business-intelligence/page.tsx
 * merges all four (no precedence needed, since the field sets are disjoint).
 */

test("realityToDefinition: maps the 4 genuine overlaps, drops empty values", () => {
  const out = realityToDefinition({
    businessReallyIn: "predictable client acquisition",
    businessNeedToBeIn: "a business that runs without me",
    want12m: "20k/mo", want36m: "  ", // blank after trim -> dropped
  });
  assert.deepEqual(out, {
    currentReality: "predictable client acquisition",
    breakthrough: "a business that runs without me",
    milestones: "20k/mo",
  });
});

test("realityToDefinition: falls back to a composed 'now' snapshot when businessReallyIn is blank", () => {
  const out = realityToDefinition({ now: { stage: "growth", revenue: "10k/mo", customers: "40" } });
  assert.equal(out.currentReality, "Stage: growth · Revenue: 10k/mo · Customers: 40");
});

test("realityToDefinition: null map yields no suggestions", () => {
  assert.deepEqual(realityToDefinition(null), {});
});

test("brandToDefinition: maps businessName from companyName, drops blank", () => {
  assert.deepEqual(brandToDefinition({ companyName: "  Acme Co  " }), { businessName: "Acme Co" });
  assert.deepEqual(brandToDefinition({ companyName: "" }), {});
  assert.deepEqual(brandToDefinition(null), {});
});

test("offerToDefinition: maps whoServe from audience and mainOffer from name, independently", () => {
  assert.deepEqual(offerToDefinition({ audience: "coaches under $10k/mo", name: "The Funnel Fix Sprint" }), {
    whoServe: "coaches under $10k/mo", mainOffer: "The Funnel Fix Sprint",
  });
  assert.deepEqual(offerToDefinition({ audience: "coaches under $10k/mo" }), { whoServe: "coaches under $10k/mo" });
  assert.deepEqual(offerToDefinition(null), {});
});

test("constraintToDefinition: maps mainConstraint from chosen, drops blank", () => {
  assert.deepEqual(constraintToDefinition({ chosen: "Sales & closing" }), { mainConstraint: "Sales & closing" });
  assert.deepEqual(constraintToDefinition({ chosen: "" }), {});
  assert.deepEqual(constraintToDefinition(null), {});
});

test("the four bridges' field sources never collide — safe to merge with no precedence", () => {
  const allKeys = [
    ...Object.keys(REALITY_FIELD_SOURCE), ...Object.keys(BRAND_FIELD_SOURCE),
    ...Object.keys(OFFER_FIELD_SOURCE), ...Object.keys(CONSTRAINT_FIELD_SOURCE),
  ];
  assert.equal(new Set(allKeys).size, allKeys.length, "each BusinessDefinition field must be claimed by at most one bridge");
});
