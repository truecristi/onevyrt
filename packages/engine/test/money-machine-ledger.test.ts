import test from "node:test";
import assert from "node:assert/strict";
import { summarizeLedger, monthsToTarget, requiredMonthlyContribution, type LedgerEntry } from "../src/money-machine-ledger.ts";

function entry(over: Partial<LedgerEntry>): LedgerEntry {
  return { id: "e", createdAt: "2026-01-01T00:00:00.000Z", bucket: "security", kind: "contribution", amount: 0, ...over };
}

test("summarizeLedger: empty ledger has zero balances and null progress everywhere", () => {
  const s = summarizeLedger([]);
  assert.equal(s.security.balance, 0);
  assert.equal(s.security.progressPct, null);
  assert.equal(s.totalBalance, 0);
});

test("summarizeLedger: contributions accumulate per bucket, independently of each other", () => {
  const s = summarizeLedger([
    entry({ id: "1", bucket: "security", amount: 10000 }),
    entry({ id: "2", bucket: "security", amount: 5000 }),
    entry({ id: "3", bucket: "growth", amount: 2000 }),
  ]);
  assert.equal(s.security.balance, 15000);
  assert.equal(s.growth.balance, 2000);
  assert.equal(s.dream.balance, 0);
  assert.equal(s.totalBalance, 17000);
});

test("summarizeLedger: a withdrawal reduces its own bucket's balance, not any other", () => {
  const s = summarizeLedger([
    entry({ id: "1", bucket: "dream", kind: "contribution", amount: 10000 }),
    entry({ id: "2", bucket: "dream", kind: "withdrawal", amount: 4000 }),
  ]);
  assert.equal(s.dream.balance, 6000);
});

test("summarizeLedger: progressPct is null when no target is set, even with a real balance", () => {
  const s = summarizeLedger([entry({ id: "1", amount: 5000 })]);
  assert.equal(s.security.progressPct, null);
});

test("summarizeLedger: progressPct is computed and rounded once a target is set", () => {
  const s = summarizeLedger([entry({ id: "1", amount: 2500 })], { securityTarget: 10000 });
  assert.equal(s.security.progressPct, 25);
  assert.equal(s.security.target, 10000);
});

test("summarizeLedger: progressPct clamps at 100 once the balance exceeds the target", () => {
  const s = summarizeLedger([entry({ id: "1", amount: 15000 })], { securityTarget: 10000 });
  assert.equal(s.security.progressPct, 100);
});

test("summarizeLedger: progressPct clamps at 0 if withdrawals push a bucket negative", () => {
  const s = summarizeLedger(
    [entry({ id: "1", kind: "contribution", amount: 1000 }), entry({ id: "2", kind: "withdrawal", amount: 3000 })],
    { securityTarget: 10000 },
  );
  assert.equal(s.security.balance, -2000);
  assert.equal(s.security.progressPct, 0);
});

test("monthsToTarget: no target set returns null", () => {
  assert.equal(monthsToTarget(0, undefined, 1000), null);
});

test("monthsToTarget: target already met returns 0, never negative", () => {
  assert.equal(monthsToTarget(12000, 10000, 1000), 0);
  assert.equal(monthsToTarget(10000, 10000, 1000), 0);
});

test("monthsToTarget: zero or negative contribution rate with a real gap is unreachable (null)", () => {
  assert.equal(monthsToTarget(0, 10000, 0), null);
  assert.equal(monthsToTarget(0, 10000, -500), null);
});

test("monthsToTarget: rounds up a partial month so the target is never reported early", () => {
  assert.equal(monthsToTarget(0, 10000, 3000), 4); // 3.33... months -> 4
  assert.equal(monthsToTarget(0, 9000, 3000), 3); // exact
});

test("summarizeLedger: goalDate passes through per bucket, independently of target", () => {
  const s = summarizeLedger([], { securityTarget: 10000, securityGoalDate: "2027-06-01", growthTarget: 5000 });
  assert.equal(s.security.goalDate, "2027-06-01");
  assert.equal(s.growth.goalDate, undefined, "a bucket with no goal date set must not inherit another bucket's");
});

test("requiredMonthlyContribution: no target, no date, or a non-positive target all return null", () => {
  assert.equal(requiredMonthlyContribution(0, undefined, "2027-01-01", new Date("2026-01-01")), null);
  assert.equal(requiredMonthlyContribution(0, 10000, undefined, new Date("2026-01-01")), null);
  assert.equal(requiredMonthlyContribution(0, 0, "2027-01-01", new Date("2026-01-01")), null);
});

test("requiredMonthlyContribution: target already met returns 0, regardless of the date", () => {
  assert.equal(requiredMonthlyContribution(10000, 10000, "2020-01-01", new Date("2026-01-01")), 0, "even a past date shouldn't matter once the gap is already closed");
});

test("requiredMonthlyContribution: splits the remaining gap evenly across the whole months left", () => {
  // 12,000 gap, 2026-01-01 -> 2026-07-01 = 6 whole months -> 2,000/mo
  assert.equal(requiredMonthlyContribution(0, 12000, "2026-07-01", new Date("2026-01-01")), 2000);
});

test("requiredMonthlyContribution: a goal date already in the past with a real gap left is null — no retroactive schedule", () => {
  assert.equal(requiredMonthlyContribution(0, 10000, "2025-01-01", new Date("2026-01-01")), null);
});

test("requiredMonthlyContribution: an unparseable date is treated the same as no date (null), not a crash", () => {
  assert.equal(requiredMonthlyContribution(0, 10000, "not-a-date", new Date("2026-01-01")), null);
});
