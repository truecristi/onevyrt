import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  doublePrecision,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
  unique,
  check,
} from "drizzle-orm/pg-core";

/**
 * Phase 1 schema: identity + tenancy only (DOM-TENANCY-001, DOM-AUTH-001).
 * Everything else in the spec's data-architecture section (§8) is deferred
 * to the phase that actually needs it - this package does not pre-declare
 * tables for unimplemented product domains.
 */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Added in the Phase 3 curriculum slice (PRD-CURRICULUM-001): curriculum
  // authoring is platform-wide, not workspace-scoped, so it needs an
  // authorization concept above workspace membership. No product surface
  // sets this yet - it has to be set directly in the database until an
  // admin console exists. Re-derived fresh from the DB on every check
  // (requirePlatformAdmin, curriculum-use-cases.ts), same as workspace
  // membership - never trust a cached/client-supplied value for it.
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Role is intentionally a plain text column with a DB check constraint
 * (see migrations/0000_init.sql) rather than a Postgres enum, so adding a
 * role later (§4's manager/editor/viewer) is a data migration, not a type
 * migration. */
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workspaceId, table.userId] }),
    byUser: index("workspace_members_user_id_idx").on(table.userId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    byUser: index("sessions_user_id_idx").on(table.userId),
  }),
);

/** Append-only from the application's perspective (§38). Phase 1 writes to
 * this on register/login/workspace-create only; broader event taxonomy is
 * Phase 2+. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Added in the audit-records slice (PRD-BIZCORE-010) once this table
    // gained its first read path (listAuditLog) - every write since Phase
    // 1 has scoped by workspaceId, but nothing queried by it until now.
    byWorkspace: index("audit_log_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * Phase 2 schema (README "Core user and business data" - first slice: the
 * canonical business record and goals, per the master spec's §2.3 entity
 * graph: Workspace -> Business -> ... -> Outcome). One row per workspace -
 * "the living outputs" the README's My Business/Build area reads from,
 * not a lesson answer.
 */
export const businessProfiles = pgTable("business_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  vision: text("vision").notNull().default(""),
  mission: text("mission").notNull().default(""),
  industry: text("industry").notNull().default(""),
  stage: text("stage").notNull().default("idea"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Status is a plain text + CHECK constraint, same reasoning as workspace_members.role (ADR-0003/0004 precedent). */
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    targetDate: timestamp("target_date", { withTimezone: true }),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("goals_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * Phase 2 schema (README "Core user and business data" - second slice):
 * customer profiles. Unlike business_profiles (one per workspace), a
 * workspace can have many customer profiles - one per segment/persona
 * (master spec §6.13 "Customers and Raving Fans" is the much larger future
 * feature this is a deliberately small first step toward: journey,
 * promises, delivery evidence, complaints/recovery and a transparent score
 * are explicitly not part of this slice).
 */
export const customerProfiles = pgTable(
  "customer_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    painPoints: text("pain_points").notNull().default(""),
    desiredOutcome: text("desired_outcome").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("customer_profiles_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * Phase 2 schema (README "Core user and business data" - third slice):
 * offers. Deliberately small - name, description, price, status - not the
 * full §6.7 offer/positioning/message system (value proposition, bonuses,
 * guarantees, risk reversal, objections, versioned messaging), which stays
 * a later, separate slice.
 *
 * §40's financial-assurance rule applies from the first money field: price
 * is stored as integer minor units (cents), never floating point, with an
 * explicit currency code alongside it - "10.99" as a float can't represent
 * every currency amount exactly, integer cents can.
 */
export const offers = pgTable(
  "offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    priceCents: integer("price_cents"),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("offers_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * Phase 2 schema (README "Core user and business data" - fourth slice):
 * tasks. Deliberately small - not the full §6.18 execution system
 * (projects, milestones, dependencies, blockers, checklists tied to
 * lessons/decisions), which stays a later, separate slice once Execute has
 * more than one kind of thing to attach a task to.
 *
 * completedAt is a real derived field, not just another status value: it
 * records *when* a task was actually finished, separately from status
 * potentially changing again later (§37's domain-invariant spirit - a
 * fact that happened shouldn't be reconstructible only by guessing from
 * updatedAt).
 */
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("open"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("tasks_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * PRD-BIZCORE-006 vertical slice: business metrics. Sits between Goals and
 * the Phase 4+ numbers-and-modeling engine in the spec's canonical graph
 * (Workspace -> Business -> Vision -> Outcome -> Metric -> Assumption ->
 * Model -> Decision -> Action -> Experiment -> Evidence -> Review, section
 * 3.2). This is the Metric node only: a named, trackable figure with a
 * baseline/target/current value - not yet wired to goals, models or
 * experiments, which are later phases.
 *
 * Values are doublePrecision rather than integer minor units, unlike
 * offers' priceCents: a metric can be a percentage, a count or a ratio,
 * not only money, so there is no single fixed-point representation that
 * fits every metric. This is a deliberate, documented tradeoff against
 * the "never floating point" money rule (spec section 40), which applies
 * to money amounts specifically.
 */
export const businessMetrics = pgTable(
  "business_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    unit: text("unit").notNull().default(""),
    direction: text("direction").notNull().default("increase"),
    cadence: text("cadence").notNull().default("monthly"),
    baselineValue: doublePrecision("baseline_value"),
    targetValue: doublePrecision("target_value"),
    currentValue: doublePrecision("current_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("business_metrics_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * PRD-BIZCORE-007 vertical slice: assumptions. The Assumption node from the
 * spec's canonical graph (section 3.2), sitting between Metric and Model -
 * a stated belief or input (e.g. "conversion rate is 2%") that later
 * modeling/scenario work (Phase 4+) will reference and let users override
 * per-scenario without touching the baseline. Not yet wired to models or
 * scenarios, which are later phases.
 */
export const assumptions = pgTable(
  "assumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    description: text("description").notNull().default(""),
    source: text("source").notNull().default(""),
    confidence: text("confidence").notNull().default("medium"),
    status: text("status").notNull().default("unvalidated"),
    unit: text("unit").notNull().default(""),
    value: doublePrecision("value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("assumptions_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * PRD-BIZCORE-008 vertical slice: decisions. The Decision node from the
 * spec's canonical graph (section 3.2), between Model and Action - a
 * recorded business decision with its context and outcome. Not yet linked
 * to the assumptions/models that informed it or the actions it produces;
 * those links are later phases once those entities exist to link against.
 *
 * decidedAt follows the same "reflects current state, not history" rule as
 * tasks.completedAt: it is set when status becomes "decided" and cleared
 * for any other status, including "reversed" - a reversed decision is no
 * longer a currently-decided one, so a stale decidedAt would be
 * misleading. This is a deliberate simplification: it does not preserve
 * "when was this originally decided" as a separate historical fact.
 */
export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    context: text("context").notNull().default(""),
    outcome: text("outcome").notNull().default(""),
    status: text("status").notNull().default("proposed"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("decisions_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * PRD-BIZCORE-009 vertical slice: evidence. The Evidence node from the
 * spec's canonical graph (section 3.2), which in the full model connects
 * to actions, experiments and reviews as well - this slice wires it to
 * the two entities that already exist, assumptions and decisions, via
 * optional links. Both are ON DELETE SET NULL rather than CASCADE:
 * deleting an assumption or decision should not destroy the evidence that
 * was gathered, only detach it.
 *
 * Cross-workspace link integrity (an assumptionId/decisionId that exists
 * but belongs to a *different* workspace) is not enforceable by a foreign
 * key alone, since the FK only checks the row exists, not which workspace
 * it belongs to. That check is done in application code
 * (evidence-use-cases.ts), the same tradeoff every other tenant-scoped
 * table in this schema makes.
 */
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    strength: text("strength").notNull().default("moderate"),
    assumptionId: uuid("assumption_id").references(() => assumptions.id, { onDelete: "set null" }),
    decisionId: uuid("decision_id").references(() => decisions.id, { onDelete: "set null" }),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("evidence_workspace_id_idx").on(table.workspaceId),
    byAssumption: index("evidence_assumption_id_idx").on(table.assumptionId),
    byDecision: index("evidence_decision_id_idx").on(table.decisionId),
  }),
);

/**
 * PRD-CURRICULUM-001 vertical slice: programs, program versions and
 * lessons - the first Phase 3 slice (README "Learning system"). Unlike
 * every Phase 2 table, this content is platform-wide, not
 * workspace-scoped: it's authored once (by a platform admin, see
 * users.isPlatformAdmin) and read by every workspace, matching the
 * spec's ProgrammeVersion -> LessonVersion model (section 21). Lesson
 * *blocks* (the typed content inside a lesson - concept, worked-example,
 * knowledge-check, etc., section 21) are deliberately a separate, later
 * slice; this one only establishes the catalog and versioning/publishing
 * shape they'll attach to.
 */
export const programs = pgTable("programs", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  orderIndex: integer("order_index").notNull().default(0),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * "Publishing freezes a version for enrolled learners; edits create a new
 * version" (spec section 6.20). At most one published version per program
 * is enforced by a partial unique index, not application code alone -
 * publishProgramVersion (curriculum-use-cases.ts) atomically archives any
 * previously-published version in the same transaction before publishing
 * the new one, so the index should never actually reject a legitimate
 * publish; it exists as a backstop against a bug doing it wrong.
 */
export const programVersions = pgTable(
  "program_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    status: text("status").notNull().default("draft"),
    outcomes: text("outcomes").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byProgram: index("program_versions_program_id_idx").on(table.programId),
    uniqueVersionPerProgram: unique("program_versions_program_id_version_key").on(
      table.programId,
      table.version,
    ),
    onePublishedPerProgram: uniqueIndex("program_versions_one_published_per_program_idx")
      .on(table.programId)
      .where(sql`${table.status} = 'published'`),
  }),
);

/**
 * Lessons can only be created or edited while their parent program
 * version is still "draft" (enforced in curriculum-use-cases.ts, not the
 * database) - once a version is published it's frozen for enrolled
 * learners, per the same rule as programVersions above.
 */
export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programVersionId: uuid("program_version_id")
      .notNull()
      .references(() => programVersions.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    outcome: text("outcome").notNull().default(""),
    orderIndex: integer("order_index").notNull().default(0),
    estimatedMinutes: integer("estimated_minutes"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byProgramVersion: index("lessons_program_version_id_idx").on(table.programVersionId),
    uniqueSlugPerVersion: unique("lessons_program_version_id_slug_key").on(
      table.programVersionId,
      table.slug,
    ),
  }),
);

/**
 * PRD-CURRICULUM-002 vertical slice: structured lesson blocks (spec
 * section 21's 19 block types - orientation, concept, why, story,
 * metaphor, figure, worked-example, counterexample, calculation,
 * reflection, knowledge-check, practice, build, implementation,
 * coach-prompt, evidence, review, celebration, resource). Each type has a
 * genuinely different shape, so `payload` is jsonb rather than 19 tables
 * or 19 nullable column groups - the type-specific structure is enforced
 * by a Zod discriminated union at the API boundary
 * (packages/contracts/src/lesson-blocks.ts), not by the database.
 *
 * Same editability rule as lessons: blocks can only be created while the
 * parent lesson's program version is still "draft"
 * (assertProgramVersionEditable, curriculum-use-cases.ts). This first
 * slice is create + list only - no update or delete yet, the same
 * incremental scoping every other slice in this codebase has used.
 */
export const lessonBlocks = pgTable(
  "lesson_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    orderIndex: integer("order_index").notNull().default(0),
    blockType: text("block_type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byLesson: index("lesson_blocks_lesson_id_idx").on(table.lessonId),
  }),
);

/**
 * PRD-CURRICULUM-003 vertical slice: progress tracking and resume
 * behavior. Unlike programs/versions/lessons/blocks, enrollments and
 * progress belong to an individual learner's own account, not a
 * workspace - a person can belong to several workspaces but their
 * curriculum progress is personal (matches the spec's Enrollment ->
 * LearnerAttempt model, section 21).
 *
 * A learner may only enroll in a *published* program version
 * (curriculum-use-cases.ts already guarantees a published version is
 * frozen, so enrolling never targets a moving target). Re-enrolling in
 * the same version is rejected (unique per user+version) rather than
 * silently creating a duplicate.
 */
export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    programVersionId: uuid("program_version_id")
      .notNull()
      .references(() => programVersions.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    byUser: index("enrollments_user_id_idx").on(table.userId),
    uniquePerUserAndVersion: unique("enrollments_user_id_program_version_id_key").on(
      table.userId,
      table.programVersionId,
    ),
  }),
);

/**
 * One row per (enrollment, lesson) - the LearnerAttempt shape, scoped
 * down to what resuming actually needs. currentBlockId is how "resume at
 * the exact block, see saved state" (section 3.2) is implemented: the UI
 * reads it back and reopens the lesson there rather than at block one.
 * ON DELETE SET NULL rather than CASCADE - if a block were ever removed,
 * a learner's progress record should survive, just without a precise
 * resume point.
 */
export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("in_progress"),
    currentBlockId: uuid("current_block_id").references(() => lessonBlocks.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byEnrollment: index("lesson_progress_enrollment_id_idx").on(table.enrollmentId),
    uniquePerEnrollmentAndLesson: unique("lesson_progress_enrollment_id_lesson_id_key").on(
      table.enrollmentId,
      table.lessonId,
    ),
  }),
);

/**
 * PRD-CURRICULUM-004 vertical slice: notes and bookmarks. Same personal,
 * not-workspace-scoped shape as enrollments/progress. Unlike every other
 * table in this schema, notes and bookmarks are the first to support a
 * real hard delete: a bookmark is inherently a toggle (there is no
 * "history" value in keeping a removed one), and a personal note is the
 * user's own scratch content, not a business or audit record - deleting
 * your own note loses nothing anyone else needs. Every other table so
 * far only supports status changes for exactly this reason; this one is
 * a deliberate, scoped exception, not a new default.
 */
export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byUser: index("bookmarks_user_id_idx").on(table.userId),
    uniquePerUserAndLesson: unique("bookmarks_user_id_lesson_id_key").on(
      table.userId,
      table.lessonId,
    ),
  }),
);

/** Multiple notes per (user, lesson) are allowed - a running list of jottings, not a single field, matching how a learner would actually take notes while working through a lesson. */
export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byUserAndLesson: index("notes_user_id_lesson_id_idx").on(table.userId, table.lessonId),
  }),
);

/**
 * PRD-CURRICULUM-005 vertical slice: the learner's own responses to
 * "knowledge-check" and "reflection" blocks (README "Knowledge checks"
 * and "Reflection"). Scoped to an enrollment, not a bare userId - a
 * response only makes sense in the context of a specific attempt at the
 * program version that block belongs to, same reasoning as
 * lesson_progress. One response per (enrollment, block): resubmitting
 * overwrites rather than creating a history of attempts - this is
 * intentionally "your current answer", not a full attempt log.
 *
 * `response` is jsonb because its shape depends on block_type, same
 * reasoning as lesson_blocks.payload - enforced by a Zod discriminated
 * union at the API boundary (packages/contracts/src/block-responses.ts),
 * restricted for now to the two block types that actually need a
 * captured response. block_type is denormalized from the referenced
 * block so a response can be validated/queried without an extra join.
 */
export const blockResponses = pgTable(
  "block_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    lessonBlockId: uuid("lesson_block_id")
      .notNull()
      .references(() => lessonBlocks.id, { onDelete: "cascade" }),
    blockType: text("block_type").notNull(),
    response: jsonb("response").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byEnrollment: index("block_responses_enrollment_id_idx").on(table.enrollmentId),
    uniquePerEnrollmentAndBlock: unique("block_responses_enrollment_id_lesson_block_id_key").on(
      table.enrollmentId,
      table.lessonBlockId,
    ),
  }),
);

/**
 * PRD-CURRICULUM-006 vertical slice: prerequisites (README "Prerequisites").
 * A lesson may require one or more other lessons to be completed first.
 * Both sides are always lessons *in the same program version* -
 * enforced in prerequisite-use-cases.ts, not the database, the same
 * tradeoff every other cross-entity link in this schema makes (see
 * evidence's doc comment). ON DELETE CASCADE on both columns: a lesson
 * being removed (never actually implemented anywhere in this codebase
 * yet, but the FK exists for schema completeness) takes its prerequisite
 * links with it either way it participates.
 */
export const lessonPrerequisites = pgTable(
  "lesson_prerequisites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    prerequisiteLessonId: uuid("prerequisite_lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byLesson: index("lesson_prerequisites_lesson_id_idx").on(table.lessonId),
    uniquePerPair: unique("lesson_prerequisites_lesson_id_prerequisite_lesson_id_key").on(
      table.lessonId,
      table.prerequisiteLessonId,
    ),
    noSelfReference: check(
      "lesson_prerequisites_no_self_reference",
      sql`${table.lessonId} != ${table.prerequisiteLessonId}`,
    ),
  }),
);

/**
 * PRD-CURRICULUM-007 vertical slice: lesson application (README "Lesson
 * application") - links a learner's "build"/"practice"/"implementation"
 * block (spec section 3.1: "a structured build activity that creates or
 * updates a canonical asset") to the real Phase 2 business record it
 * produced, e.g. a lesson about setting goals pointing at the Goal the
 * learner actually created in their business. This is the concrete tie
 * between curriculum (platform-wide) and business data (workspace-owned)
 * the spec's canonical graph implies but no earlier slice wires up.
 *
 * resource_id is polymorphic - it can reference a row in any of several
 * workspace-scoped tables depending on resource_type - so it's a bare
 * uuid with no foreign key, the same reasoning evidence's
 * assumption_id/decision_id links would have needed if they pointed at
 * more than two tables. Existence and workspace ownership are checked in
 * application code (lesson-application-use-cases.ts), not the database.
 * One application per (enrollment, block): pointing it at a different
 * resource overwrites, not logs a history - "what this block currently
 * produced", matching block_responses' own "current answer" semantics.
 */
export const lessonApplications = pgTable(
  "lesson_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    lessonBlockId: uuid("lesson_block_id")
      .notNull()
      .references(() => lessonBlocks.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id").notNull(),
    note: text("note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byEnrollment: index("lesson_applications_enrollment_id_idx").on(table.enrollmentId),
    byWorkspace: index("lesson_applications_workspace_id_idx").on(table.workspaceId),
    uniquePerEnrollmentAndBlock: unique("lesson_applications_enrollment_id_lesson_block_id_key").on(
      table.enrollmentId,
      table.lessonBlockId,
    ),
  }),
);
