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
  type AnyPgColumn,
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
    // PRD-BUILD-002 (Phase 5 second slice: customer and positioning
    // tools, spec section 6.7 "Offer, positioning and message system" -
    // "capture ideal customer, problem, emotional consequence, desired
    // outcome, ... unique mechanism, proof, ... call to action").
    // Additive columns with defaults - no behavior change for profiles
    // created before this slice. These are how the business should
    // talk to *this* customer segment specifically - distinct from
    // offers.positioningStatement (PRD-BUILD-001), which positions one
    // specific product, not a whole audience.
    emotionalConsequence: text("emotional_consequence").notNull().default(""),
    uniqueMechanism: text("unique_mechanism").notNull().default(""),
    proof: text("proof").notNull().default(""),
    callToAction: text("call_to_action").notNull().default(""),
    positioningStatement: text("positioning_statement").notNull().default(""),
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
    // PRD-BUILD-001 (Phase 5 first slice: offer builder, spec's "Offer
    // and funnel building" section - "customer profiles, problem
    // statements, desired outcomes, positioning statements, value
    // propositions, offer components, bonuses, pricing, guarantees,
    // risk reversal, objections"). Additive columns with defaults - no
    // behavior change for offers created before this slice. Pricing
    // stays priceCents/currency above; this is the rest of the offer's
    // persuasive structure, free text plus small jsonb lists rather
    // than a normalized child table each, since these are ordered,
    // wholesale-edited lists that belong to exactly one offer, not
    // independently queried or referenced elsewhere.
    problemStatement: text("problem_statement").notNull().default(""),
    desiredOutcome: text("desired_outcome").notNull().default(""),
    positioningStatement: text("positioning_statement").notNull().default(""),
    valueProposition: text("value_proposition").notNull().default(""),
    guarantee: text("guarantee").notNull().default(""),
    riskReversal: text("risk_reversal").notNull().default(""),
    /** Array of {name, description} - what the offer actually includes. */
    offerComponents: jsonb("offer_components").notNull().default([]),
    /** Array of {name, description, value} - value as free text (e.g. "$500 value"), not a parsed money amount. */
    bonuses: jsonb("bonuses").notNull().default([]),
    /** Array of {objection, response} - the standard "but what if..." pairs a sales page addresses. */
    objections: jsonb("objections").notNull().default([]),
  },
  (table) => ({
    byWorkspace: index("offers_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * PRD-BUILD-005 (Phase 5 fifth slice: task and project system, spec's
 * "Execution system" section - "projects; milestones; tasks; next
 * actions; priorities; due dates; dependencies; blockers; ..."). A
 * project is just a named grouping a task can optionally belong to -
 * milestones/checklists/experiments/review-cycles from that same list
 * stay later, separate slices.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("projects_workspace_id_idx").on(table.workspaceId),
    statusCheck: check(
      "projects_status_check",
      sql`${table.status} IN ('active', 'completed', 'archived')`,
    ),
  }),
);

/**
 * Phase 2 schema (README "Core user and business data" - fourth slice):
 * tasks, extended by PRD-BUILD-005 (Phase 5 fifth slice: task and
 * project system) with projectId/priority/blockedByTaskId. Originally
 * deliberately small - not the full §6.18 execution system (projects,
 * milestones, dependencies, blockers, checklists tied to lessons/
 * decisions) - milestones/checklists/experiments/review-cycles from
 * that list still stay later, separate slices.
 *
 * completedAt is a real derived field, not just another status value: it
 * records *when* a task was actually finished, separately from status
 * potentially changing again later (§37's domain-invariant spirit - a
 * fact that happened shouldn't be reconstructible only by guessing from
 * updatedAt).
 *
 * blockedByTaskId is a single self-reference, not a full dependency
 * graph - "this task is blocked by that task" is the concrete case spec
 * asks for; a many-to-many dependency DAG with cycle detection is a
 * larger feature this slice doesn't attempt. SET NULL on delete so
 * removing the blocking task doesn't cascade into deleting the blocked
 * one, and a CHECK constraint (mirroring lesson_prerequisites') rules
 * out a task blocking itself.
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
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    priority: text("priority").notNull().default("medium"),
    blockedByTaskId: uuid("blocked_by_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    byWorkspace: index("tasks_workspace_id_idx").on(table.workspaceId),
    byProject: index("tasks_project_id_idx").on(table.projectId),
    priorityCheck: check(
      "tasks_priority_check",
      sql`${table.priority} IN ('low', 'medium', 'high', 'urgent')`,
    ),
    noSelfBlock: check("tasks_no_self_block", sql`${table.blockedByTaskId} != ${table.id}`),
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
    // PRD-NUMBERS-006 (Phase 4 sixth slice: assumption provenance,
    // spec section 6.x "every number carries value, unit, currency,
    // period, source type, source date, confidence, owner and formula
    // trace"). `source` above stays the free-text description
    // ("industry benchmark", "customer interview #4"); sourceType is
    // the spec's controlled vocabulary distinguishing how a number
    // came to exist. Additive columns with defaults - no behavior
    // change for the Phase 2 assumption rows created before this slice.
    sourceType: text("source_type").notNull().default("estimate-user"),
    sourceDate: timestamp("source_date", { withTimezone: true }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    // Populated only when sourceType is 'derived' or 'scenario-override' -
    // which formula (formula_definitions.key/version) produced this
    // value, so a derived number's trail can be followed back to the
    // calculation that made it, not just to a person.
    formulaTraceKey: text("formula_trace_key"),
    formulaTraceVersion: integer("formula_trace_version"),
  },
  (table) => ({
    byWorkspace: index("assumptions_workspace_id_idx").on(table.workspaceId),
    sourceTypeCheck: check(
      "assumptions_source_type_check",
      sql`${table.sourceType} IN ('actual-imported', 'actual-entered', 'estimate-user', 'estimate-ai', 'benchmark', 'derived', 'scenario-override')`,
    ),
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
    // PRD-BUILD-007 (Phase 5 seventh slice: evidence collection, README
    // "Build and execution" -> "Evidence collection" - the Phase-5-scale
    // version of this Phase 2 slice, spec section 6.19: "an experiment
    // connects a lesson hypothesis to an action, measurement and review
    // decision"). Additive, nullable, set null on delete - no behavior
    // change for evidence created before this slice; an evidence record
    // can be linked to an assumption, a decision, an experiment, any
    // combination, or none.
    experimentId: uuid("experiment_id").references((): AnyPgColumn => experiments.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    byWorkspace: index("evidence_workspace_id_idx").on(table.workspaceId),
    byAssumption: index("evidence_assumption_id_idx").on(table.assumptionId),
    byDecision: index("evidence_decision_id_idx").on(table.decisionId),
    byExperiment: index("evidence_experiment_id_idx").on(table.experimentId),
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

/**
 * PRD-NUMBERS-001 vertical slice: the versioned formula library (README
 * "Numbers and modeling" -> "Versioned formula library", first slice of
 * Phase 4). The spec requires every important number to retain "its
 * formula version" - this table is that version history, platform-wide
 * content authored by a platform admin, same draft/published/
 * one-published-per-key shape as programVersions above: publishing
 * freezes a version, edits create a new one, at most one version of a
 * given formula key is published at a time.
 *
 * The formula's actual computation is NOT stored here as a string
 * expression to eval - that's an injection/correctness risk for limited
 * benefit, and this system has no legitimate need for user-authored
 * arbitrary math. Instead each (key, version) pair is implemented as a
 * plain TypeScript function in formula-registry.ts (packages/domain);
 * this table is the versioned, publishable metadata describing what a
 * formula is, what named inputs it needs (with unit/description), and
 * what unit it outputs - the source of truth callers consult before
 * invoking the matching registry function, and what listFormulaDefinitions
 * shows a workspace so they know which formulas exist and at what version.
 */
export const formulaDefinitions = pgTable(
  "formula_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Array of {name, unit, description} - the named inputs computeFormula (formula-use-cases.ts) validates a caller's input map against. */
    inputSchema: jsonb("input_schema").notNull(),
    outputUnit: text("output_unit").notNull(),
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byKey: index("formula_definitions_key_idx").on(table.key),
    uniqueVersionPerKey: unique("formula_definitions_key_version_key").on(table.key, table.version),
    onePublishedPerKey: uniqueIndex("formula_definitions_one_published_per_key_idx")
      .on(table.key)
      .where(sql`${table.status} = 'published'`),
  }),
);

/**
 * PRD-NUMBERS-002 vertical slice: scenario modeling (README "Numbers and
 * modeling" -> "Scenario modeling", second slice of Phase 4). Spec
 * section 6.11: "Create immutable base, likely, best, worst and custom
 * scenarios. Users may override selected assumptions without modifying
 * the baseline."
 *
 * A scenario is a named lens over the workspace's existing Phase 2
 * assumptions (schema.ts's assumptions table) rather than a parallel set
 * of numbers - scenarioAssumptionOverrides (below) points at real
 * assumptions rows and only stores the values that differ from that
 * assumption's own current baseline value. At most one "base"/"best"/
 * "worst" scenario per workspace (the canonical three), but any number
 * of "custom" ones - enforced by a partial unique index on
 * (workspace_id, scenario_type) that excludes 'custom'.
 *
 * "Immutable" in the spec's sense means a scenario's *identity* doesn't
 * change into a different one - it does not mean overrides can never be
 * adjusted after creation. This slice keeps override editing simple
 * (upsert/remove a single row), matching the "current state, not
 * history" convention most Phase 2/3 tables already use; a scenario is
 * never merged back into the baseline, which is the property the spec
 * actually cares about.
 */
export const scenarios = pgTable(
  "scenarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    scenarioType: text("scenario_type").notNull().default("custom"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("scenarios_workspace_id_idx").on(table.workspaceId),
    scenarioTypeCheck: check(
      "scenarios_scenario_type_check",
      sql`${table.scenarioType} IN ('base', 'best', 'worst', 'custom')`,
    ),
    onePerCanonicalTypePerWorkspace: uniqueIndex("scenarios_one_per_canonical_type_idx")
      .on(table.workspaceId, table.scenarioType)
      .where(sql`${table.scenarioType} != 'custom'`),
  }),
);

/**
 * The actual overrides for one scenario: (scenarioId, assumptionId) ->
 * value. Only the assumptions a scenario actually overrides get a row
 * here - resolveScenarioAssumptions (scenario-use-cases.ts) falls back
 * to the assumption's own baseline value for every assumption a
 * scenario doesn't override, which is exactly "override selected
 * assumptions without modifying the baseline".
 */
export const scenarioAssumptionOverrides = pgTable(
  "scenario_assumption_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    assumptionId: uuid("assumption_id")
      .notNull()
      .references(() => assumptions.id, { onDelete: "cascade" }),
    value: doublePrecision("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byScenario: index("scenario_assumption_overrides_scenario_id_idx").on(table.scenarioId),
    uniquePerScenarioAssumption: unique(
      "scenario_assumption_overrides_scenario_id_assumption_id_key",
    ).on(table.scenarioId, table.assumptionId),
  }),
);

/**
 * PRD-NUMBERS-003 vertical slice: funnel mathematics (README "Numbers
 * and modeling" -> "Funnel mathematics", third slice of Phase 4). One
 * ordered funnel per workspace, top (e.g. "Traffic") to bottom (e.g.
 * "Sales"). conversionRate is nullable and means "share of the previous
 * stage's volume that reaches this one" - so the very first stage
 * (lowest orderIndex) has no meaningful incoming conversion rate and is
 * expected to leave it null; every later stage needs one to compute
 * backward from a target (funnel-use-cases.ts's
 * calculateFunnelRequirements). unique(workspace_id, order_index) keeps
 * one stage per position, the same "no duplicate ordering" property
 * lessons/lessonBlocks get from their own orderIndex + parent scoping.
 */
export const funnelStages = pgTable(
  "funnel_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    orderIndex: integer("order_index").notNull(),
    conversionRate: doublePrecision("conversion_rate"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("funnel_stages_workspace_id_idx").on(table.workspaceId),
    uniqueOrderPerWorkspace: unique("funnel_stages_workspace_id_order_index_key").on(
      table.workspaceId,
      table.orderIndex,
    ),
  }),
);

/**
 * PRD-BUILD-003 (Phase 5 third slice: funnel builder, spec section 6.8's
 * "Funnel step" node family: "landing page, opt-in, webinar, appointment,
 * sales call, sales page, checkout, confirmation and custom step"). This
 * is the structural funnel *map* - what pages/steps this business's
 * funnel is actually made of - distinct from funnel_stages above, which
 * is purely the conversion-rate math between stages (PRD-NUMBERS-003).
 * The full drag/drop React Flow canvas from spec 6.8 is a Phase 5+
 * frontend concern; this table is the data model a future canvas UI
 * would read and write.
 *
 * offerId is an optional link (e.g. a "sales-page" or "checkout" step
 * naturally corresponds to the offer being sold there) - nullable
 * because not every step type has one (a webinar or confirmation page
 * doesn't), and SET NULL on delete so removing an offer doesn't cascade
 * into silently deleting funnel structure that still exists.
 */
export const funnelSteps = pgTable(
  "funnel_steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    stepType: text("step_type").notNull(),
    orderIndex: integer("order_index").notNull(),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("funnel_steps_workspace_id_idx").on(table.workspaceId),
    uniqueOrderPerWorkspace: unique("funnel_steps_workspace_id_order_index_key").on(
      table.workspaceId,
      table.orderIndex,
    ),
    stepTypeCheck: check(
      "funnel_steps_step_type_check",
      sql`${table.stepType} IN (
        'landing-page', 'opt-in', 'webinar', 'appointment', 'sales-call',
        'sales-page', 'checkout', 'confirmation', 'custom'
      )`,
    ),
  }),
);

/**
 * PRD-BUILD-004 (Phase 5 fourth slice: artifact versioning, README
 * "Offer and funnel building" -> "Important business artifacts must be
 * versioned. Users must be able to compare changes and understand which
 * version produced which result."). A generic, cross-artifact version
 * history rather than a parallel `_versions` table per artifact type
 * (offer_versions, customer_profile_versions, ...) - every artifact this
 * slice supports just needs "snapshot the current state, keep every past
 * snapshot, diff any two" and none of them need artifact-specific
 * version columns, so one polymorphic table serves all of them (same
 * "resourceId with no FK, dispatched by resourceType in application
 * code" reasoning as lesson_applications).
 *
 * Versioning here is an explicit action (snapshotArtifactVersion in
 * artifact-version-use-cases.ts), not an automatic snapshot on every
 * edit - matching this codebase's own precedent (programVersions,
 * formulaDefinitions: a deliberate "publish"/"save version" step, not
 * silent history on every keystroke).
 */
export const artifactVersions = pgTable(
  "artifact_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(),
    artifactId: uuid("artifact_id").notNull(),
    version: integer("version").notNull(),
    /** The full serialized state of the artifact at this point - shape depends on artifactType, validated by the contract for that type at the API boundary, not by this table. */
    snapshot: jsonb("snapshot").notNull(),
    changeNote: text("change_note").notNull().default(""),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byArtifact: index("artifact_versions_artifact_idx").on(table.artifactType, table.artifactId),
    uniqueVersionPerArtifact: unique("artifact_versions_artifact_version_key").on(
      table.artifactType,
      table.artifactId,
      table.version,
    ),
    artifactTypeCheck: check(
      "artifact_versions_artifact_type_check",
      sql`${table.artifactType} IN ('offer', 'customer_profile', 'funnel_step')`,
    ),
  }),
);

/**
 * PRD-BUILD-006 vertical slice: experiments (README "Build and execution"
 * -> "Experiment system", sixth slice of Phase 5; spec section 6.19
 * "Experiments and evidence" - "hypothesis, assumption, metric, baseline,
 * target, design, audience, dates, budget, owner, result, confidence,
 * evidence and decision"). Deliberately small - hypothesis, method,
 * status, an optional assumption link, an optional owner, start/end
 * dates and a result/decision pair - not the full field list (metric,
 * baseline/target, audience, budget, confidence), which stays a later,
 * separate slice. This is the "later, separate slice" referenced in
 * tasks' and projects' own doc comments above.
 *
 * startedAt/endedAt are real derived fields, same reasoning as tasks'
 * completedAt: they record *when* the experiment actually moved into
 * that state, set by the status transition itself (experiment-use-
 * cases.ts's updateExperiment), not left for a caller to backfill by
 * hand.
 */
export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hypothesis: text("hypothesis").notNull().default(""),
    method: text("method").notNull().default(""),
    status: text("status").notNull().default("planned"),
    assumptionId: uuid("assumption_id").references(() => assumptions.id, {
      onDelete: "set null",
    }),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    result: text("result").notNull().default(""),
    decision: text("decision"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("experiments_workspace_id_idx").on(table.workspaceId),
    statusCheck: check(
      "experiments_status_check",
      sql`${table.status} IN ('planned', 'running', 'completed', 'abandoned')`,
    ),
    /** NULL (no decision made yet) passes a CHECK unchecked - this only constrains a decision once one is actually set. */
    decisionCheck: check(
      "experiments_decision_check",
      sql`${table.decision} IS NULL OR ${table.decision} IN ('adopt', 'iterate', 'retest', 'stop', 'insufficient_evidence', 'reject')`,
    ),
  }),
);

/**
 * PRD-BUILD-008 vertical slice: launches (README "Build and execution" ->
 * "Launch workflows", eighth and final slice of Phase 5; spec's guided
 * business-transformation lifecycle "Define, Offer, Numbers, Build,
 * Launch, Leads, Improve" - this is the Launch stage). A launch is an
 * optionally offer-linked plan with a target/actual date and an ordered
 * checklist - same jsonb-array-for-an-ordered-wholesale-edited-list
 * pattern as offers' offerComponents/bonuses/objections, not a normalized
 * child table, since a launch checklist belongs to exactly one launch and
 * is edited as a whole list, not independently queried elsewhere.
 * Leads/campaigns (the spec's next lifecycle stage) stay a later, separate
 * slice - this only covers getting a specific offer out the door.
 */
export const launches = pgTable(
  "launches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    status: text("status").notNull().default("planning"),
    launchDate: timestamp("launch_date", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    /** Array of {label, done} - the launch's ordered readiness checklist. */
    checklist: jsonb("checklist").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("launches_workspace_id_idx").on(table.workspaceId),
    byOffer: index("launches_offer_id_idx").on(table.offerId),
    statusCheck: check(
      "launches_status_check",
      sql`${table.status} IN ('planning', 'scheduled', 'live', 'completed', 'cancelled')`,
    ),
  }),
);

/**
 * PRD-AI-006 vertical slice: artifact proposals (README "AI coaching" ->
 * "Artifact proposals", sixth slice of Phase 6; ADR-0012, spec §7.2's
 * "propose -> validate -> user-review -> accept/edit/reject -> audited-
 * apply" pipeline). Covers the same three artifact types as
 * artifactVersions above (offer, customer_profile, funnel_step) -
 * deliberately not a fourth polymorphic surface, a proposal always
 * targets an *existing* artifact that already has versioning; proposing
 * a brand-new artifact is a later, separate extension.
 *
 * proposedPatch is stored only after being validated at creation time
 * against that artifact type's own update-request Zod schema (the same
 * one the human-facing PATCH route already uses) - "the model returns
 * JSON conforming to a versioned Zod schema. The server validates" made
 * concrete without inventing a second, parallel schema per artifact
 * type. promptTemplateKey/promptTemplateVersion/providerId/model record
 * exactly what produced this proposal - §7.2's "records model/provider,
 * prompt template version" - and reviewedByUserId/reviewedAt record who
 * confirmed or rejected it and when, once a human actually does.
 */
export const artifactProposals = pgTable(
  "artifact_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    artifactType: text("artifact_type").notNull(),
    artifactId: uuid("artifact_id").notNull(),
    proposedPatch: jsonb("proposed_patch").notNull(),
    rationale: text("rationale").notNull().default(""),
    promptTemplateKey: text("prompt_template_key").notNull(),
    promptTemplateVersion: integer("prompt_template_version").notNull(),
    providerId: text("provider_id").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("artifact_proposals_workspace_id_idx").on(table.workspaceId),
    byArtifact: index("artifact_proposals_artifact_idx").on(table.artifactType, table.artifactId),
    artifactTypeCheck: check(
      "artifact_proposals_artifact_type_check",
      sql`${table.artifactType} IN ('offer', 'customer_profile', 'funnel_step')`,
    ),
    statusCheck: check(
      "artifact_proposals_status_check",
      sql`${table.status} IN ('pending', 'accepted', 'rejected')`,
    ),
  }),
);

/**
 * PRD-AI-007 vertical slice: task proposals (README "AI coaching" ->
 * "Task proposals", seventh slice of Phase 6; ADR-0012, spec §7.1's
 * "suggest experiments and actions grounded in current data"). Unlike
 * artifactProposals above (which patches an *existing* record),
 * accepting a task proposal *creates* a new task - so this stores the
 * proposed task's fields, not a patch, and records which task was
 * actually created (createdTaskId) once accepted, for traceability.
 * Same propose -> validate -> user-review -> accept/reject shape
 * otherwise; see artifact-proposal-use-cases.ts's doc comment for why
 * accept runs as two separate transactions rather than one.
 */
export const taskProposals = pgTable(
  "task_proposals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    proposedTask: jsonb("proposed_task").notNull(),
    rationale: text("rationale").notNull().default(""),
    promptTemplateKey: text("prompt_template_key").notNull(),
    promptTemplateVersion: integer("prompt_template_version").notNull(),
    providerId: text("provider_id").notNull(),
    model: text("model").notNull(),
    status: text("status").notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdTaskId: uuid("created_task_id").references(() => tasks.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("task_proposals_workspace_id_idx").on(table.workspaceId),
    statusCheck: check(
      "task_proposals_status_check",
      sql`${table.status} IN ('pending', 'accepted', 'rejected')`,
    ),
  }),
);

/**
 * PRD-AI-010 vertical slice: cost and latency tracking (README
 * "AI coaching" -> "Cost and latency tracking", tenth slice of Phase 6;
 * spec §39's "AI budget" concern). One row per completed AI call -
 * provider/model, token usage, measured latency, and an estimated cost
 * (packages/ai's estimateCostMicros, pricing.ts - explicitly an
 * estimate, never authoritative billing, per §40's financial-assurance
 * rule).
 *
 * workspaceId is nullable because not every AI call happens inside a
 * workspace context - lesson explanations are scoped to a learner's
 * personal enrollment, not a workspace, so they still get a row (cost
 * and latency happened regardless of context) but with workspaceId
 * null. actorUserId is always required - every call has a real person
 * who triggered it.
 *
 * Written explicitly by each AI route after a successful call (recordAiCall,
 * ai-call-record-use-cases.ts), the same "domain functions record their
 * own audit trail explicitly" convention as everywhere else in this
 * codebase - not an automatic hook buried in the gateway, which lives in
 * packages/ai and has no database access by design.
 */
export const aiCallRecords = pgTable(
  "ai_call_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    promptTemplateKey: text("prompt_template_key").notNull(),
    promptTemplateVersion: integer("prompt_template_version").notNull(),
    providerId: text("provider_id").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    /** USD micros (1,000,000 = $1) - null when the model has no known price (estimateCostMicros). */
    estimatedCostMicros: integer("estimated_cost_micros"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byActor: index("ai_call_records_actor_user_id_idx").on(table.actorUserId),
    byWorkspace: index("ai_call_records_workspace_id_idx").on(table.workspaceId),
  }),
);

/**
 * PRD-REVIEW-002 vertical slice: weekly reviews (README "Review and
 * intelligence" -> "Weekly reviews", second slice of Phase 7; spec
 * section 6.18's "weekly review"). One row per workspace per calendar
 * week - upsertWeeklyReview (weekly-review-use-cases.ts) creates it on
 * the first save for a given week and updates it on every save after,
 * the same "one row per natural key, INSERT ... ON CONFLICT DO UPDATE"
 * pattern as businessProfiles (one per workspace), applied here to
 * (workspace_id, week_start_date).
 *
 * weekStartDate is a timestamptz normalized to that week's Monday
 * 00:00:00 UTC by the domain layer (toWeekStart in weekly-review-use-
 * cases.ts), not a native Postgres `date` - this schema has no other
 * day-only column yet, and normalizing at the application layer keeps
 * every date column in this table the same timestamptz type as the rest
 * of the schema.
 *
 * scorecardSnapshot freezes getWorkspaceScorecard's output (Phase 7
 * first slice) at the moment this review is saved - a scorecard itself
 * is deliberately never persisted (it's a live aggregation over other
 * tables), but a weekly review is exactly the point-in-time record that
 * should keep one, so a later week's review can be compared against it.
 */
export const weeklyReviews = pgTable(
  "weekly_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStartDate: timestamp("week_start_date", { withTimezone: true }).notNull(),
    wins: text("wins").notNull().default(""),
    challenges: text("challenges").notNull().default(""),
    focusNextWeek: text("focus_next_week").notNull().default(""),
    scorecardSnapshot: jsonb("scorecard_snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("weekly_reviews_workspace_id_idx").on(table.workspaceId),
    uniquePerWorkspaceAndWeek: unique("weekly_reviews_workspace_id_week_start_date_key").on(
      table.workspaceId,
      table.weekStartDate,
    ),
  }),
);

/**
 * PRD-REVIEW-004 vertical slice: force assessments (README "Review and
 * intelligence" -> "Constraint diagnosis", fourth slice of Phase 7;
 * spec section 6.4's "Diagnostic and Seven Forces" - "for each force
 * store current score 0-100, target, confidence, evidence, constraint,
 * coach score, recommendations and reassessment date"). One row per
 * workspace per force (the seven forces are a fixed enumerated set, not
 * user-defined) - upsertForceAssessment (force-assessment-use-cases.ts)
 * creates or revises the assessment for one force at a time, the same
 * "one row per natural key" pattern as weekly_reviews and
 * business_profiles.
 *
 * This slice deliberately implements only score/target/confidence/
 * evidence/constraintNote/recommendations/reassessedAt from the spec's
 * full field list - "coach score" (a second, coach-authored score
 * alongside the self-reported one) is left for a later slice once a
 * real coach-vs-founder review workflow exists, the same
 * "deliberately small field scope, extended when a later slice needs
 * more" convention as experiments' own table.
 */
export const forceAssessments = pgTable(
  "force_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    force: text("force").notNull(),
    score: integer("score").notNull(),
    target: integer("target"),
    confidence: text("confidence").notNull().default("medium"),
    evidence: text("evidence").notNull().default(""),
    /** The specific limiting factor observed for this force - spec section 6.4's own "constraint" field, not a computed diagnosis (that's getConstraintDiagnosis, derived from every force's score). */
    constraintNote: text("constraint_note").notNull().default(""),
    recommendations: text("recommendations").notNull().default(""),
    reassessedAt: timestamp("reassessed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byWorkspace: index("force_assessments_workspace_id_idx").on(table.workspaceId),
    uniquePerWorkspaceAndForce: unique("force_assessments_workspace_id_force_key").on(
      table.workspaceId,
      table.force,
    ),
    forceCheck: check(
      "force_assessments_force_check",
      sql`${table.force} IN ('owner_psychology', 'vision_planning', 'sales_marketing', 'people_culture', 'operations_systems', 'finance_measurement', 'customer_experience')`,
    ),
    confidenceCheck: check(
      "force_assessments_confidence_check",
      sql`${table.confidence} IN ('low', 'medium', 'high')`,
    ),
    scoreRangeCheck: check(
      "force_assessments_score_range_check",
      sql`${table.score} BETWEEN 0 AND 100`,
    ),
    targetRangeCheck: check(
      "force_assessments_target_range_check",
      sql`${table.target} IS NULL OR ${table.target} BETWEEN 0 AND 100`,
    ),
  }),
);
