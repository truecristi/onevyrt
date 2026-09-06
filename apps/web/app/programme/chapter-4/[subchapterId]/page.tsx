/**
 * Programme — Chapter 4 (IMPROVE & SCALE) subchapter page: the individual
 * 4.1–4.5 learning step. Two content sources, both pure/server-rendered so the
 * page never flashes:
 *   - lib/chapter-4's expanded teaching (title/description/keyPoints/
 *     learningObjectives/actionItems) — the rich subchapter copy.
 *   - the canonical curriculum lesson (findLesson on the engine's "chapter-4"
 *     stage) — the real assignment (checklist + evidence prompt) the learner
 *     actually submits, via the SAME LessonGuide component chapters 1-3 use.
 * The live per-learner state (status, locking, submit) is layered on by
 * LessonGuide reading /api/programme/enrollment, scoped to THIS subchapter's
 * moduleId — identical mechanics to chapters 1-3, just under Chapter 4's own
 * route (basePath="/programme/chapter-4") so prev/next and the back link stay
 * inside the chapter instead of jumping to the whole-programme guide.
 */
import type { Metadata } from "next";
import { findLesson } from "@onevyrt/engine";
import { getDefaultProgramme } from "../../../../lib/curriculum-store";
import { resolveToolHref } from "../../../../lib/programme-tool-links";
import { CHAPTER_4_SUBCHAPTERS, getChapter4SubchapterByCode } from "../../../../lib/chapter-4";
import { LessonGuide, type LessonGuideAssignment, type LessonNeighbor } from "../../../../components/LessonGuide";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ subchapterId: string }> }): Promise<Metadata> {
  const { subchapterId } = await params;
  const sub = getChapter4SubchapterByCode(subchapterId);
  return { title: sub ? `${subchapterId} ${sub.title} — Chapter 4 — ONEVYRT` : "Chapter 4 — ONEVYRT" };
}

function toolHrefOf(deepLink: string | undefined): string | null {
  return typeof deepLink === "string" && deepLink.startsWith("/") ? deepLink : null;
}

export default async function Chapter4SubchapterPage({ params }: { params: Promise<{ subchapterId: string }> }) {
  const { subchapterId } = await params;
  const subchapter = getChapter4SubchapterByCode(subchapterId);
  if (!subchapter) return <SubchapterNotFound />;

  let assignment: LessonGuideAssignment | null = null;
  let content = "";
  let toolHref: string | null = null;
  try {
    const programme = await getDefaultProgramme();
    const found = findLesson(programme, subchapter.moduleId);
    if (found) {
      const { lesson } = found;
      content = lesson.content;
      toolHref = resolveToolHref(lesson.id, toolHrefOf(lesson.toolDeepLink));
      if (lesson.assignment) {
        assignment = {
          title: lesson.assignment.title,
          instructions: lesson.assignment.instructions,
          evidencePrompt: lesson.assignment.evidencePrompt,
          checklist: lesson.assignment.checklist.map((c) => ({ id: c.id, label: c.label })),
        };
      }
    }
  } catch {
    /* keep the fallback content — the page still renders the teaching + neighbours */
  }

  const idx = CHAPTER_4_SUBCHAPTERS.findIndex((s) => s.code === subchapter.code);
  const prev: LessonNeighbor | null = idx > 0 ? { id: CHAPTER_4_SUBCHAPTERS[idx - 1]!.code, title: `${CHAPTER_4_SUBCHAPTERS[idx - 1]!.code} ${CHAPTER_4_SUBCHAPTERS[idx - 1]!.title}` } : null;
  const next: LessonNeighbor | null = idx >= 0 && idx < CHAPTER_4_SUBCHAPTERS.length - 1 ? { id: CHAPTER_4_SUBCHAPTERS[idx + 1]!.code, title: `${CHAPTER_4_SUBCHAPTERS[idx + 1]!.code} ${CHAPTER_4_SUBCHAPTERS[idx + 1]!.title}` } : null;
  const isLast = idx === CHAPTER_4_SUBCHAPTERS.length - 1;

  return (
    <>
      <style>{teachingCss}</style>
      <div className="c4t-wrap">
        <section className="c4t">
          <h2 className="c4t-h">Key points</h2>
          <ul className="c4t-points">
            {subchapter.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <h2 className="c4t-h">You&rsquo;ll be able to</h2>
          <ul className="c4t-points">
            {subchapter.learningObjectives.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <h2 className="c4t-h">This week&rsquo;s actions</h2>
          <ol className="c4t-actions">
            {subchapter.actionItems.map((a, i) => (
              <li key={i}><strong>{a.title}</strong><span>{a.description}</span></li>
            ))}
          </ol>
        </section>
      </div>
      <LessonGuide
        lessonId={subchapter.moduleId}
        stageTitle="Chapter 4 · Improve & Scale"
        stageState="momentum"
        moduleTitle={`${subchapter.code} ${subchapter.title}`}
        outcome=""
        content={content || subchapter.description}
        toolHref={toolHref}
        assignment={assignment}
        numInStage={idx + 1}
        countInStage={CHAPTER_4_SUBCHAPTERS.length}
        prev={prev}
        next={next}
        basePath="/programme/chapter-4"
        backHref="/programme/chapter-4"
        backLabel="← Back to Chapter 4"
      />
      {isLast && (
        <div className="c4t-wrap">
          <a className="c4t-final" href="/programme/chapter-4">
            Once your assignment above is submitted and every subchapter is done, go to Chapter 4 to submit your Growth &amp; Improvement Plan for coach approval →
          </a>
        </div>
      )}
    </>
  );
}

function SubchapterNotFound() {
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "72px 20px", textAlign: "center", color: "var(--ds-text-primary, #111827)" }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#7c3aed", margin: "0 0 10px" }}>
        ONEVYRT · Chapter 4
      </p>
      <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.01em", margin: "0 0 10px" }}>Subchapter not found</h1>
      <p style={{ fontSize: 15, color: "var(--ds-text-secondary, #475569)", margin: "0 0 22px" }}>
        Chapter 4 has five subchapters, 4.1 through 4.5. This link may be out of date.
      </p>
      <a href="/programme/chapter-4" style={{ display: "inline-block", textDecoration: "none", fontWeight: 700, fontSize: 14, color: "#fff", background: "#7c3aed", borderRadius: 10, padding: "11px 18px" }}>
        ← Back to Chapter 4
      </a>
    </div>
  );
}

const teachingCss = `
.c4t-wrap { max-width: 760px; margin: 28px auto 0; padding: 0 20px; }
.c4t { background: var(--ds-surface, #fff); border: 1px solid var(--ds-border-subtle, #e8ecf2); border-radius: var(--ds-radius-lg, 14px);
  padding: 20px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
.c4t-h { font-size: 11px; font-weight: 750; letter-spacing: .07em; text-transform: uppercase; color: var(--ds-text-tertiary, #586173); margin: 16px 0 8px; }
.c4t-h:first-child { margin-top: 0; }
.c4t-points { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 6px; font-size: 14.5px; line-height: 1.5; color: var(--ds-text-primary, #111827); }
.c4t-actions { margin: 0; padding: 0; list-style: none; counter-reset: c4a; display: flex; flex-direction: column; gap: 10px; }
.c4t-actions li { position: relative; padding-left: 32px; display: flex; flex-direction: column; gap: 2px; }
.c4t-actions li::before { counter-increment: c4a; content: counter(c4a); position: absolute; left: 0; top: 0;
  width: 21px; height: 21px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;
  color: #7c3aed; background: color-mix(in srgb, #7c3aed 12%, var(--ds-surface, #fff)); border: 1px solid color-mix(in srgb, #7c3aed 34%, transparent); }
.c4t-actions strong { font-size: 14.5px; color: var(--ds-text-primary, #111827); }
.c4t-actions span { font-size: 13.5px; line-height: 1.5; color: var(--ds-text-secondary, #475569); }
.c4t-final { display: block; text-align: center; text-decoration: none; margin: 20px 0 0; padding: 14px 16px; border-radius: 12px;
  background: color-mix(in srgb, #7c3aed 10%, var(--ds-surface, #fff)); border: 1px solid #7c3aed; color: var(--ds-text-primary, #111827);
  font-size: 14px; font-weight: 600; line-height: 1.4; }
`;
