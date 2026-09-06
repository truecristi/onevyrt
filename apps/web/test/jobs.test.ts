import test, { after } from "node:test";
import assert from "node:assert/strict";
import { isoWeekBucket, lastActivity, dueJobKeys, markRun } from "../lib/jobs";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";
import type { Enrollment } from "@onevyrt/engine";

/**
 * cohortSessionReminders and staleProgrammeNudges themselves are
 * deliberately NOT exercised here: both scan the whole shared cohorts/
 * enrollments tables unconditionally (same "read it all" pattern as
 * lib/cohorts.ts) and, on a match, send a real email via lib/mailer.ts —
 * which this dev environment has real SMTP credentials configured for
 * (see .env.local). Running them against the same shared Postgres
 * instance these tests use would risk emailing real users over real
 * production data. Only the pure/scheduling pieces below are safe to
 * test without that risk — see billing-e2e.test.ts for the same
 * reasoning applied to a different real-side-effect boundary.
 */

test("isoWeekBucket: same calendar week maps to the same bucket", () => {
  const mon = new Date("2026-03-02T09:00:00Z");
  const wed = new Date("2026-03-04T23:00:00Z");
  assert.equal(isoWeekBucket(mon), isoWeekBucket(wed));
});

test("isoWeekBucket: adjacent weeks map to different buckets", () => {
  const week1 = new Date("2026-03-02T09:00:00Z");
  const week2 = new Date("2026-03-09T09:00:00Z");
  assert.notEqual(isoWeekBucket(week1), isoWeekBucket(week2));
});

function enrollment(overrides: Partial<Enrollment> = {}): Enrollment {
  return { id: "e1", programmeId: "p1", workspaceId: "ws1", userId: "u1", deliveryMode: "self_paced", startedAt: "2026-01-01T00:00:00.000Z", lessons: [], ...overrides };
}

test("lastActivity: falls back to the enrollment's own startedAt with no lesson activity", () => {
  const e = enrollment({ startedAt: "2026-01-05T00:00:00.000Z" });
  assert.equal(lastActivity(e), new Date("2026-01-05T00:00:00.000Z").getTime());
});

test("lastActivity: a later lesson startedAt wins over the enrollment's own startedAt", () => {
  const e = enrollment({
    startedAt: "2026-01-01T00:00:00.000Z",
    lessons: [{ lessonId: "l1", startedAt: "2026-02-01T00:00:00.000Z", submissions: [] }],
  });
  assert.equal(lastActivity(e), new Date("2026-02-01T00:00:00.000Z").getTime());
});

test("lastActivity: a submission's submittedAt counts as activity too", () => {
  const e = enrollment({
    startedAt: "2026-01-01T00:00:00.000Z",
    lessons: [{
      lessonId: "l1", submissions: [{ id: "s1", submittedAt: "2026-03-01T00:00:00.000Z", evidence: "x", checklistChecked: [], reviewStatus: "pending" }],
    }],
  });
  assert.equal(lastActivity(e), new Date("2026-03-01T00:00:00.000Z").getTime());
});

const PREFIX = uid("jobs-test");
after(async () => {
  await pgPool().query("DELETE FROM job_runs WHERE job_key LIKE $1", [`${PREFIX}%`]);
});

test("dueJobKeys: a job with no prior run is due", async () => {
  const key = `${PREFIX}-fresh`;
  const due = await dueJobKeys([key], new Map([[key, 24]]));
  assert.ok(due.has(key));
});

test("markRun then dueJobKeys: a job just run within its interval is not due again", async () => {
  const key = `${PREFIX}-justran`;
  await markRun(key);
  const due = await dueJobKeys([key], new Map([[key, 24]]));
  assert.ok(!due.has(key));
});

test("dueJobKeys: a job run long enough ago (beyond its interval) is due again", async () => {
  const key = `${PREFIX}-old`;
  await pgPool().query(
    "INSERT INTO job_runs (job_key, last_run_at) VALUES ($1, now() - interval '2 hours')",
    [key],
  );
  const due = await dueJobKeys([key], new Map([[key, 1]])); // 1-hour interval, ran 2 hours ago
  assert.ok(due.has(key));
});
