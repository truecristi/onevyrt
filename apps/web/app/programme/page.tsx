/**
 * Programme — the canonical four-chapter journey (DEFINE, IMPLEMENT, CONTROL,
 * IMPROVE & SCALE) plus Start and Finish. Server-rendered STRUCTURE (chapters,
 * modules, each module's tool link) from the same curriculum the course uses, so
 * it can never drift and signed-out visitors see the whole path with no flash.
 * The live per-learner overlay (real position, locks, progress, the Continue CTA)
 * is added on top by the ProgrammeJourney client component, which reads the
 * engine's buildProgrammeMap via /api/programme/enrollment.
 */
import type { Metadata } from "next";
import {
  CANONICAL_STAGES,
  orderedStages,
  orderedLessons,
  type ProgrammeTemplate,
  type PsychologicalState,
} from "@onevyrt/engine";
import { getDefaultProgramme } from "../../lib/curriculum-store";
import { resolveToolHref } from "../../lib/programme-tool-links";
import { ProgrammeJourney, type JourneyStage } from "../../components/ProgrammeJourney";

// Reads the DB at request time — never statically prerendered at build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Programme — ONEVYRT" };

function stateOf(stageId: string): PsychologicalState {
  return CANONICAL_STAGES.find((s) => s.id === stageId)?.state ?? "clarity";
}
function outputOf(stageId: string): string | null {
  return CANONICAL_STAGES.find((s) => s.id === stageId)?.output ?? null;
}
/** A route the journey can link to, or null (a non-route deep-link stays text). */
function toolHrefOf(deepLink: string | undefined): string | null {
  return typeof deepLink === "string" && deepLink.startsWith("/") ? deepLink : null;
}

export default async function ProgrammePage() {
  // Defaults to null; if the DB is unreachable we keep that and fall back to the
  // canonical shape below, so the page always renders the arc.
  let programme: ProgrammeTemplate | null = null;
  try {
    programme = await getDefaultProgramme();
  } catch {
    /* keep the null fallback */
  }

  const orderedSource = programme
    ? orderedStages(programme)
    : CANONICAL_STAGES.map((s) => ({ id: s.id, order: s.order, title: s.title, outcome: s.outcome, lessons: [] as ProgrammeTemplate["stages"][number]["lessons"] }));

  const stages: JourneyStage[] = orderedSource.map((stage, idx) => ({
    id: stage.id,
    num: idx,
    title: stage.title,
    outcome: stage.outcome,
    state: stateOf(stage.id),
    output: outputOf(stage.id),
    modules: orderedLessons(stage as ProgrammeTemplate["stages"][number]).map((l) => ({
      id: l.id,
      title: l.title,
      outcome: l.outcome,
      toolHref: resolveToolHref(l.id, toolHrefOf(l.toolDeepLink)),
    })),
  }));

  const totalModules = stages.reduce((n, s) => n + s.modules.length, 0);

  return <ProgrammeJourney stages={stages} totalModules={totalModules} />;
}
