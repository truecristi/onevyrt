/**
 * Shared "which project represents this workspace" heuristic. Three call
 * sites (api/my-business/summary, lib/programme-business-snapshot.ts, and
 * business-intelligence/page.tsx's own project-picking) each used to
 * hardcode "most recently updated project = primary" — listProjects()
 * already returns newest-first, so all three just took index 0. That's a
 * real, demonstrated bug: lightly touching an unrelated second project in
 * the same workspace flips which one is "primary," and a fully-completed
 * Business Intelligence workbook on the OLDER project can disappear from
 * view entirely.
 *
 * pickPrimaryProject() fixes this by scanning newest-first (the existing
 * default order, unchanged) for the first project whose doc actually has
 * the kind of content the CALLER cares about — falling back to the newest
 * project if none qualify, so a workspace that already resolves correctly
 * today never regresses. Parameterized by `hasContent` rather than one
 * hardcoded rule: "does this project have a real business definition" and
 * "does this project have any real goals/force-actions" are different
 * questions with different right answers — conflating them would just
 * move the same bug to a different field.
 */
import { listProjects, loadProject } from "../store";
import { deserializeDoc, type FunnelDoc, type BusinessDefinition } from "@onevyrt/engine";

export interface PrimaryProject {
  id: string;
  name: string;
  doc: FunnelDoc;
}

// No real multi-project test data or product decision exists for a
// workspace with many projects (confirmed by this session's own research —
// this app has no project-count ceiling at all). Bounded so a pathological
// many-project workspace can't turn this into an unbounded scan; comfortably
// covers any real multi-project use today.
const SCAN_LIMIT = 10;

export async function pickPrimaryProject(
  workspaceId: string,
  hasContent: (doc: FunnelDoc) => boolean,
): Promise<PrimaryProject | null> {
  const projects = await listProjects(workspaceId);
  if (projects.length === 0) return null;

  for (const meta of projects.slice(0, SCAN_LIMIT)) {
    const stored = await loadProject(workspaceId, meta.id);
    if (!stored) continue;
    let doc: FunnelDoc;
    try {
      doc = deserializeDoc(stored.doc);
    } catch {
      continue;
    }
    if (hasContent(doc)) return { id: meta.id, name: stored.name, doc };
  }

  // Nothing scanned had the content this caller cares about — fall back to
  // the newest project (today's behavior), so a workspace that already
  // resolved correctly never regresses.
  const fallback = projects[0]!;
  const stored = await loadProject(workspaceId, fallback.id);
  if (!stored) return null;
  try {
    return { id: fallback.id, name: stored.name, doc: deserializeDoc(stored.doc) };
  } catch {
    return null;
  }
}

/** True if any of BusinessDefinition's fields is a non-empty string. Used by
 *  callers whose notion of "primary" is about the business-definition
 *  workbook (my-business/summary, business-intelligence's primary-project
 *  picker) — NOT by lib/programme-business-snapshot.ts, whose own concern
 *  (goals/force-actions) needs a different predicate. */
export function hasAnyDefinitionField(definition: BusinessDefinition | undefined): boolean {
  if (!definition) return false;
  return Object.values(definition).some((v) => typeof v === "string" && v.trim().length > 0);
}
