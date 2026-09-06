import test from "node:test";
import assert from "node:assert/strict";
import { executionReadiness } from "../lib/studio/execution-readiness";

test("nothing done → 0, Not started, next is the funnel", () => {
  const r = executionReadiness({});
  assert.equal(r.score, 0);
  assert.equal(r.stage, "Not started");
  assert.equal(r.next?.key, "funnel");
  assert.ok(r.steps.every((s) => !s.done));
});

test("milestones add 25 each, in order, with the right stage + next", () => {
  assert.equal(executionReadiness({ hasFunnel: true }).score, 25);
  assert.equal(executionReadiness({ hasFunnel: true }).stage, "Funnel built");
  assert.equal(executionReadiness({ hasFunnel: true }).next?.key, "leads");

  const two = executionReadiness({ hasFunnel: true, leadsTotal: 4 });
  assert.equal(two.score, 50);
  assert.equal(two.stage, "Getting traffic");
  assert.equal(two.next?.key, "qualified");

  const three = executionReadiness({ hasFunnel: true, leadsTotal: 4, qualified: 2 });
  assert.equal(three.score, 75);
  assert.equal(three.stage, "Qualifying leads");
});

test("all milestones → 100, Booking calls, no next", () => {
  const r = executionReadiness({ hasFunnel: true, leadsTotal: 10, qualified: 5, booked: 1 });
  assert.equal(r.score, 100);
  assert.equal(r.stage, "Booking calls");
  assert.equal(r.next, null);
});

test("counts: zero/negative/NaN are treated as not-done", () => {
  const r = executionReadiness({ hasFunnel: true, leadsTotal: 0, qualified: -3, booked: Number.NaN });
  assert.equal(r.score, 25);
  assert.equal(r.steps.find((s) => s.key === "leads")!.done, false);
});
