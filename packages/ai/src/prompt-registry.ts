import type { z } from "zod";

/**
 * PRD-AI-002 vertical slice: the prompt and schema registry (README
 * "AI coaching" -> "Prompt and schema registry", second slice of Phase 6;
 * spec §7.2's "safe operation protocol" - "the model returns JSON
 * conforming to a versioned Zod schema"). Same (key, version) in-code
 * Map-based registry shape as formula-registry.ts - a prompt template is
 * developer-authored config, not user-editable data, so it lives in code
 * with an explicit version rather than a database table (contrast with
 * formula_definitions, which *is* a table because that library is
 * authored/published through an admin workflow, not a code change).
 *
 * A registered version is immutable once shipped: a prompt whose wording
 * or output shape changes is a *new* version, never an edit in place -
 * the same "history" reasoning as formula-definitions' draft/publish
 * versioning, applied here at the code level instead of the database
 * level.
 */

export interface PromptTemplate<TOutput> {
  key: string;
  version: number;
  /** Renders this template's system/user messages from typed variables - never string-concatenates untrusted input directly into the system prompt. */
  render: (variables: Record<string, string>) => { system: string; user: string };
  /** What the model's JSON response must validate against - see run-prompt.ts's runPrompt. */
  outputSchema: z.ZodType<TOutput>;
  /** Overridable per call via RunPromptOptions - see run-prompt.ts. */
  defaultMaxTokens: number;
}

const registry = new Map<string, PromptTemplate<unknown>>();

function registryKey(key: string, version: number): string {
  return `${key}@${version}`;
}

export function registerPromptTemplate<TOutput>(template: PromptTemplate<TOutput>): void {
  const rk = registryKey(template.key, template.version);
  if (registry.has(rk)) {
    throw new Error(`Prompt template ${rk} is already registered`);
  }
  registry.set(rk, template as PromptTemplate<unknown>);
}

export function getPromptTemplate<TOutput = unknown>(
  key: string,
  version: number,
): PromptTemplate<TOutput> | undefined {
  return registry.get(registryKey(key, version)) as PromptTemplate<TOutput> | undefined;
}
