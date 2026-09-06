import test, { after } from "node:test";
import assert from "node:assert/strict";
import { addComment, listComments, commentCounts, deleteComment } from "../lib/community/comments";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS_A = uid("cmt-ws");
const WS_B = uid("cmt-ws2");
const ART1 = uid("art");
const ART2 = uid("art");

after(async () => {
  await pgPool().query("DELETE FROM community_comments WHERE author_workspace_id = ANY($1)", [[WS_A, WS_B]]);
});

test("comments thread reads oldest-first", async () => {
  const a = await addComment(WS_A, "Alice", "template", ART1, "First — this converted great");
  const b = await addComment(WS_B, "Bob", "template", ART1, "  Second, swapped the CTA  ");
  assert.equal(a.authorName, "Alice");
  assert.equal(b.body, "Second, swapped the CTA", "trimmed");

  const thread = await listComments("template", ART1);
  assert.deepEqual(thread.map((c) => c.id), [a.id, b.id], "chronological");
});

test("an empty comment is rejected", async () => {
  await assert.rejects(() => addComment(WS_A, "Alice", "template", ART1, "   "), /empty/i);
});

test("counts are scoped by type + id and batched", async () => {
  await addComment(WS_A, "Alice", "creative", ART2, "Nice hook");
  // ART1 has 2 template comments; ART2 has 1 creative comment.
  const tc = await commentCounts("template", [ART1, ART2]);
  assert.equal(tc[ART1], 2);
  assert.equal(tc[ART2] ?? 0, 0, "a creative comment doesn't count under template");
  const cc = await commentCounts("creative", [ART2]);
  assert.equal(cc[ART2], 1);
  assert.deepEqual(await commentCounts("template", []), {}, "empty batch → empty map, no query");
});

test("delete is scoped to the author", async () => {
  const c = await addComment(WS_A, "Alice", "creative", ART2, "to be removed");
  assert.equal(await deleteComment(WS_B, c.id), false, "another workspace can't delete it");
  assert.equal(await deleteComment(WS_A, c.id), true, "the author deletes it");
  assert.equal((await listComments("creative", ART2)).some((x) => x.id === c.id), false, "gone");
});
