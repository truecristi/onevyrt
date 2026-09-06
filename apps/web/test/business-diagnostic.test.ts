import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createWorkspace } from "../lib/workspaces";
import {
  getDiagnostic,
  patchDiagnosticCategory,
  sanitizeDiagnostic,
  DIAGNOSTIC_CATEGORY_ORDER,
  type DiagnosticCategoryEntry,
} from "../lib/business-diagnostic";
import { uid, purgeWorkspacesByNamePrefix } from "./helpers/pg";

/**
 * lib/business-diagnostic.ts — Section 2's first slice (platform spec
 * "Business diagnostic and 7 Forces wheel"). Covers the sanitizer, the
 * category-level partial merge, and the same advisory-lock concurrency
 * regression already tested for lib/offer.ts / lib/reality.ts (this module
 * was built with the lock from the start, but the guarantee is only real
 * if it's actually exercised).
 */

const PREFIX = uid("biz-diagnostic-test");
after(async () => { await purgeWorkspacesByNamePrefix(PREFIX); });

const FULL_ENTRY: DiagnosticCategoryEntry = {
  score: 62, target: 85, confidence: "medium",
  evidence: "Booked calls dropped 30% this quarter.",
  biggestConstraint: "No consistent follow-up on warm leads.",
  recommendedActions: "Add a 3-touch follow-up sequence.",
};

test("getDiagnostic: a fresh workspace has no categories scored yet", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-fresh`);
  const d = await getDiagnostic(ws.id);
  assert.deepEqual(d.categories, {});
  assert.equal(d.updatedAt, undefined);
});

test("patchDiagnosticCategory: sets one category; a second read reflects it", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-set`);
  const saved = await patchDiagnosticCategory(ws.id, "salesMarketing", FULL_ENTRY);
  assert.deepEqual(saved.categories.salesMarketing, FULL_ENTRY);
  assert.ok(saved.updatedAt);

  const reread = await getDiagnostic(ws.id);
  assert.deepEqual(reread.categories.salesMarketing, FULL_ENTRY);
});

test("patchDiagnosticCategory: touching one category never wipes an untouched sibling", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-sibling`);
  await patchDiagnosticCategory(ws.id, "ownerPsychology", { ...FULL_ENTRY, score: 40 });
  await patchDiagnosticCategory(ws.id, "financeMeasurement", { ...FULL_ENTRY, score: 20 });

  const d = await getDiagnostic(ws.id);
  assert.equal(d.categories.ownerPsychology?.score, 40, "the first category must survive a later patch to a different category");
  assert.equal(d.categories.financeMeasurement?.score, 20);
  assert.equal(Object.keys(d.categories).length, 2, "only the two touched categories should exist — no eagerly-created empty shells for the other 6");
});

test("patchDiagnosticCategory: a partial patch merges onto the category's own existing fields, not onto empty defaults", async () => {
  const ws = await createWorkspace("u1", `${PREFIX}-partial`);
  await patchDiagnosticCategory(ws.id, "peopleCulture", FULL_ENTRY);
  const updated = await patchDiagnosticCategory(ws.id, "peopleCulture", { score: 75 });
  assert.equal(updated.categories.peopleCulture?.score, 75, "the field just patched must apply");
  assert.equal(updated.categories.peopleCulture?.evidence, FULL_ENTRY.evidence, "fields not present in the patch must survive from the existing entry");
  assert.equal(updated.categories.peopleCulture?.recommendedActions, FULL_ENTRY.recommendedActions);
});

test("patchDiagnosticCategory: two truly concurrent patches to different categories both survive (advisory-lock regression)", async () => {
  // Without the lock, both concurrent patches would read the SAME pre-write
  // `current` and each write back a merge missing the other's change — the
  // exact race this module was built to avoid from the start (see
  // lib/offer.ts's own regression test for the same shape of bug, found
  // for real in app/api/campaign-studio/brand/route.ts).
  const ws = await createWorkspace("u1", `${PREFIX}-concurrent`);
  await patchDiagnosticCategory(ws.id, "businessPlanning", { score: 10 }); // an existing category that must survive both concurrent writes below

  await Promise.all([
    patchDiagnosticCategory(ws.id, "operationsSystems", { score: 55, evidence: "Half our SOPs are undocumented." }),
    patchDiagnosticCategory(ws.id, "customerExperience", { score: 70, evidence: "NPS holding steady at 42." }),
  ]);

  const reread = await getDiagnostic(ws.id);
  assert.equal(reread.categories.operationsSystems?.score, 55, "the first concurrent patch's change must survive");
  assert.equal(reread.categories.customerExperience?.score, 70, "the second concurrent patch's change must survive");
  assert.equal(reread.categories.businessPlanning?.score, 10, "an untouched sibling category must survive both concurrent patches");
});

test("sanitizeDiagnostic: clips score/target to 0..100, defaults an invalid confidence to low, and drops unknown category ids", async () => {
  const clean = sanitizeDiagnostic({
    categories: {
      ownerPsychology: { score: 500, target: -10, confidence: "extreme", evidence: "x".repeat(2000), biggestConstraint: "y", recommendedActions: "z" },
      notARealCategory: { score: 50 },
    },
  });
  assert.equal(clean.categories.ownerPsychology?.score, 100);
  assert.equal(clean.categories.ownerPsychology?.target, 0);
  assert.equal(clean.categories.ownerPsychology?.confidence, "low");
  assert.equal(clean.categories.ownerPsychology?.evidence.length, 1000);
  assert.equal((clean.categories as Record<string, unknown>).notARealCategory, undefined, "an unrecognized category id must be dropped, not silently persisted");
});

test("sanitizeDiagnostic: an empty/malformed input never throws — returns an empty categories map", async () => {
  assert.deepEqual(sanitizeDiagnostic(undefined).categories, {});
  assert.deepEqual(sanitizeDiagnostic(null).categories, {});
  assert.deepEqual(sanitizeDiagnostic({}).categories, {});
  assert.deepEqual(sanitizeDiagnostic({ categories: "not an object" }).categories, {});
});

test("DIAGNOSTIC_CATEGORY_ORDER: exactly the spec's 8 categories, each unique", () => {
  assert.equal(DIAGNOSTIC_CATEGORY_ORDER.length, 8);
  assert.equal(new Set(DIAGNOSTIC_CATEGORY_ORDER).size, 8);
});
