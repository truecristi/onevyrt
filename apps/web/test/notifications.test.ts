import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as notifications from "../lib/notifications";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const PREFIX = uid("notif-test");
const userId = (n: string) => `${PREFIX}-user-${n}`;

after(async () => {
  await pgPool().query("DELETE FROM notifications WHERE user_id LIKE $1", [`${PREFIX}%`]);
});

test("createNotification: creates a row, listable and counted as unread", async () => {
  const uId = userId("1");
  const n = await notifications.createNotification({ userId: uId, type: "test", title: "Hi", body: "Body text" });
  assert.ok(n);
  assert.equal(n?.title, "Hi");
  const list = await notifications.listNotifications(uId);
  assert.equal(list.length, 1);
  assert.equal(await notifications.unreadCount(uId), 1);
});

test("createNotification: with a dedupeKey, a second call with the same key is a no-op", async () => {
  const uId = userId("2");
  const key = `dedupe-${PREFIX}-2`;
  const first = await notifications.createNotification({ userId: uId, type: "test", title: "A", body: "B", dedupeKey: key });
  const second = await notifications.createNotification({ userId: uId, type: "test", title: "A", body: "B", dedupeKey: key });
  assert.ok(first);
  assert.equal(second, null);
  const list = await notifications.listNotifications(uId);
  assert.equal(list.length, 1);
});

test("markRead: marks one notification read, drops unread count, never touches another user's", async () => {
  const a = userId("3a"), b = userId("3b");
  const n = await notifications.createNotification({ userId: a, type: "test", title: "A", body: "B" });
  await notifications.createNotification({ userId: b, type: "test", title: "C", body: "D" });
  await notifications.markRead(b, n!.id); // wrong user — no-op
  assert.equal(await notifications.unreadCount(a), 1);
  await notifications.markRead(a, n!.id);
  assert.equal(await notifications.unreadCount(a), 0);
  assert.equal(await notifications.unreadCount(b), 1);
});

test("markAllRead: clears every unread notification for that user only", async () => {
  const uId = userId("4");
  await notifications.createNotification({ userId: uId, type: "test", title: "A", body: "1" });
  await notifications.createNotification({ userId: uId, type: "test", title: "B", body: "2" });
  assert.equal(await notifications.unreadCount(uId), 2);
  await notifications.markAllRead(uId);
  assert.equal(await notifications.unreadCount(uId), 0);
});

test("listNotifications: most recent first", async () => {
  const uId = userId("5");
  const a = await notifications.createNotification({ userId: uId, type: "test", title: "first", body: "1" });
  await new Promise((r) => setTimeout(r, 5));
  const b = await notifications.createNotification({ userId: uId, type: "test", title: "second", body: "2" });
  const list = await notifications.listNotifications(uId);
  assert.equal(list[0]!.id, b!.id);
  assert.equal(list[1]!.id, a!.id);
});
