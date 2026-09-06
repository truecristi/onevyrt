import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  listPrograms,
  listProgramVersions,
  listLessons,
  listMyEnrollments,
  assertLessonVisible,
  listLessonBlocks,
  listBlockResponsesForLesson,
  startOrResumeLesson,
  LessonNotFoundError,
  PrerequisitesNotMetError,
} from "@onevyrt/domain";
import { EmptyState } from "@onevyrt/design-system";
import { getServerContext } from "@/lib/server";
import { getCurrentUser } from "@/lib/session";
import { BlockRenderer } from "./block-renderer";
import { KnowledgeCheckBlock } from "./knowledge-check-block";
import { ReflectionBlock } from "./reflection-block";
import { MarkCompleteButton } from "./mark-complete-button";

/**
 * Phase 9 Learn slice: a single lesson. Security note (this slice's real
 * fix, not a UI nicety): knowledge-check's correctOptionIndex is never
 * read out of a block's payload here at all - only question/options are
 * forwarded to KnowledgeCheckBlock, and explanation only once a response
 * already exists (responseByBlockId.has). Structurally, not just by
 * discipline: there's no `payload` object ever spread wholesale into a
 * knowledge-check prop, so there's nothing to forget to strip later.
 */
export default async function LessonPage({
  params,
}: {
  params: { workspaceId: string; programId: string; lessonId: string };
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { db } = getServerContext();
  const actorUserId = user.id;

  const programs = await listPrograms(db, { actorUserId });
  const program = programs.find((candidate) => candidate.id === params.programId);
  if (!program) {
    notFound();
  }

  const versions = await listProgramVersions(db, { actorUserId, programId: program.id });
  const published = versions.find((version) => version.status === "published");
  if (!published) {
    notFound();
  }

  let lesson;
  try {
    lesson = await assertLessonVisible(db, params.lessonId, actorUserId);
  } catch (error) {
    if (error instanceof LessonNotFoundError) {
      notFound();
    }
    throw error;
  }
  if (lesson.programVersionId !== published.id) {
    notFound();
  }

  const lessons = await listLessons(db, { actorUserId, programVersionId: published.id });
  const enrollments = await listMyEnrollments(db, { actorUserId });
  const enrollment = enrollments.find((candidate) => candidate.programVersionId === published.id);
  if (!enrollment) {
    redirect(`/workspaces/${params.workspaceId}/learn/${program.id}`);
  }

  const lessonTitleById = new Map(lessons.map((candidate) => [candidate.id, candidate.title]));
  const currentIndex = lessons.findIndex((candidate) => candidate.id === lesson.id);
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : undefined;
  const nextLesson =
    currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : undefined;
  const lessonHref = (lessonId: string) =>
    `/workspaces/${params.workspaceId}/learn/${program.id}/lessons/${lessonId}`;

  let progress;
  try {
    progress = await startOrResumeLesson(db, {
      actorUserId,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    });
  } catch (error) {
    if (error instanceof PrerequisitesNotMetError) {
      return (
        <div className="flex flex-col gap-6">
          <h1 className="text-xl font-semibold tracking-tight">{lesson.title}</h1>
          <EmptyState
            title="Finish the prerequisites first"
            description={`Complete ${error.incompleteLessonIds
              .map((id) => lessonTitleById.get(id) ?? id)
              .join(", ")} before starting this lesson.`}
          />
        </div>
      );
    }
    throw error;
  }

  const [blocks, responses] = await Promise.all([
    listLessonBlocks(db, { actorUserId, lessonId: lesson.id }),
    listBlockResponsesForLesson(db, {
      actorUserId,
      enrollmentId: enrollment.id,
      lessonId: lesson.id,
    }),
  ]);
  const responseByBlockId = new Map(
    responses.map((response) => [response.lessonBlockId, response]),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{lesson.title}</h1>
        <p className="mt-1 text-sm text-gray-600">{lesson.outcome}</p>
      </div>

      <div className="flex flex-col gap-4">
        {blocks.map((block) => {
          if (block.blockType === "knowledge-check") {
            const payload = block.payload as {
              question: string;
              options: string[];
              explanation: string;
            };
            const response = responseByBlockId.get(block.id);
            const initialResponse = response?.response as
              { selectedOptionIndex: number; isCorrect: boolean } | undefined;
            return (
              <KnowledgeCheckBlock
                key={block.id}
                enrollmentId={enrollment.id}
                lessonBlockId={block.id}
                question={payload.question}
                options={payload.options}
                {...(response ? { explanation: payload.explanation } : {})}
                {...(initialResponse ? { initialResponse } : {})}
              />
            );
          }
          if (block.blockType === "reflection") {
            const payload = block.payload as {
              prompt: string;
              collectConfidenceRating: boolean;
            };
            const response = responseByBlockId.get(block.id);
            const initialResponse = response?.response as
              { text: string; confidenceRating?: number } | undefined;
            return (
              <ReflectionBlock
                key={block.id}
                enrollmentId={enrollment.id}
                lessonBlockId={block.id}
                prompt={payload.prompt}
                collectConfidenceRating={payload.collectConfidenceRating}
                {...(initialResponse ? { initialResponse } : {})}
              />
            );
          }
          return <BlockRenderer key={block.id} block={block} />;
        })}
      </div>

      <div className="flex items-center justify-between border-t border-gray-500 pt-4">
        <div>
          {prevLesson && (
            <Link
              href={lessonHref(prevLesson.id)}
              className="text-sm text-blue-600 hover:underline"
            >
              &larr; {prevLesson.title}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          {progress.status === "completed" ? (
            <span className="text-sm font-semibold uppercase text-gray-500">Completed</span>
          ) : (
            <MarkCompleteButton
              enrollmentId={enrollment.id}
              lessonId={lesson.id}
              {...(nextLesson ? { nextLessonHref: lessonHref(nextLesson.id) } : {})}
            />
          )}
          {nextLesson && (
            <Link
              href={lessonHref(nextLesson.id)}
              className="text-sm text-blue-600 hover:underline"
            >
              {nextLesson.title} &rarr;
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
