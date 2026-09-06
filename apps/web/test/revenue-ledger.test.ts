import test from "node:test";
import assert from "node:assert/strict";
import { dominantRevenue, type WorkspaceRevenue } from "../lib/revenue-ledger";

const row = (o: Partial<WorkspaceRevenue> & { currency: string }): WorkspaceRevenue => ({
  grossCents: 0, refundedCents: 0, netCents: 0, saleCount: 0, refundCount: 0, ...o,
});

test("dominantRevenue: null when the ledger has no rows (caller falls back to the log)", () => {
  assert.equal(dominantRevenue([]), null);
});

test("dominantRevenue: reports the dominant currency's NET, gross and refunded", () => {
  const d = dominantRevenue([
    row({ currency: "usd", grossCents: 10000, refundedCents: 1500, netCents: 8500, saleCount: 4, refundCount: 1 }),
  ]);
  assert.deepEqual(d, {
    completedCount: 4,
    completedAmountTotal: 8500,   // net = gross − refunded
    grossAmountTotal: 10000,
    refundedAmountTotal: 1500,
    currency: "usd",
    mixedCurrency: false,
  });
});

test("dominantRevenue: picks the largest NET across currencies and flags the mix", () => {
  const d = dominantRevenue([
    row({ currency: "eur", grossCents: 4000, netCents: 4000, saleCount: 2 }),
    row({ currency: "usd", grossCents: 9000, refundedCents: 2000, netCents: 7000, saleCount: 5, refundCount: 1 }),
  ]);
  assert.equal(d?.currency, "usd", "usd nets 7000 > eur 4000");
  assert.equal(d?.completedAmountTotal, 7000);
  assert.equal(d?.completedCount, 5);
  assert.equal(d?.mixedCurrency, true);
});

test("dominantRevenue: an unknown-currency bucket ('') still reports, currency null", () => {
  const d = dominantRevenue([row({ currency: "", grossCents: 1200, netCents: 1200, saleCount: 1 })]);
  assert.equal(d?.currency, null);
  assert.equal(d?.completedAmountTotal, 1200);
});
