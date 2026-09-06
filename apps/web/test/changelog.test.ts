import test from "node:test";
import assert from "node:assert/strict";
import { CHANGELOG, latestChangeDate, type ChangeTag } from "../lib/changelog";

const TAGS: ChangeTag[] = ["new", "improved", "fixed"];

test("changelog: well-formed, non-empty, newest first", () => {
  assert.ok(CHANGELOG.length > 0);
  for (const e of CHANGELOG) {
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, `date ${e.date} is ISO`);
    assert.ok(e.title.trim().length > 0, "has a title");
    assert.ok(TAGS.includes(e.tag), `valid tag: ${e.tag}`);
    assert.ok(e.items.length > 0 && e.items.every((i) => i.trim().length > 0), "non-empty items");
  }
  // Entries are in non-increasing date order.
  for (let i = 1; i < CHANGELOG.length; i++) {
    assert.ok(CHANGELOG[i - 1]!.date >= CHANGELOG[i]!.date, "newest first");
  }
});

test("latestChangeDate returns the max date", () => {
  const max = CHANGELOG.reduce((m, e) => (e.date > m ? e.date : m), "");
  assert.equal(latestChangeDate(), max);
  assert.equal(latestChangeDate(), CHANGELOG[0]!.date, "== the first (newest) entry");
});
