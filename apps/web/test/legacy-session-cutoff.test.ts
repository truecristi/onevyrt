import test from "node:test";
import assert from "node:assert/strict";
import { legacySessionsCutoffPassed } from "../lib/auth";

function withEnv<T>(v: string | undefined, fn: () => T): T {
  const prev = process.env.SESSION_SID_REQUIRED_AFTER;
  if (v === undefined) delete process.env.SESSION_SID_REQUIRED_AFTER; else process.env.SESSION_SID_REQUIRED_AFTER = v;
  try { return fn(); }
  finally { if (prev === undefined) delete process.env.SESSION_SID_REQUIRED_AFTER; else process.env.SESSION_SID_REQUIRED_AFTER = prev; }
}

test("legacy session cutoff: unset env is permissive (unchanged behaviour)", () => {
  withEnv(undefined, () => assert.equal(legacySessionsCutoffPassed(), false));
});

test("legacy session cutoff: a future cutoff still allows sid-less tokens (grace period)", () => {
  withEnv("2999-01-01T00:00:00Z", () => assert.equal(legacySessionsCutoffPassed(Date.parse("2026-08-23T00:00:00Z")), false));
});

test("legacy session cutoff: once now passes the cutoff, sid-less tokens are refused", () => {
  withEnv("2026-01-01T00:00:00Z", () => assert.equal(legacySessionsCutoffPassed(Date.parse("2026-08-23T00:00:00Z")), true));
});

test("legacy session cutoff: a malformed cutoff is ignored (fails permissive, never crashes)", () => {
  withEnv("not-a-date", () => assert.equal(legacySessionsCutoffPassed(), false));
});
