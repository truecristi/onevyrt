import test from "node:test";
import assert from "node:assert/strict";
import { summarizeExperiments, type ExperimentEntry } from "../src/experiments.ts";

function experiment(over: Partial<ExperimentEntry>): ExperimentEntry {
  return { id: "e", hypothesis: "h", status: "planned", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}

test("summarizeExperiments: counts by status", () => {
  const list = [
    experiment({ id: "1", status: "planned" }),
    experiment({ id: "2", status: "running" }),
    experiment({ id: "3", status: "completed", decision: "adopt" }),
    experiment({ id: "4", status: "abandoned" }),
  ];
  const s = summarizeExperiments(list);
  assert.equal(s.total, 4);
  assert.equal(s.planned, 1);
  assert.equal(s.running, 1);
  assert.equal(s.completed, 1);
  assert.equal(s.abandoned, 1);
});

test("summarizeExperiments: flags completed experiments with no recorded decision", () => {
  const list = [
    experiment({ id: "1", status: "completed", decision: "adopt" }),
    experiment({ id: "2", status: "completed" }), // no decision — this is the gap
    experiment({ id: "3", status: "running" }), // not completed, doesn't count
  ];
  const s = summarizeExperiments(list);
  assert.deepEqual(s.awaitingDecision.map((e) => e.id), ["2"]);
});

test("summarizeExperiments: every decision value (including the new ones, and the legacy 'reject') counts as decided", () => {
  const list = (["adopt", "iterate", "retest", "stop", "insufficient_evidence", "reject"] as const)
    .map((decision, i) => experiment({ id: String(i), status: "completed", decision }));
  const s = summarizeExperiments(list);
  assert.deepEqual(s.awaitingDecision, [], "a recorded decision of any kind — old or new vocabulary — must not still read as 'awaiting decision'");
});
