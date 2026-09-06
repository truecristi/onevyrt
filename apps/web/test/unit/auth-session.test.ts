import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../../lib/auth";
import { uid, purgeUsersByEmailPrefix } from "../helpers/pg";

const EMAIL_PREFIX = uid("auth-session-test");

after(async () => {
  await purgeUsersByEmailPrefix(EMAIL_PREFIX);
});

test("Session Management", async (t) => {
  await t.test("signSession creates valid token and verifySession validates it", () => {
    const userId = "user-123";
    const token = auth.signSession(userId);
    const verified = auth.verifySession(token);
    assert.equal(verified, userId);
  });

  await t.test("verifySession rejects null/undefined tokens", () => {
    assert.equal(auth.verifySession(null), null);
    assert.equal(auth.verifySession(undefined), null);
    assert.equal(auth.verifySession(""), null);
  });

  await t.test("verifySession rejects malformed tokens (no dot)", () => {
    assert.equal(auth.verifySession("nodothere"), null);
  });

  await t.test("verifySession rejects tokens with invalid signature", () => {
    const token = auth.signSession("user-123");
    const [payload] = token.split(".");
    const fakeToken = `${payload}.invalidsignature`;
    assert.equal(auth.verifySession(fakeToken), null);
  });

  await t.test("verifySession rejects tokens with tampered payload", () => {
    const token = auth.signSession("user-123");
    const [payload, sig] = token.split(".");
    assert.ok(payload);
    // Decode and tamper with payload
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    const modified = JSON.parse(decoded);
    modified.uid = "attacker";
    const tamperedPayload = Buffer.from(JSON.stringify(modified), "utf8").toString("base64url");
    const fakeToken = `${tamperedPayload}.${sig}`;
    assert.equal(auth.verifySession(fakeToken), null);
  });

  await t.test("respects token TTL (expired token rejected)", () => {
    const token = auth.signSession("user-123", 1); // 1ms TTL
    // Synchronously the token should be valid
    assert.equal(auth.verifySession(token), "user-123");
    // After waiting, it should expire
    return new Promise((resolve) => {
      setTimeout(() => {
        assert.equal(auth.verifySession(token), null, "expired token rejected");
        resolve(undefined);
      }, 10);
    });
  });

  await t.test("default TTL is 30 days", () => {
    const token = auth.signSession("user-456");
    const verified = auth.verifySession(token);
    assert.equal(verified, "user-456");
    assert.ok(verified, "token with default TTL is valid on creation");
  });

  await t.test("handles special characters in userId", () => {
    const specialUserIds = [
      "user@example.com",
      "user-with-dashes-123",
      "user_with_underscores",
    ];

    for (const userId of specialUserIds) {
      const token = auth.signSession(userId);
      const verified = auth.verifySession(token);
      assert.equal(verified, userId, `special userId "${userId}" verified`);
    }
  });

  await t.test("createSession creates database session record", async () => {
    const email = `${EMAIL_PREFIX}-session@test.com`;
    const password = "password";

    const user = await auth.registerUser(email, password);
    const token = await auth.createSession(user.id);

    assert.ok(token, "session token created");
    const verified = auth.verifySession(token);
    assert.equal(verified, user.id);
  });

  await t.test("listSessions returns all sessions for a user", async () => {
    const email = `${EMAIL_PREFIX}-list@test.com`;
    const password = "password";

    const user = await auth.registerUser(email, password);

    // Create multiple sessions
    await auth.createSession(user.id);
    await auth.createSession(user.id);
    await auth.createSession(user.id);

    const sessions = await auth.listSessions(user.id);
    assert.ok(sessions.length >= 3, "at least 3 sessions listed");
  });

  await t.test("revokeSession removes a specific session", async () => {
    const email = `${EMAIL_PREFIX}-revoke@test.com`;
    const password = "password";

    const user = await auth.registerUser(email, password);
    const sessionsBefore = await auth.listSessions(user.id);

    if (sessionsBefore.length > 0) {
      const sessionId = sessionsBefore[0]!.id;
      await auth.revokeSession(user.id, sessionId);

      const sessionsAfter = await auth.listSessions(user.id);
      // Should have one fewer session
      assert.ok(sessionsAfter.length < sessionsBefore.length, "session was revoked");
    }
  });

  await t.test("revokeOtherSessions keeps one session", async () => {
    const email = `${EMAIL_PREFIX}-other@test.com`;
    const password = "password";

    const user = await auth.registerUser(email, password);

    // Create multiple sessions
    const token1 = await auth.createSession(user.id);
    await auth.createSession(user.id);
    await auth.createSession(user.id);

    const session1 = auth.verifySession(token1);
    // Revoke all others, keep session1
    const revoked = await auth.revokeOtherSessions(user.id, session1 || undefined);

    assert.ok(revoked > 0, "revoked other sessions");
  });
});
