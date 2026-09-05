/**
 * ADR-0010: the provider-neutral shapes every AiProvider adapter speaks -
 * no provider SDK type crosses this boundary. See packages/ai/src/index.ts
 * for the phase this belongs to and what it deliberately doesn't cover yet
 * (context assembly/redaction, proposed-action approval, cost/latency
 * persistence, safety checks - all separate, later Phase 6 slices).
 */

export interface CompletionMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  /** Which model to use - an explicit, per-call choice; the gateway never guesses this. */
  model: string;
  system?: string;
  messages: CompletionMessage[];
  maxTokens: number;
  temperature?: number;
}

export type StopReason = "end_turn" | "max_tokens" | "stop_sequence";

export interface CompletionUsage {
  inputTokens: number;
  outputTokens: number;
}

/** What an AiProvider adapter itself produces - latency is added by the gateway (runCompletion), not the adapter, since the adapter doesn't know when the caller started timing. */
export interface ProviderCompletionResult {
  text: string;
  stopReason: StopReason;
  usage: CompletionUsage;
  model: string;
  providerId: string;
}

/** What runCompletion returns - the adapter's result plus the latency the gateway measured around the call. */
export interface CompletionResult extends ProviderCompletionResult {
  latencyMs: number;
}

export interface AiProvider {
  readonly id: string;
  complete(request: CompletionRequest): Promise<ProviderCompletionResult>;
}

/** Thrown by a provider adapter when the underlying call fails - never a silent empty response. */
export class AiProviderError extends Error {
  constructor(providerId: string, message: string) {
    super(`[${providerId}] ${message}`);
    this.name = "AiProviderError";
  }
}
