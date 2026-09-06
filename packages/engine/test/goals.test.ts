import test from "node:test";
import assert from "node:assert/strict";
import { rollUpStatus, summarizeGoals, ancestryOf, childrenOf, rootGoals, type GoalNode } from "../src/goals.ts";

function goal(over: Partial<GoalNode>): GoalNode {
  return { id: "g", level: "action", title: "t", status: "not_started", createdAt: "2026-01-01T00:00:00.000Z", ...over };
}

test("rollUpStatus: a leaf goal just reports its own status", () => {
  const goals = [goal({ id: "a", status: "on_track" })];
  assert.equal(rollUpStatus("a", goals), "on_track");
});

test("rollUpStatus: any at-risk descendant makes every ancestor at-risk too", () => {
  const goals = [
    goal({ id: "vision", level: "vision", status: "on_track" }),
    goal({ id: "annual", level: "annual", parentId: "vision", status: "on_track" }),
    goal({ id: "quarterly", level: "quarterly", parentId: "annual", status: "at_risk" }),
  ];
  assert.equal(rollUpStatus("quarterly", goals), "at_risk");
  assert.equal(rollUpStatus("annual", goals), "at_risk", "a parent must inherit an at-risk child");
  assert.equal(rollUpStatus("vision", goals), "at_risk", "at-risk must propagate all the way to the root");
});

test("rollUpStatus: only 'done' when every child is done", () => {
  const goals = [
    goal({ id: "p", level: "project", status: "not_started" }),
    goal({ id: "a1", level: "action", parentId: "p", status: "done" }),
    goal({ id: "a2", level: "action", parentId: "p", status: "done" }),
  ];
  assert.equal(rollUpStatus("p", goals), "done");

  const partial = [
    goal({ id: "p2", level: "project", status: "not_started" }),
    goal({ id: "b1", level: "action", parentId: "p2", status: "done" }),
    goal({ id: "b2", level: "action", parentId: "p2", status: "not_started" }),
  ];
  // Not every child is done, so the parent isn't "done" — but one done
  // child among not-started ones is real partial progress, which the
  // on_track rule below covers; it's "not_started" only when NO child
  // shows any progress at all.
  assert.equal(rollUpStatus("p2", partial), "on_track");

  const noProgress = [
    goal({ id: "p3", level: "project", status: "not_started" }),
    goal({ id: "c1", level: "action", parentId: "p3", status: "not_started" }),
    goal({ id: "c2", level: "action", parentId: "p3", status: "not_started" }),
  ];
  assert.equal(rollUpStatus("p3", noProgress), "not_started");
});

test("rollUpStatus: on_track if at least one child is on_track/done and none are at_risk", () => {
  const goals = [
    goal({ id: "p", level: "project", status: "not_started" }),
    goal({ id: "a1", level: "action", parentId: "p", status: "on_track" }),
    goal({ id: "a2", level: "action", parentId: "p", status: "not_started" }),
  ];
  assert.equal(rollUpStatus("p", goals), "on_track");
});

test("summarizeGoals: counts by EFFECTIVE (rolled-up) status, and surfaces at-risk roots", () => {
  const goals = [
    goal({ id: "vision1", level: "vision", status: "on_track" }),
    goal({ id: "annual1", level: "annual", parentId: "vision1", status: "at_risk" }),
    goal({ id: "vision2", level: "vision", status: "done" }),
  ];
  const summary = summarizeGoals(goals);
  assert.equal(summary.total, 3);
  assert.equal(summary.atRisk, 2, "both vision1 (rolled up) and annual1 itself are at_risk");
  assert.equal(summary.done, 1);
  assert.equal(summary.atRiskRoots.length, 1);
  assert.equal(summary.atRiskRoots[0].id, "vision1");
});

test("childrenOf / rootGoals: basic filtering", () => {
  const goals = [
    goal({ id: "v", level: "vision" }),
    goal({ id: "a1", level: "annual", parentId: "v" }),
    goal({ id: "a2", level: "annual", parentId: "v" }),
  ];
  assert.deepEqual(rootGoals(goals).map((g) => g.id), ["v"]);
  assert.deepEqual(childrenOf(goals, "v").map((g) => g.id).sort(), ["a1", "a2"]);
});

test("ancestryOf: walks all the way up to the vision, root first", () => {
  const goals = [
    goal({ id: "vision", level: "vision", title: "Freedom" }),
    goal({ id: "annual", level: "annual", parentId: "vision", title: "2x revenue" }),
    goal({ id: "quarterly", level: "quarterly", parentId: "annual", title: "Q1 push" }),
    goal({ id: "action", level: "action", parentId: "quarterly", title: "Ship the ad" }),
  ];
  const chain = ancestryOf("action", goals);
  assert.deepEqual(chain.map((g) => g.id), ["vision", "annual", "quarterly", "action"]);
});

test("ancestryOf: a root goal's ancestry is just itself", () => {
  const goals = [goal({ id: "vision", level: "vision" })];
  assert.deepEqual(ancestryOf("vision", goals).map((g) => g.id), ["vision"]);
});
