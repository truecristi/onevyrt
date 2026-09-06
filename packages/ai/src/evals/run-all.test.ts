import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { listEvalSuiteKeys, getEvalSuite } from "../eval-registry";
import { runEvalSuite } from "../run-eval";

// Side-effect imports: register every prompt template this repository ships
// and every golden evaluation suite that checks one of them.
import "../prompts/explain-calculation";
import "../prompts/coaching-ask";
import "../prompts/explain-lesson-block";
import "../prompts/propose-artifact-patch";
import "../prompts/propose-task";
import "../prompts/interpret-sketch";
import "./explain-calculation";
import "./coaching-ask";
import "./explain-lesson-block";
import "./propose-artifact-patch";
import "./propose-task";
import "./interpret-sketch";

/**
 * The actual CI gate spec §44 calls for: "AI schema and evaluation
 * thresholds for changed capabilities." Every registered golden
 * evaluation suite must pass in full - a prompt template change (or a
 * regression in one) that breaks a golden case fails this test, the same
 * way a broken formula fixture would fail a numerical golden test. This
 * iterates listEvalSuiteKeys() rather than a hand-maintained list, so a
 * newly-registered suite is picked up automatically.
 */
describe("golden evaluation gate", () => {
  it("registers exactly one suite per shipped prompt template", () => {
    const keys = listEvalSuiteKeys();
    const expected = [
      "explain_calculation",
      "coaching_ask",
      "explain_lesson_block",
      "propose_artifact_patch",
      "propose_task",
      "interpret_sketch",
    ];
    expect(keys.map((k) => k.key).sort()).toEqual(expected.sort());
  });

  it.each(listEvalSuiteKeys())(
    "$key@$version passes every golden case",
    async ({ key, version }) => {
      const template = getPromptTemplate(key, version);
      if (!template) {
        throw new Error(`${key}@${version} has no registered prompt template`);
      }

      const cases = getEvalSuite(key, version);
      if (!cases) {
        throw new Error(`${key}@${version} has no registered evaluation suite`);
      }

      const report = await runEvalSuite(template, cases);

      if (report.failedCount > 0) {
        const detail = report.results
          .filter((r) => !r.passed)
          .map((r) => `  - ${r.name}: ${r.failures.join("; ")}`)
          .join("\n");
        throw new Error(
          `${key}@${version} failed ${report.failedCount} golden case(s):\n${detail}`,
        );
      }

      expect(report.passedCount).toBe(cases.length);
    },
  );
});
