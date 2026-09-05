import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import { proposedTaskSchema } from "@onevyrt/contracts";
import type { ProposedTask, TaskProposalStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { createTask } from "./task-use-cases";
import {
  InvalidTaskProposalError,
  TaskProposalNotFoundError,
  TaskProposalNotPendingError,
} from "./errors";

/**
 * PRD-AI-007 vertical slice: task proposals (README "AI coaching" ->
 * "Task proposals", seventh slice of Phase 6; ADR-0012, spec §7.1's
 * "suggest experiments and actions grounded in current data"). Same
 * propose -> validate -> user-review -> accept/reject shape as
 * artifact-proposal-use-cases.ts, but accepting *creates* a new task
 * (via task-use-cases.ts's createTask) rather than patching an existing
 * record.
 */

export interface TaskProposalRecord {
  id: string;
  workspaceId: string;
  proposedTask: ProposedTask;
  rationale: string;
  promptTemplateKey: string;
  promptTemplateVersion: number;
  providerId: string;
  model: string;
  status: TaskProposalStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  createdTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function validateProposedTask(proposedTask: unknown): ProposedTask {
  const result = proposedTaskSchema.safeParse(proposedTask);
  if (!result.success) {
    throw new InvalidTaskProposalError(result.error.message);
  }
  return result.data;
}

export interface CreateTaskProposalInput {
  workspaceId: string;
  actorUserId: string;
  proposedTask: unknown;
  rationale: string;
  promptTemplateKey: string;
  promptTemplateVersion: number;
  providerId: string;
  model: string;
}

export async function createTaskProposal(
  db: Database,
  input: CreateTaskProposalInput,
): Promise<TaskProposalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  const proposedTask = validateProposedTask(input.proposedTask);

  return withTransaction(db, async (tx) => {
    const [proposal] = await tx
      .insert(schema.taskProposals)
      .values({
        workspaceId: input.workspaceId,
        proposedTask,
        rationale: input.rationale,
        promptTemplateKey: input.promptTemplateKey,
        promptTemplateVersion: input.promptTemplateVersion,
        providerId: input.providerId,
        model: input.model,
      })
      .returning();
    if (!proposal) throw new Error("Failed to create task proposal");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "task_proposal.created",
      metadata: { title: proposedTask.title },
    });

    return proposal as TaskProposalRecord;
  });
}

export interface ListTaskProposalsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listTaskProposals(
  db: Database,
  input: ListTaskProposalsInput,
): Promise<TaskProposalRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.taskProposals)
    .where(eq(schema.taskProposals.workspaceId, input.workspaceId))
    .orderBy(desc(schema.taskProposals.createdAt));

  return rows as TaskProposalRecord[];
}

async function getPendingProposalOrThrow(db: Database, workspaceId: string, proposalId: string) {
  const proposal = await db.query.taskProposals.findFirst({
    where: and(
      eq(schema.taskProposals.id, proposalId),
      eq(schema.taskProposals.workspaceId, workspaceId),
    ),
  });
  if (!proposal) throw new TaskProposalNotFoundError(proposalId);
  if (proposal.status !== "pending") {
    throw new TaskProposalNotPendingError(proposalId, proposal.status);
  }
  return proposal;
}

export interface AcceptTaskProposalInput {
  workspaceId: string;
  actorUserId: string;
  proposalId: string;
}

/**
 * Creates the real task through task-use-cases.ts's own createTask (the
 * same domain function and "task.created" audit entry the regular POST
 * /tasks route produces) as its own transaction, then separately marks
 * the proposal accepted with the created task's ID - two transactions,
 * not one, for the same reason acceptArtifactProposal is: this codebase
 * has no nested-transaction composition across domain use cases.
 */
export async function acceptTaskProposal(
  db: Database,
  input: AcceptTaskProposalInput,
): Promise<TaskProposalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  const proposal = await getPendingProposalOrThrow(db, input.workspaceId, input.proposalId);
  const proposedTask = proposal.proposedTask as ProposedTask;

  const task = await createTask(db, {
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    title: proposedTask.title,
    description: proposedTask.description,
    priority: proposedTask.priority,
  });

  return withTransaction(db, async (tx) => {
    const [updated] = await tx
      .update(schema.taskProposals)
      .set({
        status: "accepted",
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        createdTaskId: task.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.taskProposals.id, proposal.id))
      .returning();
    if (!updated) throw new TaskProposalNotFoundError(input.proposalId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "task_proposal.accepted",
      metadata: { proposalId: updated.id, taskId: task.id },
    });

    return updated as TaskProposalRecord;
  });
}

export interface RejectTaskProposalInput {
  workspaceId: string;
  actorUserId: string;
  proposalId: string;
}

export async function rejectTaskProposal(
  db: Database,
  input: RejectTaskProposalInput,
): Promise<TaskProposalRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  const proposal = await getPendingProposalOrThrow(db, input.workspaceId, input.proposalId);

  return withTransaction(db, async (tx) => {
    const [updated] = await tx
      .update(schema.taskProposals)
      .set({
        status: "rejected",
        reviewedByUserId: input.actorUserId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.taskProposals.id, proposal.id))
      .returning();
    if (!updated) throw new TaskProposalNotFoundError(input.proposalId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "task_proposal.rejected",
      metadata: { proposalId: updated.id },
    });

    return updated as TaskProposalRecord;
  });
}
