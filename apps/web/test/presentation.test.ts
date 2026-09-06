import test from "node:test";
import assert from "node:assert/strict";
import { PRESENTATION_ITEMS, PRESENTATION_GROUPS, itemsByGroup, scorePresentation, sanitizeCheckedIds } from "../lib/studio/presentation";

test("sanitizeCheckedIds keeps only known ids, deduped, drops junk", () => {
  const valid = PRESENTATION_ITEMS[0]!.id;
  const out = sanitizeCheckedIds([valid, valid, "not-a-real-id", 42, null, PRESENTATION_ITEMS[1]!.id]);
  assert.deepEqual(out, [valid, PRESENTATION_ITEMS[1]!.id]);
  assert.deepEqual(sanitizeCheckedIds("nope"), []);
  assert.deepEqual(sanitizeCheckedIds(undefined), []);
});

test("every item has a known group and ids are unique", () => {
  const ids = PRESENTATION_ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "ids unique");
  for (const i of PRESENTATION_ITEMS) assert.ok(PRESENTATION_GROUPS.includes(i.group), `${i.id} valid group`);
  for (const g of PRESENTATION_GROUPS) assert.ok(itemsByGroup(g).length >= 1, `${g} has items`);
});

test("scorePresentation: none / all / partial", () => {
  const total = PRESENTATION_ITEMS.length;
  assert.deepEqual(scorePresentation([]), { done: 0, total, score: 0 });
  const all = PRESENTATION_ITEMS.map((i) => i.id);
  assert.deepEqual(scorePresentation(all), { done: total, total, score: 100 });
  const half = all.slice(0, Math.floor(total / 2));
  const s = scorePresentation(half);
  assert.equal(s.done, half.length);
  assert.equal(s.score, Math.round((half.length / total) * 100));
});

test("scorePresentation accepts a Set and ignores unknown ids", () => {
  const s = scorePresentation(new Set(["hero", "proof", "not-a-real-item"]));
  assert.equal(s.done, 2);
  assert.equal(s.total, PRESENTATION_ITEMS.length);
});
