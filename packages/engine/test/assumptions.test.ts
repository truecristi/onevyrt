import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAssumptions, type AssumptionEntry } from "../src/assumptions.ts";

function assumption(over: Partial<AssumptionEntry>): AssumptionEntry {
  return { id: "a", text: "t", confidence: "medium", status: "untested", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}

test("summarizeAssumptions: counts by status", () => {
  const list = [
    assumption({ id: "1", status: "untested" }),
    assumption({ id: "2", status: "testing" }),
    assumption({ id: "3", status: "confirmed" }),
    assumption({ id: "4", status: "invalidated", reviewedAt: "2026-02-01T00:00:00.000Z" }),
  ];
  const s = summarizeAssumptions(list);
  assert.equal(s.total, 4);
  assert.equal(s.untested, 1);
  assert.equal(s.testing, 1);
  assert.equal(s.confirmed, 1);
  assert.equal(s.invalidated, 1);
});

test("summarizeAssumptions: flags high-confidence but untested as overconfident", () => {
  const list = [
    assumption({ id: "1", confidence: "high", status: "untested" }),
    assumption({ id: "2", confidence: "high", status: "confirmed" }), // tested, not overconfident
    assumption({ id: "3", confidence: "low", status: "untested" }), // low confidence, not overconfident
  ];
  const s = summarizeAssumptions(list);
  assert.deepEqual(s.overconfident.map((a) => a.id), ["1"]);
});

test("summarizeAssumptions: flags invalidated assumptions that were never reviewed", () => {
  const list = [
    assumption({ id: "1", status: "invalidated" }), // no reviewedAt
    assumption({ id: "2", status: "invalidated", reviewedAt: "2026-02-01T00:00:00.000Z" }), // reviewed
  ];
  const s = summarizeAssumptions(list);
  assert.deepEqual(s.unreviewedInvalidated.map((a) => a.id), ["1"]);
});
