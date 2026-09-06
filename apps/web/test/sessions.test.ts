import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import { uid, purgeUsersByEmailPrefix } from "./helpers/pg";

const PREFIX = uid("sessions-test");
const email = (n: string) => `${PREFIX}+${n}@example.com`;

after(() => purgeUsersByEmailPrefix(PREFIX));

test("createSession: issues a token that currentUser resolves, and it shows up in listSessions", async () => {
  const user = await auth.registerUser(email("1"), "correct-horse-1");
  const token = await auth.createSession(user.id, { userAgent: "test-agent" });
  const resolved = await auth.currentUser(`gb_session=${token}`);
  assert.equal(resolved?.id, user.id);

  const sessions = await auth.listSessions(user.id);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]!.userAgent, "test-agent");
});

test("revokeSession: a revoked session's token stops resolving to a user", async () => {
  const user = await auth.registerUser(email("2"), "correct-horse-1");
  const token = await auth.createSession(user.id);
  const [sessionRecord] = await auth.listSessions(user.id);

  await auth.revokeSession(user.id, sessionRecord!.id);
  const resolved = await auth.currentUser(`gb_session=${token}`);
  assert.equal(resolved, null);
});

test("revokeSession: cannot revoke another user's session", async () => {
  const a = await auth.registerUser(email("3a"), "correct-horse-1");
  const b = await auth.registerUser(email("3b"), "correct-horse-2");
  await auth.createSession(a.id);
  const [aSession] = await auth.listSessions(a.id);

  await assert.rejects(() => auth.revokeSession(b.id, aSession!.id), /not found/i);
  // a's session is untouched
  const stillThere = await auth.listSessions(a.id);
  assert.equal(stillThere.length, 1);
});

test("revokeOtherSessions: keeps the excluded session alive, revokes the rest, and never touches another user's", async () => {
  const user = await auth.registerUser(email("4"), "correct-horse-1");
  const otherUser = await auth.registerUser(email("4b"), "correct-horse-2");
  const keepToken = await auth.createSession(user.id);
  await auth.createSession(user.id);
  await auth.createSession(user.id);
  await auth.createSession(otherUser.id);

  const keepId = auth.sessionIdFromToken(keepToken);
  const revokedCount = await auth.revokeOtherSessions(user.id, keepId ?? undefined);
  assert.equal(revokedCount, 2, "revokes the 2 sessions other than the kept one");

  const remaining = await auth.listSessions(user.id);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0]!.id, keepId);
  assert.ok(await auth.currentUser(`gb_session=${keepToken}`), "the kept session's token still resolves");

  const otherRemaining = await auth.listSessions(otherUser.id);
  assert.equal(otherRemaining.length, 1, "the other user's session is untouched");
});

test("listSessions: never returns another user's sessions", async () => {
  const a = await auth.registerUser(email("5a"), "correct-horse-1");
  const b = await auth.registerUser(email("5b"), "correct-horse-2");
  await auth.createSession(a.id);
  await auth.createSession(b.id);

  const aSessions = await auth.listSessions(a.id);
  assert.equal(aSessions.length, 1);
  const bSessions = await auth.listSessions(b.id);
  assert.equal(bSessions.length, 1);
});

test("setUserDisabled: disabling a user ends their sessions immediately, even unrevoked ones", async () => {
  const user = await auth.registerUser(email("6"), "correct-horse-1");
  const token = await auth.createSession(user.id);
  assert.ok(await auth.currentUser(`gb_session=${token}`));

  await auth.setUserDisabled(user.id, true);
  const resolved = await auth.currentUser(`gb_session=${token}`);
  assert.equal(resolved, null);
});
