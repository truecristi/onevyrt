import { desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { estimateCostMicros } from "@onevyrt/ai";
import { requireWorkspaceMembership } from "./workspace-use-cases";

/**
 * PRD-AI-010 vertical slice: cost and latency tracking (README
 * "AI coaching" -> "Cost and latency tracking", tenth slice of Phase 6).
 * See schema.ts's aiCallRecords doc comment for why workspaceId is
 * nullable and why this is written explicitly per route (recordAiCall)
 * rather than automatically inside packages/ai's gateway, which has no
 * database access by design.
 */

export interface AiCallRecordRecord {
  id: string;
  actorUserId: string;
  workspaceId: string | null;
  promptTemplateKey: string;
  promptTemplateVersion: number;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCostMicros: number | null;
  createdAt: Date;
}

export interface RecordAiCallInput {
  actorUserId: string;
  workspaceId?: string;
  promptTemplateKey: string;
  promptTemplateVersion: number;
  providerId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

/**
 * Called by each AI route after a successful runPrompt, not by
 * packages/ai itself - no workspace-membership check here, since the
 * caller has already done every authorization check needed to make the
 * AI call in the first place; this only records that it happened.
 */
export async function recordAiCall(
  db: Database,
  input: RecordAiCallInput,
): Promise<AiCallRecordRecord> {
  const [record] = await db
    .insert(schema.aiCallRecords)
    .values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId ?? null,
      promptTemplateKey: input.promptTemplateKey,
      promptTemplateVersion: input.promptTemplateVersion,
      providerId: input.providerId,
      model: input.model,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      latencyMs: input.latencyMs,
      estimatedCostMicros: estimateCostMicros(input.model, input.inputTokens, input.outputTokens),
    })
    .returning();
  if (!record) throw new Error("Failed to record AI call");

  return record as AiCallRecordRecord;
}

export interface ListAiCallRecordsInput {
  workspaceId: string;
  actorUserId: string;
}

/**
 * Lists AI call records for a workspace - calls with no workspace context
 * (e.g. lesson explanations) never appear here, only in a future
 * per-user view if one is added.
 */
export async function listAiCallRecords(
  db: Database,
  input: ListAiCallRecordsInput,
): Promise<AiCallRecordRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.aiCallRecords)
    .where(eq(schema.aiCallRecords.workspaceId, input.workspaceId))
    .orderBy(desc(schema.aiCallRecords.createdAt));

  return rows as AiCallRecordRecord[];
}
