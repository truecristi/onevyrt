/**
 * Store for saved ad creatives + their real performance. Saving a creative
 * pins its creative_id (unique per workspace); performance is a join of that id
 * against the creative_id every lead/booking recorded in its attribution — so
 * the AI's predicted score sits next to what the creative actually produced.
 */
import { randomUUID } from "node:crypto";
import { pgPool } from "../db";
import { detectCreativeWinner, type WinnerVerdict } from "./winner";

export interface SavedCreative {
  id: string;
  funnelSlug: string;
  creativeId: string;
  angle: string | null;
  headline: string;
  primaryText: string | null;
  cta: string | null;
  score: number;
  createdAt: string;
}

export interface CreativePerformance extends SavedCreative {
  spend: number;
  leads: number;
  qualified: number;
  booked: number;
  /** qualified ÷ leads, 0..1 */
  qualifyRate: number;
  /** spend ÷ qualified (0 when no spend or no qualified) */
  costPerQualified: number;
  /** spend ÷ booked */
  costPerBooking: number;
}

export interface AnglePerformance {
  angle: string;
  creatives: number;
  spend: number;
  leads: number;
  qualified: number;
  booked: number;
  /** qualified ÷ leads, 0..1 */
  qualifyRate: number;
  /** spend ÷ qualified across the angle's creatives */
  costPerQualified: number;
}

export interface CreativeInput {
  funnelSlug: string;
  creativeId: string;
  angle?: string;
  headline: string;
  primaryText?: string;
  cta?: string;
  score?: number;
}

function rowToSaved(r: Record<string, unknown>): SavedCreative {
  return {
    id: r.id as string, funnelSlug: r.funnel_slug as string, creativeId: r.creative_id as string,
    angle: (r.angle as string) ?? null, headline: r.headline as string,
    primaryText: (r.primary_text as string) ?? null, cta: (r.cta as string) ?? null,
    score: Number(r.score) || 0, createdAt: new Date(r.created_at as string).toISOString(),
  };
}

/** Save a creative to track. Ensures its creative_id is unique in the workspace
 *  (appending -2, -3 … on collision) so the attribution join stays unambiguous;
 *  returns the saved record with the id the caller should use in the link. */
export async function saveCreative(workspaceId: string, input: CreativeInput): Promise<SavedCreative> {
  const headline = (input.headline || "").trim();
  if (!headline) throw new Error("a headline is required");
  const base = (input.creativeId || "creative").trim();
  let creativeId = base;
  for (let n = 2; n < 1000; n++) {
    const clash = await pgPool().query("SELECT 1 FROM creatives WHERE workspace_id = $1 AND creative_id = $2", [workspaceId, creativeId]);
    if (clash.rowCount === 0) break;
    creativeId = `${base}-${n}`;
  }
  const id = randomUUID();
  const r = await pgPool().query(
    `INSERT INTO creatives (id, workspace_id, funnel_slug, creative_id, angle, headline, primary_text, cta, score)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, funnel_slug, creative_id, angle, headline, primary_text, cta, score, created_at`,
    [id, workspaceId, input.funnelSlug, creativeId, input.angle ?? null, headline, input.primaryText ?? null, input.cta ?? null, Math.max(0, Math.min(100, Math.round(input.score ?? 0)))],
  );
  return rowToSaved(r.rows[0]);
}

/** Saved creatives for a workspace with their real leads / qualified / booked,
 *  best performers first (then by predicted score). */
export async function listCreativePerformance(workspaceId: string): Promise<CreativePerformance[]> {
  const r = await pgPool().query(
    `SELECT c.id, c.funnel_slug, c.creative_id, c.angle, c.headline, c.primary_text, c.cta, c.score, c.created_at, c.spend,
            COALESCE(l.leads, 0) AS leads, COALESCE(l.qualified, 0) AS qualified, COALESCE(bk.booked, 0) AS booked
     FROM creatives c
     LEFT JOIN (
       SELECT attribution->>'creativeId' AS cid, COUNT(*)::int AS leads,
              COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified
       FROM leads WHERE workspace_id = $1 AND deleted_at IS NULL AND attribution->>'creativeId' IS NOT NULL GROUP BY 1
     ) l ON l.cid = c.creative_id
     LEFT JOIN (
       SELECT attribution->>'creativeId' AS cid, COUNT(*)::int AS booked
       FROM bookings WHERE workspace_id = $1 AND deleted_at IS NULL AND attribution->>'creativeId' IS NOT NULL GROUP BY 1
     ) bk ON bk.cid = c.creative_id
     WHERE c.workspace_id = $1
     ORDER BY qualified DESC, leads DESC, c.score DESC, c.created_at DESC`,
    [workspaceId],
  );
  return r.rows.map((row) => {
    const saved = rowToSaved(row);
    const leads = Number(row.leads) || 0, qualified = Number(row.qualified) || 0, booked = Number(row.booked) || 0;
    const spend = Number(row.spend) || 0;
    return {
      ...saved, spend, leads, qualified, booked,
      qualifyRate: leads > 0 ? qualified / leads : 0,
      costPerQualified: qualified > 0 ? spend / qualified : 0,
      costPerBooking: booked > 0 ? spend / booked : 0,
    };
  });
}

/** Set a creative's ad spend (owner-entered), for cost-per-qualified. */
export async function setCreativeSpend(workspaceId: string, id: string, spend: number): Promise<boolean> {
  const r = await pgPool().query("UPDATE creatives SET spend = $1 WHERE id = $2 AND workspace_id = $3", [Math.max(0, spend), id, workspaceId]);
  return (r.rowCount ?? 0) > 0;
}

/** Roll the per-creative performance up by angle — which *angles* actually
 *  convert for this business, across every creative and funnel. Winners first
 *  (by qualified, then qualify rate, then leads). This is the "learn" step: the
 *  top angles seed the next round of generation. */
export async function anglePerformance(workspaceId: string): Promise<AnglePerformance[]> {
  const perf = await listCreativePerformance(workspaceId);
  const byAngle = new Map<string, AnglePerformance>();
  for (const c of perf) {
    const angle = (c.angle || "Unlabelled").trim() || "Unlabelled";
    const a = byAngle.get(angle) ?? { angle, creatives: 0, spend: 0, leads: 0, qualified: 0, booked: 0, qualifyRate: 0, costPerQualified: 0 };
    a.creatives += 1; a.spend += c.spend; a.leads += c.leads; a.qualified += c.qualified; a.booked += c.booked;
    byAngle.set(angle, a);
  }
  const out = [...byAngle.values()].map((a) => ({
    ...a,
    qualifyRate: a.leads > 0 ? a.qualified / a.leads : 0,
    costPerQualified: a.qualified > 0 ? a.spend / a.qualified : 0,
  }));
  return out.sort((x, y) => y.qualified - x.qualified || y.qualifyRate - x.qualifyRate || y.leads - x.leads);
}

/** The angle names that have actually produced qualified leads, best first —
 *  the winners to seed generation with. Empty until there's signal. */
export async function topAngles(workspaceId: string, limit = 4): Promise<string[]> {
  const angles = await anglePerformance(workspaceId);
  return angles.filter((a) => a.qualified > 0).slice(0, limit).map((a) => a.angle);
}

/** Is one of this workspace's creatives a clear enough winner to scale? Reads
 *  the live per-creative performance and runs the (pure, tested) winner
 *  detection over it — the Grow-step "publish a winner" nudge calls this. */
export async function creativeWinner(workspaceId: string): Promise<WinnerVerdict> {
  const perf = await listCreativePerformance(workspaceId);
  return detectCreativeWinner(perf.map((p) => ({
    creativeId: p.creativeId, headline: p.headline, angle: p.angle, leads: p.leads, qualified: p.qualified,
  })));
}

/** Remove a saved creative the workspace owns. Returns true if one was removed. */
export async function deleteCreative(workspaceId: string, id: string): Promise<boolean> {
  const r = await pgPool().query("DELETE FROM creatives WHERE id = $1 AND workspace_id = $2", [id, workspaceId]);
  return (r.rowCount ?? 0) > 0;
}
