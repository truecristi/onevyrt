import test from "node:test";
import assert from "node:assert/strict";
import { summarizeRiskRegister, type RiskRegisterEntry } from "../src/governance.ts";

const entry = (status: RiskRegisterEntry["status"]): RiskRegisterEntry => ({
  id: `r-${status}-${Math.random()}`, createdAt: "2026-01-01T00:00:00.000Z",
  label: "Test risk", description: "desc", severity: "medium", status,
});

test("summarizeRiskRegister: counts by status", () => {
  const s = summarizeRiskRegister([entry("open"), entry("open"), entry("mitigated"), entry("accepted")]);
  assert.deepEqual(s, { total: 4, open: 2, mitigated: 1, accepted: 1 });
});

test("summarizeRiskRegister: empty register", () => {
  assert.deepEqual(summarizeRiskRegister([]), { total: 0, open: 0, mitigated: 0, accepted: 0 });
});
