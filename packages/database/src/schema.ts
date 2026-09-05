import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  doublePrecision,
  primaryKey,
  index,
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
export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
