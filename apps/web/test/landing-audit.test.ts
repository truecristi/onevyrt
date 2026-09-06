import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditPrompt, parseAudit, DEISS_PRINCIPLES } from "../lib/studio/landing-audit";

test("buildAuditPrompt: names every principle and asks for JSON only", () => {
  const { system, user } = buildAuditPrompt("My headline\nBuy now");
  for (const p of DEISS_PRINCIPLES) assert.ok(system.includes(p), `prompt mentions ${p}`);
  assert.match(system, /ONLY JSON/i);
  assert.match(user, /My headline/);
});

test("buildAuditPrompt: truncates a huge paste", () => {
  const { user } = buildAuditPrompt("x".repeat(20000));
  assert.ok(user.length < 13000, "user message is bounded");
});

test("parseAudit: reads a valid verdict, clamps score, keeps valid findings", () => {
  const raw = JSON.stringify({
    score: 142, // out of range → clamps to 100
    summary: "Weak proof and no guarantee.",
    findings: [
      { principle: "social_proof", status: "missing", note: "No testimonials anywhere.", fix: "Add 2-3 quotes above the fold." },
      { principle: "headline", status: "weak", note: "Generic; no audience.", fix: "Name the reader." },
      { principle: "not_a_principle", status: "missing", note: "x", fix: "y" }, // dropped
      { principle: "single_cta", status: "banana", note: "x", fix: "y" }, // bad status → dropped
    ],
  });
  const a = parseAudit(raw)!;
  assert.equal(a.score, 100);
  assert.equal(a.findings.length, 2);
  assert.equal(a.findings[0]!.principle, "social_proof");
});

test("parseAudit: tolerates prose/fences around the JSON", () => {
  const raw = 'Here you go:\n```json\n{"score":70,"summary":"ok","findings":[{"principle":"grunt_test","status":"strong","note":"clear","fix":"none"}]}\n```';
  const a = parseAudit(raw)!;
  assert.equal(a.score, 70);
  assert.equal(a.findings[0]!.principle, "grunt_test");
});

test("parseAudit: de-dupes repeated principles", () => {
  const raw = JSON.stringify({ score: 50, summary: "s", findings: [
    { principle: "risk_reversal", status: "missing", note: "a", fix: "b" },
    { principle: "risk_reversal", status: "weak", note: "c", fix: "d" },
  ] });
  assert.equal(parseAudit(raw)!.findings.length, 1);
});

test("parseAudit: junk or empty findings → null", () => {
  assert.equal(parseAudit("not json"), null);
  assert.equal(parseAudit(JSON.stringify({ score: 10, findings: [] })), null);
});
