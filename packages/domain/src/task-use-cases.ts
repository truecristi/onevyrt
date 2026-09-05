import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { TaskPriority, TaskStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { ProjectNotFoundError, TaskBlockerInvalidError, TaskNotFoundError } from "./errors";

/**
 * PRD-BIZCORE-005 vertical slice: tasks. Same tenancy shape as the other
 * business-core use cases - requireWorkspaceMembership (ADR-0003), every
 * write scoped by workspaceId in the WHERE clause.
 *
 * Extended by PRD-BUILD-005 (Phase 5 fifth slice: task and project
 * system) with projectId/priority/blockedByTaskId - see
 * project-use-cases.ts for the projects side of this slice.
 */

export interface TaskRecord {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  projectId: string | null;
  priority: TaskPriority;
  blockedByTaskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** projectId, if given, must belong to the same workspace - same cross-entity link-integrity check used throughout this codebase (e.g. funnel-step-use-cases.ts's assertOfferInWorkspace). */
async function assertProjectInWorkspace(
  db: Database,
  workspaceId: string,
  projectId: string,
): Promise<void> {
  const project = await db.query.projects.findFirst({
    where: and(eq(schema.projects.id, projectId), eq(schema.projects.workspaceId, workspaceId)),
  });
  if (!project) throw new ProjectNotFoundError(projectId);
}

/**
 * blockedByTaskId, if given, must belong to the same workspace and must not
 * be the task itself - the workspace check mirrors assertProjectInWorkspace
 * above; the self-block check is the application-level half of the
 * tasks_no_self_block DB constraint (which only catches it when
 * blockedByTaskId and id happen to already both be known - this also
 * covers the create path, where the row doesn't have an id yet to compare
 * against at the DB level in a single INSERT).
 */
async function assertBlockerInWorkspace(
  db: Database,
  workspaceId: string,
  taskId: string | undefined,
  blockedByTaskId: string,
): Promise<void> {
  if (blockedByTaskId === taskId) {
    throw new TaskBlockerInvalidError(taskId ?? blockedByTaskId, blockedByTaskId);
  }
  const blocker = await db.query.tasks.findFirst({
    where: and(eq(schema.tasks.id, blockedByTaskId), eq(schema.tasks.workspaceId, workspaceId)),
  });
  if (!blocker) throw new TaskBlockerInvalidError(taskId ?? blockedByTaskId, blockedByTaskId);
}

export interface CreateTaskInput {
  workspaceId: string;
  actorUserId: string;
  title: string;
  description: string;
  dueDate?: Date;
  projectId?: string;
  priority: TaskPriority;
  blockedByTaskId?: string;
}

export async function createTask(db: Database, input: CreateTaskInput): Promise<TaskRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.projectId !== undefined) {
    await assertProjectInWorkspace(db, input.workspaceId, input.projectId);
  }
  if (input.blockedByTaskId !== undefined) {
    await assertBlockerInWorkspace(db, input.workspaceId, undefined, input.blockedByTaskId);
  }

  return withTransaction(db, async (tx) => {
    const [task] = await tx
      .insert(schema.tasks)
      .values({
        workspaceId: input.workspaceId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate ?? null,
        projectId: input.projectId ?? null,
        priority: input.priority,
        blockedByTaskId: input.blockedByTaskId ?? null,
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

export interface UpdateTaskInput {
  workspaceId: string;
  actorUserId: string;
  taskId: string;
  /** undefined = leave unchanged; null = remove from its project; a uuid = set it (validated to belong to this workspace). */
  projectId?: string | null;
  priority?: TaskPriority;
  /** undefined = leave unchanged; null = clear the blocker; a uuid = set it (validated to belong to this workspace, and not be the task itself). */
  blockedByTaskId?: string | null;
}

/** The project/priority/blocker fields - kept separate from updateTaskStatus above, since status has its own dedicated completedAt side effect and this route has none. */
export async function updateTask(db: Database, input: UpdateTaskInput): Promise<TaskRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  if (input.projectId !== undefined && input.projectId !== null) {
    await assertProjectInWorkspace(db, input.workspaceId, input.projectId);
  }
  if (input.blockedByTaskId !== undefined && input.blockedByTaskId !== null) {
    await assertBlockerInWorkspace(db, input.workspaceId, input.taskId, input.blockedByTaskId);
  }

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.tasks.$inferInsert> = { updatedAt: new Date() };
    if (input.projectId !== undefined) patch.projectId = input.projectId;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.blockedByTaskId !== undefined) patch.blockedByTaskId = input.blockedByTaskId;

    const [task] = await tx
      .update(schema.tasks)
      .set(patch)
      .where(
        and(eq(schema.tasks.id, input.taskId), eq(schema.tasks.workspaceId, input.workspaceId)),
      )
      .returning();

    if (!task) throw new TaskNotFoundError(input.taskId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "task.updated",
      metadata: { taskId: task.id },
    });

    return task as TaskRecord;
  });
}
