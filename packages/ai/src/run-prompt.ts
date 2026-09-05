import { runCompletion } from "./gateway";
import type { AiProvider, CompletionResult } from "./types";
import type { PromptTemplate } from "./prompt-registry";

/**
 * Thrown when a model's response is either not valid JSON or doesn't match
 * the template's outputSchema - spec §7.2's "the server validates" half of
 * the safe operation protocol. This is a normal, expected failure mode
 * (models don't always follow instructions), never silently coerced or
 * partially accepted.
 */
export class PromptOutputValidationError extends Error {
  constructor(key: string, version: number, reason: string) {
    super(`Prompt ${key}@${version} returned output that failed validation: ${reason}`);
    this.name = "PromptOutputValidationError";
  }
}

export interface RunPromptOptions {
  /** Required, not defaulted here - ADR-0010's model routing is an explicit per-call choice, never guessed by the gateway. */
  model: string;
  maxTokens?: number;
  temperature?: number;
  /** Passed straight through to runCompletion's rate-limit check (rate-limit.ts) - typically `ai:${actorUserId}`. Omit only when there's no real actor to key by (internal tooling, tests). */
  rateLimitKey?: string;
}

export interface RunPromptResult<TOutput> {
  output: TOutput;
  completion: CompletionResult;
}

/**
 * Renders a template, runs it through the gateway, and validates the
 * result against the template's outputSchema before returning it - the
 * one path every AI-touching feature (coaching, lesson explanations,
 * artifact/task proposals) should call through rather than calling
 * runCompletion directly with a hand-built prompt.
 */
export async function runPrompt<TOutput>(
  provider: AiProvider,
  template: PromptTemplate<TOutput>,
  variables: Record<string, string>,
  options: RunPromptOptions,
): Promise<RunPromptResult<TOutput>> {
  const { system, user } = template.render(variables);

  const completion = await runCompletion(
    provider,
    {
      model: options.model,
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: options.maxTokens ?? template.defaultMaxTokens,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    },
    { ...(options.rateLimitKey !== undefined ? { rateLimitKey: options.rateLimitKey } : {}) },
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(completion.text);
  } catch {
    throw new PromptOutputValidationError(
      template.key,
      template.version,
      "response was not valid JSON",
    );
  }

  const result = template.outputSchema.safeParse(parsed);
  if (!result.success) {
    throw new PromptOutputValidationError(template.key, template.version, result.error.message);
  }

  return { output: result.data, completion };
}
