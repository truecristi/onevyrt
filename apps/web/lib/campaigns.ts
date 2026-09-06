/**
 * Campaign Studio — campaigns store. One row per campaign (see
 * migrations/1786630700000_campaigns.js); the ordered flow of steps lives in a
 * jsonb column. Every function is workspace-scoped so a workspace can only ever
 * read or mutate its own campaigns. Templates (lib/templates.ts) seed a
 * campaign's flow at creation time but are not persisted separately.
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "./db";
import { type Channel, findTemplate } from "./templates";
import { softDeleteRow } from "./soft-delete";

export type CampaignStatus = "draft" | "scheduled" | "active" | "paused" | "done";
export const STATUSES: CampaignStatus[] = ["draft", "scheduled", "active", "paused", "done"];
export function isStatus(v: unknown): v is CampaignStatus { return typeof v === "string" && (STATUSES as string[]).includes(v); }

export interface FlowStep {
  id: string;
  channel: Channel;
  kind: string;
  title: string;
  content: string;
  day: number;
}

export interface Campaign {
  id: string;
  workspaceId: string;
  name: string;
  objective: string;
  status: CampaignStatus;
  channel: string;
  budget: string;
  startsAt: string;
  endsAt: string;
  templateId: string;
  flow: FlowStep[];
  createdAt: string;
  updatedAt: string;
}

const MAX_FLOW = 60_000; // guard the jsonb column

interface Row {
  id: string; workspace_id: string; name: string; objective: string; status: string;
  channel: string; budget: string; starts_at: string; ends_at: string; template_id: string;
  flow: FlowStep[]; created_at: Date; updated_at: Date;
}
function toCampaign(r: Row): Campaign {
  return {
    id: r.id, workspaceId: r.workspace_id, name: r.name, objective: r.objective,
    status: isStatus(r.status) ? r.status : "draft",
    channel: r.channel, budget: r.budget, startsAt: r.starts_at, endsAt: r.ends_at,
    templateId: r.template_id, flow: Array.isArray(r.flow) ? r.flow : [],
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}
const COLS = "id, workspace_id, name, objective, status, channel, budget, starts_at, ends_at, template_id, flow, created_at, updated_at";

export async function listCampaigns(workspaceId: string): Promise<Campaign[]> {
  const res = await pgPool().query<Row>(
    `SELECT ${COLS} FROM campaigns WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC`,
    [workspaceId],
  );
  return res.rows.map(toCampaign);
}

export async function getCampaign(workspaceId: string, id: string): Promise<Campaign | null> {
  const res = await pgPool().query<Row>(
    `SELECT ${COLS} FROM campaigns WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL`,
    [workspaceId, id],
  );
  return res.rows[0] ? toCampaign(res.rows[0]) : null;
}

export interface CreateCampaignInput {
  name: string;
  objective?: string;
  channel?: string;
  templateId?: string;
}

/** Creates a campaign. When templateId matches a built-in template, its steps
 *  seed the flow (each step gets a fresh id); objective/channel default from the
 *  template unless the caller overrode them. */
export async function createCampaign(workspaceId: string, input: CreateCampaignInput): Promise<Campaign> {
  const tpl = input.templateId ? findTemplate(input.templateId) : undefined;
  const flow: FlowStep[] = tpl
    ? tpl.steps.map((s) => ({ id: randomUUID(), channel: s.channel, kind: s.kind, title: s.title, content: s.content, day: s.day }))
    : [];
  const name = (input.name || tpl?.name || "Untitled campaign").trim().slice(0, 200);
  const objective = (input.objective ?? tpl?.objective ?? "").slice(0, 4000);
  const channel = (input.channel ?? tpl?.channel ?? "").slice(0, 200);
  const now = new Date().toISOString();
  const id = randomUUID();
  const res = await pgPool().query<Row>(
    `INSERT INTO campaigns (id, workspace_id, name, objective, status, channel, budget, starts_at, ends_at, template_id, flow, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'draft', $5, '', '', '', $6, $7, $8, $8)
     RETURNING ${COLS}`,
    [id, workspaceId, name, objective, channel, tpl?.id ?? "", JSON.stringify(flow), now],
  );
  return toCampaign(res.rows[0]!);
}

export interface CampaignPatch {
  name?: string;
  objective?: string;
  status?: CampaignStatus;
  channel?: string;
  budget?: string;
  startsAt?: string;
  endsAt?: string;
  flow?: FlowStep[];
}

/** Partial update, workspace-scoped. Only provided fields change; returns null
 *  if the campaign doesn't belong to this workspace. */
export async function updateCampaign(workspaceId: string, id: string, patch: CampaignPatch): Promise<Campaign | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const put = (col: string, val: unknown) => { sets.push(`${col} = $${i++}`); vals.push(val); };
  if (patch.name !== undefined) put("name", patch.name.trim().slice(0, 200) || "Untitled campaign");
  if (patch.objective !== undefined) put("objective", patch.objective.slice(0, 4000));
  if (patch.status !== undefined) put("status", patch.status);
  if (patch.channel !== undefined) put("channel", patch.channel.slice(0, 200));
  if (patch.budget !== undefined) put("budget", patch.budget.slice(0, 100));
  if (patch.startsAt !== undefined) put("starts_at", patch.startsAt.slice(0, 40));
  if (patch.endsAt !== undefined) put("ends_at", patch.endsAt.slice(0, 40));
  if (patch.flow !== undefined) {
    const blob = JSON.stringify(patch.flow);
    if (blob.length > MAX_FLOW) throw new Error("This campaign flow is too large to save.");
    put("flow", blob);
  }
  if (sets.length === 0) return getCampaign(workspaceId, id);
  put("updated_at", new Date().toISOString());
  vals.push(workspaceId, id);
  // `deleted_at IS NULL` matches the SELECTs (listCampaigns/getCampaign): a
  // soft-deleted campaign must not be editable. Without it the UPDATE "succeeds"
  // on a row that's already in the 30-day bin, so the edit silently vanishes.
  const res = await pgPool().query<Row>(
    `UPDATE campaigns SET ${sets.join(", ")} WHERE workspace_id = $${i++} AND id = $${i} AND deleted_at IS NULL RETURNING ${COLS}`,
    vals,
  );
  return res.rows[0] ? toCampaign(res.rows[0]) : null;
}

/** Soft-delete: move the campaign to the 30-day bin (see lib/soft-delete). */
export async function deleteCampaign(workspaceId: string, id: string): Promise<boolean> {
  return softDeleteRow("campaigns", workspaceId, id);
}

/** Normalises an untrusted flow array from a request body into FlowStep[]. */
export function sanitizeFlow(v: unknown): FlowStep[] {
  if (!Array.isArray(v)) return [];
  const out: FlowStep[] = [];
  for (const raw of v.slice(0, 200)) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    out.push({
      id: typeof s.id === "string" && s.id ? s.id.slice(0, 64) : randomUUID(),
      channel: (typeof s.channel === "string" ? s.channel : "other") as Channel,
      kind: (typeof s.kind === "string" ? s.kind : "other").slice(0, 40),
      title: (typeof s.title === "string" ? s.title : "").slice(0, 200),
      content: (typeof s.content === "string" ? s.content : "").slice(0, 8000),
      day: Number.isFinite(Number(s.day)) ? Math.max(-90, Math.min(365, Math.trunc(Number(s.day)))) : 0,
    });
  }
  return out;
}
