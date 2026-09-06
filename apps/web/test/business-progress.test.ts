import test from "node:test";
import assert from "node:assert/strict";
import { computeStatus } from "../lib/business/progress";

// The audit finding this guards: the Business-OS hub used to treat any step that
// had been *touched* as *done*, so the progress bar and "Continue here" pointer
// skipped past steps that were only half-filled. `started` and `done` must be
// distinct — started = some data, done = a stricter, meaningful-completion bar.

test("non-object input is empty (never started, never done)", () => {
  for (const d of [null, undefined, 42, "x", true]) {
    assert.deepEqual(computeStatus("reality", d), { done: false, started: false, stat: "" });
  }
});

test("reality: a snapshot alone is started but not done; target + snapshot is done", () => {
  const snapOnly = computeStatus("reality", { now: { rev: "100" } });
  assert.equal(snapOnly.started, true);
  assert.equal(snapOnly.done, false);

  const targetOnly = computeStatus("reality", { targetRevenue: "10000" });
  assert.equal(targetOnly.started, true);
  assert.equal(targetOnly.done, false); // target but no real snapshot yet

  const both = computeStatus("reality", { targetRevenue: "10000", now: { rev: "100" } });
  assert.equal(both.started, true);
  assert.equal(both.done, true);
});

test("drivers: a bare driver row is started; a current+target row is done", () => {
  const bare = computeStatus("drivers", { drivers: [{ label: "Leads" }] });
  assert.equal(bare.started, true);
  assert.equal(bare.done, false);

  const complete = computeStatus("drivers", { drivers: [{ label: "Leads", current: "100", target: "300" }] });
  assert.equal(complete.started, true);
  assert.equal(complete.done, true);
});

test("constraint: a severity guess is started; only an explicit choice is done", () => {
  const guessed = computeStatus("constraint", { areas: [{ area: "Traffic", severity: 3 }] });
  assert.equal(guessed.started, true);
  assert.equal(guessed.done, false);

  const chosen = computeStatus("constraint", { chosen: "Traffic", areas: [{ area: "Traffic", severity: 3 }] });
  assert.equal(chosen.started, true);
  assert.equal(chosen.done, true);
});

test("execution: goals alone is started; goals + tasks is done", () => {
  const goalsOnly = computeStatus("execution", { goals: [{ id: 1 }] });
  assert.equal(goalsOnly.started, true);
  assert.equal(goalsOnly.done, false);

  const both = computeStatus("execution", { goals: [{ id: 1 }], tasks: [{ status: "todo", weight: 1 }] });
  assert.equal(both.started, true);
  assert.equal(both.done, true);
});

test("launches: a named launch with no readiness items is started but not done", () => {
  const named = computeStatus("launches", { launches: [{ name: "Spring", readiness: [] }] });
  assert.equal(named.started, true);
  assert.equal(named.done, false);

  const withItems = computeStatus("launches", { launches: [{ name: "Spring", readiness: [{ done: false, weight: 1 }] }] });
  assert.equal(withItems.started, true);
  assert.equal(withItems.done, true);
});

test("review: presence of a cycle counts as done (a review is inherently a record)", () => {
  const none = computeStatus("review", { cycles: [] });
  assert.equal(none.done, false);
  const one = computeStatus("review", { cycles: [{ period: "Q1" }] });
  assert.equal(one.done, true);
  assert.equal(one.started, true);
});
