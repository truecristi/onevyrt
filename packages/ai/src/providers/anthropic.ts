import { AiProviderError } from "../types";
import type { AiProvider, CompletionRequest, ProviderCompletionResult, StopReason } from "../types";

/**
 * ADR-0010's real adapter: calls the Claude Messages API directly over
 * `fetch` rather than adding an SDK dependency just for this one call
 * shape. Never constructed with a hardcoded key - callers read
 * ANTHROPIC_API_KEY via packages/contracts' env schema (see
 * provider-selection.ts), which is optional precisely so an environment
 * without one configured still builds and runs.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface AnthropicProviderConfig {
  apiKey: string;
  /** Used when a CompletionRequest doesn't specify one - callers should normally set request.model explicitly instead of relying on this. */
  defaultModel?: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  model: string;
  stop_reason?: string | null;
  content?: AnthropicContentBlock[];
  usage?: { input_tokens?: number; output_tokens?: number };
}

function mapStopReason(reason: string | null | undefined): StopReason {
  switch (reason) {
    case "max_tokens":
      return "max_tokens";
    case "stop_sequence":
      return "stop_sequence";
    default:
      return "end_turn";
  }
}

export function createAnthropicProvider(config: AnthropicProviderConfig): AiProvider {
  return {
    id: "anthropic",
    async complete(request: CompletionRequest): Promise<ProviderCompletionResult> {
      const model = request.model || config.defaultModel;
      if (!model) {
        throw new AiProviderError(
          "anthropic",
          "No model specified on the request or provider config",
        );
      }

      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": config.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          system: request.system,
          messages: request.messages,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new AiProviderError(
          "anthropic",
          `Request failed with status ${response.status}: ${body}`,
        );
      }

      const data = (await response.json()) as AnthropicMessageResponse;
      const text = (data.content ?? [])
        .filter((block) => block.type === "text" && typeof block.text === "string")
        .map((block) => block.text)
        .join("");

      return {
        text,
        stopReason: mapStopReason(data.stop_reason),
        usage: {
          inputTokens: data.usage?.input_tokens ?? 0,
          outputTokens: data.usage?.output_tokens ?? 0,
        },
        model: data.model,
        providerId: "anthropic",
      };
    },
  };
}
