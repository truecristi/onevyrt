import type { CompletionRequest } from "./types";

/**
 * PRD-AI-011 (README "AI coaching" -> "Evaluation system", eleventh and
 * final Phase 6 slice; spec §5.4's "maintain golden evaluations for
 * factual grounding, calculation fidelity, schema validity, appropriate
 * uncertainty, no cross-tenant leakage, ... and refusal of unsafe
 * mutation" and §28's "prompt templates are versioned ... with ... an
 * evaluation set"). Same (key, version) in-code Map-based registry shape
 * as prompt-registry.ts and formula-registry.ts - an evaluation suite is
 * developer-authored, versioned alongside the prompt template it checks,
 * never user-editable data.
 *
 * A golden evaluation case is a *fixed* input/output pair, not a live
 * model call: `respond` supplies the exact text a provider would have to
 * return for this case, and `assertions` check that text (once parsed and
 * schema-validated by run-eval.ts's runEvalSuite) for whatever property
 * the case exists to prove - a correctly-shaped answer passes, a
 * deliberately-wrong one fails. This is what lets the suite run in CI
 * with zero external dependency or secret (the same "prove the pipeline
 * without a live dependency" reasoning as the deterministic provider
 * itself, ADR-0010) while still exercising real schema validation and
 * real assertion logic - a suite that could never fail would prove
 * nothing.
 */

export type EvalAssertion<TOutput> = (output: TOutput) => string | null;

export interface EvalCase<TOutput> {
  name: string;
  variables: Record<string, string>;
  /** The canned text a provider "returns" for this case - see the module doc comment above. */
  respond: (request: CompletionRequest) => string;
  /** Checked, in order, once the response has parsed and validated against the template's outputSchema. Each returns a failure reason, or null when it passes. */
  assertions: EvalAssertion<TOutput>[];
}

const registry = new Map<string, EvalCase<unknown>[]>();

function registryKey(key: string, version: number): string {
  return `${key}@${version}`;
}

export function registerEvalSuite<TOutput>(
  key: string,
  version: number,
  cases: EvalCase<TOutput>[],
): void {
  const rk = registryKey(key, version);
  if (registry.has(rk)) {
    throw new Error(`Evaluation suite for ${rk} is already registered`);
  }
  registry.set(rk, cases as EvalCase<unknown>[]);
}

export function getEvalSuite<TOutput = unknown>(
  key: string,
  version: number,
): EvalCase<TOutput>[] | undefined {
  return registry.get(registryKey(key, version)) as EvalCase<TOutput>[] | undefined;
}

/** Every (key, version) with a registered suite - used by run-all.test.ts to gate every template that has one, without hand-maintaining a parallel list. */
export function listEvalSuiteKeys(): Array<{ key: string; version: number }> {
  return [...registry.keys()].map((rk) => {
    const [key, version] = rk.split("@");
    return { key: key as string, version: Number(version) };
  });
}
