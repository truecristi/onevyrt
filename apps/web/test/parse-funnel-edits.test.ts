import test from "node:test";
import assert from "node:assert/strict";
import { parseFunnelEdits } from "../lib/studio/parse-funnel-edits";

test("parses a mixed batch against existing ids", () => {
  const raw = JSON.stringify({
    edits: [
      { op: "add_node", id: "n9", kind: "offer", label: "Order bump" },
      { op: "add_edge", source: "n1", target: "n9" },
      { op: "update_node", id: "n2", label: "New headline" },
      { op: "delete_node", id: "n3" },
    ],
  });
  const r = parseFunnelEdits(raw, ["n1", "n2", "n3"]);
  assert.ok(r);
  assert.equal(r!.ops.length, 4);
  assert.equal(r!.skipped, 0);
  assert.deepEqual(r!.ops[0], { op: "add_node", id: "n9", kind: "offer", label: "Order bump" });
});

test("accepts an edge that forward-references a node added later in the batch", () => {
  const raw = JSON.stringify({
    edits: [
      { op: "add_edge", source: "n1", target: "new1" },
      { op: "add_node", id: "new1", kind: "step", label: "Upsell" },
    ],
  });
  const r = parseFunnelEdits(raw, ["n1"]);
  assert.ok(r);
  assert.equal(r!.ops.length, 2, "the forward edge validates because new1 is added");
});

test("drops ops that reference unknown nodes, counting them as skipped", () => {
  const raw = JSON.stringify({
    edits: [
      { op: "update_node", id: "ghost", label: "x" },       // unknown id
      { op: "add_edge", source: "n1", target: "ghost" },     // unknown target
      { op: "delete_node", id: "n1" },                        // ok
    ],
  });
  const r = parseFunnelEdits(raw, ["n1"]);
  assert.ok(r);
  assert.equal(r!.ops.length, 1);
  assert.equal(r!.ops[0]!.op, "delete_node");
  assert.equal(r!.skipped, 2);
});

test("rejects invalid kinds, self-loops, blank labels", () => {
  const raw = JSON.stringify({
    edits: [
      { op: "add_node", id: "a", kind: "wormhole", label: "bad kind" },
      { op: "add_node", id: "b", kind: "step", label: "" },
      { op: "add_node", id: "c", kind: "step", label: "ok" },
      { op: "add_edge", source: "c", target: "c" }, // self loop
    ],
  });
  const r = parseFunnelEdits(raw, []);
  assert.ok(r);
  assert.equal(r!.ops.length, 1, "only node c survives");
  assert.equal(r!.ops[0]!.op, "add_node");
});

test("accepts `ops` as an alias and tolerates prose/fences around the JSON", () => {
  const raw = 'Sure! Here is the change:\n```json\n{ "ops": [ { "op": "delete_node", "id": "n1" } ] }\n```\nDone.';
  const r = parseFunnelEdits(raw, ["n1"]);
  assert.ok(r);
  assert.equal(r!.ops[0]!.op, "delete_node");
});

test("caps the number of ops and reports the overflow as skipped", () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ op: "add_node", id: `x${i}`, kind: "step", label: `L${i}` }));
  const r = parseFunnelEdits(JSON.stringify({ edits: many }), []);
  assert.ok(r);
  assert.equal(r!.ops.length, 40);
  assert.equal(r!.skipped, 10);
});

test("returns null for junk or an empty/invalid batch", () => {
  assert.equal(parseFunnelEdits("not json", []), null);
  assert.equal(parseFunnelEdits(JSON.stringify({ edits: [] }), []), null);
  assert.equal(parseFunnelEdits(JSON.stringify({ nope: 1 }), []), null);
});
