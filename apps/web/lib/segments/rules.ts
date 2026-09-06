/**
 * The segment rule engine — a pure compiler from a nested AND/OR filter tree
 * into a parameterized SQL WHERE fragment over the leads table (aliased `l`).
 * Fields and operators are whitelisted, so an untrusted rule tree can never
 * inject SQL: unknown fields/ops throw, and every value goes in as a bound
 * parameter. Kept dependency-free and side-effect-free so it's exhaustively
 * unit-testable without a database.
 */

export type Combinator = "and" | "or";
export type Op = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains" | "isTrue" | "isFalse" | "withinDays";

export interface Condition { field: string; op: Op; value?: string | number | boolean | string[] }
export interface Group { combinator: Combinator; rules: RuleNode[] }
export type RuleNode = Condition | Group;

export function isGroup(n: RuleNode): n is Group {
  return !!n && typeof n === "object" && "combinator" in n && Array.isArray((n as Group).rules);
}

type ValueKind = "enum" | "number" | "text" | "bool" | "boolExpr" | "days";

interface FieldDef {
  label: string;
  /** SQL expression on the `l` (leads) alias, or a full boolean expression for boolExpr fields. */
  sql: string;
  kind: ValueKind;
  ops: Op[];
  /** For enum fields: the allowed values. */
  options?: { value: string; label: string }[];
}

// EXISTS a booking in this workspace for the same email — "booked / converted".
// Excludes a soft-deleted booking (see bookings.deleted_at) same as every
// other read of these tables.
export const BOOKED_SQL =
  "EXISTS (SELECT 1 FROM bookings b WHERE b.workspace_id = l.workspace_id AND b.deleted_at IS NULL AND b.email IS NOT NULL AND l.email IS NOT NULL AND lower(b.email) = lower(l.email))";

export const SEGMENT_FIELDS: Record<string, FieldDef> = {
  status: { label: "Lead status", sql: "l.status", kind: "enum", ops: ["eq", "neq", "in"],
    options: [{ value: "qualified", label: "Qualified" }, { value: "nurture", label: "Nurture" }, { value: "unqualified", label: "Unqualified" }] },
  score: { label: "Score", sql: "l.score", kind: "number", ops: ["eq", "gt", "gte", "lt", "lte"] },
  funnel: { label: "Funnel", sql: "l.funnel_slug", kind: "text", ops: ["eq", "neq", "in", "contains"] },
  route: { label: "Route", sql: "l.route", kind: "text", ops: ["eq", "neq", "contains"] },
  name: { label: "Name", sql: "l.name", kind: "text", ops: ["contains"] },
  email: { label: "Email", sql: "l.email", kind: "text", ops: ["contains"] },
  source: { label: "Ad source (utm_source)", sql: "l.attribution->>'utmSource'", kind: "text", ops: ["eq", "contains"] },
  medium: { label: "Ad medium (utm_medium)", sql: "l.attribution->>'utmMedium'", kind: "text", ops: ["eq", "contains"] },
  campaign: { label: "Campaign", sql: "l.attribution->>'utmCampaign'", kind: "text", ops: ["eq", "contains"] },
  creative: { label: "Creative", sql: "l.attribution->>'creativeId'", kind: "text", ops: ["eq", "contains"] },
  verified: { label: "Contact verified", sql: "l.verified", kind: "bool", ops: ["isTrue", "isFalse"] },
  hasEmail: { label: "Has email", sql: "(l.email IS NOT NULL AND l.email <> '')", kind: "boolExpr", ops: ["isTrue", "isFalse"] },
  hasPhone: { label: "Has phone / SMS-reachable", sql: "(l.phone IS NOT NULL AND l.phone <> '')", kind: "boolExpr", ops: ["isTrue", "isFalse"] },
  booked: { label: "Booked a call (converted)", sql: BOOKED_SQL, kind: "boolExpr", ops: ["isTrue", "isFalse"] },
  createdAt: { label: "Created", sql: "l.created_at", kind: "days", ops: ["withinDays"] },
};

export interface CompiledSegment { sql: string; params: unknown[] }

/** Compile a rule tree to a parameterized WHERE fragment. `paramStart` is the
 *  1-based index of the first placeholder (so a caller can reserve $1 for the
 *  workspace id and pass paramStart=2). An empty tree matches everyone. */
export function compileSegment(root: Group, paramStart = 1): CompiledSegment {
  const params: unknown[] = [];
  const ph = (v: unknown): string => { params.push(v); return `$${paramStart + params.length - 1}`; };

  const compileCondition = (c: Condition): string => {
    const def = SEGMENT_FIELDS[c.field];
    if (!def) throw new Error(`unknown segment field "${c.field}"`);
    if (!def.ops.includes(c.op)) throw new Error(`operator "${c.op}" not allowed on field "${c.field}"`);
    const col = def.sql;
    switch (c.op) {
      case "isTrue": return def.kind === "boolExpr" ? col : `${col} IS TRUE`;
      case "isFalse": return def.kind === "boolExpr" ? `NOT ${col}` : `${col} IS NOT TRUE`;
      case "eq": return def.kind === "number" ? `${col} = ${ph(num(c.value))}` : `lower(${col}) = lower(${ph(str(c.value))})`;
      case "neq": return def.kind === "number" ? `${col} <> ${ph(num(c.value))}` : `lower(${col}) IS DISTINCT FROM lower(${ph(str(c.value))})`;
      case "gt": return `${col} > ${ph(num(c.value))}`;
      case "gte": return `${col} >= ${ph(num(c.value))}`;
      case "lt": return `${col} < ${ph(num(c.value))}`;
      case "lte": return `${col} <= ${ph(num(c.value))}`;
      case "contains": return `${col} ILIKE ${ph("%" + str(c.value) + "%")}`;
      case "withinDays": return `${col} >= now() - make_interval(days => ${ph(num(c.value))})`;
      case "in": {
        const arr = Array.isArray(c.value) ? c.value.map(String) : [];
        if (arr.length === 0) return "FALSE"; // "in nothing" matches no rows
        return `lower(${col}) IN (${arr.map((v) => `lower(${ph(v)})`).join(", ")})`;
      }
      default: throw new Error(`unhandled operator "${c.op as string}"`);
    }
  };

  const compileNode = (n: RuleNode): string => {
    if (isGroup(n)) {
      const parts = n.rules.map(compileNode).filter(Boolean);
      if (parts.length === 0) return "TRUE";
      const joiner = n.combinator === "or" ? " OR " : " AND ";
      return `(${parts.join(joiner)})`;
    }
    return compileCondition(n);
  };

  const sql = !root || root.rules.length === 0 ? "TRUE" : compileNode(root);
  return { sql, params };
}

/** Validate a rule tree without compiling params (throws on the first problem). */
export function validateSegmentRules(root: unknown): asserts root is Group {
  if (!root || typeof root !== "object" || !("combinator" in root) || !Array.isArray((root as Group).rules)) {
    throw new Error("rules must be a group with a combinator and a rules array");
  }
  compileSegment(root as Group); // reuses the whitelist checks
}

function str(v: unknown): string {
  if (v === undefined || v === null) throw new Error("a value is required");
  return String(v);
}
function num(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`"${String(v)}" is not a number`);
  return n;
}
