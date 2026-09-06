import test from "node:test";
import assert from "node:assert/strict";
import { summarizeForceActions, buildTransformationBrief, type ForceActionItem } from "../src/program.ts";

const item = (over: Partial<ForceActionItem>): ForceActionItem => ({
  id: "a1", force: 1, principle: "Know your numbers", actionItem: "Baseline the funnel",
  status: "open", priority: "medium", createdAt: "2026-01-01T00:00:00.000Z", ...over,
});

test("summarizeForceActions: counts status and per-force totals", () => {
  const items: ForceActionItem[] = [
    item({ id: "a", force: 1, status: "open" }),
    item({ id: "b", force: 1, status: "done" }),
    item({ id: "c", force: 4, status: "in_progress" }),
  ];
  const s = summarizeForceActions(items);
  assert.equal(s.total, 3);
  assert.equal(s.open, 1);
  assert.equal(s.inProgress, 1);
  assert.equal(s.done, 1);
  assert.equal(s.byForce[1].total, 2);
  assert.equal(s.byForce[1].done, 1);
  assert.equal(s.byForce[4].total, 1);
  assert.equal(s.byForce[7].total, 0);
});

test("summarizeForceActions: totalDollarValue sums only not-done items", () => {
  const items: ForceActionItem[] = [
    item({ id: "a", dollarValue: 10000, status: "open" }),
    item({ id: "b", dollarValue: 5000, status: "done" }),
    item({ id: "c", dollarValue: 2000, status: "in_progress" }),
  ];
  assert.equal(summarizeForceActions(items).totalDollarValue, 12000);
});

test("buildTransformationBrief: pulls definition fields through", () => {
  const brief = buildTransformationBrief(
    { businessName: "Acme", breakthrough: "Stop chasing cold leads", vision: "10x in 3 years" },
    [],
    "2026-01-05T00:00:00.000Z",
  );
  assert.equal(brief.businessName, "Acme");
  assert.equal(brief.breakthrough, "Stop chasing cold leads");
  assert.equal(brief.vision, "10x in 3 years");
  assert.equal(brief.generatedAt, "2026-01-05T00:00:00.000Z");
  assert.deepEqual(brief.topActions, []);
});

test("buildTransformationBrief: top 3 actions are highest dollar value, not-done, sorted descending", () => {
  const items: ForceActionItem[] = [
    item({ id: "a", dollarValue: 1000, status: "open" }),
    item({ id: "b", dollarValue: 50000, status: "open" }),
    item({ id: "c", dollarValue: 99999999, status: "done" }), // excluded: already done
    item({ id: "d", dollarValue: 20000, status: "in_progress" }),
    item({ id: "e", dollarValue: 5000, status: "open" }),
  ];
  const brief = buildTransformationBrief({}, items);
  assert.deepEqual(brief.topActions.map((a) => a.id), ["b", "d", "e"]);
});
