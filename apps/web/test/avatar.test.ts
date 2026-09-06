import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as auth from "../lib/auth";
import { uid, purgeUsersByEmailPrefix } from "./helpers/pg";

const PREFIX = uid("avatar-test");
const email = (n: string) => `${PREFIX}+${n}@example.com`;

after(() => purgeUsersByEmailPrefix(PREFIX));

const TINY_PNG_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

test("updateAvatar: rejects a non-image data URL", async () => {
  const user = await auth.registerUser(email("1"), "correct-horse-1");
  await assert.rejects(() => auth.updateAvatar(user.id, "not-a-data-url"), /image/i);
  await assert.rejects(() => auth.updateAvatar(user.id, "data:text/plain;base64,aGVsbG8="), /image/i);
});

test("updateAvatar: rejects an oversized data URL", async () => {
  const user = await auth.registerUser(email("2"), "correct-horse-1");
  const huge = "data:image/png;base64," + "A".repeat(300_001);
  await assert.rejects(() => auth.updateAvatar(user.id, huge), /too large/i);
});

test("updateAvatar: accepts a valid small image and it round-trips through getUserById", async () => {
  const user = await auth.registerUser(email("3"), "correct-horse-1");
  const updated = await auth.updateAvatar(user.id, TINY_PNG_DATA_URL);
  assert.equal(updated.avatarUrl, TINY_PNG_DATA_URL);

  const fetched = await auth.getUserById(user.id);
  assert.equal(fetched?.avatarUrl, TINY_PNG_DATA_URL);
});

test("removeAvatar: clears a previously set photo", async () => {
  const user = await auth.registerUser(email("4"), "correct-horse-1");
  await auth.updateAvatar(user.id, TINY_PNG_DATA_URL);
  await auth.removeAvatar(user.id);
  const fetched = await auth.getUserById(user.id);
  assert.equal(fetched?.avatarUrl, undefined);
});
