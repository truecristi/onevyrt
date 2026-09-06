import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessReport } from "../src/business-report.ts";
import { DEFAULT_MONEY_MACHINE_CONFIG } from "../src/money-machine.ts";
import { DEFAULT_PROFIT_DRIVER_INPUTS } from "../src/profit-drivers.ts";
import type { ForceActionItem } from "../src/program.ts";
import type { ClientPromise } from "../src/raving-fans.ts";

test("buildBusinessReport: stitches all five sections together consistently", () => {
  const forceActions: ForceActionItem[] = [
    { id: "f1", force: 4, principle: "Follow-up", actionItem: "Add SMS follow-up", dollarValue: 100000,
      status: "open", priority: "high", createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const clientPromises: ClientPromise[] = [
    { id: "p1", promise: "Reply within 24h", delivered: true, createdAt: "2026-01-01T00:00:00.000Z" },
  ];
  const report = buildBusinessReport(
    { businessName: "Acme", breakthrough: "Stop chasing cold leads" },
    forceActions,
    500000, // $5,000 monthly profit
    DEFAULT_MONEY_MACHINE_CONFIG,
    { revenue: 1000000, cost: 500000 },
    { ...DEFAULT_PROFIT_DRIVER_INPUTS, conversionPct: 0.1 },
    clientPromises,
    { retentionRate: 0.6, referralRate: 0.4 },
    "2026-02-01T00:00:00.000Z",
  );

  assert.equal(report.generatedAt, "2026-02-01T00:00:00.000Z");
  assert.equal(report.brief.businessName, "Acme");
  assert.equal(report.brief.topActions[0]?.id, "f1");
  assert.equal(report.moneyMachine.monthlyProfit, 500000);
  assert.equal(report.moneyMachine.freedomFundMonthly, 50000); // 10% default
  assert.equal(report.profitDrivers.improved.revenue, 1100000); // +10% conversion
  assert.equal(report.ravingFans.promiseDeliveryRate, 1);
  assert.equal(report.forceActionSummary.total, 1);
  assert.equal(report.readiness.score, null); // no goals/assumptions/experiments passed
  assert.equal(report.moneyMachineLedger.totalBalance, 0); // no ledger entries passed
});
