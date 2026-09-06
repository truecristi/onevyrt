/**
 * Pulls the real business signals (Readiness Score, top goal, overdue
 * work) from a workspace's primary project into the programme dashboard —
 * the "current business goal" / "KPI actual vs target" pieces of the Home
 * Command Centre spec. Deliberately thin: no new computation, just wiring
 * already-built engine functions (computeReadiness, rootGoals,
 * rollUpStatus) against the project doc that already exists, server-side,
 * so the dashboard doesn't need the client to have that project open.
 *
 * "Primary project" = the workspace's most-recently-updated project that
 * actually has goals or force-actions — see lib/studio/primary-project.ts.
 * NOT the same predicate api/my-business/summary uses (that one cares
 * about program.definition being populated, this one cares about goal/
 * force-action activity); a project can have one without the other.
 */
import { pickPrimaryProject } from "./studio/primary-project";
import { computeReadiness, rootGoals, rollUpStatus, type ReadinessLabel } from "@onevyrt/engine";

export interface BusinessSnapshot {
  projectId: string | null;
  projectName: string | null;
  readinessScore: number | null;
  readinessLabel: ReadinessLabel;
  topGoal: { title: string; level: string; status: string } | null;
  overdueCount: number;
}

const EMPTY_SNAPSHOT: BusinessSnapshot = { projectId: null, projectName: null, readinessScore: null, readinessLabel: "no_data", topGoal: null, overdueCount: 0 };

export async function getBusinessSnapshot(workspaceId: string): Promise<BusinessSnapshot> {
  const primary = await pickPrimaryProject(workspaceId, (doc) => (doc.goals?.length ?? 0) > 0 || (doc.program?.forceActions?.length ?? 0) > 0);
  if (!primary) return EMPTY_SNAPSHOT;
  const doc = primary.doc;

  const goals = doc.goals ?? [];
  const assumptions = doc.assumptions ?? [];
  const experiments = doc.experiments ?? [];
  const readiness = computeReadiness(goals, assumptions, experiments);

  const roots = rootGoals(goals);
  const firstRoot = roots[0];
  const topGoal = firstRoot ? { title: firstRoot.title, level: firstRoot.level, status: rollUpStatus(firstRoot.id, goals) } : null;

  const now = Date.now();
  let overdueCount = 0;
  for (const g of goals) {
    if (g.dueDate && new Date(g.dueDate).getTime() < now && rollUpStatus(g.id, goals) !== "done") overdueCount++;
  }
  for (const fa of doc.program?.forceActions ?? []) {
    if (fa.deadline && new Date(fa.deadline).getTime() < now && fa.status !== "done") overdueCount++;
  }

  return { projectId: primary.id, projectName: primary.name, readinessScore: readiness.score, readinessLabel: readiness.label, topGoal, overdueCount };
}
