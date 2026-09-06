import { and, asc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema, withTransaction } from "@onevyrt/database";
import type { FormulaInputDefinition, FormulaResult, FormulaStatus } from "@onevyrt/contracts";
import { isUniqueViolation } from "./db-errors";
import { requirePlatformAdmin, checkPlatformAdmin } from "./platform-admin-use-cases";
import { getFormulaImplementation } from "./formula-registry";
import {
  DuplicateFormulaVersionError,
  FormulaDefinitionNotFoundError,
  FormulaImplementationNotFoundError,
  NoPublishedFormulaError,
  FormulaInputMismatchError,
} from "./errors";

/**
 * PRD-NUMBERS-001 vertical slice: the versioned formula library (README
 * "Numbers and modeling" -> "Versioned formula library", first slice of
 * Phase 4). Same platform-admin-authoring / draft-publish-archive shape
 * as curriculum-use-cases.ts, applied to formulaDefinitions instead of
 * programs.
 */

export interface FormulaDefinitionRecord {
  id: string;
  key: string;
  version: number;
  title: string;
  description: string;
  inputSchema: FormulaInputDefinition[];
  outputUnit: string;
  status: FormulaStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFormulaDefinitionInput {
  actorUserId: string;
  key: string;
  version: number;
  title: string;
  description: string;
  inputSchema: FormulaInputDefinition[];
  outputUnit: string;
}

/**
 * Refuses to create metadata for a (key, version) pair that has no
 * matching computation in formula-registry.ts - this table must never
 * describe a formula the system can't actually run (the inverse of
 * curriculum's "draft content can exist with no learners enrolled yet";
 * a formula definition is useless, and dangerous to silently no-op on,
 * without code behind it).
 */
export async function createFormulaDefinition(
  db: Database,
  input: CreateFormulaDefinitionInput,
): Promise<FormulaDefinitionRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  if (!getFormulaImplementation(input.key, input.version)) {
    throw new FormulaImplementationNotFoundError(input.key, input.version);
  }

  try {
    const [definition] = await db
      .insert(schema.formulaDefinitions)
      .values({
        key: input.key,
        version: input.version,
        title: input.title,
        description: input.description,
        inputSchema: input.inputSchema,
        outputUnit: input.outputUnit,
      })
      .returning();
    if (!definition) throw new Error("Failed to create formula definition");
    return definition as FormulaDefinitionRecord;
  } catch (error) {
    if (isUniqueViolation(error)) throw new DuplicateFormulaVersionError(input.key, input.version);
    throw error;
  }
}

export interface ListFormulaDefinitionsInput {
  actorUserId: string;
  key?: string;
}

/** Same visibility rule as listPrograms: a platform admin sees every draft/published/archived version, everyone else only ever sees published ones. */
export async function listFormulaDefinitions(
  db: Database,
  input: ListFormulaDefinitionsInput,
): Promise<FormulaDefinitionRecord[]> {
  const isAdmin = await checkPlatformAdmin(db, input.actorUserId);

  const keyFilter =
    input.key !== undefined ? eq(schema.formulaDefinitions.key, input.key) : undefined;
  const statusFilter = isAdmin ? undefined : eq(schema.formulaDefinitions.status, "published");
  const where = [keyFilter, statusFilter].filter((c) => c !== undefined);

  const rows = await db
    .select()
    .from(schema.formulaDefinitions)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(asc(schema.formulaDefinitions.key), asc(schema.formulaDefinitions.version));

  return rows as FormulaDefinitionRecord[];
}

export interface PublishFormulaDefinitionInput {
  actorUserId: string;
  formulaDefinitionId: string;
}

/** Archives any previously-published version of the same key in the same transaction, mirroring publishProgramVersion - at most one published version per key, enforced again by the partial unique index as a backstop. */
export async function publishFormulaDefinition(
  db: Database,
  input: PublishFormulaDefinitionInput,
): Promise<FormulaDefinitionRecord> {
  await requirePlatformAdmin(db, input.actorUserId);

  return withTransaction(db, async (tx) => {
    const target = await tx.query.formulaDefinitions.findFirst({
      where: eq(schema.formulaDefinitions.id, input.formulaDefinitionId),
    });
    if (!target) throw new FormulaDefinitionNotFoundError(input.formulaDefinitionId);

    await tx
      .update(schema.formulaDefinitions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(
          eq(schema.formulaDefinitions.key, target.key),
          eq(schema.formulaDefinitions.status, "published"),
        ),
      );

    const [published] = await tx
      .update(schema.formulaDefinitions)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.formulaDefinitions.id, input.formulaDefinitionId))
      .returning();
    if (!published) throw new FormulaDefinitionNotFoundError(input.formulaDefinitionId);

    return published as FormulaDefinitionRecord;
  });
}

export interface ComputeFormulaInput {
  key: string;
  inputs: Record<string, number>;
}

/**
 * Runs the currently-published version of a formula against the
 * caller's inputs and returns the full provenance envelope the spec's
 * business-modeling section requires (source, unit, formula version).
 * valueOrigin is always "calculated" here: this function only ever
 * re-derives a number from inputs the caller supplied in the same call,
 * it never reads or writes an "observed"/"entered"/"imported"/
 * "estimated"/"AI-suggested" business record - that provenance belongs
 * to whatever workspace-scoped feature stores the result (a later Phase
 * 4/5 slice), not to the stateless calculation itself.
 *
 * No authorization check here - reading a published formula's shape and
 * computing against it is not privileged, the same as listPrograms/
 * listLessons showing published content to any workspace member.
 * Creating/publishing formula metadata is the privileged action.
 */
export async function computeFormula(
  db: Database,
  input: ComputeFormulaInput,
): Promise<FormulaResult> {
  const definition = await db.query.formulaDefinitions.findFirst({
    where: and(
      eq(schema.formulaDefinitions.key, input.key),
      eq(schema.formulaDefinitions.status, "published"),
    ),
  });
  if (!definition) throw new NoPublishedFormulaError(input.key);

  const inputSchema = definition.inputSchema as FormulaInputDefinition[];
  const expectedNames = new Set(inputSchema.map((f) => f.name));
  const actualNames = new Set(Object.keys(input.inputs));
  const missing = [...expectedNames].filter((name) => !actualNames.has(name));
  const unexpected = [...actualNames].filter((name) => !expectedNames.has(name));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new FormulaInputMismatchError(input.key, missing, unexpected);
  }

  const impl = getFormulaImplementation(definition.key, definition.version);
  if (!impl) throw new FormulaImplementationNotFoundError(definition.key, definition.version);

  const value = impl.compute(input.inputs);

  return {
    formulaKey: definition.key,
    formulaVersion: definition.version,
    value,
    unit: definition.outputUnit,
    inputs: input.inputs,
    valueOrigin: "calculated",
    computedAt: new Date().toISOString(),
  };
}
