/**
 * Programme — Chapter 4 (IMPROVE & SCALE) intro. Server-rendered STRUCTURE
 * (the chapter's title/outcome from the canonical curriculum, and the 5
 * subchapters from lib/chapter-4) so signed-out visitors see the whole
 * chapter with no flash; the live per-learner overlay (Chapter 3 prerequisite,
 * each subchapter's status, the chapter-submit gate) is added by the
 * Chapter4Intro client component, exactly the way /programme itself layers
 * ProgrammeJourney over the same curriculum read.
 */
import type { Metadata } from "next";
import { getDefaultProgramme } from "../../../lib/curriculum-store";
import { CHAPTER_4_SUBCHAPTERS } from "../../../lib/chapter-4";
import { Chapter4Intro } from "../../../components/Chapter4Intro";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chapter 4 — Improve & Scale — ONEVYRT" };

const FALLBACK_TITLE = "Chapter 4 — Improve and Scale the Business";
const FALLBACK_OUTCOME =
  "Momentum: the single biggest constraint on growth found and named, conversion improved, profit improved, the repetitive work systemised, and all of it turned into a dated 90-day roadmap — your Growth & Improvement Plan.";

export default async function Chapter4Page() {
  let stageTitle = FALLBACK_TITLE;
  let stageOutcome = FALLBACK_OUTCOME;
  try {
    const programme = await getDefaultProgramme();
    const stage = programme.stages.find((s) => s.id === "chapter-4");
    if (stage) { stageTitle = stage.title; stageOutcome = stage.outcome; }
  } catch {
    /* keep the fallback copy — the page still renders the chapter structure */
  }

  const subchapters = CHAPTER_4_SUBCHAPTERS.map((s) => ({ code: s.code, slug: s.slug, title: s.title, moduleId: s.moduleId }));

  return <Chapter4Intro stageTitle={stageTitle} stageOutcome={stageOutcome} subchapters={subchapters} />;
}
