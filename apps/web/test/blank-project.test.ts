import test from "node:test";
import assert from "node:assert/strict";
import { isUntouchedStarter, matchUntouchedTemplate, type StarterNode } from "../lib/studio/blank-project";
import { defaultData, type RFNodeData } from "../lib/funnel-map";
import { TEMPLATES, buildTemplate } from "../lib/studio/templates";

const STARTER: StarterNode[] = [
  { id: "traffic", data: defaultData("traffic", "Facebook Ads") },
  { id: "landing", data: defaultData("step", "Landing Page") },
  { id: "sale", data: defaultData("offer", "Core Offer") },
];
const STARTER_EDGES = [{ source: "traffic", target: "landing" }, { source: "landing", target: "sale" }];

test("a brand-new project (freshInitial's exact starter) is untouched", () => {
  assert.equal(isUntouchedStarter(STARTER, STARTER_EDGES, false), true);
});

test("renaming a node doesn't count as touched — the NUMBERS are still fake", () => {
  const renamed = STARTER.map((n) => (n.id === "sale" ? { ...n, data: { ...n.data, label: "My real offer" } } : n));
  assert.equal(isUntouchedStarter(renamed, STARTER_EDGES, false), true);
});

test("changing the offer price marks it touched", () => {
  const edited = STARTER.map((n) => (n.id === "sale" ? { ...n, data: { ...n.data, price: 4900 } } : n));
  assert.equal(isUntouchedStarter(edited, STARTER_EDGES, false), false);
});

test("changing traffic visitors or cost marks it touched", () => {
  const v = STARTER.map((n) => (n.id === "traffic" ? { ...n, data: { ...n.data, visitors: 5000 } } : n));
  assert.equal(isUntouchedStarter(v, STARTER_EDGES, false), false);
  const c = STARTER.map((n) => (n.id === "traffic" ? { ...n, data: { ...n.data, costPerVisitor: 150 } } : n));
  assert.equal(isUntouchedStarter(c, STARTER_EDGES, false), false);
});

test("changing the landing pass rate marks it touched", () => {
  const edited = STARTER.map((n) => (n.id === "landing" ? { ...n, data: { ...n.data, passRate: 0.6 } } : n));
  assert.equal(isUntouchedStarter(edited, STARTER_EDGES, false), false);
});

test("adding a node marks it touched", () => {
  const withExtra = [...STARTER, { id: "upsell", data: defaultData("offer", "Upsell") }];
  assert.equal(isUntouchedStarter(withExtra, STARTER_EDGES, false), false);
});

test("removing a node marks it touched (no longer the 3-node starter)", () => {
  assert.equal(isUntouchedStarter(STARTER.slice(0, 2), STARTER_EDGES.slice(0, 1), false), false);
});

test("rewiring the edges marks it touched", () => {
  const rewired = [{ source: "traffic", target: "sale" }, { source: "landing", target: "sale" }];
  assert.equal(isUntouchedStarter(STARTER, rewired, false), false);
});

test("recording expenses marks it touched even with untouched nodes", () => {
  assert.equal(isUntouchedStarter(STARTER, STARTER_EDGES, true), false);
});

test("a template-built project (different node ids) is never mistaken for the blank starter", () => {
  const template: StarterNode[] = [
    { id: "t", data: defaultData("traffic", "Foot traffic") },
    { id: "burger", data: defaultData("offer", "$1 burger") },
  ];
  assert.equal(isUntouchedStarter(template, [{ source: "t", target: "burger" }], false), false);
});

// --- matchUntouchedTemplate ---

/** Turn a built template into the StarterNode/StarterEdge shape the matcher
 *  and the studio's load path both use. */
function asStarter(tpl: (typeof TEMPLATES)[number]): { nodes: StarterNode[]; edges: { source: string; target: string }[] } {
  const built = buildTemplate(tpl);
  return {
    nodes: built.nodes.map((n) => ({ id: n.id, data: n.data as RFNodeData })),
    edges: built.edges.map((e) => ({ source: e.source, target: e.target })),
  };
}

test("every built-in template is recognised as its own untouched example", () => {
  for (const tpl of TEMPLATES) {
    const { nodes, edges } = asStarter(tpl);
    assert.equal(matchUntouchedTemplate(nodes, edges, false, false), tpl.name, `template ${tpl.key} should match itself`);
  }
});

test("renaming a template node keeps the example match — the numbers are still the sample's", () => {
  const tpl = TEMPLATES[0]!;
  const { nodes, edges } = asStarter(tpl);
  const renamed = nodes.map((n, i) => (i === 0 ? { ...n, data: { ...n.data, label: "My own traffic source" } } : n));
  assert.equal(matchUntouchedTemplate(renamed, edges, false, false), tpl.name);
});

test("editing any template number un-matches it (now it's the founder's own plan)", () => {
  const tpl = TEMPLATES[0]!;
  const { nodes, edges } = asStarter(tpl);
  // bump the first numeric field on the traffic node
  const edited = nodes.map((n, i) => (i === 0 ? { ...n, data: { ...n.data, visitors: (n.data.visitors ?? 0) + 1 } } : n));
  assert.equal(matchUntouchedTemplate(edited, edges, false, false), null);
});

test("recording an actual or an expense un-matches a template", () => {
  const tpl = TEMPLATES[0]!;
  const { nodes, edges } = asStarter(tpl);
  assert.equal(matchUntouchedTemplate(nodes, edges, true, false), null);
  assert.equal(matchUntouchedTemplate(nodes, edges, false, true), null);
});

test("the blank 3-node starter is not mistaken for a template, and a template is not the starter", () => {
  assert.equal(matchUntouchedTemplate(STARTER, STARTER_EDGES, false, false), null);
  const { nodes, edges } = asStarter(TEMPLATES[0]!);
  assert.equal(isUntouchedStarter(nodes, edges, false), false);
});

test("a wholly custom funnel matches no template", () => {
  const custom: StarterNode[] = [
    { id: "x1", data: { ...defaultData("traffic", "X"), visitors: 137, costPerVisitor: 313 } },
    { id: "x2", data: { ...defaultData("offer", "Y"), price: 4242, conversionRate: 0.137 } },
  ];
  assert.equal(matchUntouchedTemplate(custom, [{ source: "x1", target: "x2" }], false, false), null);
});
