import { logger } from "@onevyrt/observability";
import type { AiProvider, CompletionRequest, CompletionResult } from "./types";

/**
 * ADR-0010's gateway entry point: every call site goes through this, never
 * `provider.complete` directly, so latency measurement and logging happen
 * exactly once regardless of which adapter is behind it. Cost/latency
 * *persistence* (an audit-style record per call) is a separate, later
 * Phase 6 slice ("Cost and latency tracking") - this only measures and
 * logs, it does not yet write anywhere.
 */
export async function runCompletion(
  provider: AiProvider,
  request: CompletionRequest,
): Promise<CompletionResult> {
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
