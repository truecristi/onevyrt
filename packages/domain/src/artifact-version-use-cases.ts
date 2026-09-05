import { and, desc, eq, max } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import type { ArtifactType, ArtifactVersionFieldDiff } from "@onevyrt/contracts";
import { requireWorkspaceMembership } from "./workspace-use-cases";
import { ArtifactNotFoundError, ArtifactVersionNotFoundError } from "./errors";

/**
 * PRD-BUILD-004 vertical slice: artifact versioning (README "Offer and
 * funnel building" -> "Important business artifacts must be versioned.
 * Users must be able to compare changes and understand which version
 * produced which result."), fourth slice of Phase 5. See schema.ts's
 * artifactVersions doc comment for the polymorphic-table design and why
 * versioning is an explicit action here, not automatic on every edit.
 */

export interface ArtifactVersionRecord {
  id: string;
  workspaceId: string;
  artifactType: ArtifactType;
  artifactId: string;
  version: number;
  snapshot: Record<string, unknown>;
  changeNote: string;
  createdByUserId: string | null;
  createdAt: Date;
}

/**
 * Fetches the artifact's current row and confirms it belongs to this
 * workspace, the same cross-entity link-integrity check used throughout
 * this codebase (e.g. lesson-application-use-cases.ts's
 * assertResourceInWorkspace) - just over the three artifact types this
 * slice supports instead of that function's seven.
 */
async function loadArtifactInWorkspace(
  db: Database,
  artifactType: ArtifactType,
  artifactId: string,
  workspaceId: string,
): Promise<Record<string, unknown>> {
  let row: Record<string, unknown> | undefined;

  switch (artifactType) {
    case "offer":
      row = await db.query.offers.findFirst({
        where: and(eq(schema.offers.id, artifactId), eq(schema.offers.workspaceId, workspaceId)),
      });
      break;
    case "customer_profile":
      row = await db.query.customerProfiles.findFirst({
        where: and(
          eq(schema.customerProfiles.id, artifactId),
          eq(schema.customerProfiles.workspaceId, workspaceId),
        ),
      });
      break;
    case "funnel_step":
      row = await db.query.funnelSteps.findFirst({
        where: and(
          eq(schema.funnelSteps.id, artifactId),
          eq(schema.funnelSteps.workspaceId, workspaceId),
        ),
      });
      break;
  }

  if (!row) throw new ArtifactNotFoundError(artifactType, artifactId);
  return row;
}

export interface SnapshotArtifactVersionInput {
  actorUserId: string;
  workspaceId: string;
  artifactType: ArtifactType;
  artifactId: string;
  changeNote?: string;
}

/** Records the artifact's *current* state as the next version - a deliberate "save version" action, not a diff-triggered auto-snapshot. */
export async function snapshotArtifactVersion(
  db: Database,
  input: SnapshotArtifactVersionInput,
): Promise<ArtifactVersionRecord> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  const artifact = await loadArtifactInWorkspace(
    db,
    input.artifactType,
    input.artifactId,
    input.workspaceId,
  );

  const [maxVersionRow] = await db
    .select({ maxVersion: max(schema.artifactVersions.version) })
    .from(schema.artifactVersions)
    .where(
      and(
        eq(schema.artifactVersions.artifactType, input.artifactType),
        eq(schema.artifactVersions.artifactId, input.artifactId),
      ),
    );
  const maxVersion = maxVersionRow?.maxVersion;

  // JSON round-trip so the stored snapshot only ever contains plain,
  // comparable JSON values (Dates become ISO strings, etc.) - the same
  // representation compareArtifactVersions will diff against later.
  const snapshot = JSON.parse(JSON.stringify(artifact)) as Record<string, unknown>;

  const [version] = await db
    .insert(schema.artifactVersions)
    .values({
      workspaceId: input.workspaceId,
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      version: (maxVersion ?? 0) + 1,
      snapshot,
      changeNote: input.changeNote ?? "",
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!version) throw new Error("Failed to snapshot artifact version");

  return version as ArtifactVersionRecord;
}

export interface ListArtifactVersionsInput {
  actorUserId: string;
  workspaceId: string;
  artifactType: ArtifactType;
  artifactId: string;
}

export async function listArtifactVersions(
  db: Database,
  input: ListArtifactVersionsInput,
): Promise<ArtifactVersionRecord[]> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const rows = await db
    .select()
    .from(schema.artifactVersions)
    .where(
      and(
        eq(schema.artifactVersions.workspaceId, input.workspaceId),
        eq(schema.artifactVersions.artifactType, input.artifactType),
        eq(schema.artifactVersions.artifactId, input.artifactId),
      ),
    )
    .orderBy(desc(schema.artifactVersions.version));

  return rows as ArtifactVersionRecord[];
}

async function getVersionOrThrow(
  db: Database,
  workspaceId: string,
  artifactType: ArtifactType,
  artifactId: string,
  version: number,
): Promise<ArtifactVersionRecord> {
  const row = await db.query.artifactVersions.findFirst({
    where: and(
      eq(schema.artifactVersions.workspaceId, workspaceId),
      eq(schema.artifactVersions.artifactType, artifactType),
      eq(schema.artifactVersions.artifactId, artifactId),
      eq(schema.artifactVersions.version, version),
    ),
  });
  if (!row) throw new ArtifactVersionNotFoundError(artifactType, artifactId, version);
  return row as ArtifactVersionRecord;
}

export interface CompareArtifactVersionsInput {
  actorUserId: string;
  workspaceId: string;
  artifactType: ArtifactType;
  artifactId: string;
  fromVersion: number;
  toVersion: number;
}

export interface ArtifactVersionComparisonResult {
  fromVersion: number;
  toVersion: number;
  changes: ArtifactVersionFieldDiff[];
}

/**
 * A shallow field-by-field diff between two recorded snapshots - "users
 * must be able to compare changes and understand which version produced
 * which result" made concrete. Fields whose values are structurally
 * identical (via JSON comparison, so it also catches nested
 * object/array differences) are omitted from the result.
 */
export async function compareArtifactVersions(
  db: Database,
  input: CompareArtifactVersionsInput,
): Promise<ArtifactVersionComparisonResult> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);

  const [from, to] = await Promise.all([
    getVersionOrThrow(
      db,
      input.workspaceId,
      input.artifactType,
      input.artifactId,
      input.fromVersion,
    ),
    getVersionOrThrow(db, input.workspaceId, input.artifactType, input.artifactId, input.toVersion),
  ]);

  const allFields = new Set([...Object.keys(from.snapshot), ...Object.keys(to.snapshot)]);
  const changes: ArtifactVersionFieldDiff[] = [];
  for (const field of allFields) {
    const before = from.snapshot[field];
    const after = to.snapshot[field];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push({ field, before, after });
    }
  }

  return { fromVersion: input.fromVersion, toVersion: input.toVersion, changes };
}
