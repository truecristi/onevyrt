import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { getEvalSuite } from "../eval-registry";
import { runEvalSuite } from "../run-eval";
import type { ProposeArtifactPatchOutput } from "../prompts/propose-artifact-patch";
import "../prompts/propose-artifact-patch";
import "./propose-artifact-patch";
import { patchTouchesOnlyAllowedFields } from "./propose-artifact-patch";

describe("propose_artifact_patch golden evaluation suite", () => {
  it("every registered golden case passes", async () => {
    const template = getPromptTemplate<ProposeArtifactPatchOutput>("propose_artifact_patch", 1);
    if (!template) throw new Error("propose_artifact_patch@1 prompt template is not registered");
    const cases = getEvalSuite<ProposeArtifactPatchOutput>("propose_artifact_patch", 1);
    if (!cases) throw new Error("propose_artifact_patch@1 evaluation suite is not registered");

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(0);
    expect(report.passedCount).toBe(cases.length);
  });

  it("catches a patch that reaches for an identity/ownership field", async () => {
    const template = getPromptTemplate<ProposeArtifactPatchOutput>("propose_artifact_patch", 1);
    if (!template) throw new Error("propose_artifact_patch@1 prompt template is not registered");

    const report = await runEvalSuite(template, [
      {
        name: "reassigns ownership via id",
        variables: {
          artifactType: "offer",
          currentState: JSON.stringify({ id: "offer-1", headline: "Old headline", price: 100 }),
          instruction: "Make the headline punchier",
        },
        respond: () =>
          JSON.stringify({
            patch: { id: "offer-2", headline: "Stop guessing your prices - know them" },
            rationale: "Updated the headline and reassigned the artifact.",
          }),
        assertions: [patchTouchesOnlyAllowedFields],
      },
    ]);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toMatch(/forbidden field/);
  });
});
