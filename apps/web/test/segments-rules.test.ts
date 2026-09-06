import test from "node:test";
import assert from "node:assert/strict";
import { compileSegment, validateSegmentRules, type Group } from "../lib/segments/rules";

test("an empty group matches everyone", () => {
  const { sql, params } = compileSegment({ combinator: "and", rules: [] });
  assert.equal(sql, "TRUE");
  assert.deepEqual(params, []);
});

test("conditions compile to bound parameters, never inline values", () => {
  const rules: Group = { combinator: "and", rules: [
    { field: "status", op: "eq", value: "qualified" },
    { field: "score", op: "gte", value: 70 },
  ] };
  const { sql, params } = compileSegment(rules, 2);
  // Params are offset from $2 (caller reserves $1 for workspace id).
  assert.match(sql, /lower\(l\.status\) = lower\(\$2\)/);
  assert.match(sql, /l\.score >= \$3/);
  assert.deepEqual(params, ["qualified", 70]);
});

test("nested AND/OR groups nest correctly", () => {
  const rules: Group = { combinator: "and", rules: [
    { field: "booked", op: "isFalse" },
    { combinator: "or", rules: [
      { field: "status", op: "eq", value: "qualified" },
      { field: "score", op: "gte", value: 60 },
    ] },
  ] };
  const { sql } = compileSegment(rules);
  assert.match(sql, /NOT EXISTS/); // booked isFalse
  assert.match(sql, /\(.*OR.*\)/s);
  // Structure: (NOT EXISTS(...) AND (lower(l.status)... OR l.score >= ...))
  assert.ok(sql.startsWith("(") && sql.endsWith(")"));
});

test("channel fields compile to boolean expressions without params", () => {
  assert.match(compileSegment({ combinator: "and", rules: [{ field: "hasPhone", op: "isTrue" }] }).sql, /l\.phone IS NOT NULL/);
  assert.match(compileSegment({ combinator: "and", rules: [{ field: "hasEmail", op: "isFalse" }] }).sql, /^\(NOT \(l\.email IS NOT NULL/);
  assert.match(compileSegment({ combinator: "and", rules: [{ field: "verified", op: "isTrue" }] }).sql, /l\.verified/);
});

test("'in' with a list binds each value; empty list matches nobody", () => {
  const { sql, params } = compileSegment({ combinator: "and", rules: [{ field: "status", op: "in", value: ["qualified", "nurture"] }] }, 1);
  assert.match(sql, /IN \(lower\(\$1\), lower\(\$2\)\)/);
  assert.deepEqual(params, ["qualified", "nurture"]);
  assert.equal(compileSegment({ combinator: "and", rules: [{ field: "status", op: "in", value: [] }] }).sql, "(FALSE)");
});

test("withinDays uses a bound interval", () => {
  const { sql, params } = compileSegment({ combinator: "and", rules: [{ field: "createdAt", op: "withinDays", value: 7 }] }, 1);
  assert.match(sql, /l\.created_at >= now\(\) - make_interval\(days => \$1\)/);
  assert.deepEqual(params, [7]);
});

test("unknown fields and disallowed operators are rejected (no injection surface)", () => {
  assert.throws(() => compileSegment({ combinator: "and", rules: [{ field: "id; DROP TABLE leads", op: "eq", value: "x" } as never] }), /unknown segment field/);
  assert.throws(() => compileSegment({ combinator: "and", rules: [{ field: "status", op: "gt", value: 1 }] }), /not allowed on field/);
  assert.throws(() => validateSegmentRules({ nope: true }), /combinator/);
});
