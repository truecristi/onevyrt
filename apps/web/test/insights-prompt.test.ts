import test from "node:test";
import assert from "node:assert/strict";
import { insightsPrompt, parseInsights, isSnapshotEmpty, type InsightsSnapshot } from "../lib/insights/prompt";

const snap: InsightsSnapshot = {
  currency: "USD",
  overview: { leadsTotal: 40, leads7d: 12, qualified: 18, qualifyRate: 0.45, bookingsTotal: 6, bookRate: 0.33, upcoming: 2 },
  economics: { spend: 900, costPerQualified: 50, costPerBooking: 150 },
  funnels: [{ slug: "coach", title: "Coaching intake", leads: 40, qualified: 18, booked: 6, qualifyRate: 0.45, costPerQualified: 50 }],
  angles: [{ angle: "Cost of inaction", qualified: 12, leads: 20, qualifyRate: 0.6, costPerQualified: 40 }],
  creatives: [{ headline: "Every week you wait costs leads", angle: "Cost of inaction", qualified: 12, leads: 20, costPerQualified: 40 }],
};

test("the prompt embeds the real numbers and asks for strict JSON", () => {
  const { system, user } = insightsPrompt(snap);
  assert.match(system, /JSON object/i);
  assert.match(system, /never invent numbers/i);
  assert.match(user, /45%/, "qualify rate rendered");
  assert.match(user, /Cost of inaction/, "top angle included");
  assert.match(user, /Coaching intake/, "funnel title included");
  assert.match(user, /\$50/, "CAC formatted as currency");
});

test("isSnapshotEmpty is true only with no leads and no funnels", () => {
  assert.equal(isSnapshotEmpty(snap), false);
  assert.equal(isSnapshotEmpty({ ...snap, overview: { ...snap.overview, leadsTotal: 0 }, funnels: [] }), true);
});

test("parseInsights extracts a digest from a fenced/noisy reply", () => {
  const reply = "Here's your read:\n```json\n" + JSON.stringify({
    headline: "Cost-of-inaction is carrying you", summary: "It qualifies 60%.",
    insights: [
      { title: "Double down on 'Cost of inaction'", detail: "60% qualify vs 45% overall.", action: "Make 3 more variants of it." },
      { title: "", detail: "dropped", action: "ignored" },
    ],
  }) + "\n```";
  const d = parseInsights(reply);
  assert.equal(d.headline, "Cost-of-inaction is carrying you");
  assert.equal(d.insights.length, 1, "blank-title insight is filtered out");
  assert.equal(d.insights[0]!.action, "Make 3 more variants of it.");
});

test("parseInsights throws on unusable output", () => {
  assert.throws(() => parseInsights("sorry, I can't help with that"), /digest/i);
  assert.throws(() => parseInsights(JSON.stringify({ headline: "x", insights: [] })), /no insights/i);
});
