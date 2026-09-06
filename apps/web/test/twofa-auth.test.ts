import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import * as twofa from "../lib/twofa";
import { uid, purgeUsersByEmailPrefix } from "./helpers/pg";

const PREFIX = uid("2fa-test");
const email = (n: string) => `${PREFIX}+${n}@example.com`;

after(() => purgeUsersByEmailPrefix(PREFIX));

test("is2faEnabled: false for a brand-new account", async () => {
  const user = await auth.registerUser(email("1"), "correct-horse-1");
  assert.equal(await auth.is2faEnabled(user.id), false);
});

test("start2faSetup: rejects the wrong password, and doesn't enable anything on its own", async () => {
  const user = await auth.registerUser(email("2"), "correct-horse-1");
  await assert.rejects(() => auth.start2faSetup(user.id, "wrong-password"), /incorrect/i);
  const { secret } = await auth.start2faSetup(user.id, "correct-horse-1");
  assert.ok(secret);
  assert.equal(await auth.is2faEnabled(user.id), false, "setup alone must not enable 2FA");
});

test("confirm2fa: rejects a wrong code, accepts the right one and enables 2FA with backup codes", async () => {
  const user = await auth.registerUser(email("3"), "correct-horse-1");
  const { secret } = await auth.start2faSetup(user.id, "correct-horse-1");

  await assert.rejects(() => auth.confirm2fa(user.id, "000000"), /doesn't match/i);
  assert.equal(await auth.is2faEnabled(user.id), false);

  const code = twofa.currentTotpCode(secret);
  const backupCodes = await auth.confirm2fa(user.id, code);
  assert.equal(await auth.is2faEnabled(user.id), true);
  assert.equal(backupCodes.length, 8);
  assert.equal(new Set(backupCodes).size, 8);
});

test("login flow: a 2FA account gets a pending token instead of a session, then verify2faCode completes it", async () => {
  const user = await auth.registerUser(email("4"), "correct-horse-1");
  const { secret } = await auth.start2faSetup(user.id, "correct-horse-1");
  await auth.confirm2fa(user.id, twofa.currentTotpCode(secret));

  const pendingToken = await auth.createPending2faLogin(user.id);
  // A wrong code must NOT burn the pending token — one typo shouldn't force
  // the whole login over from the password step.
  const wrong = await auth.verifyPending2faLogin(pendingToken, "000000");
  assert.deepEqual(wrong, { error: "Incorrect code." });

  const right = await auth.verifyPending2faLogin(pendingToken, twofa.currentTotpCode(secret));
  assert.deepEqual(right, { userId: user.id });

  // But it IS single-use once a code actually succeeds.
  const reused = await auth.verifyPending2faLogin(pendingToken, twofa.currentTotpCode(secret));
  assert.deepEqual(reused, { error: "This login attempt has expired. Sign in again." });
});

test("verifyPending2faLogin: invalidates the token after too many wrong attempts", async () => {
  const user = await auth.registerUser(email("4b"), "correct-horse-1");
  const { secret } = await auth.start2faSetup(user.id, "correct-horse-1");
  await auth.confirm2fa(user.id, twofa.currentTotpCode(secret));

  const pendingToken = await auth.createPending2faLogin(user.id);
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(await auth.verifyPending2faLogin(pendingToken, "000000"), { error: "Incorrect code." });
  }
  // 5th wrong attempt exhausts it, even though the code is still wrong.
  assert.deepEqual(await auth.verifyPending2faLogin(pendingToken, "000000"), { error: "Too many incorrect attempts. Sign in again." });
  // And now even the RIGHT code no longer works — the token is gone.
  assert.deepEqual(await auth.verifyPending2faLogin(pendingToken, twofa.currentTotpCode(secret)), { error: "This login attempt has expired. Sign in again." });
});

test("verify2faCode: accepts a backup code exactly once, then rejects it on reuse", async () => {
  const user = await auth.registerUser(email("5"), "correct-horse-1");
  const { secret } = await auth.start2faSetup(user.id, "correct-horse-1");
  const backupCodes: string[] = await auth.confirm2fa(user.id, twofa.currentTotpCode(secret));

  assert.equal(await auth.verify2faCode(user.id, backupCodes[0]!), true);
  assert.equal(await auth.verify2faCode(user.id, backupCodes[0]!), false, "backup codes are single-use");
  // The others are still good.
  assert.equal(await auth.verify2faCode(user.id, backupCodes[1]!), true);
});

test("disable2fa: requires the current password, and turns is2faEnabled back off", async () => {
  const user = await auth.registerUser(email("6"), "correct-horse-1");
  const { secret } = await auth.start2faSetup(user.id, "correct-horse-1");
  await auth.confirm2fa(user.id, twofa.currentTotpCode(secret));
  assert.equal(await auth.is2faEnabled(user.id), true);

  await assert.rejects(() => auth.disable2fa(user.id, "wrong-password"), /incorrect/i);
  await auth.disable2fa(user.id, "correct-horse-1");
  assert.equal(await auth.is2faEnabled(user.id), false);
  // Old code no longer works after disabling.
  assert.equal(await auth.verify2faCode(user.id, twofa.currentTotpCode(secret)), false);
});
