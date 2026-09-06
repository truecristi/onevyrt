import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { ProjectStatus } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { ProjectNotFoundError } from "./errors";

/**
 * PRD-BUILD-005 vertical slice: projects (README "Build and execution"
 * -> "Task and project system", fifth slice of Phase 5). Same tenancy
 * shape as the other business-core use cases - requireWorkspaceMembership
 * (ADR-0003), every write scoped by workspaceId in the WHERE clause.
 */

export interface ProjectRecord {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectInput {
  workspaceId: string;
  actorUserId: string;
  name: string;
  description: string;
}

export async function createProject(
  db: Database,
  input: CreateProjectInput,
): Promise<ProjectRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const [project] = await tx
      .insert(schema.projects)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.description,
      })
      .returning();
    if (!project) throw new Error("Failed to create project");

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "project.created",
      metadata: { name: project.name },
    });

    return project as ProjectRecord;
  });
}

export interface ListProjectsInput {
  workspaceId: string;
  actorUserId: string;
}

export async function listProjects(
  db: Database,
  input: ListProjectsInput,
): Promise<ProjectRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.projects)
    .where(eq(schema.projects.workspaceId, input.workspaceId))
    .orderBy(desc(schema.projects.createdAt));

  return rows as ProjectRecord[];
}

export interface UpdateProjectInput {
  workspaceId: string;
  actorUserId: string;
  projectId: string;
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export async function updateProject(
  db: Database,
  input: UpdateProjectInput,
): Promise<ProjectRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const patch: Partial<typeof schema.projects.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;

    const [project] = await tx
      .update(schema.projects)
      .set(patch)
      .where(
        and(
          eq(schema.projects.id, input.projectId),
          eq(schema.projects.workspaceId, input.workspaceId),
        ),
      )
      .returning();

    if (!project) throw new ProjectNotFoundError(input.projectId);

    await tx.insert(schema.auditLog).values({
      actorUserId: input.actorUserId,
      workspaceId: input.workspaceId,
      action: "project.updated",
      metadata: { projectId: project.id, status: project.status },
    });

    return project as ProjectRecord;
  });
}
