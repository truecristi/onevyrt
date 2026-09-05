import { desc, eq } from "drizzle-orm";
import type { Database } from "@onevyrt/database";
import { schema } from "@onevyrt/database";
import { requireWorkspaceMembership } from "./workspace-use-cases";

/**
 * PRD-AI-003 vertical slice: workspace context assembly (README
 * "AI coaching" -> "Context assembly", third slice of Phase 6; ADR-0011,
 * spec §5.2). §5.2 in full: "Never dump the entire database or book
 * archive into a prompt. A policy-controlled context assembler selects
 * the minimum records permitted for the task... Every request stores a
 * manifest of IDs, versions, data classifications and redactions.
 * ...data from another workspace are excluded by construction."
 *
 * This lives in packages/domain (not packages/ai) because assembling
 * context means reading real workspace-scoped rows through the same
 * tenancy gate (requireWorkspaceMembership, ADR-0003) every other domain
 * use case uses - "excluded by construction" here means literally the
 * same `eq(table.workspaceId, input.workspaceId)` WHERE clause as
 * everywhere else, not a separate access-control layer bolted onto AI
 * specifically. packages/ai's prompt templates declare which
 * ContextClasses they're allowed to request; this function is what
 * actually fetches and formats them.
 *
 * Deliberately scoped to four of the spec's example classes (business
 * profile, goals, assumptions, decisions) rather than every business-core
 * table - a real call site adds a ContextClass here in the same slice
 * that starts requesting it, following this repository's "don't
 * pre-declare capability nothing uses yet" convention.
 */

export type ContextClass = "business_profile" | "goals" | "assumptions" | "decisions";

export interface ContextManifestEntry {
  recordType: ContextClass;
  recordId: string;
  /** The record's updatedAt, as an ISO string - these tables carry no explicit version counter (unlike program_versions/formula_definitions), so this is the closest honest stand-in for "which revision of this record did the model see". */
  version: string;
  classification: "business_confidential";
  /** Fields that exist on the record but were left out of the text sent to the model - e.g. an internal owner/actor user ID, which identifies a person rather than describing the business. Never empty by omission-without-comment: an empty array means nothing on this record needed redacting. */
  redactedFields: string[];
}

export interface AssembledContext {
  manifest: ContextManifestEntry[];
  /** The actual text to embed in a prompt's context section - already redacted per each entry's redactedFields. */
  text: string;
}

export interface AssembleWorkspaceContextInput {
  workspaceId: string;
  actorUserId: string;
  contextClasses: ContextClass[];
  /** Caps rows per class - "the minimum records permitted for the task", never the whole table. */
  limitPerClass?: number;
}

async function loadBusinessProfile(
  db: Database,
  workspaceId: string,
): Promise<{ entries: ContextManifestEntry[]; section: string | undefined }> {
  const profile = await db.query.businessProfiles.findFirst({
    where: eq(schema.businessProfiles.workspaceId, workspaceId),
  });
  if (!profile) return { entries: [], section: undefined };

  return {
    entries: [
      {
        recordType: "business_profile",
        recordId: profile.id,
        version: profile.updatedAt.toISOString(),
        classification: "business_confidential",
        redactedFields: [],
      },
    ],
    section: [
      "Business profile:",
      `Name: ${profile.name}`,
      `Vision: ${profile.vision}`,
      `Mission: ${profile.mission}`,
      `Industry: ${profile.industry}`,
      `Stage: ${profile.stage}`,
    ].join("\n"),
  };
}

async function loadGoals(
  db: Database,
  workspaceId: string,
  limit: number,
): Promise<{ entries: ContextManifestEntry[]; section: string | undefined }> {
  const rows = await db
    .select()
    .from(schema.goals)
    .where(eq(schema.goals.workspaceId, workspaceId))
    .orderBy(desc(schema.goals.createdAt))
    .limit(limit);
  if (rows.length === 0) return { entries: [], section: undefined };

  return {
    entries: rows.map((goal) => ({
      recordType: "goals" as const,
      recordId: goal.id,
      version: goal.updatedAt.toISOString(),
      classification: "business_confidential" as const,
      redactedFields: [],
    })),
    section: [
      "Goals:",
      ...rows.map(
        (goal) =>
          `- ${goal.title} (${goal.status}${goal.targetDate ? `, due ${goal.targetDate.toISOString().slice(0, 10)}` : ""}): ${goal.description}`,
      ),
    ].join("\n"),
  };
}

async function loadAssumptions(
  db: Database,
  workspaceId: string,
  limit: number,
): Promise<{ entries: ContextManifestEntry[]; section: string | undefined }> {
  const rows = await db
    .select()
    .from(schema.assumptions)
    .where(eq(schema.assumptions.workspaceId, workspaceId))
    .orderBy(desc(schema.assumptions.createdAt))
    .limit(limit);
  if (rows.length === 0) return { entries: [], section: undefined };

  return {
    entries: rows.map((assumption) => ({
      recordType: "assumptions" as const,
      recordId: assumption.id,
      version: assumption.updatedAt.toISOString(),
      classification: "business_confidential" as const,
      // ownerId identifies a specific person, not the business fact itself - kept out of the prompt text, recorded here instead.
      redactedFields: assumption.ownerId ? ["ownerId"] : [],
    })),
    section: [
      "Assumptions:",
      ...rows.map(
        (assumption) =>
          `- ${assumption.statement} (confidence: ${assumption.confidence}, status: ${assumption.status})`,
      ),
    ].join("\n"),
  };
}

async function loadDecisions(
  db: Database,
  workspaceId: string,
  limit: number,
): Promise<{ entries: ContextManifestEntry[]; section: string | undefined }> {
  const rows = await db
    .select()
    .from(schema.decisions)
    .where(eq(schema.decisions.workspaceId, workspaceId))
    .orderBy(desc(schema.decisions.createdAt))
    .limit(limit);
  if (rows.length === 0) return { entries: [], section: undefined };

  return {
    entries: rows.map((decision) => ({
      recordType: "decisions" as const,
      recordId: decision.id,
      version: decision.updatedAt.toISOString(),
      classification: "business_confidential" as const,
      redactedFields: [],
    })),
    section: [
      "Recent decisions:",
      ...rows.map(
        (decision) =>
          `- ${decision.title} (${decision.status}): ${decision.outcome || "no outcome recorded yet"}`,
      ),
    ].join("\n"),
  };
}

const DEFAULT_LIMIT_PER_CLASS = 5;

export async function assembleWorkspaceContext(
  db: Database,
  input: AssembleWorkspaceContextInput,
): Promise<AssembledContext> {
  await requireWorkspaceMembership(db, input.workspaceId, input.actorUserId);
  const limit = input.limitPerClass ?? DEFAULT_LIMIT_PER_CLASS;

  const manifest: ContextManifestEntry[] = [];
  const sections: string[] = [];

  for (const contextClass of input.contextClasses) {
    const { entries, section } = await (contextClass === "business_profile"
      ? loadBusinessProfile(db, input.workspaceId)
      : contextClass === "goals"
        ? loadGoals(db, input.workspaceId, limit)
        : contextClass === "assumptions"
          ? loadAssumptions(db, input.workspaceId, limit)
          : loadDecisions(db, input.workspaceId, limit));

    manifest.push(...entries);
    if (section) sections.push(section);
  }

  return { manifest, text: sections.join("\n\n") };
}
