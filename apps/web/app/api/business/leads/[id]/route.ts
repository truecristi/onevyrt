/**
 * Lead detail — the inbox drill-down. Returns one lead (scoped to the viewer's
 * workspace) with its full answers mapped to the funnel's question prompts and
 * option labels, so the owner sees "What's your budget? → $5k–$15k" instead of
 * raw ids. Falls back to the raw value when a question/option can't be resolved
 * (e.g. the funnel changed since the lead came in).
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf, listWorkspaceMemberSummaries } from "../../../../../lib/workspaces";
import { getWorkspaceLead, updateLead, recordLeadEvent, listLeadEvents, isLeadLifecycle, type LeadUpdate } from "../../../../../lib/acquisition/leads";
import { resolveFunnelConfig } from "../../../../../lib/studio/funnel-store";
import { scoreLead, type QualAnswers } from "@onevyrt/engine";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging("api/business/leads/[id]:GET", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const { id } = await ctx.params;
  const lead = await getWorkspaceLead(wsId, id);
  if (!lead) return json({ error: "lead not found" }, 404);

  // Map the raw answers to readable "prompt → answer label(s)" pairs.
  const config = await resolveFunnelConfig(lead.funnelSlug);
  const answers: { prompt: string; value: string }[] = [];
  if (lead.answers && typeof lead.answers === "object") {
    const questions = config?.questions ?? [];
    const byId = new Map(questions.map((q) => [q.id, q]));
    // Keep the funnel's question order, then any leftover answer keys.
    const order = [...questions.map((q) => q.id), ...Object.keys(lead.answers).filter((k) => !byId.has(k))];
    for (const qid of order) {
      const raw = (lead.answers as Record<string, unknown>)[qid];
      if (raw == null || (Array.isArray(raw) && raw.length === 0) || raw === "") continue;
      const q = byId.get(qid);
      const labelOf = (v: unknown): string => q?.options?.find((o) => o.value === String(v))?.label ?? String(v);
      const value = Array.isArray(raw) ? raw.map(labelOf).join(", ") : labelOf(raw);
      answers.push({ prompt: q?.prompt ?? qid, value });
    }
  }

  // Score reason (§ leads): re-run the scorer to see which weighted rules fired
  // for this lead, so the drawer explains the score instead of just showing it.
  let scoreReason: { reasons: { label: string; points: number }[]; maxScore: number; percent: number } | null = null;
  if (config?.rules && lead.answers && typeof lead.answers === "object") {
    try {
      const res = scoreLead(lead.answers as QualAnswers, config.rules);
      const promptById = new Map((config.questions ?? []).map((q) => [q.id, q.prompt]));
      const matched = new Set(res.matchedRuleIds);
      const reasons = (config.rules.scored ?? [])
        .filter((r) => matched.has(r.id))
        .map((r) => ({ label: promptById.get(r.when.questionId) ?? r.when.questionId, points: r.points }))
        .sort((a, b) => b.points - a.points);
      scoreReason = { reasons, maxScore: res.maxScore, percent: res.percent };
    } catch { /* scoring is best-effort; the number alone still shows */ }
  }

  const events = await listLeadEvents(wsId, id);
  return json({ lead: { ...lead, answers: undefined }, answers, funnelTitle: config?.title ?? lead.funnelSlug, events, scoreReason });
});

/** Update a lead's follow-up state — lifecycle stage, assignee, next action,
 *  due date (§322). Any EDITING member can work the inbox, but read-only
 *  viewers can't: this is a write, and every other write route blocks viewers,
 *  so this one must too. Every field is optional; only the ones present are
 *  changed, and null clears a nullable field (unassign / drop action / drop due).*/
export const PATCH = withRouteLogging("api/business/leads/[id]:PATCH", async (req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);
  if (role === "viewer") return json({ error: "viewers have read-only access and can't edit leads" }, 403);

  let body: { lifecycle?: unknown; assigneeId?: unknown; nextAction?: unknown; dueAt?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const patch: LeadUpdate = {};
  if ("lifecycle" in body) {
    if (!isLeadLifecycle(body.lifecycle)) return json({ error: "unknown lifecycle stage" }, 400);
    patch.lifecycle = body.lifecycle;
  }
  if ("assigneeId" in body) {
    if (body.assigneeId === null) patch.assigneeId = null;
    else if (typeof body.assigneeId === "string") {
      // Only an actual member of this workspace can own a lead.
      const members = await listWorkspaceMemberSummaries(wsId);
      if (!members.some((m) => m.userId === body.assigneeId)) return json({ error: "assignee is not a member of this workspace" }, 400);
      patch.assigneeId = body.assigneeId;
    } else return json({ error: "assigneeId must be a member id or null" }, 400);
  }
  if ("nextAction" in body) {
    if (body.nextAction === null) patch.nextAction = null;
    else if (typeof body.nextAction === "string") { const t = body.nextAction.trim().slice(0, 300); patch.nextAction = t || null; }
    else return json({ error: "nextAction must be a string or null" }, 400);
  }
  if ("dueAt" in body) {
    if (body.dueAt === null) patch.dueAt = null;
    else if (typeof body.dueAt === "string") {
      const d = new Date(body.dueAt);
      if (Number.isNaN(d.getTime())) return json({ error: "dueAt is not a valid date" }, 400);
      patch.dueAt = d.toISOString();
    } else return json({ error: "dueAt must be an ISO date or null" }, 400);
  }
  if (Object.keys(patch).length === 0) return json({ error: "nothing to update" }, 400);

  const { id } = await ctx.params;
  const ok = await updateLead(wsId, id, patch);
  if (!ok) return json({ error: "lead not found" }, 404);

  // Record the change on the lead's activity timeline (best-effort).
  if (patch.lifecycle !== undefined) void recordLeadEvent(wsId, id, "stage", { to: patch.lifecycle }, user.email);
  if (patch.assigneeId !== undefined) {
    const members = await listWorkspaceMemberSummaries(wsId);
    const to = patch.assigneeId ? (members.find((m) => m.userId === patch.assigneeId)?.email ?? null) : null;
    void recordLeadEvent(wsId, id, "assignee", { to }, user.email);
  }
  if (patch.nextAction !== undefined) void recordLeadEvent(wsId, id, "next_action", { to: patch.nextAction }, user.email);
  if (patch.dueAt !== undefined) void recordLeadEvent(wsId, id, "due", { to: patch.dueAt }, user.email);

  return json({ ok: true, patch });
});
