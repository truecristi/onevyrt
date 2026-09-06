import test from "node:test";
import assert from "node:assert/strict";
import { buildBriefHtml, esc, type BriefData } from "../lib/studio/brief";

const base: BriefData = {
  funnelName: "My Funnel", generatedOn: "2026-08-16", revenue: "$10,000", profit: "$4,000",
  profitLabel: "Plan profit",
  blocks: [{ label: "Landing Page", kind: "step", metric: "35% pass", auditScore: 72 }],
  fixes: [{ rank: 1, tag: "Money leak", title: "Fix Checkout", detail: "Leaking $2,500/mo." }],
};

test("buildBriefHtml: includes name, KPIs, block and fix", () => {
  const html = buildBriefHtml(base);
  assert.match(html, /<title>My Funnel — funnel brief<\/title>/);
  assert.match(html, /\$10,000/);
  assert.match(html, /Landing Page/);
  assert.match(html, /35% pass/);
  assert.match(html, /72\/100/);
  assert.match(html, /Fix Checkout/);
});

test("buildBriefHtml: escapes funnel text so it can't inject markup", () => {
  const html = buildBriefHtml({ ...base, funnelName: `<script>alert(1)</script>`, blocks: [], fixes: [] });
  assert.ok(!html.includes("<script>alert(1)</script>"), "raw script tag must not appear");
  assert.match(html, /&lt;script&gt;/);
});

test("buildBriefHtml: empty funnel shows placeholders, not a broken table", () => {
  const html = buildBriefHtml({ ...base, blocks: [], fixes: [] });
  assert.match(html, /No blocks yet/);
  assert.match(html, /Nothing urgent to fix/);
});

test("esc: escapes the five HTML-significant characters", () => {
  assert.equal(esc(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});
