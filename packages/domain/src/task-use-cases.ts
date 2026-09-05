import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { TaskStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { TaskNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-005 vertical slice: tasks. Same tenancy shape as the other
 * business-core use cases - requireWorkspaceMembership (ADR-0003), every
 * write scoped by workspaceId in the WHERE clause.
 */

export interface TaskRecord {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  workspaceId: string;
  actorUserId: string;
  title: string;
  description: string;
  dueDate?: Date;
}

export async function createTask(db: Database, input: CreateTaskInput): Promise<TaskRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [task] = await tx
      .insert(schema.tasks)
      .values({
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ?? null,
      })
      .returning();
    if (!task) throw new Error("Failed to create task");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "task.created",
      metadata: { title: task.title },
    });

    return task as TaskRecord;
  });
}

export interface ListTasksInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listTasks(db: Database, input: ListTasksInput): Promise<TaskRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.workspaceId, input.workspaceId))
    .orderBy(desc(schema.tasks.createdAt));

  return rows as TaskRecord[];
}

export interface UpdateTaskStatusInput {
  workspaceId: string;
  actorUserId: string;
  taskId: string;
  status: TaskStatus;
}

/**
 * Sets completedAt when status becomes "done", and clears it for any other
 * status - including moving *back* from "done" to "open"/"in_progress",
 * which is a real, expected case (a task was marked done too early) and
 * must not leave a stale completedAt behind implying it's still finished.
 */
export async function updateTaskStatus(
  db: Database,
  input: UpdateTaskStatusInput,
): Promise<TaskRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [task] = await tx
      .update(schema.tasks)
      .set({
        status: input.status,
        completedAt: input.status === "done" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(schema.tasks.id, input.taskId), eq(schema.tasks.workspaceId, input.workspaceId)),
      )
      .returning();

    if (!task) throw new TaskNotFoundError(input.taskId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "task.status_changed",
      metadata: { taskId: task.id, status: task.status },
    });

    return task as TaskRecord;
  });
}
