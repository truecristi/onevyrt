import { requireAdmin } from "../../../../lib/admin";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";
import { webhookQueueCounts, webhookQueueOverview, retryDeadLetteredWebhook } from "../../../../lib/webhooks/retry-queue";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

// Admin dashboard for the webhook retry queue (lib/webhooks/retry-queue.ts):
// counts plus the pending / failed / dead-letter lists an operator needs to
// answer "is delivery healthy?" and "what's stuck?" — this table has no other
// UI, so this route is the only window into it.
export const GET = withRouteLogging("api/admin/webhook-status:GET", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  const [counts, overview] = await Promise.all([webhookQueueCounts(), webhookQueueOverview()]);
  return json({ counts, ...overview });
});

// The manual-retry button for one dead-lettered delivery — the operator's
// override once a destination is known-fixed. Resets the row to a clean
// 'pending' state with a full attempt budget (see retryDeadLetteredWebhook);
// the next processRetryQueue tick picks it up like any other due delivery.
export const POST = withRouteLogging("api/admin/webhook-status:POST", async (req: Request): Promise<Response> => {
  const admin = await requireAdmin(req.headers.get("cookie"));
  if (!admin) return json({ error: "not authorized" }, 403);
  let body: { id?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.id !== "string" || !body.id.trim()) return json({ error: "id is required" }, 400);
  const id = body.id.trim();

  const retried = await retryDeadLetteredWebhook(id);
  if (!retried) return json({ error: "no dead-lettered delivery with that id" }, 404);
  await recordAudit({ actorEmail: admin.email, action: "webhook_queue.retry", targetType: "webhook_delivery_queue", targetLabel: id });

  const [counts, overview] = await Promise.all([webhookQueueCounts(), webhookQueueOverview()]);
  return json({ ok: true, counts, ...overview });
});
