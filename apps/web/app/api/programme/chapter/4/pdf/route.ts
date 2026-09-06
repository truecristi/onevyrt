/**
 * Growth & Improvement Plan PDF export. Downloads the current plan as a
 * single-page or multi-page PDF, ready to print or archive.
 *
 * Server-side only: fetches the plan, generates the PDF using jsPDF,
 * returns it as an attachment with the workspace name in the filename.
 */
import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../../lib/workspaces";
import { getChapter4Submission } from "../../../../../../lib/chapter4-submissions";
import { formatPlan } from "../../../../../../lib/growth-plan-utils";
import { buildGrowthPlanPdf, filenameFor } from "../../../../../../lib/reports/growth-plan-pdf";
import { pgPool } from "../../../../../../lib/db";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";

const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

/**
 * GET /api/programme/chapter/4/pdf — Generates and downloads the current
 * Growth & Improvement Plan as a PDF. Requires workspace membership.
 * Any workspace member can download (the artifact is workspace-shared).
 */
export const GET = withRouteLogging("api/programme/chapter/4/pdf:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  // Fetch workspace name for the filename
  const wsRow = await pgPool().query("SELECT name FROM workspaces WHERE id = $1", [wsId]);
  const workspaceName = wsRow.rows[0]?.name || "workspace";

  // Fetch the chapter 4 submission
  const submission = await getChapter4Submission(wsId);
  if (!submission) {
    return json({ error: "No Growth & Improvement Plan found for this workspace." }, 404);
  }

  // Format and generate PDF
  const plan = formatPlan(submission);
  const doc = buildGrowthPlanPdf(plan, workspaceName);
  const pdfBytes = new Uint8Array(doc.output("arraybuffer"));
  const filename = filenameFor(workspaceName);

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(pdfBytes.length),
    },
  });
});
