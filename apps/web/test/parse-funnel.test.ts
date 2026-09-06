import test from "node:test";
import assert from "node:assert/strict";
import { parseFunnel } from "../lib/studio/parse-funnel";

test("parses a clean funnel JSON", () => {
  const f = parseFunnel(JSON.stringify({
    name: "Coaching funnel",
    nodes: [{ id: "a", kind: "traffic", label: "Facebook Ads" }, { id: "b", kind: "step", label: "Landing page" }, { id: "c", kind: "offer", label: "Book a call" }],
    edges: [["a", "b"], ["b", "c"]],
  }));
  assert.ok(f);
  assert.equal(f.name, "Coaching funnel");
  assert.equal(f.nodes.length, 3);
  assert.deepEqual(f.edges, [["a", "b"], ["b", "c"]]);
});

test("strips markdown fences and surrounding prose", () => {
  const f = parseFunnel('Sure! ```json\n{"name":"X","nodes":[{"id":"a","kind":"traffic","label":"SEO"},{"id":"b","kind":"offer","label":"Buy"}],"edges":[["a","b"]]}\n``` hope that helps');
  assert.ok(f);
  assert.equal(f.nodes.length, 2);
});

test("drops invalid node kinds and blank labels", () => {
  const f = parseFunnel(JSON.stringify({
    nodes: [{ id: "a", kind: "traffic", label: "Ads" }, { id: "b", kind: "bogus", label: "X" }, { id: "c", kind: "step", label: "  " }, { id: "d", kind: "offer", label: "Buy" }],
    edges: [],
  }));
  assert.ok(f);
  assert.deepEqual(f.nodes.map((n) => n.id), ["a", "d"]);
});

test("regenerates duplicate/missing ids and drops edges that reference them", () => {
  const f = parseFunnel(JSON.stringify({
    nodes: [{ id: "a", kind: "traffic", label: "Ads" }, { id: "a", kind: "step", label: "Page" }],
    edges: [["a", "a"]],
  }));
  assert.ok(f);
  assert.equal(new Set(f.nodes.map((n) => n.id)).size, 2, "ids made unique");
  // self-edge dropped, so nodes get auto-chained instead
  assert.equal(f.edges.length, 1);
  assert.notEqual(f.edges[0]![0], f.edges[0]![1]);
});

test("auto-chains nodes when no usable edges are given", () => {
  const f = parseFunnel(JSON.stringify({
    nodes: [{ id: "a", kind: "traffic", label: "Ads" }, { id: "b", kind: "step", label: "Page" }, { id: "c", kind: "offer", label: "Buy" }],
    edges: [["x", "y"]], // references non-existent nodes -> dropped
  }));
  assert.ok(f);
  assert.deepEqual(f.edges, [["a", "b"], ["b", "c"]]);
});

test("caps node count at 20", () => {
  const nodes = Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, kind: "step", label: `L${i}` }));
  const f = parseFunnel(JSON.stringify({ nodes, edges: [] }));
  assert.ok(f);
  assert.equal(f.nodes.length, 20);
});

test("returns null on garbage / no JSON / too few nodes", () => {
  assert.equal(parseFunnel("not json at all"), null);
  assert.equal(parseFunnel("{ broken"), null);
  assert.equal(parseFunnel(JSON.stringify({ nodes: [{ id: "a", kind: "traffic", label: "Only one" }] })), null);
});
