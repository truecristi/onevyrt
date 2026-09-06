/**
 * Emails the caller's own Transformation Report to their own account email —
 * never a client-supplied recipient, matching api/reports/email's existing
 * rule ("the rate limit exists purely to stop one account from hammering the
 * mail provider, not to prevent abuse against someone else's inbox"). The
 * report is recompiled server-side (never trusted from the client) and sent
 * as plain text — lib/mailer.ts's MailMessage has no `html` field, matching
 * every other transactional email this app sends.
 */
import { currentUser } from "../../../../../lib/auth";
import { ensurePersonalWorkspace, roleOf } from "../../../../../lib/workspaces";
import { getTransformationReport, transformationReportToText } from "../../../../../lib/reports/transformation-report";
import { sendMail } from "../../../../../lib/mailer";
import { checkRateLimit, rateLimitHeaders } from "../../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...headers } });

const EMAIL_LIMIT = { windowMs: 3_600_000, max: 5 };

export const POST = withRouteLogging("api/account/transformation-report/email:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const wsId = new URL(req.url).searchParams.get("ws") || (await ensurePersonalWorkspace(user.id)).id;
  const role = await roleOf(wsId, user.id);
  if (!role) return json({ error: "not a member of this workspace" }, 403);

  const rl = await checkRateLimit(`transformation-report-email:${user.id}`, EMAIL_LIMIT);
  if (!rl.allowed) return json({ error: "Too many report emails requested. Try again later." }, 429, rateLimitHeaders(rl));

  const report = await getTransformationReport(wsId, user.id);
  const text = transformationReportToText(report);
  const result = await sendMail({ to: user.email, subject: `Your ONEVYRT Transformation Report — ${report.account.workspaceName}`, text });
  if (!result.sent) return json({ error: result.reason ?? "Could not send the email." }, 502);
  return json({ ok: true });
});
