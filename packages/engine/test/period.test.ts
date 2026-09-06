import test from "node:test";
import assert from "node:assert/strict";
import { periodDays, perDay, projectTo, isValidPeriod, validatePeriod, describePeriod } from "../src/period.ts";

test("period: day count is inclusive", () => {
  assert.equal(periodDays({ start: "2026-07-01", end: "2026-07-31" }), 31);
  assert.equal(periodDays({ start: "2026-07-15", end: "2026-07-15" }), 1); // one day is 1, not 0
  assert.equal(periodDays({ start: "2026-02-01", end: "2026-03-01" }), 29); // 2026 is not a leap year
  assert.equal(periodDays({ start: "2024-02-01", end: "2024-03-01" }), 30); // 2024 is
});

test("period: run-rate divides money across the window", () => {
  const p = { start: "2026-07-01", end: "2026-07-10" }; // 10 days
  assert.equal(perDay(400000, p), 40000);               // $4,000 over 10 days = $400/day
  assert.equal(projectTo(400000, p, 30), 1200000);      // -> $12,000 for 30 days
});

test("period: rejects impossible and reversed dates", () => {
  assert.equal(isValidPeriod({ start: "2026-02-31", end: "2026-03-01" }), false); // no such day
  assert.equal(isValidPeriod({ start: "2026-07-31", end: "2026-07-01" }), false); // reversed
  assert.equal(isValidPeriod({ start: "15/07/2026", end: "2026-07-31" }), false); // not ISO
  assert.equal(isValidPeriod(null), false);
  assert.equal(isValidPeriod({ start: "2026-07-01", end: "2026-07-01" }), true);
  assert.throws(() => validatePeriod({ start: "2026-07-31", end: "2026-07-01" }), /on or before/);
  assert.throws(() => validatePeriod({ start: "nope", end: "2026-07-01" }), /not an ISO date/);
});

test("period: a day is a calendar day, not a timezone-shifted instant", () => {
  // month boundaries must not drift regardless of where this runs
  assert.equal(periodDays({ start: "2026-12-31", end: "2027-01-01" }), 2);
  assert.equal(describePeriod({ start: "2026-07-01", end: "2026-07-31" }).includes("31 days"), true);
});
