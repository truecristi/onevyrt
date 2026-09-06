import { z } from "zod";
import { registerPromptTemplate } from "../prompt-registry";

/**
 * Seed prompt template proving the registry works end to end - spec
 * §7.1's first listed AI function, "explain a calculation or warning in
 * plain language" (the eventual "Lesson explanations" README slice calls
 * through this, once that slice wires it to a real route). Variables are
 * plain strings so `render` never has to guess a caller's formatting -
 * the caller pre-formats whatever number/label it wants explained.
 */

export const explainCalculationOutputSchema = z.object({
  explanation: z.string().min(1),
  /** A short, non-jargon takeaway distinct from the fuller explanation - what a founder should actually do or watch for. */
  keyTakeaway: z.string().min(1),
});
export type ExplainCalculationOutput = z.infer<typeof explainCalculationOutputSchema>;

registerPromptTemplate({
  key: "explain_calculation",
  version: 1,
  defaultMaxTokens: 512,
  outputSchema: explainCalculationOutputSchema,
  render: (variables) => ({
    system:
      "You are a business-coaching assistant inside ONEVYRT. Explain the given " +
      "calculation or warning to a non-technical founder in plain, encouraging " +
      "language - never jargon, never a lecture. Respond with ONLY a JSON object " +
      'matching this shape: {"explanation": string, "keyTakeaway": string}. No ' +
      "markdown, no code fences, no text outside the JSON object.",
    user: [
      `Metric or warning: ${variables.label ?? "(unlabeled)"}`,
      `Value: ${variables.value ?? "(unknown)"}`,
      variables.context ? `Context: ${variables.context}` : undefined,
    ]
      .filter((line): line is string => line !== undefined)
      .join("\n"),
  }),
});
