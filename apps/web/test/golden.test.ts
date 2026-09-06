import test from "node:test";
import assert from "node:assert/strict";
import { PHI, INV_PHI, GOLDEN_PORTRAIT, goldenType, goldenSpace } from "../lib/design/golden";

test("PHI and its inverse are the golden ratio", () => {
  assert.ok(Math.abs(PHI - 1.6180339887) < 1e-9);
  assert.ok(Math.abs(INV_PHI - 0.6180339887) < 1e-9);
  assert.ok(Math.abs(PHI * INV_PHI - 1) < 1e-12, "φ · 1/φ = 1");
  assert.equal(GOLDEN_PORTRAIT, INV_PHI);
});

test("goldenType steps around the base", () => {
  assert.equal(goldenType(0, 15), 15);
  assert.ok(goldenType(1, 15) > 15 && goldenType(-1, 15) < 15);
  assert.ok(goldenType(1, 15) < goldenType(2, 15), "monotonic up");
});

test("goldenSpace steps by φ from the base", () => {
  assert.equal(goldenSpace(0, 8), 8);
  assert.equal(goldenSpace(1, 8), 13); // round(8·1.618) = 13
  assert.equal(goldenSpace(2, 8), 21); // round(13.09·1.618) via 8·φ² ≈ 20.9
});
