import test from "node:test";
import assert from "node:assert/strict";
import { summarizePromises, computeRavingFansScore, type ClientPromise } from "../src/raving-fans.ts";

const promise = (over: Partial<ClientPromise>): ClientPromise => ({
  id: "p1", promise: "Reply within 24h", delivered: false, createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

test("summarizePromises: no promises yields null rate, not zero", () => {
  const s = summarizePromises([]);
  assert.equal(s.total, 0);
  assert.equal(s.rate, null);
});

test("summarizePromises: computes delivered/total rate", () => {
  const s = summarizePromises([
    promise({ id: "a", delivered: true }),
    promise({ id: "b", delivered: true }),
    promise({ id: "c", delivered: false }),
    promise({ id: "d", delivered: false }),
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.delivered, 2);
  assert.equal(s.rate, 0.5);
});

test("computeRavingFansScore: with no promises, weight redistributes 50/50 to retention/referral", () => {
  const s = computeRavingFansScore([], { retentionRate: 0.8, referralRate: 0.4 });
  assert.equal(s.promiseDeliveryRate, null);
  assert.equal(s.score, 60); // 0.5*0.8 + 0.5*0.4 = 0.6
});

test("computeRavingFansScore: with promises, blends 40/30/30", () => {
  const promises = [promise({ id: "a", delivered: true }), promise({ id: "b", delivered: false })]; // rate 0.5
  const s = computeRavingFansScore(promises, { retentionRate: 1, referralRate: 1 });
  assert.equal(s.promiseDeliveryRate, 0.5);
  assert.equal(s.score, 80); // 0.4*0.5 + 0.3*1 + 0.3*1 = 0.2+0.3+0.3 = 0.8
});

test("computeRavingFansScore: bands are building < 45 <= solid < 75 <= raving", () => {
  assert.equal(computeRavingFansScore([], { retentionRate: 0, referralRate: 0 }).band, "building");
  assert.equal(computeRavingFansScore([], { retentionRate: 0.5, referralRate: 0.5 }).band, "solid");
  assert.equal(computeRavingFansScore([], { retentionRate: 0.9, referralRate: 0.9 }).band, "raving");
});
