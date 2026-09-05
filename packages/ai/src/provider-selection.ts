import { loadEnv } from "@onevyrt/contracts";
import type { Env } from "@onevyrt/contracts";
import { createAnthropicProvider } from "./providers/anthropic";
import { createDeterministicProvider } from "./providers/deterministic";
import type { AiProvider } from "./types";

/**
 * The model-routing half of ADR-0010: per the root README's "default to
 * the latest and most capable Claude models" guidance, this names the
 * latest Claude generation rather than pinning to whatever was current
 * when this file was written - a call site that genuinely needs an older
 * model overrides CompletionRequest.model explicitly instead of relying on
 * this default.
 */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";

/**
 * Picks the real Anthropic adapter when a key is configured, otherwise
 * falls back to the deterministic adapter - so a call site written against
 * this function works in every environment without an `if` on whether AI
 * is "enabled" scattered through the codebase. Feature/route code should
 * still exist regardless (nothing here decides *whether* to call the
 * gateway), just what actually answers when it does.
 *
 * Takes an optional Env so tests can pass one in directly rather than
 * mutating process.env - the same dependency-injection shape as
 * loadEnv(source) itself.
 */
export function selectDefaultProvider(env: Env = loadEnv()): AiProvider {
  if (env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      defaultModel: DEFAULT_ANTHROPIC_MODEL,
    });
  }
  return createDeterministicProvider();
}
