import { currentUser } from "../../../../lib/auth";
import { sendMail } from "../../../../lib/mailer";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

const MAX_TEXT_LENGTH = 20_000;
// This only ever sends to the caller's own account email — never a
// client-supplied recipient — so the rate limit exists purely to stop one
// account from hammering the mail provider, not to prevent abuse against
// someone else's inbox.
const EMAIL_LIMIT = { windowMs: 60 * 60 * 1000, max: 20 };

export const POST = withRouteLogging("api/reports/email:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const limit = await checkRateLimit(`report-email:user:${user.id}`, EMAIL_LIMIT);
  if (!limit.allowed) return json({ error: "Too many report emails requested. Try again later." }, 429, retryAfterHeader(limit.retryAfterMs!));

  let body: { subject?: unknown; text?: unknown };
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }
  if (typeof body.subject !== "string" || !body.subject.trim()) return json({ error: "subject is required" }, 400);
  if (typeof body.text !== "string" || !body.text.trim()) return json({ error: "text is required" }, 400);
  if (body.text.length > MAX_TEXT_LENGTH) return json({ error: "Report is too long to email — export it as a PDF instead." }, 400);

  const result = await sendMail({ to: user.email, subject: body.subject.slice(0, 200), text: body.text });
  if (!result.sent) return json({ error: result.reason ?? "Could not send the email." }, 502);
  return json({ ok: true });
});
