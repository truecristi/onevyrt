import { describe, expect, it } from "vitest";
import { getPromptTemplate } from "../prompt-registry";
import { runPrompt } from "../run-prompt";
import { createDeterministicProvider } from "../providers/deterministic";
import type { ProposeTaskOutput } from "./propose-task";
import "./propose-task";

describe("propose_task prompt template", () => {
  it("is registered under key propose_task, version 1", () => {
    expect(getPromptTemplate("propose_task", 1)).toBeDefined();
  });

  it("renders the business context and instruction into the user message", () => {
    const template = getPromptTemplate("propose_task", 1);
    const rendered = template?.render({
      context: "Goals: Hit $10k MRR",
      instruction: "Suggest a next action",
    });
    expect(rendered?.user).toContain("Hit $10k MRR");
    expect(rendered?.user).toContain("Suggest a next action");
  });

  it("validates a well-formed model response end to end via runPrompt", async () => {
    const template = getPromptTemplate<ProposeTaskOutput>("propose_task", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () =>
        JSON.stringify({
          task: { title: "Call your top 3 customers for feedback", priority: "high" },
          rationale: "Direct feedback grounds the next pricing decision.",
        }),
    });

    const { output } = await runPrompt(
      provider,
      template,
      { context: "Goals: Hit $10k MRR", instruction: "Suggest a next action" },
      { model: "test-model" },
    );

    expect(output.task.title).toBe("Call your top 3 customers for feedback");
    expect(output.task.priority).toBe("high");
    expect(output.rationale.length).toBeGreaterThan(0);
  });

  it("rejects a response missing a task title", async () => {
    const template = getPromptTemplate<ProposeTaskOutput>("propose_task", 1);
    if (!template) throw new Error("template not registered");

    const provider = createDeterministicProvider({
      respond: () => JSON.stringify({ task: {}, rationale: "x" }),
    });

    await expect(
      runPrompt(provider, template, { instruction: "x" }, { model: "test-model" }),
    ).rejects.toThrow();
  });
});
