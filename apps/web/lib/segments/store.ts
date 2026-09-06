/**
 * Segment store — persistence for saved segments plus the live evaluation that
 * powers the builder: a preview (how many people match, and how many are
 * reachable by each channel) and the full contact list a workflow acts on
 * (export, email list, SMS list, call list). All evaluation runs against the
 * workspace's own leads, scoped by workspace_id, with the rule tree compiled to
 * bound parameters (see ./rules).
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";
import { compileSegment, validateSegmentRules, BOOKED_SQL, type Group } from "./rules";
import { softDeleteRow } from "../soft-delete";

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  rules: Group;
  createdAt: string;
  updatedAt: string;
}

export interface SegmentPreview {
  total: number;
  withEmail: number;
  withPhone: number; // SMS-reachable
  verified: number;
  booked: number;
  sample: SegmentContact[];
}

export interface SegmentContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  score: number;
  funnelSlug: string;
  source: string | null;
  booked: boolean;
  createdAt: string;
}

function rowToSegment(r: Record<string, unknown>): Segment {
  return {
    id: r.id as string, name: r.name as string, description: (r.description as string) ?? null,
    rules: r.rules as Group,
    createdAt: new Date(r.created_at as string).toISOString(),
    updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

/** Build the FROM/WHERE that every evaluation shares, with params seeded by
 *  wsId. Excludes soft-deleted leads (see leads.deleted_at) so an erased
 *  contact can never be counted into a segment or reached by a broadcast. */
function scope(workspaceId: string, rules: Group): { where: string; params: unknown[] } {
  const params: unknown[] = [workspaceId];
  const compiled = compileSegment(rules, 2);
  params.push(...compiled.params);
  return { where: `l.workspace_id = $1 AND l.deleted_at IS NULL AND (${compiled.sql})`, params };
}

/** Count matches + channel reachability + a small sample, for the live builder. */
export async function previewSegment(workspaceId: string, rules: Group, sampleSize = 25): Promise<SegmentPreview> {
  validateSegmentRules(rules);
  const { where, params } = scope(workspaceId, rules);
  const agg = await pgPool().query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE l.email IS NOT NULL AND l.email <> '')::int AS with_email,
            COUNT(*) FILTER (WHERE l.phone IS NOT NULL AND l.phone <> '')::int AS with_phone,
            COUNT(*) FILTER (WHERE l.verified)::int AS verified,
            COUNT(*) FILTER (WHERE ${BOOKED_SQL})::int AS booked
     FROM leads l WHERE ${where}`,
    params,
  );
  const sample = await listContacts(workspaceId, rules, sampleSize, 0);
  const a = agg.rows[0] ?? {};
  return {
    total: Number(a.total) || 0, withEmail: Number(a.with_email) || 0, withPhone: Number(a.with_phone) || 0,
    verified: Number(a.verified) || 0, booked: Number(a.booked) || 0, sample,
  };
}

/** The matching contacts — newest first — for export / a workflow list. */
export async function listContacts(workspaceId: string, rules: Group, limit = 500, offset = 0): Promise<SegmentContact[]> {
  const { where, params } = scope(workspaceId, rules);
  const r = await pgPool().query(
    `SELECT l.id, l.name, l.email, l.phone, l.status, l.score, l.funnel_slug,
            l.attribution->>'utmSource' AS source, l.created_at,
            ${BOOKED_SQL} AS booked
     FROM leads l WHERE ${where}
     ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, Math.min(5000, Math.max(1, limit)), Math.max(0, offset)],
  );
  return r.rows.map((row) => ({
    id: row.id as string, name: (row.name as string) ?? null, email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null, status: row.status as string, score: Number(row.score) || 0,
    funnelSlug: row.funnel_slug as string, source: (row.source as string) ?? null, booked: !!row.booked,
    createdAt: new Date(row.created_at as string).toISOString(),
  }));
}

export async function listSegments(workspaceId: string): Promise<Segment[]> {
  const r = await pgPool().query(
    "SELECT id, name, description, rules, created_at, updated_at FROM segments WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC",
    [workspaceId],
  );
  return r.rows.map(rowToSegment);
}

export async function getSegment(workspaceId: string, id: string): Promise<Segment | null> {
  const r = await pgPool().query("SELECT id, name, description, rules, created_at, updated_at FROM segments WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL", [id, workspaceId]);
  return r.rows[0] ? rowToSegment(r.rows[0]) : null;
}

export async function createSegment(workspaceId: string, input: { name: string; description?: string; rules: Group }): Promise<Segment> {
  const name = (input.name || "").trim();
  if (!name) throw new Error("a segment name is required");
  validateSegmentRules(input.rules);
  const id = randomUUID();
  const r = await pgPool().query(
    `INSERT INTO segments (id, workspace_id, name, description, rules) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, name, description, rules, created_at, updated_at`,
    [id, workspaceId, name.slice(0, 120), (input.description ?? "").slice(0, 400) || null, JSON.stringify(input.rules)],
  );
  return rowToSegment(r.rows[0]);
}

export async function updateSegment(workspaceId: string, id: string, input: { name?: string; description?: string; rules?: Group }): Promise<Segment | null> {
  if (input.rules) validateSegmentRules(input.rules);
  const existing = await getSegment(workspaceId, id);
  if (!existing) return null;
  const name = input.name !== undefined ? (input.name || "").trim() : existing.name;
  if (!name) throw new Error("a segment name is required");
  const r = await pgPool().query(
    `UPDATE segments SET name = $3, description = $4, rules = $5, updated_at = now()
     WHERE id = $1 AND workspace_id = $2
     RETURNING id, name, description, rules, created_at, updated_at`,
    [id, workspaceId, name.slice(0, 120),
      (input.description !== undefined ? input.description : existing.description ?? "").slice(0, 400) || null,
      JSON.stringify(input.rules ?? existing.rules)],
  );
  return r.rows[0] ? rowToSegment(r.rows[0]) : null;
}

/** Soft-delete: move the segment to the 30-day bin (see lib/soft-delete). */
export async function deleteSegment(workspaceId: string, id: string): Promise<boolean> {
  return softDeleteRow("segments", workspaceId, id);
}
