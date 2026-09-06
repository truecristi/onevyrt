import test from "node:test";
import assert from "node:assert/strict";
import { critiqueFunnel, applyFix, maxScore, buildCritiquePrompt } from "../lib/studio/funnel-critique";
import { blankFunnelDoc } from "../lib/studio/funnel-builder";
import type { FunnelDoc } from "../lib/studio/funnel-builder";

const clone = (d: FunnelDoc): FunnelDoc => JSON.parse(JSON.stringify(d));

test("a healthy blank funnel scores high with no fixes needed", () => {
  const { score, findings } = critiqueFunnel(blankFunnelDoc("s", "Test"));
  assert.ok(score >= 90, `expected high score, got ${score}`);
  assert.equal(findings.filter((x) => x.severity === "fix").length, 0);
});

test("unreachable qualified threshold is flagged and the fix caps it to max", () => {
  const doc = clone(blankFunnelDoc("s", "Test"));
  doc.thresholds.qualified = 9999;
  const before = critiqueFunnel(doc);
  const bad = before.findings.find((x) => x.id === "thr-unreachable");
  assert.ok(bad && bad.fixId === "cap-qualified");
  const fixed = applyFix(doc, "cap-qualified");
  assert.equal(fixed.thresholds.qualified, maxScore(doc));
  // finding is resolved after the fix
  assert.equal(critiqueFunnel(fixed).findings.some((x) => x.id === "thr-unreachable"), false);
  // pure: original untouched
  assert.equal(doc.thresholds.qualified, 9999);
});

test("nurture >= qualified is flagged and the fix spaces them below qualified", () => {
  const doc = clone(blankFunnelDoc("s", "Test"));
  doc.thresholds.qualified = 40;
  doc.thresholds.nurture = 40;
  assert.ok(critiqueFunnel(doc).findings.some((x) => x.id === "thr-order"));
  const fixed = applyFix(doc, "order-thresholds");
  assert.ok(fixed.thresholds.nurture < fixed.thresholds.qualified);
  assert.equal(critiqueFunnel(fixed).findings.some((x) => x.id === "thr-order"), false);
});

test("empty outcome copy is flagged and fill-outcomes resolves it", () => {
  const doc = clone(blankFunnelDoc("s", "Test"));
  doc.outcomes.qualified.heading = "";
  doc.outcomes.nurture.body = "  ";
  const found = critiqueFunnel(doc).findings.find((x) => x.id === "outcome-empty");
  assert.ok(found && found.fixId === "fill-outcomes");
  const fixed = applyFix(doc, "fill-outcomes");
  assert.ok(fixed.outcomes.qualified.heading.length > 0);
  assert.ok(fixed.outcomes.nurture.body.trim().length > 0);
  assert.equal(critiqueFunnel(fixed).findings.some((x) => x.id === "outcome-empty"), false);
});

test("disabled contact capture is a fix and enable-contact turns it on", () => {
  const doc = clone(blankFunnelDoc("s", "Test"));
  doc.contact = { enabled: false };
  assert.ok(critiqueFunnel(doc).findings.some((x) => x.id === "contact-off"));
  const fixed = applyFix(doc, "enable-contact");
  assert.equal(fixed.contact?.enabled, true);
  assert.equal(critiqueFunnel(fixed).findings.some((x) => x.id === "contact-off"), false);
});

test("a funnel where no answer scores points is flagged", () => {
  const doc = clone(blankFunnelDoc("s", "Test"));
  for (const q of doc.questions) for (const o of q.options ?? []) o.points = 0;
  assert.equal(maxScore(doc), 0);
  assert.ok(critiqueFunnel(doc).findings.some((x) => x.id === "score-zero"));
});

test("findings are ordered worst-first (fix before warn before good)", () => {
  const doc = clone(blankFunnelDoc("s", "Test"));
  doc.contact = { enabled: false }; // a fix
  doc.intro = ""; // a warn
  const order = critiqueFunnel(doc).findings.map((x) => x.severity);
  const firstGood = order.indexOf("good");
  const lastFix = order.lastIndexOf("fix");
  if (firstGood !== -1 && lastFix !== -1) assert.ok(lastFix < firstGood, "all fixes should come before any good");
});

test("applyFix ignores unknown fix ids without throwing", () => {
  const doc = blankFunnelDoc("s", "Test");
  assert.equal(applyFix(doc, "no-such-fix"), doc);
});

test("buildCritiquePrompt includes questions and outcome screens", () => {
  const p = buildCritiquePrompt(blankFunnelDoc("s", "Strategy Call"));
  assert.match(p, /Funnel: Strategy Call/);
  assert.match(p, /Q1 \[single\]:/);
  assert.match(p, /Qualified screen:/);
  assert.match(p, /Give your critique now\./);
});

test("buildCritiquePrompt folds in the business strategy when given", () => {
  const p = buildCritiquePrompt(blankFunnelDoc("s", "Strategy Call"), "12-month goal: $40k MRR");
  assert.match(p, /BUSINESS STRATEGY/);
  assert.match(p, /12-month goal: \$40k MRR/);
  assert.doesNotMatch(buildCritiquePrompt(blankFunnelDoc("s", "Strategy Call"), ""), /BUSINESS STRATEGY/);
});
