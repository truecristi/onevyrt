import test from "node:test";
import assert from "node:assert/strict";
import { parseActualsCsv } from "../lib/studio/parse-actuals-csv";

test("parses the exported header into per-node actuals", () => {
  const csv = [
    "node_id,node_label,visits,conversions,revenue_minor",
    "n1,Landing,1000,120,45000",
    "n2,Checkout,120,30,45000",
  ].join("\n");
  const { rows, skipped } = parseActualsCsv(csv);
  assert.equal(skipped, 0);
  assert.deepEqual(rows[0], { nodeId: "n1", visits: 1000, conversions: 120, revenue: 45000 });
  assert.equal(rows[1]!.nodeId, "n2");
});

test("column order is free and node_label / extra columns are ignored", () => {
  const csv = "revenue,conversions,node_id,notes\n900,3,x,hello";
  const { rows } = parseActualsCsv(csv);
  assert.deepEqual(rows[0], { nodeId: "x", conversions: 3, revenue: 900 });
});

test("handles quoted labels with commas, and CRLF", () => {
  const csv = 'node_id,node_label,visits\r\nn1,"Home, hero",50\r\n';
  const { rows } = parseActualsCsv(csv);
  assert.deepEqual(rows[0], { nodeId: "n1", visits: 50 });
});

test("skips blank lines and rows with no node id, reporting the skip count", () => {
  const csv = "node_id,visits\n\nn1,10\n,99\nn2,20\n";
  const { rows, skipped } = parseActualsCsv(csv);
  assert.equal(rows.length, 2);
  assert.equal(skipped, 1, "the row with an empty node id is skipped");
});

test("tolerates thousands separators and rounds/clamps numbers", () => {
  const csv = 'node_id,visits,revenue_minor\nn1,"1,250",-5';
  const { rows } = parseActualsCsv(csv);
  assert.equal(rows[0]!.visits, 1250);
  assert.equal(rows[0]!.revenue, 0, "negative clamps to 0");
});

test("rejects a CSV with no node_id column", () => {
  assert.throws(() => parseActualsCsv("visits,conversions\n1,2"), /node_id/);
});

test("rejects a CSV with no importable metric columns", () => {
  assert.throws(() => parseActualsCsv("node_id,node_label\nn1,Home"), /no visits/);
});

test("rejects an empty file", () => {
  assert.throws(() => parseActualsCsv("   \n  "), /empty/);
});
