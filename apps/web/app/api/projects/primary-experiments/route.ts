/**
 * GET /api/projects/primary-experiments — a small, read-only slice of the
 * workspace's "primary" (experiment-bearing) project: just its Experiment
 * Register, not the whole FunnelDoc. Backs the "Recent experiments" widgets
 * on the Offer/Message/Constraint pages (Section 13 of the platform spec —
 * "shared by growth, pricing, offers, operations, and customer experience").
 *
 * Deliberately does NOT promote ExperimentEntry to a per-workspace store —
 * that would strand its siblings (GoalNode, AssumptionEntry), which
 * packages/engine/src/readiness.ts's computeReadiness() reads together with
 * experiments as one per-project unit; splitting just one of the three
 * across scopes would break that coupling and add a new instance of the
 * exact per-project-vs-per-workspace inconsistency already tracked as a
 * cross-section gap. Cross-page read-only surfacing gets the same
 * "shared" outcome without that risk, reusing pickPrimaryProject()
 * (lib/studio/primary-project.ts) exactly as api/projects/primary/route.ts
 * already does, just with a different predicate and a narrower response.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../lib/workspaces";
import { pickPrimaryProject } from "../../../../lib/studio/primary-project";
import { withRouteLogging } from "../../../../lib/logger";
import type { ExperimentEntry } from "@onevyrt/engine";

export const runtime = "nodejs";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

// Enough to give a page a sense of "what's being tested right now" without
// turning this into a full experiments-management surface — that's still
// the Studio Experiments tab's job.
const MAX_RETURNED = 10;

export const GET = withRouteLogging("api/projects/primary-experiments:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const primary = await pickPrimaryProject(wsId, (doc) => (doc.experiments?.length ?? 0) > 0);
  const experiments: ExperimentEntry[] = primary?.doc.experiments ?? [];
  const recent = [...experiments]
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, MAX_RETURNED);
  return json({ projectId: primary?.id ?? null, projectName: primary?.name ?? null, experiments: recent });
});
