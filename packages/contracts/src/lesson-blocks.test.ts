import { describe, expect, it } from "vitest";
import { createLessonBlockRequestSchema, lessonBlockTypeSchema } from "./lesson-blocks";

describe("createLessonBlockRequestSchema", () => {
  it("accepts a valid payload for every one of the 19 block types", () => {
    const validPayloads: Record<string, unknown> = {
      orientation: { outcome: "State your goals", prerequisiteCheck: "" },
      concept: { explanation: "Contribution margin is revenue minus variable cost." },
      why: { explanation: "This determines how much each sale actually contributes." },
      story: { narrative: "A founder raised prices and revenue grew despite fewer sales." },
      metaphor: {
        sourceDomain: "a leaky bucket",
        targetConcept: "customer churn",
        mappingPairs: [{ source: "water leaking out", target: "customers cancelling" }],
        limitations: "Buckets don't refill themselves; businesses can win customers back.",
      },
      figure: {
        primitiveType: "funnel",
        dataSummary: "100 leads -> 20 trials -> 5 customers",
        accessibilityDescription: "A funnel narrowing from 100 leads to 5 customers.",
      },
      "worked-example": {
        scenario: "Selling a $100 product with $40 variable cost",
        inputs: { price: 100, variableCost: 40 },
        result: "$60 contribution margin per unit",
      },
      counterexample: {
        scenario: "Pricing below variable cost to win market share",
        whyItFails: "Every sale loses money regardless of volume.",
      },
      calculation: {
        formula: "margin = price - variableCost",
        inputs: { price: 100, variableCost: 40 },
        result: "60",
      },
      reflection: { prompt: "How confident are you in your current pricing?" },
      "knowledge-check": {
        question: "Which of these increases contribution margin?",
        options: ["Raising price", "Raising variable cost"],
        correctOptionIndex: 0,
      },
      practice: { instructions: "Calculate your own contribution margin." },
      build: {
        instructions: "Fill in your pricing model with real numbers.",
        targetAsset: "pricing-model",
      },
      implementation: { action: "Update your price sheet", deadlineDays: 7 },
      "coach-prompt": { question: "What's stopping you from raising prices?" },
      evidence: { instructions: "Attach your latest pricing sheet as evidence." },
      review: { reviewPrompt: "Did the price change hold up after 30 days?" },
      celebration: { message: "You just built your first pricing model!" },
      resource: { title: "Pricing 101", url: "https://example.com/pricing-101" },
    };

    for (const blockType of lessonBlockTypeSchema.options) {
      const result = createLessonBlockRequestSchema.safeParse({
        blockType,
        orderIndex: 1,
        payload: validPayloads[blockType],
      });
      expect(result.success, `${blockType} should validate: ${JSON.stringify(result)}`).toBe(true);
    }
  });

  it("rejects a payload missing a required field for its block type", () => {
    const result = createLessonBlockRequestSchema.safeParse({
      blockType: "knowledge-check",
      payload: { question: "Missing options and correctOptionIndex" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a payload shaped for the wrong block type", () => {
    const result = createLessonBlockRequestSchema.safeParse({
      blockType: "concept",
      // This is a valid knowledge-check payload, not a valid concept payload.
      payload: { question: "x", options: ["a", "b"], correctOptionIndex: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown block type", () => {
    const result = createLessonBlockRequestSchema.safeParse({
      blockType: "not-a-real-block-type",
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("defaults orderIndex to 0 when omitted", () => {
    const result = createLessonBlockRequestSchema.parse({
      blockType: "celebration",
      payload: { message: "Nice work!" },
    });
    expect(result.orderIndex).toBe(0);
  });
});
