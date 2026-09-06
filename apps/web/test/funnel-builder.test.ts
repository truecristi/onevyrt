import test, { after } from "node:test";
import assert from "node:assert/strict";
import { scoreLead } from "@onevyrt/engine";
import { compileFunnel, validateFunnelDoc, blankFunnelDoc, slugify, attainableMaxScore, type FunnelDoc, type BuilderQuestion } from "../lib/studio/funnel-builder";
import { isPayable } from "../lib/studio/qualification-config";
import { saveFunnel, getStoredFunnel, listWorkspaceFunnels, deleteFunnel, resolveFunnelConfig, FunnelSlugTakenError } from "../lib/studio/funnel-store";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const WS = uid("fb-ws");
const SLUG = "fbtest-" + Math.random().toString(36).slice(2, 8); // lowercase, dash-safe
after(async () => {
  await pgPool().query("DELETE FROM qual_funnels WHERE slug LIKE 'fbtest-%'");
});

test("slugify makes URL-safe slugs", () => {
  assert.equal(slugify("My Agency Funnel!"), "my-agency-funnel");
  assert.equal(slugify("  spaces  "), "spaces");
  assert.equal(slugify("***"), "funnel");
});

test("blankFunnelDoc compiles and scores end to end", () => {
  const doc = blankFunnelDoc("starter-x", "Starter");
  assert.equal(validateFunnelDoc({ ...doc, slug: "starter-x" }), null);
  const cfg = compileFunnel(doc);
  // Top answers on all three questions → qualified (40+30+30 = 100 ≥ 70).
  const best = scoreLead({ budget: "15kplus", timeline: "now", role: "owner" }, cfg.rules);
  assert.equal(best.status, "qualified");
  assert.equal(best.score, 100);
  // Worst answers → 0 → unqualified.
  const worst = scoreLead({ budget: "under1k", timeline: "exploring", role: "other" }, cfg.rules);
  assert.equal(worst.status, "unqualified");
});

test("compileFunnel: a disqualify option becomes a hard gate", () => {
  const doc: FunnelDoc = {
    slug: "gate-x", title: "Gate", questions: [
      { id: "country", prompt: "Where?", kind: "single", required: true, options: [
        { value: "us", label: "US", points: 10 },
        { value: "elsewhere", label: "Elsewhere", disqualify: true },
      ] },
    ],
    thresholds: { qualified: 5, nurture: 1 },
    outcomes: {
      qualified: { heading: "Q", body: "", ctaLabel: "Book" },
      nurture: { heading: "N", body: "", ctaLabel: "Learn" },
      unqualified: { heading: "U", body: "", ctaLabel: "Later" },
    },
  };
  const cfg = compileFunnel(doc);
  assert.equal(scoreLead({ country: "us" }, cfg.rules).status, "qualified");
  // Disqualify fires regardless of any points.
  assert.equal(scoreLead({ country: "elsewhere" }, cfg.rules).status, "unqualified");
});

test("compileFunnel: multi-select options score with contains", () => {
  const doc: FunnelDoc = {
    slug: "multi-x", title: "Multi", questions: [
      { id: "goals", prompt: "Goals?", kind: "multi", required: true, options: [
        { value: "leads", label: "Leads", points: 40 },
        { value: "brand", label: "Brand", points: 10 },
      ] },
    ],
    thresholds: { qualified: 40, nurture: 10 },
    outcomes: {
      qualified: { heading: "Q", body: "", ctaLabel: "Book" },
      nurture: { heading: "N", body: "", ctaLabel: "Learn" },
      unqualified: { heading: "U", body: "", ctaLabel: "Later" },
    },
  };
  const cfg = compileFunnel(doc);
  assert.equal(scoreLead({ goals: ["leads", "brand"] }, cfg.rules).score, 50);
  assert.equal(scoreLead({ goals: ["brand"] }, cfg.rules).status, "nurture");
});

test("compileFunnel carries contact capture config through", () => {
  const doc = blankFunnelDoc("contact-x", "Contact");
  const cfg = compileFunnel(doc);
  assert.equal(cfg.contact?.enabled, true);
  assert.equal(cfg.contact?.askName, true);
  assert.equal(cfg.contact?.requirePhone, false);
  // A funnel without contact compiles to no contact config (opt-out is honoured).
  const off = compileFunnel({ ...doc, contact: undefined });
  assert.equal(off.contact, undefined);
});

test("validateFunnelDoc catches the common mistakes", () => {
  const ok = blankFunnelDoc("valid-x", "Valid");
  assert.equal(validateFunnelDoc(ok), null);
  assert.match(validateFunnelDoc({ ...ok, slug: "demo" })!, /reserved/);
  assert.match(validateFunnelDoc({ ...ok, slug: "Bad Slug" })!, /lowercase/);
  assert.match(validateFunnelDoc({ ...ok, title: "" })!, /title/);
  assert.match(validateFunnelDoc({ ...ok, questions: [] })!, /at least one question/);
  assert.match(validateFunnelDoc({ ...ok, thresholds: { qualified: 10, nurture: 50 } })!, /at least the nurture/);
});

test("saveFunnel persists, resolveFunnelConfig serves it, delete removes it", async () => {
  const slug = SLUG;
  const doc = blankFunnelDoc(slug, "Store Test");
  const saved = await saveFunnel(WS, doc, true);
  assert.equal(saved.slug, slug);
  assert.equal(saved.workspaceId, WS);

  const stored = await getStoredFunnel(slug);
  assert.equal(stored?.doc.title, "Store Test");

  // The public runtime resolves the stored funnel (compiled), not the demo.
  const cfg = await resolveFunnelConfig(slug);
  assert.equal(cfg?.title, "Store Test");
  assert.equal((await listWorkspaceFunnels(WS)).some((f) => f.slug === slug), true);

  assert.equal(await deleteFunnel(WS, slug), true);
  assert.equal(await getStoredFunnel(slug), null);
});

test("another workspace cannot overwrite an owned slug", async () => {
  const slug = "fbtest-owned-" + Math.random().toString(36).slice(2, 6);
  await saveFunnel(WS, blankFunnelDoc(slug, "Mine"), true);
  await assert.rejects(() => saveFunnel(`${WS}-other`, blankFunnelDoc(slug, "Theirs"), true), FunnelSlugTakenError);
  await deleteFunnel(WS, slug);
});

test("resolveFunnelConfig falls back to the demo, and hides an unpublished funnel", async () => {
  assert.equal((await resolveFunnelConfig("demo"))?.slug, "demo");
  const slug = "fbtest-draft-" + Math.random().toString(36).slice(2, 6);
  await saveFunnel(WS, blankFunnelDoc(slug, "Draft"), false); // unpublished
  assert.equal(await resolveFunnelConfig(slug), null, "an unpublished funnel is not served publicly");
  await deleteFunnel(WS, slug);
});

// ── attainableMaxScore + threshold validation (P0 defects) ──────────────────
// These are pure (no DB) and guard the two confirmed audit defects.

function q(id: string, kind: BuilderQuestion["kind"], pts: number[]): BuilderQuestion {
  return { id, prompt: id, kind, options: pts.map((p, i) => ({ value: `${id}_${i}`, label: `o${i}`, points: p })) };
}
function docWith(questions: BuilderQuestion[], thresholds: { qualified: number; nurture: number }): FunnelDoc {
  const d = blankFunnelDoc("maxtest", "Max"); d.questions = questions; d.thresholds = thresholds; return d;
}

test("attainableMaxScore: single-choice counts only its highest positive option", () => {
  assert.equal(attainableMaxScore({ questions: [q("a", "single", [5, 10, 3])] }), 10);
});
test("attainableMaxScore: multi-choice sums all positive options", () => {
  assert.equal(attainableMaxScore({ questions: [q("a", "multi", [5, 10, 3])] }), 18);
});
test("attainableMaxScore: number/text questions are unscored", () => {
  assert.equal(attainableMaxScore({ questions: [q("a", "number", [5]), q("b", "text", [9])] }), 0);
});
test("attainableMaxScore: mixes single + multi correctly (not a naive total)", () => {
  // naive sum of all positives would be 10 + 18 = 28; correct = 10 (single max) + 18 (multi sum) = 28? no:
  // single a: max(5,10,3)=10 ; multi b: 2+4=6 → 16. Naive all-positive sum = 10+3+5+2+4 = 24.
  const doc = { questions: [q("a", "single", [5, 10, 3]), q("b", "multi", [2, 4])] };
  assert.equal(attainableMaxScore(doc), 16);
});

test("validateFunnelDoc: rejects a qualified threshold above the attainable maximum", () => {
  const doc = docWith([q("a", "single", [5, 10, 3])], { qualified: 25, nurture: 5 });
  assert.match(validateFunnelDoc(doc) ?? "", /above the maximum attainable/);
});
test("validateFunnelDoc: rejects negative and non-finite thresholds", () => {
  assert.match(validateFunnelDoc(docWith([q("a", "single", [10, 5])], { qualified: -1, nurture: 0 })) ?? "", /negative/);
  assert.match(validateFunnelDoc(docWith([q("a", "single", [10, 5])], { qualified: NaN, nurture: 0 })) ?? "", /finite/);
});
test("validateFunnelDoc: accepts thresholds within the attainable range", () => {
  const doc = docWith([q("a", "single", [5, 10, 3])], { qualified: 10, nurture: 5 });
  assert.equal(validateFunnelDoc(doc), null);
});

test("compileFunnel: a doc's payment step compiles through to a payable runtime config", () => {
  const doc = docWith([q("a", "single", [5, 10, 3])], { qualified: 10, nurture: 5 });
  doc.payment = { enabled: true, priceCents: 4900, currency: "gbp", label: "Reserve your spot", description: "Strategy call deposit" };
  const cfg = compileFunnel(doc);
  assert.ok(cfg.payment, "payment must survive compilation");
  assert.equal(cfg.payment!.priceCents, 4900);
  assert.equal(cfg.payment!.currency, "gbp");
  assert.equal(isPayable(cfg.payment), true);
});

test("compileFunnel: no payment step compiles to a non-payable config", () => {
  const doc = docWith([q("a", "single", [5, 10, 3])], { qualified: 10, nurture: 5 });
  const cfg = compileFunnel(doc);
  assert.equal(isPayable(cfg.payment), false);
});
