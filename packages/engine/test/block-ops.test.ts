import test from "node:test";
import assert from "node:assert/strict";
import { findBlockOps, isBlockOpsStarted, type BlockOpsEntry } from "../src/block-ops.ts";

function entry(over: Partial<BlockOpsEntry>): BlockOpsEntry {
  return {
    id: "b1", linkedNodeId: "n1", checklist: [], kpis: [],
    approvalStatus: "not_required", integrationStatus: "planned",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

test("findBlockOps: returns the entry linked to a node, null when none exists", () => {
  const list = [entry({ id: "a", linkedNodeId: "n1" }), entry({ id: "b", linkedNodeId: "n2" })];
  assert.equal(findBlockOps(list, "n2")?.id, "b");
  assert.equal(findBlockOps(list, "n3"), null);
});

test("isBlockOpsStarted: a freshly created entry with only defaults is not started", () => {
  assert.equal(isBlockOpsStarted(entry({})), false);
});

test("isBlockOpsStarted: any single filled field counts as started", () => {
  assert.equal(isBlockOpsStarted(entry({ purpose: "Capture leads" })), true);
  assert.equal(isBlockOpsStarted(entry({ owner: "Jane" })), true);
  assert.equal(isBlockOpsStarted(entry({ checklist: [{ id: "c1", label: "Set up tracking", done: false }] })), true);
  assert.equal(isBlockOpsStarted(entry({ approvalStatus: "pending" })), true);
  assert.equal(isBlockOpsStarted(entry({ integrationStatus: "connected" })), true);
});

test("isBlockOpsStarted: whitespace-only text fields don't count as started", () => {
  assert.equal(isBlockOpsStarted(entry({ purpose: "   ", sop: "\n" })), false);
});
