/**
 * My Business Summary API — unified profile data for the learner's business.
 *
 * Wires together six data sources (BusinessDefinition from FunnelDoc, Reality
 * Map, Growth Constraint, Offer and Message from business-os, and Brand
 * Profile from brand brain) into one canonical MyBusiness profile using the
 * engine's assembleMyBusiness().
 *
 * ENHANCED: Also includes programme outputs (all chapters + finish) with
 * submission status, approvals, and coach feedback. Shows the cumulative
 * record of all permanent artifacts built across the programme.
 *
 * This is the data layer for /my-business page and any other surfaces
 * that need the learner's consolidated business snapshot.
 */
import { currentUser } from "../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, getWorkspace } from "../../../../lib/workspaces";
import { getBusiness } from "../../../../lib/business";
import { getBrandProfile } from "../../../../lib/brand";
import { getConstraint } from "../../../../lib/constraint";
import { getOffer } from "../../../../lib/offer";
import { getMessage, composeOneLiner } from "../../../../lib/message";
import { pickPrimaryProject, hasAnyDefinitionField } from "../../../../lib/studio/primary-project";
import { assembleMyBusiness, myBusinessCompleteness, chapterGates, CANONICAL_STAGES, type MyBusiness, type MyBusinessCompleteness, type BusinessDefinition, type ProgrammeOutput } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../lib/logger";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { getEnrollment } from "../../../../lib/enrollments";
import { listChapterSubmissions } from "../../../../lib/chapter-submissions";
import { effectiveStageAccessLimit, listCohortsForWorkspace } from "../../../../lib/cohorts";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export interface MyBusinessSummaryResponse {
  myBusiness: MyBusiness;
  completeness: MyBusinessCompleteness;
  workspace: { id: string; name: string };
}

/**
 * GET /api/my-business/summary
 *
 * Returns the signed-in user's unified business profile, assembled from:
 * - FunnelDoc.program.definition (BusinessDefinition from the primary project)
 * - Business-OS Reality Map (current numbers, vision horizons)
 * - Business-OS Growth Constraint (the declared current bottleneck)
 * - Business-OS Offer (name, guarantee, price anchor)
 * - Business-OS Message (the composed one-liner)
 * - Brand Brain (company positioning, message)
 *
 * Precedence is per-fact, not one global order — see assembleMyBusiness()'s
 * own doc comment for which source wins for each field. All fields optional
 * until the learner fills them in across the workspace.
 */
export const GET = withRouteLogging("api/my-business/summary:GET", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  try {
    // Load all data sources in parallel
    const [workspace, business, brand, constraint, offer, message, primaryProject, programme, enrollment, submissions, stageAccessLimit, cohorts] = await Promise.all([
      getWorkspace(wsId),
      getBusiness(wsId),
      getBrandProfile(wsId),
      getConstraint(wsId),
      getOffer(wsId),
      getMessage(wsId),
      pickPrimaryProject(wsId, (doc) => hasAnyDefinitionField(doc.program?.definition)),
      getDefaultProgramme(),
      getEnrollment(wsId),
      listChapterSubmissions(wsId),
      effectiveStageAccessLimit(wsId),
      listCohortsForWorkspace(wsId),
    ]);

    // BusinessDefinition from the primary project — the first project
    // (newest-first) whose definition actually has content, not just
    // whichever project was most recently touched (see
    // lib/studio/primary-project.ts: touching an unrelated blank project
    // used to be able to hide a fully-completed workbook on an older one).
    const definition: BusinessDefinition | undefined = primaryProject?.doc.program?.definition;

    // Assemble the unified profile from the three sources
    // Adapt BrandProfile to MyBusinessBrandInput (extract only the fields we need)
    const brandInput = brand
      ? {
          companyName: brand.companyName,
          industry: brand.industry,
          description: brand.description,
          audience: brand.audience,
          competitors: brand.competitors,
          guarantees: brand.guarantees,
          pricingNotes: brand.pricingNotes,
          brandVoice: brand.brandVoice,
          messageOneLiner: brand.message?.oneLiner,
          customerProblem: brand.message?.problem,
          customerSuccess: brand.message?.success,
        }
      : undefined;

    const myBusiness = assembleMyBusiness({
      definition,
      reality: business.realityMap,
      brand: brandInput,
      constraint: { chosen: constraint.chosen },
      offer: { name: offer.name, guarantee: offer.guarantee, priceAnchor: offer.priceAnchor },
      message: { oneLiner: composeOneLiner(message) },
    });

    // Calculate completeness for progress indicators
    const completeness = myBusinessCompleteness(myBusiness);

    // Build programme outputs list
    const gates = enrollment ? chapterGates(programme, enrollment, submissions, stageAccessLimit) : [];
    const coach = cohorts[0] ? { name: cohorts[0].coachEmail.split("@")[0], email: cohorts[0].coachEmail } : null;

    const programmeOutputs: ProgrammeOutput[] = gates
      .filter((g) => CANONICAL_STAGES.some((s) => s.id === g.stageId))
      .map((gate) => {
        const stageMeta = CANONICAL_STAGES.find((s) => s.id === gate.stageId);
        const submission = gate.submission;

        return {
          stageId: gate.stageId,
          title: stageMeta?.title || gate.stageId,
          outputName: stageMeta?.output,
          status:
            gate.state === "approved"
              ? "approved"
              : gate.state === "awaiting_review"
                ? "awaiting_review"
                : gate.state === "changes_requested"
                  ? "changes_requested"
                : gate.state === "ready_to_submit" || gate.state === "in_progress"
                  ? "in_progress"
                : gate.state === "locked"
                  ? "locked"
                : "not_started",
          submittedAt: submission?.submittedAt,
          approvedAt: submission?.reviewedAt && gate.state === "approved" ? submission.reviewedAt : undefined,
          coachName: coach?.name,
          coachEmail: coach?.email,
          coachFeedback: submission?.coachFeedback,
          lessonsComplete: gate.lessonsComplete,
          lessonsTotal: gate.lessonsTotal,
        };
      });

    // Add programme outputs to myBusiness
    if (programmeOutputs.length > 0) {
      myBusiness.programmeOutputs = programmeOutputs;
    }

    return json({
      myBusiness,
      completeness,
      workspace: workspace ? { id: workspace.id, name: workspace.name } : { id: wsId, name: "" },
    } as MyBusinessSummaryResponse);
  } catch (error) {
    console.error("Error in /api/my-business/summary:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
