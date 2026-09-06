import test from "node:test";
import assert from "node:assert/strict";
import { benchmarkFor } from "../lib/studio/benchmarks";

test("benchmarkFor: flags a below-band opt-in rate", () => {
  const r = benchmarkFor("step", 0.04)!;
  assert.equal(r.band, "below");
  assert.match(r.message, /below/);
  assert.match(r.message, /opt-in/);
});

test("benchmarkFor: typical band sits inside the range", () => {
  assert.equal(benchmarkFor("step", 0.2)!.band, "typical");
  assert.equal(benchmarkFor("offer", 0.03)!.band, "typical");
});

test("benchmarkFor: above-band is flagged as strong-or-optimistic", () => {
  const r = benchmarkFor("offer", 0.5)!;
  assert.equal(r.band, "above");
  assert.match(r.message, /above/);
});

test("benchmarkFor: no benchmark for traffic or missing rate", () => {
  assert.equal(benchmarkFor("traffic", 0.2), null);
  assert.equal(benchmarkFor("step", undefined), null);
  assert.equal(benchmarkFor("step", Number.NaN), null);
});
