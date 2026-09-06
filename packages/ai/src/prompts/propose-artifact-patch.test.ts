import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { runPrompt } from "../run-prompt";
import { createDeterministicProvider } from "../providers/deterministic";
import type { ProposeArtifactPatchOutput } from "./propose-artifact-patch";
import "./propose-artifact-patch";

describe("propose_artifact_patch prompt template", () => {
  it("is registered under key propose_artifact_patch, version 1", () => {
    expect(getPromptTemplate("propose_artifact_patch", 1)).toBeDefined();
  });

  it("renders the artifact type, current state and instruction into the user message", () => {
    const template = getPromptTemplate("propose_artifact_patch", 1);
    const rendered = template?.render({
      artifactType: "offer",
      currentState: '{"name":"Coaching program","valueProposition":""}',
      instruction: "Write a stronger value proposition",
    });
    expect(rendered?.user).toContain("offer");
    expect(rendered?.user).toContain("Coaching program");
    expect(rendered?.user).toContain("Write a stronger value proposition");
  });

  it("validates a well-formed model response end to end via runPrompt", async () => {
    const template = getPromptTemplate<ProposeArtifactPatchOutput>("propose_artifact_patch", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          patch: { valueProposition: "Go from stuck to $10k/mo in 90 days." },
          rationale: "A concrete outcome and timeframe converts better than a vague claim.",
        }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      {
        artifactType: "offer",
        currentState: '{"valueProposition":""}',
        instruction: "Write a stronger value proposition",
      },
      { model: "test-model" },
    );

    expect(output.patch).toEqual({ valueProposition: "Go from stuck to $10k/mo in 90 days." });
    expect(output.rationale.length).toBeGreaterThan(0);
  });

  it("rejects a response missing the required rationale", async () => {
    const template = getPromptTemplate<ProposeArtifactPatchOutput>("propose_artifact_patch", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () => JSON.stringify({ patch: { name: "New name" } }),
    });

    await expect(
      runPrompt(provider, template, { artifactType: "offer" }, { model: "test-model" }),
    ).rejects.toThrow();
  });
});
