import test, { after } from "node:test";
import assert from "node:assert/strict";
import { publishTemplate, listSharedTemplates, getSharedTemplate, recordTemplateUse, unpublishTemplate } from "../lib/studio/shared-templates";
import { blankFunnelDoc } from "../lib/studio/funnel-builder";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const AUTHOR = uid("tmpl-ws");
const OTHER = uid("tmpl-ws2");
const NAME_A = uid("Fitness funnel");
const NAME_B = uid("Agency funnel");

after(async () => {
  await pgPool().query("DELETE FROM shared_templates WHERE author_workspace_id = ANY($1)", [[AUTHOR, OTHER]]);
});

test("publishing validates and strips the live slug", async () => {
  const doc = blankFunnelDoc("live-slug", "Fitness funnel");
  const t = await publishTemplate(AUTHOR, { name: NAME_A, description: "For coaches", category: "coach", doc });
  assert.equal(t.name, NAME_A);
  assert.equal(t.uses, 0);
  assert.equal(t.authorWorkspaceId, AUTHOR);

  const full = await getSharedTemplate(t.id);
  assert.ok(full, "fetchable by id");
  assert.equal(full!.doc.slug, "", "the live slug is stripped — a copy gets a fresh one");
  assert.equal(full!.doc.questions.length, doc.questions.length, "the structure is preserved");
});

test("a broken doc is rejected before it reaches the gallery", async () => {
  const doc = blankFunnelDoc("x", "Broken");
  doc.questions = []; // no questions → invalid
  await assert.rejects(() => publishTemplate(AUTHOR, { name: "Broken", doc }), /question/i);
});

test("a blank name is rejected", async () => {
  const doc = blankFunnelDoc("x", "Nameless");
  await assert.rejects(() => publishTemplate(AUTHOR, { name: "   ", doc }), /name/i);
});

test("the gallery lists most-used first, then newest", async () => {
  const b = await publishTemplate(OTHER, { name: NAME_B, doc: blankFunnelDoc("y", "Agency funnel") });
  // Give B two uses; A (from the first test) has zero.
  await recordTemplateUse(b.id);
  await recordTemplateUse(b.id);

  const list = await listSharedTemplates();
  const mine = list.filter((t) => t.authorWorkspaceId === AUTHOR || t.authorWorkspaceId === OTHER);
  const idxB = mine.findIndex((t) => t.id === b.id);
  const idxA = mine.findIndex((t) => t.name === NAME_A);
  assert.ok(idxB >= 0 && idxA >= 0, "both templates listed");
  assert.ok(idxB < idxA, "the more-used template sorts ahead");
  assert.equal(mine.find((t) => t.id === b.id)!.uses, 2);
});

test("recordTemplateUse bumps the counter", async () => {
  const t = await publishTemplate(AUTHOR, { name: uid("Counter"), doc: blankFunnelDoc("z", "Counter") });
  await recordTemplateUse(t.id);
  await recordTemplateUse(t.id);
  await recordTemplateUse(t.id);
  const full = await getSharedTemplate(t.id);
  assert.equal(full!.uses, 3);
});

test("unpublish is scoped to the author — a stranger can't remove it", async () => {
  const t = await publishTemplate(AUTHOR, { name: uid("Scoped"), doc: blankFunnelDoc("s", "Scoped") });
  assert.equal(await unpublishTemplate(OTHER, t.id), false, "another workspace can't unpublish it");
  assert.ok(await getSharedTemplate(t.id), "still present");
  assert.equal(await unpublishTemplate(AUTHOR, t.id), true, "the author removes it");
  assert.equal(await getSharedTemplate(t.id), null, "gone");
});
