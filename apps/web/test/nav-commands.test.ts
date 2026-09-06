import test from "node:test";
import assert from "node:assert/strict";
import { NAV_COMMANDS } from "../lib/nav-commands";
import { filterCommands } from "../lib/studio/command-palette";

test("every nav command is well-formed with a unique id and an app-relative href", () => {
  const ids = new Set<string>();
  for (const c of NAV_COMMANDS) {
    assert.ok(c.title.trim().length > 0, "title");
    assert.ok(c.href.startsWith("/"), `${c.id} href must be app-relative`);
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
  }
});

test("fuzzy search finds destinations by title and by keyword", () => {
  const byTitle = filterCommands(NAV_COMMANDS, "break", 10);
  assert.ok(byTitle.some((c) => c.id === "nav-breakeven"), "found break-even by title");

  const byKeyword = filterCommands(NAV_COMMANDS, "api key", 10);
  assert.ok(byKeyword.some((c) => c.id === "nav-connect"), "found Connect AI by keyword");

  const plan = filterCommands(NAV_COMMANDS, "next", 10);
  assert.ok(plan.some((c) => c.id === "nav-plan"), "found Your Plan via 'what next' keyword");

  // empty query returns everything (the ranker treats '' as match-all)
  assert.equal(filterCommands(NAV_COMMANDS, "", 100).length, NAV_COMMANDS.length);
});
