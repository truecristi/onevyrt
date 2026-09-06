import test, { after } from "node:test";
import assert from "node:assert/strict";
import { pgPool } from "../../lib/db";
import { uid, newId, nowIso, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix } from "../helpers/pg";
import {
  checkFreeAccessMode,
  enableFreeAccessMode,
  disableFreeAccessMode,
  bypassGatesIfFreeAccess,
  autoApproveIfFreeAccess,
  skipCoachNotificationsIfFreeAccess,
  clearFreeAccessCache,
} from "../../lib/free-access-mode";
import type { Enrollment, Submission } from "@onevyrt/engine";

const EMAIL_PREFIX = uid("free-access-e2e");
const WS_PREFIX = uid("free-access-e2e-ws");

after(async () => {
  await purgeUsersByEmailPrefix(EMAIL_PREFIX);
  await purgeWorkspacesByNamePrefix(WS_PREFIX);
});

// No console.log calls in this file, on purpose — every one of them (a
// decorative "✓ ..." line, redundant with the assert right above it) was
// removed after this file twice corrupted node:test's own reporter/IPC
// framing in CI (`not ok NNN - test/unit/free-access-e2e.test.ts` /
// "Unable to deserialize cloned data due to invalid or unsupported
// version" — a transport error, not a failed assertion). The first
// occurrence traced to a module-level banner racing the suite's first
// subtest; moving it into after() fixed that one instance but the same
// symptom recurred later, mid-subtest, elsewhere in this file. No other
// test file in this suite reproduces it despite some having comparable
// console.log volume, so the fix here is to stop being the outlier: drop
// the logging entirely rather than chase each individual timing trigger.
test("Free-Access Mode: End-to-End Flow", async (t) => {
  let testWorkspaceId: string;
  let testUserId: string;

  await t.test("setup: create test workspace and user", async () => {
    const pool = pgPool();
    const email = `${EMAIL_PREFIX}@example.com`;
    const workspaceName = `${WS_PREFIX}-main`;

    // Create user
    const { rows: [user] } = await pool.query<{ id: string; email: string }>(
      `INSERT INTO users (id, email, pass, created_at) VALUES ($1, $2, $3, $4) RETURNING id, email`,
      [newId(), email, "test-hash", nowIso()]
    );
    assert.ok(user, "User row returned");
    testUserId = user.id;
    assert.ok(testUserId, "User created");

    // Create workspace
    const { rows: [ws] } = await pool.query<{ id: string; name: string }>(
      `INSERT INTO workspaces (id, name, owner_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id, name`,
      [newId(), workspaceName, user.id, nowIso()]
    );
    assert.ok(ws, "Workspace row returned");
    testWorkspaceId = ws.id;
    assert.ok(testWorkspaceId, "Workspace created");

    // Add user to workspace — membership lives in workspaces.members (jsonb
    // array of {userId, role}), not a separate join table (see lib/workspaces.ts).
    await pool.query(
      `UPDATE workspaces SET members = members || $2::jsonb WHERE id = $1`,
      [ws.id, JSON.stringify([{ userId: user.id, role: "owner" }])]
    );
  });

  await t.test("verify free-access is disabled initially", async () => {
    const result = await checkFreeAccessMode(testWorkspaceId);
    assert.equal(result, null, "Free-access should be null initially");
  });

  await t.test("enable free-access mode for test workspace", async () => {
    // Set expiry 7 days from now
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const success = await enableFreeAccessMode(testWorkspaceId, futureDate);
    assert.ok(success, "enableFreeAccessMode should succeed");

    // Verify it was enabled
    const result = await checkFreeAccessMode(testWorkspaceId);
    assert.ok(result, "Free-access should be active");
    assert.equal(result, futureDate, "Expiry date should match");
  });

  await t.test("verify all lessons unlock when free-access is enabled", async () => {
    // Create mock enrollment with locked lessons
    const enrollment: Enrollment = {
      id: "test-enrollment",
      programmeId: "test-programme",
      workspaceId: testWorkspaceId,
      userId: testUserId,
      deliveryMode: "self_paced",
      startedAt: new Date().toISOString(),
      lessons: [
        {
          lessonId: "lesson-1",
          status: "available",
          submissions: [],
        },
        {
          lessonId: "lesson-2",
          status: "locked",
          submissions: [],
        },
        {
          lessonId: "lesson-3",
          status: "locked",
          submissions: [],
        },
        {
          lessonId: "lesson-4",
          status: "locked",
          submissions: [],
        },
      ],
    } as any;

    // Before: some lessons locked
    const lockedCount = enrollment.lessons.filter(l => l.status === "locked").length;
    assert.equal(lockedCount, 3, "Should have 3 locked lessons initially");
    assert.equal(enrollment.accessGranted, undefined, "accessGranted should be undefined");

    // Apply free-access bypass
    bypassGatesIfFreeAccess(enrollment, true);

    // After: all lessons ungated, access granted
    const stillLockedCount = enrollment.lessons.filter(l => (l as { gated?: boolean }).gated === true).length;
    assert.equal(stillLockedCount, 0, "All lessons should be ungated");
    assert.equal(enrollment.accessGranted, true, "accessGranted should be true");
  });

  await t.test("verify submission auto-approval in free-access mode", async () => {
    const submission: Submission = {
      id: "test-submission-1",
      submittedAt: new Date().toISOString(),
      evidence: "Test evidence for lesson submission",
      checklistChecked: ["item-1", "item-2"],
      reviewStatus: "pending",
    } as any;

    // Before: pending review
    assert.equal(submission.reviewStatus, "pending", "Should be pending initially");
    assert.equal(submission.reviewedAt, undefined, "reviewedAt should be undefined");
    assert.equal(submission.reviewedBy, undefined, "reviewedBy should be undefined");

    // Apply auto-approval
    autoApproveIfFreeAccess(submission, true);

    // After: auto-approved
    assert.equal(submission.reviewStatus, "approved", "Should be approved");
    assert.ok(submission.reviewedAt, "reviewedAt should be set");
    assert.equal(submission.reviewedBy, "auto (free-access)", "reviewedBy should show auto");
    assert.equal(submission.coachFeedback, undefined, "coachFeedback should be cleared");
  });

  await t.test("verify coach notifications are suppressed", async () => {
    // Clear cache to ensure fresh check
    clearFreeAccessCache(testWorkspaceId);

    // Test coach notification types are suppressed
    const coachNotifications = [
      "submission_pending_review",
      "learner_stuck",
      "learner_quiet",
      "cohort_session_reminder",
    ];

    for (const notificationType of coachNotifications) {
      const shouldSuppress = await skipCoachNotificationsIfFreeAccess(
        testWorkspaceId,
        notificationType
      );
      assert.ok(
        shouldSuppress,
        `${notificationType} should be suppressed in free-access mode`
      );
    }

    // Test non-coach notifications are NOT suppressed
    const nonCoachTypes = ["learner_progress", "lesson_available", "welcome"];
    for (const notificationType of nonCoachTypes) {
      const shouldSuppress = await skipCoachNotificationsIfFreeAccess(
        testWorkspaceId,
        notificationType
      );
      assert.equal(
        shouldSuppress,
        false,
        `${notificationType} should NOT be suppressed`
      );
    }
  });

  await t.test("verify gates re-enable after disabling free-access", async () => {
    // Verify free-access is still enabled
    const beforeDisable = await checkFreeAccessMode(testWorkspaceId);
    assert.ok(beforeDisable, "Free-access should be active before disable");

    // Disable free-access
    const success = await disableFreeAccessMode(testWorkspaceId);
    assert.ok(success, "disableFreeAccessMode should succeed");

    // Verify it was disabled
    const afterDisable = await checkFreeAccessMode(testWorkspaceId);
    assert.equal(afterDisable, null, "Free-access should be null after disable");

    // Test that gates are re-enabled (notification suppression stops)
    clearFreeAccessCache(testWorkspaceId);
    const shouldSuppress = await skipCoachNotificationsIfFreeAccess(
      testWorkspaceId,
      "submission_pending_review"
    );
    assert.equal(shouldSuppress, false, "Coach notifications should NOT be suppressed");
  });

  await t.test("verify enrollment shows locked gates after free-access disabled", async () => {
    // Create new enrollment with free-access disabled
    const enrollment: Enrollment = {
      id: "test-enrollment-2",
      programmeId: "test-programme",
      workspaceId: testWorkspaceId,
      userId: testUserId,
      deliveryMode: "self_paced",
      startedAt: new Date().toISOString(),
      lessons: [
        {
          lessonId: "lesson-1",
          status: "available",
          submissions: [],
        },
        {
          lessonId: "lesson-2",
          status: "locked",
          submissions: [],
        },
      ],
    } as any;

    // Apply free-access bypass with false (should not modify)
    bypassGatesIfFreeAccess(enrollment, false);

    // Gates should remain locked
    assert.equal((enrollment.lessons[1] as { gated?: boolean } | undefined)?.gated, undefined, "Gated property should not change");
    assert.equal(enrollment.accessGranted, undefined, "accessGranted should remain undefined");
  });

  await t.test("verify submission does NOT auto-approve when free-access disabled", async () => {
    const submission: Submission = {
      id: "test-submission-2",
      submittedAt: new Date().toISOString(),
      evidence: "Test evidence",
      checklistChecked: [],
      reviewStatus: "pending",
    } as any;

    // Apply auto-approval with false (should not modify)
    autoApproveIfFreeAccess(submission, false);

    // Should remain pending
    assert.equal(submission.reviewStatus, "pending", "Should remain pending");
    assert.equal(submission.reviewedAt, undefined, "reviewedAt should be undefined");
  });

  await t.test("verify free-access cache works correctly", async () => {
    // Re-enable free-access for cache test
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await enableFreeAccessMode(testWorkspaceId, futureDate);

    // First check (should query DB)
    const result1 = await checkFreeAccessMode(testWorkspaceId);
    assert.ok(result1, "First check should return value");

    // Second check (should use cache)
    const result2 = await checkFreeAccessMode(testWorkspaceId);
    assert.equal(result1, result2, "Cached result should be identical");

    // Clear cache
    clearFreeAccessCache(testWorkspaceId);

    // Third check (should query DB again)
    const result3 = await checkFreeAccessMode(testWorkspaceId);
    assert.equal(result1, result3, "Result after cache clear should be same");
  });
});
