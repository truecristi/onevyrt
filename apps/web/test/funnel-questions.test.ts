import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestionsPrompt, parseQuestions, QUESTIONS_SYSTEM } from "../lib/studio/funnel-questions";

test("buildQuestionsPrompt grounds in the message and drops empty parts", () => {
  const p = buildQuestionsPrompt(
    { oneLiner: { problem: "p", solution: "OneVYRT maps the funnel", result: "r" }, character: "Founders", wants: "", failure: "Wasting spend" },
    "Book a strategy call",
  );
  assert.match(p, /Funnel: Book a strategy call/);
  assert.match(p, /Business one-liner: p\. OneVYRT maps the funnel, so r\./);
  assert.match(p, /Customer \(the hero\): Founders/);
  assert.match(p, /Failure they avoid: Wasting spend/);
  assert.doesNotMatch(p, /What they want:/); // empty → dropped
});

test("buildQuestionsPrompt falls back gracefully with no message", () => {
  const p = buildQuestionsPrompt(null);
  assert.match(p, /general small-business lead qualification funnel/i);
  assert.match(p, /Write the qualification questions now\./);
});

test("buildQuestionsPrompt folds in the business strategy when given", () => {
  const p = buildQuestionsPrompt(null, "Book a call", "Current #1 growth constraint: Lead capture");
  assert.match(p, /BUSINESS STRATEGY/);
  assert.match(p, /Current #1 growth constraint: Lead capture/);
  // Blank strategy adds nothing.
  assert.doesNotMatch(buildQuestionsPrompt(null, "Book a call", "   "), /BUSINESS STRATEGY/);
});

test("system prompt pins the JSON shape", () => {
  assert.match(QUESTIONS_SYSTEM, /ONLY minified JSON/);
  assert.match(QUESTIONS_SYSTEM, /"questions"/);
});

test("parseQuestions parses a clean {questions:[…]} reply and assigns ids", () => {
  const reply = JSON.stringify({
    questions: [
      { prompt: "What's your monthly ad budget?", kind: "single", options: [
        { label: "Under $500", points: 0, disqualify: true },
        { label: "$500–$2k", points: 6 },
        { label: "Over $2k", points: 10 },
      ] },
      { prompt: "How soon do you want to launch?", kind: "single", options: [
        { label: "This month", points: 10 }, { label: "Someday", points: 2 },
      ] },
    ],
  });
  const qs = parseQuestions(reply);
  assert.equal(qs.length, 2);
  assert.deepEqual(qs.map((q) => q.id), ["q1", "q2"]);
  assert.equal(qs[0]!.options?.[0]!.disqualify, true);
  assert.equal(qs[0]!.options?.[2]!.points, 10);
  assert.ok(qs[0]!.options?.every((o) => o.value.length > 0));
});

test("parseQuestions tolerates code fences and a bare array", () => {
  const fenced = "```json\n[{\"prompt\":\"Are you the decision maker?\",\"kind\":\"single\",\"options\":[{\"label\":\"Yes\",\"points\":10},{\"label\":\"No\",\"points\":0}]}]\n```";
  const qs = parseQuestions(fenced);
  assert.equal(qs.length, 1);
  assert.equal(qs[0]!.prompt, "Are you the decision maker?");
});

test("parseQuestions clamps points, caps counts, and drops promptless items", () => {
  const reply = JSON.stringify({
    questions: [
      { prompt: "Q1", kind: "single", options: Array.from({ length: 9 }, (_, i) => ({ label: `o${i}`, points: 999 })) },
      { kind: "single", options: [{ label: "x", points: 1 }] }, // no prompt → dropped
      ...Array.from({ length: 8 }, (_, i) => ({ prompt: `Extra ${i}`, kind: "text" })),
    ],
  });
  const qs = parseQuestions(reply);
  assert.ok(qs.length <= 6, "caps at 6 questions");
  assert.ok((qs[0]!.options?.length ?? 0) <= 5, "caps options at 5");
  assert.ok(qs[0]!.options?.every((o) => (o.points ?? 0) <= 10), "clamps points to 10");
  assert.ok(qs.every((q) => q.prompt.length > 0), "no promptless questions");
});

test("parseQuestions synthesizes yes/no when a choice question has too few options", () => {
  const qs = parseQuestions(JSON.stringify({ questions: [{ prompt: "Ready?", kind: "single", options: [{ label: "Only one" }] }] }));
  assert.equal(qs.length, 1);
  assert.deepEqual(qs[0]!.options?.map((o) => o.value), ["yes", "no"]);
});

test("parseQuestions omits options for number/text kinds", () => {
  const qs = parseQuestions(JSON.stringify({ questions: [{ prompt: "How many staff?", kind: "number", options: [{ label: "junk" }] }] }));
  assert.equal(qs[0]!.kind, "number");
  assert.equal(qs[0]!.options, undefined);
});

test("parseQuestions returns [] on garbage so callers keep existing questions", () => {
  assert.deepEqual(parseQuestions("sorry, I can't do that"), []);
  assert.deepEqual(parseQuestions(""), []);
  assert.deepEqual(parseQuestions("{not json"), []);
});
