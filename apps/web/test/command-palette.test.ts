import test from "node:test";
import assert from "node:assert/strict";
import { fuzzyScore, filterCommands, type Command } from "../lib/studio/command-palette";

const CMDS: Command[] = [
  { id: "new", title: "New Funnel", keywords: ["create", "blank"] },
  { id: "add-offer", title: "Add Offer block", section: "Insert" },
  { id: "add-traffic", title: "Add Traffic source", section: "Insert" },
  { id: "sim", title: "Run Simulation", keywords: ["forecast", "model"] },
  { id: "export-pdf", title: "Export PDF", keywords: ["download", "report"] },
];

test("fuzzyScore: prefix beats mid-substring beats scattered; no match is -1", () => {
  assert.ok(fuzzyScore("New Funnel", "new") > fuzzyScore("New Funnel", "funnel"), "prefix > mid");
  assert.ok(fuzzyScore("New Funnel", "nf") > -1, "scattered subsequence matches");
  assert.equal(fuzzyScore("New Funnel", "zzz"), -1);
  assert.equal(fuzzyScore("anything", ""), 1, "empty query matches");
});

test("empty query returns all commands in order, capped at limit", () => {
  assert.deepEqual(filterCommands(CMDS, "").map((c) => c.id), CMDS.map((c) => c.id));
  assert.equal(filterCommands(CMDS, "", 2).length, 2);
});

test("prefix query ranks the title-prefix command first", () => {
  const r = filterCommands(CMDS, "run");
  assert.equal(r[0]!.id, "sim");
});

test("fuzzy subsequence finds the right command", () => {
  const r = filterCommands(CMDS, "expdf");
  assert.equal(r[0]!.id, "export-pdf");
});

test("keyword matches surface a command even when the title doesn't", () => {
  const r = filterCommands(CMDS, "forecast");
  assert.ok(r.some((c) => c.id === "sim"), "keyword 'forecast' surfaces Run Simulation");
});

test("a title hit outranks a keyword-only hit for the same query", () => {
  // "report" is a keyword of export-pdf; make a command whose TITLE contains it.
  const cmds: Command[] = [
    { id: "kw", title: "Export PDF", keywords: ["report"] },
    { id: "title", title: "Report Centre" },
  ];
  const r = filterCommands(cmds, "report");
  assert.equal(r[0]!.id, "title", "title match beats keyword match");
});

test("non-matching query returns nothing", () => {
  assert.equal(filterCommands(CMDS, "qqqq").length, 0);
});
