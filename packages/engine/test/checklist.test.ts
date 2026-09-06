import test from "node:test";
import assert from "node:assert/strict";
import { summarizeChecklist, toggleChecklistItem, type ChecklistItem } from "../src/checklist.ts";

const base: ChecklistItem = { id: "c1", text: "Tracking installed", done: false, createdAt: "2026-01-01T00:00:00.000Z" };

test("summarizeChecklist: empty list is not ready", () => {
  const s = summarizeChecklist([]);
  assert.equal(s.total, 0);
  assert.equal(s.pct, 0);
  assert.equal(s.ready, false);
});

test("summarizeChecklist: counts done/remaining and computes pct", () => {
  const items: ChecklistItem[] = [
    { ...base, id: "a", done: true },
    { ...base, id: "b", done: true },
    { ...base, id: "c", done: false },
    { ...base, id: "d", done: false },
  ];
  const s = summarizeChecklist(items);
  assert.equal(s.total, 4);
  assert.equal(s.done, 2);
  assert.equal(s.remaining, 2);
  assert.equal(s.pct, 0.5);
  assert.equal(s.ready, false);
});

test("summarizeChecklist: ready only when all items are done", () => {
  const items: ChecklistItem[] = [{ ...base, done: true }, { ...base, id: "c2", done: true }];
  assert.equal(summarizeChecklist(items).ready, true);
});

test("toggleChecklistItem: marks done and stamps doneAt, no mutation", () => {
  const done = toggleChecklistItem(base, true, "2026-01-05T00:00:00.000Z");
  assert.equal(done.done, true);
  assert.equal(done.doneAt, "2026-01-05T00:00:00.000Z");
  assert.equal(base.done, false); // original untouched
});

test("toggleChecklistItem: unchecking clears doneAt", () => {
  const done = toggleChecklistItem(base, true);
  const undone = toggleChecklistItem(done, false);
  assert.equal(undone.done, false);
  assert.equal(undone.doneAt, undefined);
});
