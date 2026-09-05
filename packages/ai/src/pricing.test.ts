import { describe, expect, it } from "vitest";
import { estimateCostMicros } from "./pricing";

describe("estimateCostMicros", () => {
  it("computes an exact integer micro-dollar cost for a known model", () => {
    // claude-sonnet-5: 2 micros/input token, 10 micros/output token.
    expect(estimateCostMicros("claude-sonnet-5", 1000, 500)).toBe(1000 * 2 + 500 * 10);
  });

  it("returns 0 for a zero-token call on a known model, never a fabricated positive number", () => {
    expect(estimateCostMicros("claude-sonnet-5", 0, 0)).toBe(0);
  });

  it("returns null for an unknown model rather than guessing", () => {
    expect(estimateCostMicros("deterministic", 100, 100)).toBeNull();
    expect(estimateCostMicros("some-future-model", 100, 100)).toBeNull();
  });

  it("prices each known model independently", () => {
    const sonnet = estimateCostMicros("claude-sonnet-5", 1_000_000, 0);
    const opus = estimateCostMicros("claude-opus-5", 1_000_000, 0);
    const haiku = estimateCostMicros("claude-haiku-4-5-20251001", 1_000_000, 0);
    expect(sonnet).toBe(2_000_000);
    expect(opus).toBe(5_000_000);
    expect(haiku).toBe(1_000_000);
  });
});
