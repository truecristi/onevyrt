import type { AiProvider, CompletionRequest, ProviderCompletionResult } from "../types";

/**
 * A fixed, no-network adapter - the "prove the pipeline without a live
 * dependency" case (same reasoning as ADR-0006's calculation engine
 * tests). This is what every test in this repository uses, and what any
 * environment with no ANTHROPIC_API_KEY configured falls back to (see
 * provider-selection.ts) - never a silent stand-in for a real answer in
 * production, only for wiring/tests where the point is exercising the
 * gateway, not getting a real model's output.
 */

export interface DeterministicProviderOptions {
  /** Called for each request to produce its text. Defaults to echoing the last user message, prefixed so it's obviously not a real model's output. */
  respond?: (request: CompletionRequest) => string;
}

/** Rough, non-billing word-count estimate - real usage always comes from a real provider's own response, never estimated for anything that matters. */
function estimateTokens(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

export function createDeterministicProvider(
  options: DeterministicProviderOptions = {},
): AiProvider {
  return {
    id: "deterministic",
    async complete(request: CompletionRequest): Promise<ProviderCompletionResult> {
      const lastUserMessage = [...request.messages].reverse().find((m) => m.role === "user");
      const text = options.respond
        ? options.respond(request)
        : `[deterministic] ${lastUserMessage?.content ?? ""}`;

      return {
        text,
        stopReason: "end_turn",
        usage: {
          inputTokens: request.messages.reduce((sum, m) => sum + estimateTokens(m.content), 0),
          outputTokens: estimateTokens(text),
        },
        model: request.model,
        providerId: "deterministic",
      };
    },
  };
}
