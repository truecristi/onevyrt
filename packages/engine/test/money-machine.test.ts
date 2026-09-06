import test from "node:test";
import assert from "node:assert/strict";
import { projectMoneyMachine, DEFAULT_MONEY_MACHINE_CONFIG, type MoneyMachineConfig } from "../src/money-machine.ts";

test("projectMoneyMachine: annualizes monthly profit", () => {
  const p = projectMoneyMachine(100000, DEFAULT_MONEY_MACHINE_CONFIG);
  assert.equal(p.monthlyProfit, 100000);
  assert.equal(p.annualProfit, 1200000);
});

test("projectMoneyMachine: freedom fund is the configured share of profit", () => {
  const p = projectMoneyMachine(100000, DEFAULT_MONEY_MACHINE_CONFIG);
  assert.equal(p.freedomFundMonthly, 10000); // 10% of 100000
  assert.equal(p.freedomFundAnnual, 120000);
});

test("projectMoneyMachine: buckets split the freedom fund and conserve the total exactly", () => {
  const p = projectMoneyMachine(100000, DEFAULT_MONEY_MACHINE_CONFIG);
  assert.equal(p.securityMonthly + p.growthMonthly + p.dreamMonthly, p.freedomFundMonthly);
  assert.equal(p.securityMonthly, 5000); // 50%
  assert.equal(p.growthMonthly, 3000);   // 30%
  assert.equal(p.dreamMonthly, 2000);    // 20%
});

test("projectMoneyMachine: bucket rates are normalised when they don't sum to 1", () => {
  const cfg: MoneyMachineConfig = { freedomFundRate: 0.2, securityRate: 1, growthRate: 1, dreamRate: 0 };
  const p = projectMoneyMachine(100000, cfg);
  assert.equal(p.freedomFundMonthly, 20000);
  assert.equal(p.securityMonthly, 10000); // normalised 1/(1+1+0) = 50%
  assert.equal(p.growthMonthly, 10000);
  assert.equal(p.dreamMonthly, 0);
});

test("projectMoneyMachine: zero profit yields zero everywhere, no division errors", () => {
  const p = projectMoneyMachine(0, DEFAULT_MONEY_MACHINE_CONFIG);
  assert.equal(p.freedomFundMonthly, 0);
  assert.equal(p.securityMonthly, 0);
  assert.equal(p.growthMonthly, 0);
  assert.equal(p.dreamMonthly, 0);
});

test("projectMoneyMachine: negative profit (a losing funnel) doesn't crash and stays proportional", () => {
  const p = projectMoneyMachine(-50000, DEFAULT_MONEY_MACHINE_CONFIG);
  assert.equal(p.freedomFundMonthly, -5000);
  assert.equal(p.securityMonthly + p.growthMonthly + p.dreamMonthly, p.freedomFundMonthly);
});

test("projectMoneyMachine: all-zero bucket rates don't divide by zero, and the remainder lands in dream (conservation wins over even split)", () => {
  const cfg: MoneyMachineConfig = { freedomFundRate: 0.1, securityRate: 0, growthRate: 0, dreamRate: 0 };
  const p = projectMoneyMachine(100000, cfg);
  assert.equal(p.freedomFundMonthly, 10000);
  assert.equal(p.securityMonthly, 0);
  assert.equal(p.growthMonthly, 0);
  assert.equal(p.dreamMonthly, 10000);
  assert.equal(p.securityMonthly + p.growthMonthly + p.dreamMonthly, p.freedomFundMonthly);
});
