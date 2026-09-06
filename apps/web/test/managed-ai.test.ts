import test from "node:test";
import assert from "node:assert/strict";
import { managedAiConfigured, managedModel, managedMonthlyQuota, MANAGED_TOKENS_MAX } from "../lib/managed-ai";
import { monthKey } from "../lib/ai-usage-store";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { fn(); } finally {
    for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; }
  }
}

test("managedAiConfigured reflects MANAGED_AI_KEY", () => {
  withEnv({ MANAGED_AI_KEY: undefined }, () => assert.equal(managedAiConfigured(), false));
  withEnv({ MANAGED_AI_KEY: "  " }, () => assert.equal(managedAiConfigured(), false));
  withEnv({ MANAGED_AI_KEY: "sk-managed" }, () => assert.equal(managedAiConfigured(), true));
});

test("managedModel falls back to a default, honours the override", () => {
  withEnv({ MANAGED_AI_MODEL: undefined }, () => assert.match(managedModel(), /\//)); // provider/model shape
  withEnv({ MANAGED_AI_MODEL: "anthropic/claude-3-haiku" }, () => assert.equal(managedModel(), "anthropic/claude-3-haiku"));
});

test("managedMonthlyQuota parses, floors, defaults on garbage", () => {
  withEnv({ MANAGED_AI_MONTHLY_QUOTA: undefined }, () => assert.equal(managedMonthlyQuota(), 50));
  withEnv({ MANAGED_AI_MONTHLY_QUOTA: "120" }, () => assert.equal(managedMonthlyQuota(), 120));
  withEnv({ MANAGED_AI_MONTHLY_QUOTA: "0" }, () => assert.equal(managedMonthlyQuota(), 0));
  withEnv({ MANAGED_AI_MONTHLY_QUOTA: "12.9" }, () => assert.equal(managedMonthlyQuota(), 12));
  withEnv({ MANAGED_AI_MONTHLY_QUOTA: "-5" }, () => assert.equal(managedMonthlyQuota(), 50)); // negative → default
  withEnv({ MANAGED_AI_MONTHLY_QUOTA: "abc" }, () => assert.equal(managedMonthlyQuota(), 50));
});

test("monthKey is a UTC YYYY-MM and rolls over between months", () => {
  assert.equal(monthKey(new Date("2026-08-20T23:59:59Z")), "2026-08");
  assert.equal(monthKey(new Date("2026-09-01T00:00:00Z")), "2026-09");
  assert.equal(monthKey(new Date("2026-01-05T12:00:00Z")), "2026-01"); // zero-padded month
  assert.equal(monthKey(new Date("2026-12-31T23:00:00Z")), "2026-12");
});

test("token ceiling is a sane cap", () => {
  assert.ok(MANAGED_TOKENS_MAX >= 500 && MANAGED_TOKENS_MAX <= 4000);
});
