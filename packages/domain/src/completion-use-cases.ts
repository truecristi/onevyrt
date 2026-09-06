import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import {
  LessonCompletionRequirementsNotMetError,
  type MissingCompletionRequirement,
} from "./errors";

/**
 * PRD-CURRICULUM-008 vertical slice: completion rules (README
 * "Completion rules"). "Completion is based on accepted outputs and
 * evidence, not time watched" (spec section 3.4) - this is the rule
 * itself, checked by updateLessonProgress (progress-use-cases.ts)
 * whenever a caller tries to transition a lesson to "completed".
 *
 * Only three block types carry a completion requirement, because only
 * three types have a corresponding evidence record elsewhere in this
 * codebase: knowledge-check and reflection need a block_response
 * (block-response-use-cases.ts), build needs a lesson_application
 * (lesson-application-use-cases.ts). Every other block type (concept,
 * story, metaphor, etc.) is informational - reading it is not something
 * this system can verify beyond "the learner opened the lesson", so it
 * carries no requirement, consistent with "not time watched".
 */

const REQUIRES_RESPONSE = new Set(["knowledge-check", "reflection"]);
const REQUIRES_APPLICATION = new Set(["build"]);

export async function assertLessonCompletionRequirementsMet(
  db: Database,
  enrollmentId: string,
  lessonId: string,
): Promise<void> {
  const blocks = await db
    .select({ id: schema.lessonBlocks.id, blockType: schema.lessonBlocks.blockType })
    .from(schema.lessonBlocks)
    .where(eq(schema.lessonBlocks.lessonId, lessonId));

  const blocksNeedingResponse = blocks.filter((b) => REQUIRES_RESPONSE.has(b.blockType));
  const blocksNeedingApplication = blocks.filter((b) => REQUIRES_APPLICATION.has(b.blockType));

  const missing: MissingCompletionRequirement[] = [];

  if (blocksNeedingResponse.length > 0) {
    const responded = await db
      .select({ lessonBlockId: schema.blockResponses.lessonBlockId })
      .from(schema.blockResponses)
      .where(
        and(
          eq(schema.blockResponses.enrollmentId, enrollmentId),
          inArray(
            schema.blockResponses.lessonBlockId,
            blocksNeedingResponse.map((b) => b.id),
          ),
        ),
      );
    const respondedIds = new Set(responded.map((r) => r.lessonBlockId));
    for (const block of blocksNeedingResponse) {
      if (!respondedIds.has(block.id)) {
        missing.push({
          lessonBlockId: block.id,
          blockType: block.blockType,
          reason: "no response submitted",
        });
      }
    }
  }

  if (blocksNeedingApplication.length > 0) {
    const applied = await db
      .select({ lessonBlockId: schema.lessonApplications.lessonBlockId })
      .from(schema.lessonApplications)
      .where(
        and(
          eq(schema.lessonApplications.enrollmentId, enrollmentId),
          inArray(
            schema.lessonApplications.lessonBlockId,
            blocksNeedingApplication.map((b) => b.id),
          ),
        ),
      );
    const appliedIds = new Set(applied.map((a) => a.lessonBlockId));
    for (const block of blocksNeedingApplication) {
      if (!appliedIds.has(block.id)) {
        missing.push({
          lessonBlockId: block.id,
          blockType: block.blockType,
          reason: "no linked business record",
        });
      }
    }
  }

  if (missing.length > 0) {
    throw new LessonCompletionRequirementsNotMetError(lessonId, missing);
  }
}
