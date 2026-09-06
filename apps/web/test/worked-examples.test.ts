import test from "node:test";
import assert from "node:assert/strict";
import { WORKED_EXAMPLES, workedExample } from "../lib/studio/worked-examples";

test("every worked example is complete enough to render", () => {
  assert.ok(WORKED_EXAMPLES.length >= 5);
  const ids = new Set<string>();
  for (const w of WORKED_EXAMPLES) {
    assert.ok(w.id && !ids.has(w.id), `duplicate or missing id: ${w.id}`);
    ids.add(w.id);
    assert.ok(w.step, `${w.id} needs a step name`);
    assert.ok(w.thought.length > 40, `${w.id} thought is too thin`);
    assert.ok(w.inputs.length > 0, `${w.id} needs example inputs`);
    for (const f of w.inputs) assert.ok(f.label && f.value, `${w.id} has an empty input field`);
    assert.ok(w.output.length > 20, `${w.id} output is too thin`);
  }
});

test("every AI step across the app has a worked example", () => {
  for (const id of ["message", "offer", "golden", "outreach", "content", "sell-better",
                    "positioning", "objections", "funnel", "audiences", "break-even"]) {
    assert.ok(workedExample(id), `missing worked example for ${id}`);
  }
});

test("workedExample returns undefined for an unknown id", () => {
  assert.equal(workedExample("nope"), undefined);
});

test("the Message and Offer examples carry a structured prefill payload", () => {
  const msg = workedExample("message")!;
  const oneLiner = (msg.prefill?.oneLiner ?? {}) as Record<string, string>;
  assert.ok(oneLiner.problem && oneLiner.solution && oneLiner.result, "message prefill needs a full one-liner");
  assert.ok(typeof msg.prefill?.character === "string");

  const offer = workedExample("offer")!;
  assert.equal(offer.prefill?.name, "The Funnel Fix Sprint");
  assert.ok(Array.isArray(offer.prefill?.deliverables));
  assert.ok(Array.isArray(offer.prefill?.objections));
});
