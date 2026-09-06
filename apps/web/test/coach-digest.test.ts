import test from "node:test";
import assert from "node:assert/strict";
import { buildDigest, type DigestLearner } from "../lib/coach/digest";
import { classifyEngagement } from "../lib/coach/engagement";

const NOW = Date.UTC(2026, 8, 1);
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function learner(name: string, over: { percentComplete?: number; lastActivityAt?: string | null } = {}): DigestLearner {
  const percentComplete = over.percentComplete ?? 20;
  const lastActivityAt = over.lastActivityAt === undefined ? daysAgo(30) : over.lastActivityAt;
  return {
    workspaceName: name,
    percentComplete,
    lastActivityAt,
    engagement: classifyEngagement({ percentComplete, awaitingReviewCount: 0, changesRequestedCount: 0, overdueCount: 0, lastActivityAt }, NOW),
  };
}

test("buildDigest: returns null when nobody is at risk (no empty emails)", () => {
  const onTrack = learner("Acme", { lastActivityAt: daysAgo(1) });
  assert.equal(onTrack.engagement.atRisk, false);
  assert.equal(buildDigest([onTrack]), null);
  assert.equal(buildDigest([]), null);
});

test("buildDigest: groups at-risk learners and counts them", () => {
  const d = buildDigest([
    learner("Gone Co", { lastActivityAt: daysAgo(30) }),      // dormant
    learner("Idle Co", { lastActivityAt: daysAgo(9) }),       // idle
    learner("Fresh Co", { percentComplete: 0, lastActivityAt: null }), // never started
    learner("Steady Co", { lastActivityAt: daysAgo(1) }),     // on track — excluded
  ]);
  assert.ok(d);
  assert.equal(d.atRiskCount, 3);
  assert.match(d.text, /Gone quiet:/);
  assert.match(d.text, /Idle:/);
  assert.match(d.text, /Not started:/);
  assert.match(d.text, /Gone Co/);
  assert.doesNotMatch(d.text, /Steady Co/); // on-track learner never appears
});

test("buildDigest: singular grammar for a lone learner", () => {
  const d = buildDigest([learner("Solo Co", { lastActivityAt: daysAgo(30) })]);
  assert.ok(d);
  assert.match(d.text, /^1 learner needs a nudge/);
  assert.equal(d.subject, "1 learner has gone quiet");
});
