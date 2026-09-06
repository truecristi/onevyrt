import { createDeterministicProvider } from "./providers/deterministic";
import { runPrompt, PromptOutputValidationError } from "./run-prompt";
import type { PromptTemplate } from "./prompt-registry";
import type { EvalCase } from "./eval-registry";

/**
 * Runs one golden evaluation case: builds a deterministic provider that
 * returns exactly `evalCase.respond`'s text (see eval-registry.ts's doc
 * comment), pushes it through the real runPrompt path - the same
 * template render + gateway + schema validation every production call
 * goes through - and then checks each of the case's assertions against
 * the validated output. A model of "eval" is passed since the
 * deterministic provider never looks at it; runPrompt still requires one
 * explicitly, per ADR-0010's "model routing is a single explicit
 * parameter, never guessed" rule.
 */

export interface EvalCaseResult {
  name: string;
  passed: boolean;
  /** Empty when passed. One entry per failed assertion, or a single schema/JSON-validation failure reason. */
  failures: string[];
  latencyMs: number;
}

export interface EvalSuiteReport {
  templateKey: string;
  templateVersion: number;
  results: EvalCaseResult[];
  passedCount: number;
  failedCount: number;
}

async function runEvalCase<TOutput>(
  template: PromptTemplate<TOutput>,
  evalCase: EvalCase<TOutput>,
): Promise<EvalCaseResult> {
  const provider = createDeterministicProvider({ respond: evalCase.respond });
  const start = Date.now();

  try {
    const { output } = await runPrompt(provider, template, evalCase.variables, {
      model: "eval",
    });
    const failures = evalCase.assertions
      .map((assertion) => assertion(output))
      .filter((failure): failure is string => failure !== null);
    return {
      name: evalCase.name,
      passed: failures.length === 0,
      failures,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    const reason =
      error instanceof PromptOutputValidationError ? error.message : (error as Error).message;
    return {
      name: evalCase.name,
      passed: false,
      failures: [reason],
      latencyMs: Date.now() - start,
    };
  }
}

/**
 * Runs every case in a suite and summarizes the result - what a CI gate
 * (spec §44's "AI schema and evaluation thresholds for changed
 * capabilities") checks `failedCount === 0` against. See
 * evals/run-all.test.ts for the actual gate over every registered suite
 * in this repository.
 */
export async function runEvalSuite<TOutput>(
  template: PromptTemplate<TOutput>,
  cases: EvalCase<TOutput>[],
): Promise<EvalSuiteReport> {
  const results = await Promise.all(cases.map((evalCase) => runEvalCase(template, evalCase)));
  return {
    templateKey: template.key,
    templateVersion: template.version,
    results,
    passedCount: results.filter((r) => r.passed).length,
    failedCount: results.filter((r) => !r.passed).length,
  };
}
