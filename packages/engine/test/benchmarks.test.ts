import test from "node:test";
import assert from "node:assert/strict";
import { inferBenchmarkKey, compareToBenchmark, BENCHMARKS } from "../src/benchmarks.ts";

test("inferBenchmarkKey: offers default to checkout unless labeled as an upsell", () => {
  assert.equal(inferBenchmarkKey("Core Offer", "offer"), "checkout");
  assert.equal(inferBenchmarkKey("Order Bump", "offer"), "upsell");
  assert.equal(inferBenchmarkKey("One-Time Offer", "offer"), "upsell");
});

test("inferBenchmarkKey: steps are sniffed from label, falling back to landingPage", () => {
  assert.equal(inferBenchmarkKey("Opt-in Page", "step"), "optIn");
  assert.equal(inferBenchmarkKey("Squeeze Page", "step"), "optIn");
  assert.equal(inferBenchmarkKey("Application Form", "step"), "applicationForm");
  assert.equal(inferBenchmarkKey("Strategy Call Booking", "step"), "bookedCall");
  assert.equal(inferBenchmarkKey("VSL Page", "step"), "salesPage");
  assert.equal(inferBenchmarkKey("Live Webinar", "step"), "webinarShowUp");
  assert.equal(inferBenchmarkKey("Webinar Purchase Close", "step"), "webinarClose");
  assert.equal(inferBenchmarkKey("Random Landing", "step"), "landingPage");
});

test("compareToBenchmark: below/typical/above verdicts match the range boundaries", () => {
  const range = BENCHMARKS.optIn; // { low: 0.20, typical: 0.35, high: 0.50 }
  assert.equal(compareToBenchmark(0.05, "optIn").verdict, "below");
  assert.equal(compareToBenchmark(range.low, "optIn").verdict, "typical"); // boundary inclusive
  assert.equal(compareToBenchmark(0.35, "optIn").verdict, "typical");
  assert.equal(compareToBenchmark(range.high, "optIn").verdict, "typical"); // boundary inclusive
  assert.equal(compareToBenchmark(0.9, "optIn").verdict, "above");
});

test("compareToBenchmark: carries the label and range through for display", () => {
  const c = compareToBenchmark(0.03, "checkout");
  assert.equal(c.label, "Checkout / order form");
  assert.deepEqual(c.range, BENCHMARKS.checkout);
  assert.equal(c.value, 0.03);
});
