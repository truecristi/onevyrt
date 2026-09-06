import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import { uid, purgeUsersByEmailPrefix } from "./helpers/pg";

const PREFIX = uid("authemail-test");
const email = (n: string) => `${PREFIX}+${n}@example.com`;

after(() => purgeUsersByEmailPrefix(PREFIX));

test("requestEmailChange: rejects the wrong current password", async () => {
  const user = await auth.registerUser(email("before"), "correct-horse-1");
  await assert.rejects(() => auth.requestEmailChange(user.id, "wrong-password", email("after")), /incorrect/i);
});

test("requestEmailChange: rejects an email already registered to someone else", async () => {
  const a = await auth.registerUser(email("a"), "correct-horse-1");
  await auth.registerUser(email("b"), "correct-horse-2");
  await assert.rejects(() => auth.requestEmailChange(a.id, "correct-horse-1", email("b")), /already registered/i);
});

test("requestEmailChange: rejects changing to your own email", async () => {
  const user = await auth.registerUser(email("self"), "correct-horse-1");
  await assert.rejects(() => auth.requestEmailChange(user.id, "correct-horse-1", email("self").toUpperCase()), /already your email/i);
});

test("email change does NOT take effect until the token is confirmed", async () => {
  const user = await auth.registerUser(email("pending"), "correct-horse-1");
  const { token } = await auth.requestEmailChange(user.id, "correct-horse-1", email("pending-new"));
  // Before confirming, login is still the old email.
  assert.ok(await auth.authenticate(email("pending"), "correct-horse-1"), "old email still works before confirm");
  assert.equal(await auth.authenticate(email("pending-new"), "correct-horse-1"), null, "new email not active yet");

  const updated = await auth.confirmEmailChange(token);
  assert.equal(updated.email, email("pending-new").toLowerCase());
  // After confirming, login moves to the new email and the old one stops working.
  assert.equal(await auth.authenticate(email("pending"), "correct-horse-1"), null);
  assert.equal((await auth.authenticate(email("pending-new"), "correct-horse-1"))?.id, user.id);
});

test("confirmEmailChange: rejects an invalid token", async () => {
  await assert.rejects(() => auth.confirmEmailChange("not-a-real-token"), /invalid or has expired/i);
});
