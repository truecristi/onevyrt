import { logger } from "@onevyrt/observability";
import { checkAiRateLimit } from "./rate-limit";
import type { AiProvider, CompletionRequest, CompletionResult } from "./types";

export interface RunCompletionOptions {
  /** When given, checked via checkAiRateLimit (rate-limit.ts) before the provider is ever called - a rate-limited request never reaches a paid API. Omitted only by internal/test call sites that don't have a real actor to key by. */
  rateLimitKey?: string;
}

/**
 * ADR-0010's gateway entry point: every call site goes through this, never
 * `provider.complete` directly, so latency measurement, logging and the
 * rate-limit safety check (README "AI coaching" -> "Safety checks", ninth
 * Phase 6 slice) happen exactly once regardless of which adapter is
 * behind it. Cost/latency *persistence* (an audit-style record per call)
 * is a separate, later Phase 6 slice ("Cost and latency tracking") - this
 * only measures and logs, it does not yet write anywhere.
 */
export async function runCompletion(
  provider: AiProvider,
  request: CompletionRequest,
  options: RunCompletionOptions = {},
): Promise<CompletionResult> {
  if (options.rateLimitKey !== undefined) {
    checkAiRateLimit(options.rateLimitKey);
  }

  const start = Date.now();
  try {
    const result = await provider.complete(request);
    const latencyMs = Date.now() - start;
    logger.info("ai completion", {
      providerId: provider.id,
      model: result.model,
      stopReason: result.stopReason,
      latencyMs,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    });
    return { ...result, latencyMs };
  } catch (error) {
    const latencyMs = Date.now() - start;
    logger.error("ai completion failed", {
      providerId: provider.id,
      model: request.model,
      latencyMs,
      error: (error as Error).message,
    });
    throw error;
  }
}
