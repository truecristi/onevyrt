import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../lib/workspaces";
import {
  getEmailPreferences,
  updateEmailPreferences,
  resetToDefaults,
  deleteEmailPreferences,
  isNotificationAllowed,
  getDefaultPreferences,
} from "../lib/email-preferences";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

/**
 * lib/email-preferences.ts had no dedicated test file at all before this —
 * a real gap, found while wiring isNotificationAllowed() into lib/jobs.ts's
 * scheduled notification jobs (Section 16 of the platform spec). Covers the
 * CRUD + the isNotificationAllowed() gate every notification-sending job now
 * calls before sending — the one thing that actually matters for this fix.
 */

const PREFIX = uid("email-prefs-test");
after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

test("getEmailPreferences: a fresh workspace gets all-enabled defaults, created on first read", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-fresh`);
  const prefs = await getEmailPreferences(ws.id);
  assert.equal(prefs.workspaceId, ws.id);
  assert.deepEqual(
    { reminderEmails: prefs.reminderEmails, weeklyDigest: prefs.weeklyDigest, inAppNotifications: prefs.inAppNotifications, decisionMoments: prefs.decisionMoments },
    getDefaultPreferences(),
  );
});

test("getEmailPreferences: a second read returns the SAME row, not a fresh duplicate", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-idempotent`);
  const first = await getEmailPreferences(ws.id);
  const second = await getEmailPreferences(ws.id);
  assert.equal(second.id, first.id, "re-reading must not silently create a second preferences row for the same workspace");
});

test("updateEmailPreferences: touching one field never wipes an untouched sibling", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-sibling`);
  await getEmailPreferences(ws.id); // establish the default row first
  const updated = await updateEmailPreferences(ws.id, { reminderEmails: false });
  assert.equal(updated.reminderEmails, false);
  assert.equal(updated.weeklyDigest, true, "an untouched sibling preference must survive the update");
  assert.equal(updated.inAppNotifications, true, "an untouched sibling preference must survive the update");

  const reread = await getEmailPreferences(ws.id);
  assert.equal(reread.reminderEmails, false);
  assert.equal(reread.weeklyDigest, true);
});

test("updateEmailPreferences: rejects an unknown field name", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-badfield`);
  await assert.rejects(() => updateEmailPreferences(ws.id, { notARealField: false } as never), /Invalid preference field/);
});

test("updateEmailPreferences: rejects a non-boolean value", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-badtype`);
  await assert.rejects(() => updateEmailPreferences(ws.id, { reminderEmails: "yes" as unknown as boolean }), /must be a boolean/);
});

test("resetToDefaults: restores every preference to true after they've been toggled off", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-reset`);
  await updateEmailPreferences(ws.id, { reminderEmails: false, weeklyDigest: false, inAppNotifications: false, decisionMoments: false });
  const reset = await resetToDefaults(ws.id);
  assert.deepEqual(
    { reminderEmails: reset.reminderEmails, weeklyDigest: reset.weeklyDigest, inAppNotifications: reset.inAppNotifications, decisionMoments: reset.decisionMoments },
    getDefaultPreferences(),
  );
});

test("isNotificationAllowed: reflects the stored per-type preference", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-gate`);
  await updateEmailPreferences(ws.id, { reminderEmails: false });
  assert.equal(await isNotificationAllowed(ws.id, "reminder"), false, "the toggled-off type must be blocked");
  assert.equal(await isNotificationAllowed(ws.id, "digest"), true, "an untouched type must remain allowed");
});

test("isNotificationAllowed: an unrecognized type fails open (allowed), never silently blocks an unknown case", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-unknown-type`);
  assert.equal(await isNotificationAllowed(ws.id, "not-a-real-type" as never), true);
});

test("deleteEmailPreferences (soft-delete): a subsequent read is treated as if no row exists — fresh defaults, not the deleted values", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-softdelete`);
  await updateEmailPreferences(ws.id, { reminderEmails: false });
  await deleteEmailPreferences(ws.id);
  const afterDelete = await getEmailPreferences(ws.id);
  assert.equal(afterDelete.reminderEmails, true, "a soft-deleted row must not leak its old (toggled-off) value into the fresh defaults");
});

test("deleteEmailPreferences then updateEmailPreferences directly (skipping a read first): revives the row instead of violating the workspace's unique constraint", async () => {
  // Regression test: the soft-deleted row still occupies UNIQUE(workspace_id),
  // so re-creating it (from EITHER createDefaultPreferences via getEmailPreferences,
  // covered above, OR updateEmailPreferences's own inline insert, covered here)
  // must revive it via ON CONFLICT, not attempt a plain INSERT that crashes.
  const ws = await createWorkspace("u1", `${PREFIX}-softdelete-update`);
  await updateEmailPreferences(ws.id, { weeklyDigest: false });
  await deleteEmailPreferences(ws.id);
  const revived = await updateEmailPreferences(ws.id, { reminderEmails: false });
  assert.equal(revived.reminderEmails, false, "the field just set must apply");
  assert.equal(revived.weeklyDigest, true, "reviving must reset to defaults, not resurrect the pre-delete value");
});
