import test from "node:test";
import assert from "node:assert/strict";
import type { Node, Edge } from "@xyflow/react";
import { applyFunnelEdits } from "../lib/studio/apply-funnel-edits";
import type { EditOp } from "../lib/studio/parse-funnel-edits";

const mkNode = (id: string, label: string, x = 0, y = 0): Node =>
  ({ id, type: "gb", position: { x, y }, data: { kind: "step", label } } as unknown as Node);
const mkEdge = (s: string, t: string): Edge => ({ id: `e-${s}-${t}`, source: s, target: t });

test("add_node places new blocks to the right and never duplicates ids", () => {
  const nodes = [mkNode("n1", "Home", 100, 0)];
  const ops: EditOp[] = [
    { op: "add_node", id: "n2", kind: "offer", label: "Order bump" },
    { op: "add_node", id: "n1", kind: "step", label: "dup" }, // duplicate id → ignored
  ];
  const r = applyFunnelEdits(ops, nodes, []);
  assert.equal(r.nodes.length, 2);
  assert.equal(r.applied, 1);
  const added = r.nodes.find((n) => n.id === "n2")!;
  assert.ok(added.position.x > 100, "new node is right of the existing graph");
  assert.equal((added.data as { label: string }).label, "Order bump");
});

test("update_node changes the label, leaving others alone", () => {
  const nodes = [mkNode("n1", "Old"), mkNode("n2", "Keep")];
  const r = applyFunnelEdits([{ op: "update_node", id: "n1", label: "New" }], nodes, []);
  assert.equal((r.nodes.find((n) => n.id === "n1")!.data as { label: string }).label, "New");
  assert.equal((r.nodes.find((n) => n.id === "n2")!.data as { label: string }).label, "Keep");
});

test("delete_node removes the node and its connected edges", () => {
  const nodes = [mkNode("n1", "A"), mkNode("n2", "B"), mkNode("n3", "C")];
  const edges = [mkEdge("n1", "n2"), mkEdge("n2", "n3")];
  const r = applyFunnelEdits([{ op: "delete_node", id: "n2" }], nodes, edges);
  assert.deepEqual(r.nodes.map((n) => n.id), ["n1", "n3"]);
  assert.equal(r.edges.length, 0, "both edges touching n2 are gone");
});

test("add_edge only connects existing nodes and never duplicates", () => {
  const nodes = [mkNode("n1", "A"), mkNode("n2", "B")];
  const ops: EditOp[] = [
    { op: "add_edge", source: "n1", target: "n2" },
    { op: "add_edge", source: "n1", target: "n2" }, // dup → ignored
    { op: "add_edge", source: "n1", target: "ghost" }, // missing node → ignored
  ];
  const r = applyFunnelEdits(ops, nodes, []);
  assert.equal(r.edges.length, 1);
  assert.equal(r.applied, 1);
});

test("delete_edge removes the matching edge", () => {
  const r = applyFunnelEdits([{ op: "delete_edge", source: "n1", target: "n2" }], [mkNode("n1", "A"), mkNode("n2", "B")], [mkEdge("n1", "n2")]);
  assert.equal(r.edges.length, 0);
  assert.equal(r.applied, 1);
});

test("does not mutate the input arrays", () => {
  const nodes = [mkNode("n1", "A")];
  const edges: Edge[] = [];
  applyFunnelEdits([{ op: "add_node", id: "n2", kind: "step", label: "B" }], nodes, edges);
  assert.equal(nodes.length, 1, "input nodes untouched");
  assert.equal(edges.length, 0, "input edges untouched");
});
