import { registerEvalSuite, type EvalAssertion, type EvalCase } from "../eval-registry";
import type { InterpretSketchOutput } from "../prompts/interpret-sketch";

/**
 * Golden evaluation suite for interpret_sketch@1 (spec §4.4's "never
 * inventing elements the description doesn't mention"). The mechanical
 * check available without a live model: every element a possibleMapping
 * refers to must actually be one of the observedElements - a mapping
 * that references something never observed is exactly the kind of
 * invented content the prompt instructs against.
 */

export const mappingsReferenceObservedElements: EvalAssertion<InterpretSketchOutput> = (output) => {
  const observedLabels = new Set(output.observedElements.map((e) => e.label));
  const invented = output.possibleMappings
    .map((m) => m.elementLabel)
    .filter((label) => !observedLabels.has(label));
  return invented.length === 0
    ? null
    : `possibleMappings reference element(s) never observed: ${invented.join(", ")}`;
};

const cases: EvalCase<InterpretSketchOutput>[] = [
  {
    name: "mappings only reference observed elements (two-box sketch)",
    variables: { description: "A box labeled Signup, with an arrow to a box labeled Purchase." },
    respond: () =>
      JSON.stringify({
        observedElements: [
          { label: "Signup", kind: "box" },
          { label: "Purchase", kind: "box" },
        ],
        ambiguities: [],
        proposedLabels: ["Signup", "Purchase"],
        possibleMappings: [
          { elementLabel: "Signup", suggestedStructuredType: "funnel step", confidence: "medium" },
          {
            elementLabel: "Purchase",
            suggestedStructuredType: "funnel step",
            confidence: "medium",
          },
        ],
      }),
    assertions: [mappingsReferenceObservedElements],
  },
  {
    name: "mappings only reference observed elements (three-box sketch)",
    variables: {
      description: "Three boxes: Signup, Onboarding, and Purchase, connected in order.",
    },
    respond: () =>
      JSON.stringify({
        observedElements: [
          { label: "Signup", kind: "box" },
          { label: "Onboarding", kind: "box" },
          { label: "Purchase", kind: "box" },
        ],
        ambiguities: [],
        proposedLabels: ["Signup", "Onboarding", "Purchase"],
        possibleMappings: [
          { elementLabel: "Signup", suggestedStructuredType: "funnel step", confidence: "medium" },
          { elementLabel: "Onboarding", suggestedStructuredType: "funnel step", confidence: "low" },
          {
            elementLabel: "Purchase",
            suggestedStructuredType: "funnel step",
            confidence: "medium",
          },
        ],
      }),
    assertions: [mappingsReferenceObservedElements],
  },
];

registerEvalSuite("interpret_sketch", 1, cases);
