import test from "node:test";
import assert from "node:assert/strict";
import { GLOSSARY, lookupTerm, glossarySorted } from "../lib/studio/glossary";

test("every entry is well-formed (term, short, plain, non-empty)", () => {
  for (const e of GLOSSARY) {
    assert.ok(e.term.trim().length > 0, "term");
    assert.ok(e.short.trim().length > 0, `${e.term} short`);
    assert.ok(e.plain.trim().length >= 20, `${e.term} plain too short`);
  }
});

test("terms and aliases are unique across the whole glossary", () => {
  const keys: string[] = [];
  for (const e of GLOSSARY) { keys.push(e.term.toLowerCase()); for (const a of e.aliases ?? []) keys.push(a.toLowerCase()); }
  assert.equal(new Set(keys).size, keys.length, "a term or alias is duplicated");
});

test("lookupTerm resolves by term and alias, case/space-insensitive", () => {
  assert.equal(lookupTerm("Contribution margin")?.term, "Contribution margin");
  assert.equal(lookupTerm("  MARGIN ")?.term, "Contribution margin");   // alias, padded, upper
  assert.equal(lookupTerm("break even")?.term, "Break-even");            // alias
  assert.equal(lookupTerm("storybrand")?.term, "One-liner");             // alias
  assert.equal(lookupTerm("not a term"), undefined);
});

test("glossarySorted returns every entry, A–Z, without mutating the source", () => {
  const before = GLOSSARY.map((e) => e.term);
  const sorted = glossarySorted();
  assert.equal(sorted.length, GLOSSARY.length);
  for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i - 1]!.term.localeCompare(sorted[i]!.term) <= 0, "not sorted");
  assert.deepEqual(GLOSSARY.map((e) => e.term), before, "source array was mutated");
});
