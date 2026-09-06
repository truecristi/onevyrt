import test, { after } from "node:test";
import assert from "node:assert/strict";
import { saveProject } from "../lib/store";
import { pgPool } from "../lib/db";
import { pickPrimaryProject, hasAnyDefinitionField } from "../lib/studio/primary-project";
import { getBusinessSnapshot } from "../lib/programme-business-snapshot";
import { uid } from "./helpers/pg";

/**
 * lib/studio/primary-project.ts's pickPrimaryProject() — fixes a real,
 * demonstrated bug: api/my-business/summary, lib/programme-business-snapshot.ts,
 * and business-intelligence/page.tsx each used to take listProjects()[0]
 * (the most-recently-updated project) unconditionally as "the workspace's
 * business." Lightly touching an unrelated second, blank project could
 * flip which one is "primary" and make a fully-completed Business
 * Intelligence workbook on the OLDER project disappear from view.
 */

const WS_PREFIX = uid("primary-project");

after(async () => {
  await pgPool().query("DELETE FROM projects WHERE scope_key LIKE $1", [`${WS_PREFIX}%`]);
});

function blankDoc(): string {
  return JSON.stringify({ nodes: [], edges: [] });
}
function docWithDefinition(businessName: string): string {
  return JSON.stringify({ nodes: [], edges: [], program: { definition: { businessName } } });
}

test("pickPrimaryProject: prefers a project with content even when a newer project is blank", async () => {
  const ws = `${WS_PREFIX}-sibling`;
  await saveProject(ws, "with-content", "Has Definition", docWithDefinition("Acme Coaching"));
  // Saved AFTER, so it's the more-recently-updated project — the exact
  // real-world shape of the bug (touching an unrelated blank funnel).
  await new Promise((r) => setTimeout(r, 5));
  await saveProject(ws, "blank", "Blank Funnel", blankDoc());

  const primary = await pickPrimaryProject(ws, (doc) => hasAnyDefinitionField(doc.program?.definition));
  assert.equal(primary?.id, "with-content", "the project with a real definition must win, even though the blank one is newer");
  assert.equal(primary?.doc.program?.definition?.businessName, "Acme Coaching");
});

test("pickPrimaryProject: falls back to the newest project when nothing qualifies (today's existing behavior)", async () => {
  const ws = `${WS_PREFIX}-fallback`;
  await saveProject(ws, "first", "First", blankDoc());
  await new Promise((r) => setTimeout(r, 5));
  await saveProject(ws, "second", "Second", blankDoc());

  const primary = await pickPrimaryProject(ws, (doc) => hasAnyDefinitionField(doc.program?.definition));
  assert.equal(primary?.id, "second", "falls back to the newest project when none have the content this caller cares about");
});

test("pickPrimaryProject: returns null for a workspace with no projects", async () => {
  const ws = `${WS_PREFIX}-empty`;
  const primary = await pickPrimaryProject(ws, () => true);
  assert.equal(primary, null);
});

test("getBusinessSnapshot: uses the primary project with real goal/force-action activity, not just the newest one", async () => {
  const ws = `${WS_PREFIX}-snapshot`;
  await saveProject(
    ws, "with-goals", "Has Goals",
    JSON.stringify({ nodes: [], edges: [], goals: [{ id: "g1", level: "quarterly", title: "Grow MRR", status: "on_track", createdAt: "2026-01-01T00:00:00.000Z" }] }),
  );
  await new Promise((r) => setTimeout(r, 5));
  await saveProject(ws, "blank", "Blank Funnel", blankDoc()); // more recently updated, no activity

  const snapshot = await getBusinessSnapshot(ws);
  assert.equal(snapshot.projectId, "with-goals", "the project with real goal activity must win, even though the blank one is newer");
  assert.equal(snapshot.topGoal?.title, "Grow MRR");
});

test("hasAnyDefinitionField: false for undefined/empty, true when any field is a non-empty string", () => {
  assert.equal(hasAnyDefinitionField(undefined), false);
  assert.equal(hasAnyDefinitionField({}), false);
  assert.equal(hasAnyDefinitionField({ businessName: "" }), false, "an explicit empty string is not content");
  assert.equal(hasAnyDefinitionField({ businessName: "Acme" }), true);
  assert.equal(hasAnyDefinitionField({ weeklyFocus: "Ship the audit" }), true, "any one of the 14 fields counts, not just businessName");
});
