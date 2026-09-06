import test from "node:test";
import assert from "node:assert/strict";
import { serializeDoc, deserializeDoc } from "@onevyrt/engine";
import { TEMPLATES, buildTemplate } from "../lib/studio/templates";
import { toDoc, docToNodes, docToEdges } from "../lib/studio/funnel-doc";
import { matchUntouchedTemplate } from "../lib/studio/blank-project";
import type { RFNodeData } from "../lib/funnel-map";

/**
 * The library card marks a project as EXAMPLE data by re-matching its loaded
 * nodes/edges against the built-in templates. That match only holds if a
 * template survives the full save→load round-trip (toDoc → serializeDoc →
 * deserializeDoc → docToNodes) still structurally identical to buildTemplate().
 * If serialization dropped or transformed any simulation number, the card would
 * silently stop marking freshly-saved templates as examples. This guards that.
 */
test("every template still matches itself after a full save→load round-trip", () => {
  for (const tpl of TEMPLATES) {
    const built = buildTemplate(tpl);
    const doc = toDoc(tpl.name, built.nodes, built.edges, {}, [], "USD");
    const reloaded = deserializeDoc(serializeDoc(doc));
    const rfNodes = docToNodes(reloaded)
      .filter((n) => n.type !== "annot")
      .map((n) => ({ id: n.id, data: n.data as RFNodeData }));
    const rfEdges = docToEdges(reloaded).map((e) => ({ source: e.source, target: e.target }));

    const docHasActuals = !!reloaded.actuals && Object.keys(reloaded.actuals).length > 0;
    assert.equal(
      matchUntouchedTemplate(rfNodes, rfEdges, docHasActuals, !!reloaded.expenses),
      tpl.name,
      `template ${tpl.key} should still match itself after a round-trip`,
    );
  }
});

test("a round-tripped template with one edited number no longer matches", () => {
  const tpl = TEMPLATES[0];
  assert.ok(tpl);
  const built = buildTemplate(tpl);
  // edit the traffic node's visitors before saving
  const edited = built.nodes.map((n, i) =>
    i === 0 ? { ...n, data: { ...(n.data as RFNodeData), visitors: ((n.data as RFNodeData).visitors ?? 0) + 500 } } : n,
  );
  const doc = toDoc(tpl.name, edited, built.edges, {}, [], "USD");
  const reloaded = deserializeDoc(serializeDoc(doc));
  const rfNodes = docToNodes(reloaded)
    .filter((n) => n.type !== "annot")
    .map((n) => ({ id: n.id, data: n.data as RFNodeData }));
  const rfEdges = docToEdges(reloaded).map((e) => ({ source: e.source, target: e.target }));
  assert.equal(matchUntouchedTemplate(rfNodes, rfEdges, false, false), null);
});
