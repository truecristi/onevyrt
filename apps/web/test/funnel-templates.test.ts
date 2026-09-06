import test from "node:test";
import assert from "node:assert/strict";
import { FUNNEL_TEMPLATES, templateDoc } from "../lib/studio/funnel-templates";
import { validateFunnelDoc, compileFunnel } from "../lib/studio/funnel-builder";
import { scoreLead } from "@onevyrt/engine";

test("every template produces a valid, compilable funnel", () => {
  assert.ok(FUNNEL_TEMPLATES.length >= 4, "a useful library");
  const ids = new Set<string>();
  for (const t of FUNNEL_TEMPLATES) {
    assert.ok(!ids.has(t.id), `duplicate template id ${t.id}`);
    ids.add(t.id);
    assert.ok(t.name && t.description && t.icon, `${t.id} has name/description/icon`);
    const doc = templateDoc(t.id, `tmpl-${t.id}`)!;
    assert.equal(validateFunnelDoc(doc), null, `${t.id} validates`);
    // Compiles and scores: answering every top option should qualify.
    const cfg = compileFunnel(doc);
    const best: Record<string, string | string[]> = {};
    for (const q of doc.questions) {
      if (!q.options?.length) continue;
      const top = [...q.options].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0]!;
      best[q.id] = q.kind === "multi" ? [top.value] : top.value;
    }
    const r = scoreLead(best, cfg.rules);
    assert.equal(r.status, "qualified", `${t.id}: best answers qualify (scored ${r.score}/${cfg.rules.thresholds.qualified})`);
  }
});

test("templateDoc assigns the slug and returns null for unknown ids", () => {
  const doc = templateDoc("agency", "my-slug");
  assert.equal(doc?.slug, "my-slug");
  assert.equal(templateDoc("nope", "x"), null);
});

test("template docs are independent clones (editing one doesn't mutate the source)", () => {
  const a = templateDoc("coach", "a")!;
  a.questions[0]!.prompt = "MUTATED";
  const b = templateDoc("coach", "b")!;
  assert.notEqual(b.questions[0]!.prompt, "MUTATED", "each call is a fresh clone");
});
