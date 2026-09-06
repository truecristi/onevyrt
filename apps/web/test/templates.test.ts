import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, CHANNELS, findTemplate, channelMeta, type Channel } from "../lib/templates";

const CHANNEL_IDS = new Set<string>(CHANNELS.map((c) => c.id));

test("templates: every template id is unique", () => {
  const ids = TEMPLATES.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate template id(s) found");
});

test("templates: every template has the required fields and at least one step", () => {
  for (const t of TEMPLATES) {
    assert.ok(t.id && t.name && t.category && t.description && t.objective && t.channel, `${t.id}: missing a required field`);
    assert.ok(t.steps.length > 0, `${t.id}: has no steps`);
  }
});

test("templates: every step uses a known channel and has copy", () => {
  for (const t of TEMPLATES) {
    for (const s of t.steps) {
      assert.ok(CHANNEL_IDS.has(s.channel), `${t.id}: step channel "${s.channel}" is not a known channel`);
      assert.ok(s.title.trim().length > 0, `${t.id}: a step is missing a title`);
      assert.ok(s.content.trim().length > 0, `${t.id}: step "${s.title}" is missing a content brief`);
    }
  }
});

test("templates: steps are in non-decreasing day order (a readable flow)", () => {
  for (const t of TEMPLATES) {
    for (let i = 1; i < t.steps.length; i++) {
      const cur = t.steps[i]!;
      const prev = t.steps[i - 1]!;
      assert.ok(cur.day >= prev.day, `${t.id}: step "${cur.title}" (day ${cur.day}) precedes the one before it (day ${prev.day})`);
    }
  }
});

test("templates: findTemplate round-trips by id and returns undefined for unknown", () => {
  for (const t of TEMPLATES) {
    assert.equal(findTemplate(t.id)?.id, t.id);
  }
  assert.equal(findTemplate("no-such-template"), undefined);
});

test("templates: the email-flow set is present", () => {
  const emailFlows = TEMPLATES.filter((t) => t.category === "Email flow").map((t) => t.id);
  for (const id of ["welcome-onboarding", "abandoned-cart", "post-purchase", "free-trial", "referral-flywheel"]) {
    assert.ok(emailFlows.includes(id), `expected email-flow template "${id}"`);
  }
});

test("templates: cover at least 15 distinct business domains", () => {
  const categories = new Set(TEMPLATES.map((t) => t.category));
  assert.ok(categories.size >= 15, `expected >= 15 distinct domain categories, got ${categories.size}`);
  for (const id of [
    "ecommerce-launch", "saas-trial-activation", "coaching-highticket", "realestate-listings",
    "restaurant-offer", "fitness-challenge", "dental-recall", "course-launch", "salon-spa",
    "home-services", "b2b-leadgen", "nonprofit-fundraise", "auto-dealership", "financial-advisor",
    "professional-services", "subscription-box",
  ]) {
    assert.ok(TEMPLATES.some((t) => t.id === id), `expected industry template "${id}"`);
  }
});

test("channelMeta: falls back to the last (Other) channel for an unknown id", () => {
  const known = channelMeta("email");
  assert.equal(known.id, "email");
  const unknown = channelMeta("not-a-channel" as Channel);
  assert.equal(unknown.id, "other");
});
