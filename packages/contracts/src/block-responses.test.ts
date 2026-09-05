import { describe, expect, it } from "vitest";
import { submitBlockResponseRequestSchema } from "./block-responses";

describe("submitBlockResponseRequestSchema", () => {
  it("accepts a valid knowledge-check response", () => {
    const result = submitBlockResponseRequestSchema.safeParse({
      blockType: "knowledge-check",
      response: { selectedOptionIndex: 1 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid reflection response with and without a confidence rating", () => {
    expect(
      submitBlockResponseRequestSchema.safeParse({
        blockType: "reflection",
        response: { text: "I feel good about this" },
      }).success,
    ).toBe(true);
    expect(
      submitBlockResponseRequestSchema.safeParse({
        blockType: "reflection",
        response: { text: "I feel good about this", confidenceRating: 4 },
      }).success,
    ).toBe(true);
  });

  it("does not accept a client-supplied isCorrect on a knowledge-check response", () => {
    const result = submitBlockResponseRequestSchema.safeParse({
      blockType: "knowledge-check",
      response: { selectedOptionIndex: 0, isCorrect: true },
    });
    // Zod strips unknown keys by default rather than rejecting - either
    // way, isCorrect must not survive parsing, since it's computed
    // server-side (block-response-use-cases.ts), never trusted from the
    // client.
    expect(result.success).toBe(true);
    if (result.success && result.data.blockType === "knowledge-check") {
      expect("isCorrect" in result.data.response).toBe(false);
    }
  });

  it("rejects a reflection payload shaped for a knowledge-check", () => {
    const result = submitBlockResponseRequestSchema.safeParse({
      blockType: "reflection",
      response: { selectedOptionIndex: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown block type", () => {
    const result = submitBlockResponseRequestSchema.safeParse({
      blockType: "concept",
      response: {},
    });
    expect(result.success).toBe(false);
  });
});
