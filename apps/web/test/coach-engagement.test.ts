import test from "node:test";
import assert from "node:assert/strict";
import { classifyEngagement, daysSince, IDLE_DAYS, DORMANT_DAYS, type EngagementInput } from "../lib/coach/engagement";

const NOW = Date.UTC(2026, 8, 1); // fixed clock so "days ago" is deterministic
const daysAgo = (n: number): string => new Date(NOW - n * 86_400_000).toISOString();
const base: EngagementInput = { percentComplete: 40, awaitingReviewCount: 0, changesRequestedCount: 0, overdueCount: 0, lastActivityAt: daysAgo(1) };
const of = (over: Partial<EngagementInput>) => classifyEngagement({ ...base, ...over }, NOW);

test("daysSince: null/garbage → null, future → clamped to 0", () => {
  assert.equal(daysSince(null, NOW), null);
  assert.equal(daysSince("not-a-date", NOW), null);
  assert.equal(daysSince(daysAgo(3), NOW), 3);
  assert.equal(daysSince(new Date(NOW + 86_400_000).toISOString(), NOW), 0);
});

test("completed learners drop out of the attention list", () => {
  const e = of({ percentComplete: 100, lastActivityAt: daysAgo(90) });
  assert.equal(e.status, "completed");
  assert.equal(e.atRisk, false);
  assert.equal(e.attention, 0);
});

test("enrolled but never started is at-risk", () => {
  const e = of({ percentComplete: 0, lastActivityAt: null });
  assert.equal(e.status, "never_started");
  assert.equal(e.atRisk, true);
});

test("inactivity is the dominant signal and outranks a pending review", () => {
  const idle = of({ lastActivityAt: daysAgo(IDLE_DAYS + 2), awaitingReviewCount: 3 });
  assert.equal(idle.status, "idle");
  assert.equal(idle.atRisk, true);
  assert.match(idle.label, /Idle 9d/);

  const dormant = of({ lastActivityAt: daysAgo(DORMANT_DAYS + 3) });
  assert.equal(dormant.status, "dormant");
  // gone-quiet must outrank an idle learner, who must outrank awaiting-review
  assert.ok(dormant.attention > idle.attention);
  assert.ok(idle.attention > of({ awaitingReviewCount: 5 }).attention);
});

test("active learners: review > changes > overdue > steady", () => {
  assert.equal(of({ awaitingReviewCount: 1 }).status, "awaiting_review");
  assert.equal(of({ changesRequestedCount: 1 }).status, "changes_pending");
  assert.equal(of({ overdueCount: 2 }).label, "Behind on tasks");
  assert.equal(of({}).status, "on_track");
  assert.equal(of({}).atRisk, false);
});
