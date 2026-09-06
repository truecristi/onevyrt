import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runEvalSuite } from "./run-eval";
import type { PromptTemplate } from "./prompt-registry";
import type { EvalCase } from "./eval-registry";

const outputSchema = z.object({ answer: z.string().min(1) });
type Output = z.infer<typeof outputSchema>;

const template: PromptTemplate<Output> = {
  key: "test_run_eval",
  version: 1,
  defaultMaxTokens: 100,
  outputSchema,
  render: (variables) => ({
    system: "You are a test.",
    user: `Question: ${variables.question}`,
  }),
};

describe("runEvalSuite", () => {
  it("passes a case whose response satisfies every assertion", async () => {
    const cases: EvalCase<Output>[] = [
      {
        name: "answers 42",
        variables: { question: "life, the universe and everything" },
        respond: () => JSON.stringify({ answer: "42" }),
        assertions: [(output) => (output.answer === "42" ? null : "expected 42")],
      },
    ];

    const report = await runEvalSuite(template, cases);

    expect(report.templateKey).toBe("test_run_eval");
    expect(report.passedCount).toBe(1);
    expect(report.failedCount).toBe(0);
    expect(report.results[0]).toMatchObject({ name: "answers 42", passed: true, failures: [] });
  });

  it("fails a case whose response violates an assertion, with the assertion's reason", async () => {
    const cases: EvalCase<Output>[] = [
      {
        name: "answers wrongly",
        variables: { question: "life, the universe and everything" },
        respond: () => JSON.stringify({ answer: "41" }),
        assertions: [(output) => (output.answer === "42" ? null : "expected 42")],
      },
    ];

    const report = await runEvalSuite(template, cases);

    expect(report.passedCount).toBe(0);
    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.passed).toBe(false);
    expect(report.results[0]?.failures).toEqual(["expected 42"]);
  });

  it("fails a case whose response isn't valid JSON, without throwing", async () => {
    const cases: EvalCase<Output>[] = [
      {
        name: "not json",
        variables: { question: "x" },
        respond: () => "not json",
        assertions: [],
      },
    ];

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toMatch(/failed validation/);
  });

  it("fails a case whose response doesn't match the schema, without throwing", async () => {
    const cases: EvalCase<Output>[] = [
      {
        name: "wrong shape",
        variables: { question: "x" },
        respond: () => JSON.stringify({ wrongField: true }),
        assertions: [],
      },
    ];

    const report = await runEvalSuite(template, cases);

    expect(report.failedCount).toBe(1);
    expect(report.results[0]?.failures[0]).toMatch(/failed validation/);
  });

  it("runs multiple assertions per case and collects every failure", async () => {
    const cases: EvalCase<Output>[] = [
      {
        name: "both assertions fail",
        variables: { question: "x" },
        respond: () => JSON.stringify({ answer: "41" }),
        assertions: [
          (output) => (output.answer === "42" ? null : "reason one"),
          (output) => (output.answer.length > 5 ? null : "reason two"),
        ],
      },
    ];

    const report = await runEvalSuite(template, cases);

    expect(report.results[0]?.failures).toEqual(["reason one", "reason two"]);
  });

  it("summarizes a mix of passing and failing cases across the suite", async () => {
    const cases: EvalCase<Output>[] = [
      {
        name: "pass",
        variables: { question: "x" },
        respond: () => JSON.stringify({ answer: "42" }),
        assertions: [(output) => (output.answer === "42" ? null : "fail")],
      },
      {
        name: "fail",
        variables: { question: "x" },
        respond: () => JSON.stringify({ answer: "41" }),
        assertions: [(output) => (output.answer === "42" ? null : "fail")],
      },
    ];

    const report = await runEvalSuite(template, cases);

    expect(report.passedCount).toBe(1);
    expect(report.failedCount).toBe(1);
  });
});
