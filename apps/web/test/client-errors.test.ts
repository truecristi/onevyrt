import test, { after } from "node:test";
import assert from "node:assert/strict";
import { recordClientError, recentClientErrors } from "../lib/client-errors";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const PREFIX = uid("cerr-test");

after(async () => {
  await pgPool().query("DELETE FROM client_errors WHERE message LIKE $1", [`${PREFIX}%`]);
});

test("recordClientError persists and recentClientErrors returns it, newest first", async () => {
  await recordClientError({ message: `${PREFIX} first`, url: "https://x/1", digest: "d1", stack: "stack-1" });
  await recordClientError({ message: `${PREFIX} second`, url: "https://x/2" });

  const rows = (await recentClientErrors(200)).filter((e) => e.message.startsWith(PREFIX));
  assert.equal(rows.length, 2);
  const [r0, r1] = rows;
  assert.ok(r0);
  assert.ok(r1);
  // Most recent first.
  assert.equal(r0.message, `${PREFIX} second`);
  assert.equal(r1.message, `${PREFIX} first`);
  // Optional fields preserved / omitted.
  assert.equal(r1.url, "https://x/1");
  assert.equal(r1.digest, "d1");
  assert.equal(r1.stack, "stack-1");
  assert.equal(r0.digest, undefined);
});

test("recordClientError truncates an oversized message and stack", async () => {
  const longMsg = PREFIX + "m".repeat(2000);
  const longStack = "s".repeat(9000);
  await recordClientError({ message: longMsg, stack: longStack });

  const row = (await recentClientErrors(200)).find((e) => e.message.startsWith(PREFIX + "m"));
  assert.ok(row);
  assert.ok(row.message.length <= 1000, "message capped");
  assert.ok((row.stack ?? "").length <= 4000, "stack capped");
});
