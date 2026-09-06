import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createSegment, listSegments, getSegment, deleteSegment } from "../lib/segments/store";
import { listDeletedRows, restoreRow, purgeRow, purgeExpiredRows } from "../lib/soft-delete";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS = uid("sd-ws");
const EMPTY = { combinator: "and" as const, rules: [] };

after(async () => {
  await pgPool().query("DELETE FROM segments WHERE workspace_id = $1", [WS]);
});

test("segment delete soft-deletes into the bin; list + get see only live rows", async () => {
  const s = await createSegment(WS, { name: "VIPs", rules: EMPTY });
  assert.equal((await listSegments(WS)).length, 1);

  assert.equal(await deleteSegment(WS, s.id), true);
  assert.equal((await listSegments(WS)).length, 0, "binned segment leaves the list");
  assert.equal(await getSegment(WS, s.id), null, "binned segment is not loadable as live");

  const bin = await listDeletedRows("segments", WS);
  assert.equal(bin.length, 1);
  assert.equal(bin[0]!.name, "VIPs");
});

test("restore brings a binned segment back", async () => {
  const cur = (await listDeletedRows("segments", WS))[0];
  assert.ok(cur);
  assert.equal(await restoreRow("segments", WS, cur.id), true);
  assert.equal((await listSegments(WS)).length, 1);
  assert.equal((await listDeletedRows("segments", WS)).length, 0);
});

test("purgeRow only ever removes a binned segment, never a live one", async () => {
  const live = (await listSegments(WS))[0];
  assert.ok(live);
  assert.equal(await purgeRow("segments", WS, live.id), false, "live row must not be destroyed");
  await deleteSegment(WS, live.id);
  assert.equal(await purgeRow("segments", WS, live.id), true, "binned row is permanently removed");
  assert.equal((await listDeletedRows("segments", WS)).length, 0);
});

test("purgeExpiredRows removes only rows past the 30-day window", async () => {
  const s = await createSegment(WS, { name: "Old", rules: EMPTY });
  await deleteSegment(WS, s.id);
  await pgPool().query("UPDATE segments SET deleted_at = now() - interval '40 days' WHERE workspace_id = $1 AND id = $2", [WS, s.id]);

  const purged = await purgeExpiredRows();
  assert.ok(purged >= 1);

  const rows = await pgPool().query("SELECT id FROM segments WHERE workspace_id = $1 AND id = $2", [WS, s.id]);
  assert.equal(rows.rowCount, 0, "expired bin entry is gone");
});
