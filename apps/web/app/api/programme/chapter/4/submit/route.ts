import { currentUser } from "../../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../../lib/workspaces";
import { saveChapter4Plan, isChapter4Subchapter, type GrowthPlanMetrics, type GrowthPlanBottleneck, type GrowthPlanAction, type GrowthPlanImpactInput } from "../../../../../../lib/chapter4-submissions";
import { validatePlanMetrics, isValidRate, isValidVolume } from "../../../../../../lib/growth-plan-utils";
import { recordActivity } from "../../../../../../lib/activity";
import { notifyCoachOfChapter4Submission } from "../../../../../../lib/programme-notifications";
import { checkRateLimit, retryAfterHeader } from "../../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Authenticated + workspace-membership-gated (same reasoning as
// community/comments's POST_LIMIT): the workspace id is the meaningful actor
// identity here, not IP. Generous enough for a learner saving progress across
// several subchapter forms in one sitting, bounded enough that a buggy
// autosave loop or a scripted flood can't hammer the DB or spam a coach with
// submission emails.
const SUBMIT_LIMIT = { windowMs: 60_000, max: 20 };

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Validates + narrows the optional `currentPosition` block. Returns
 *  undefined when absent, the typed object when valid, or an error string. */
function parseCurrentPosition(v: unknown): GrowthPlanMetrics | undefined | string {
  if (v === undefined) return undefined;
  const obj = asRecord(v);
  if (!obj) return "currentPosition must be an object";
  const metrics: GrowthPlanMetrics = {};
  for (const key of ["monthlyRevenue", "grossMarginPct", "conversionRatePct", "avgCustomerValue"] as const) {
    const raw = obj[key];
    if (raw === undefined) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw)) return `currentPosition.${key} must be a number`;
    metrics[key] = raw;
  }
  if (!validatePlanMetrics(metrics)) return "currentPosition has a metric outside a plausible range";
  return metrics;
}

function parseBottleneck(v: unknown): GrowthPlanBottleneck | undefined | string {
  if (v === undefined) return undefined;
  const obj = asRecord(v);
  if (!obj) return "bottleneck must be an object";
  const b: GrowthPlanBottleneck = {};
  if (obj.area !== undefined) {
    if (typeof obj.area !== "string") return "bottleneck.area must be a string";
    b.area = obj.area;
  }
  if (obj.why !== undefined) {
    if (typeof obj.why !== "string") return "bottleneck.why must be a string";
    b.why = obj.why;
  }
  if (obj.currentValue !== undefined) {
    if (!isValidRate(obj.currentValue)) return "bottleneck.currentValue must be a percentage between 0 and 100";
    b.currentValue = obj.currentValue;
  }
  if (obj.targetValue !== undefined) {
    if (!isValidRate(obj.targetValue)) return "bottleneck.targetValue must be a percentage between 0 and 100";
    b.targetValue = obj.targetValue;
  }
  return b;
}

function parseActions(v: unknown): GrowthPlanAction[] | undefined | string {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return "actions must be an array";
  const actions: GrowthPlanAction[] = [];
  for (const entry of v) {
    const obj = asRecord(entry);
    if (!obj || typeof obj.title !== "string" || !obj.title.trim()) return "each action needs a title";
    if (obj.expectedImpact !== undefined && typeof obj.expectedImpact !== "string") return "action.expectedImpact must be a string";
    actions.push({ title: obj.title, ...(obj.expectedImpact ? { expectedImpact: obj.expectedImpact as string } : {}) });
  }
  return actions;
}

function parseImpact(v: unknown): GrowthPlanImpactInput | undefined | string {
  if (v === undefined) return undefined;
  const obj = asRecord(v);
  if (!obj) return "impact must be an object";
  if (obj.leadVolume === undefined) return {};
  if (!isValidVolume(obj.leadVolume)) return "impact.leadVolume must be a non-negative number";
  return { leadVolume: obj.leadVolume };
}

/** A learner (or a coach editing an approved plan — see
 *  docs/IMPLEMENTATION_ROADMAP.md's "Growth & Improvement Plan is mutable"
 *  decision) saves one Chapter 4 subchapter's fields. Any workspace member
 *  except a viewer, same bar as the lesson/chapter-1-3 submit routes.
 *  Deliberately NOT gated on engine chapter-gate reachability — Chapter 4
 *  doesn't exist as an engine stage yet (see lib/chapter4-submissions.ts's
 *  header) — so this only checks workspace membership. `submitForReview:
 *  true` is what actually moves the plan to "submitted" and emails the
 *  workspace's coach(es); a plain save just persists progress. */
export const POST = withRouteLogging("api/programme/chapter/4/submit:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);
  const wsParam = new URL(req.url).searchParams.get("ws");
  const wsId = wsParam ?? (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role || role === "viewer") return json({ error: "viewers cannot submit the Growth & Improvement Plan" }, 403);

  const rl = await checkRateLimit(`chapter4:submit:${wsId}`, SUBMIT_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  let body: { subchapter?: unknown; currentPosition?: unknown; bottleneck?: unknown; actions?: unknown; impact?: unknown; submitForReview?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  if (!isChapter4Subchapter(body.subchapter)) return json({ error: "subchapter must be one of 4.1–4.6" }, 400);

  const currentPosition = parseCurrentPosition(body.currentPosition);
  if (typeof currentPosition === "string") return json({ error: currentPosition }, 400);
  const bottleneck = parseBottleneck(body.bottleneck);
  if (typeof bottleneck === "string") return json({ error: bottleneck }, 400);
  const actions = parseActions(body.actions);
  if (typeof actions === "string") return json({ error: actions }, 400);
  const impact = parseImpact(body.impact);
  if (typeof impact === "string") return json({ error: impact }, 400);
  const submitForReview = body.submitForReview === true;

  const result = await saveChapter4Plan(wsId, { subchapter: body.subchapter, currentPosition, bottleneck, actions, impact, submitForReview, actorEmail: user.email });
  if ("error" in result) return json({ error: result.error }, 400);

  await recordActivity(wsId, { actorEmail: user.email, action: "programme.chapter4_submit", detail: body.subchapter });
  if (submitForReview) {
    // Fire-and-forget, same contract as notifyCoachOfSubmission: never let a
    // mail hiccup fail or delay a submission that's already committed.
    void notifyCoachOfChapter4Submission({ workspaceId: wsId, learnerEmail: user.email }).catch(() => { /* best-effort */ });
  }
  return json({ submission: { id: result.id, status: result.status } });
});
