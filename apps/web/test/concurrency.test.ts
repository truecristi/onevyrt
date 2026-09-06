import test from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import * as workspaces from "../lib/workspaces";
import * as tracking from "../lib/tracking";
import * as comments from "../lib/comments";
import * as revisions from "../lib/revisions";
import { uid, purgeUsersByEmailPrefix, purgeWorkspacesByNamePrefix, purgeTrackingKey, purgeCommentsAndRevisions } from "./helpers/pg";

// Directly reproduces "200 people log in at the same time": many logins
// firing createSession() concurrently for the same user, each doing its own
// read-sessions/append/write-sessions. Without the lock this races; with it,
// it must pass every time.
test("createSession: N concurrent logins for the same user all survive — none lost to a write race", async () => {
  const prefix = uid("concurrent-login");
  try {
    const user = await auth.registerUser(`${prefix}@example.com`, "correct-horse-battery");

    const CONCURRENT_LOGINS = 60;
    const tokens = await Promise.all(
      Array.from({ length: CONCURRENT_LOGINS }, () => auth.createSession(user.id, { userAgent: "test-agent" })),
    );
    assert.equal(tokens.length, CONCURRENT_LOGINS);

    const sessions = await auth.listSessions(user.id);
    assert.equal(sessions.length, CONCURRENT_LOGINS, `expected all ${CONCURRENT_LOGINS} concurrent logins to have a surviving session record, got ${sessions.length}`);

    for (const token of tokens) {
      const resolved = await auth.currentUser(`gb_session=${token}`);
      assert.ok(resolved, "a concurrently-issued session token failed to resolve — its record was lost");
      assert.equal(resolved.id, user.id);
    }
  } finally {
    await purgeUsersByEmailPrefix(prefix);
  }
});

// Same race, different angle: concurrent revocations must not lose each
// other's updates either.
test("revokeSession: concurrent revocations of different sessions don't clobber each other", async () => {
  const prefix = uid("concurrent-revoke");
  try {
    const user = await auth.registerUser(`${prefix}@example.com`, "correct-horse-battery");

    const SESSION_COUNT = 20;
    const tokens: string[] = await Promise.all(
      Array.from({ length: SESSION_COUNT }, () => auth.createSession(user.id, { userAgent: "test-agent" })),
    );
    const sessionIds = tokens.map((tok: string) => auth.sessionIdFromToken(tok) as string);

    await Promise.all(sessionIds.map((sid: string) => auth.revokeSession(user.id, sid)));

    const remaining = await auth.listSessions(user.id);
    assert.equal(remaining.length, 0, `expected all ${SESSION_COUNT} concurrently-revoked sessions to be gone, ${remaining.length} survived the race`);
  } finally {
    await purgeUsersByEmailPrefix(prefix);
  }
});

// users had the exact same read-whole-table/append/write-whole-table shape
// as sessions above — many signups landing close together must not clobber
// each other.
test("registerUser: N concurrent signups all survive — none lost to a write race", async () => {
  const prefix = uid("signup");
  try {
    const CONCURRENT_SIGNUPS = 60;
    const users = await Promise.all(
      Array.from({ length: CONCURRENT_SIGNUPS }, (_, i) => auth.registerUser(`${prefix}-${i}@example.com`, "correct-horse-battery")),
    );
    assert.equal(users.length, CONCURRENT_SIGNUPS);

    for (const u of users) {
      assert.ok(await auth.getUserById(u.id), `a concurrently-registered user was lost: ${u.email}`);
    }
  } finally {
    await purgeUsersByEmailPrefix(prefix);
  }
});

// workspaces has the same shape again — a race here would silently drop
// members added at the same time (e.g. bulk-inviting a team).
test("addMember: concurrently adding many different members to one workspace loses none of them", async () => {
  const prefix = uid("ws-concurrency");
  try {
    const owner = await auth.registerUser(`${prefix}-owner@example.com`, "correct-horse-battery");
    const ws = await workspaces.createWorkspace(owner.id, `${prefix} Business plan`);
    await workspaces.adminSetPlan(ws.id, "business");

    const MEMBER_COUNT = 40;
    const members = await Promise.all(
      Array.from({ length: MEMBER_COUNT }, (_, i) => auth.registerUser(`${prefix}-member-${i}@example.com`, "correct-horse-battery")),
    );
    await Promise.all(members.map((m: { id: string }) => workspaces.addMember(ws.id, owner.id, m.id, "editor")));

    const finalWs = await workspaces.getWorkspace(ws.id);
    const editorCount = finalWs!.members.filter((m: { role: string }) => m.role === "editor").length;
    assert.equal(editorCount, MEMBER_COUNT, `expected all ${MEMBER_COUNT} concurrently-added members to survive, got ${editorCount}`);
  } finally {
    await purgeWorkspacesByNamePrefix(prefix);
    await purgeUsersByEmailPrefix(prefix);
  }
});

// The tracking counter is the highest-traffic unlocked path there was — a
// public endpoint that can be hit many times a second by real site
// visitors, each doing read-counts/increment/write-counts on the same row.
test("recordEvent: concurrent visits to the same node don't lose increments to a write race", async () => {
  const prefix = uid("tracking-concurrency");
  let key: string | undefined;
  try {
    key = await tracking.ensureTrackingKey(`scope-${prefix}`, `project-${prefix}`);

    const CONCURRENT_VISITS = 80;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT_VISITS }, () => tracking.recordEvent(key!, "node-1", "visit")),
    );
    assert.ok(results.every(Boolean));

    const counts = await tracking.getEventCounts(key);
    assert.equal(counts["node-1"]?.visits, CONCURRENT_VISITS, `expected all ${CONCURRENT_VISITS} concurrent visits to be counted, got ${counts["node-1"]?.visits}`);
  } finally {
    if (key) await purgeTrackingKey(key);
  }
});

// comments (per project) has the same read-array/append/write-array shape —
// a race here would silently drop a teammate's comment whenever two people
// commented on the same project close together.
test("addComment: concurrent comments on the same project don't lose any of them", async () => {
  const prefix = uid("comments-concurrency");
  const scopeKey = `ws-${prefix}`, projectId = `proj-${prefix}`;
  try {
    const CONCURRENT_COMMENTS = 50;
    await Promise.all(
      Array.from({ length: CONCURRENT_COMMENTS }, (_, i) => comments.addComment(scopeKey, projectId, `user-${i}`, `user-${i}@example.com`, `comment ${i}`)),
    );

    const list = await comments.listComments(scopeKey, projectId);
    assert.equal(list.length, CONCURRENT_COMMENTS, `expected all ${CONCURRENT_COMMENTS} concurrent comments to survive, got ${list.length}`);
  } finally {
    await purgeCommentsAndRevisions(scopeKey, projectId);
  }
});

// The revisions index has the same shape again — concurrent saves (e.g. two
// tabs open on the same project) must not drop each other's snapshot entry.
test("saveRevision: concurrent saves on the same project don't lose any revision entries", async () => {
  const prefix = uid("revisions-concurrency");
  const scopeKey = `ws-${prefix}`, projectId = `proj-${prefix}`;
  try {
    const CONCURRENT_SAVES = 30;
    await Promise.all(
      Array.from({ length: CONCURRENT_SAVES }, (_, i) => revisions.saveRevision(scopeKey, projectId, `user-${i}`, `user-${i}@example.com`, `{"n":${i}}`)),
    );

    const list = await revisions.listRevisions(scopeKey, projectId);
    assert.equal(list.length, CONCURRENT_SAVES, `expected all ${CONCURRENT_SAVES} concurrent revisions to survive, got ${list.length}`);
  } finally {
    await purgeCommentsAndRevisions(scopeKey, projectId);
  }
});
