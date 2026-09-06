/**
 * POST /api/coach/reach-out — the engagement console's "Reach out" action.
 * Sends a coach/mentor (or platform-admin) message to a stalled learner two
 * ways: an email (reaches them off-platform, the whole point when they're not
 * logging in) AND an in-app message (what they see when they return).
 *
 * Deliberately does NOT record workspace activity: reaching out is the COACH's
 * action, not the learner's, and logging it would reset the learner's idle
 * timer and make someone you just chased look "active" — hiding exactly the
 * person you're trying to help.
 */
import { currentUser, getUserById } from "../../../../lib/auth";
import { roleOf, getWorkspace } from "../../../../lib/workspaces";
import { isAdminEmail } from "../../../../lib/admin";
import { sendMail } from "../../../../lib/mailer";
import { sendLearnerMessage } from "../../../../lib/coach/messages";
import { checkRateLimit, retryAfterHeader } from "../../../../lib/rate-limit";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200, h: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", ...h } });

// Coach reach-out messages (which trigger emails). Rate-limited to prevent
// email spam and unintended message floods.
const REACH_OUT_LIMIT = { windowMs: 60_000, max: 20 };

export const POST = withRouteLogging("api/coach/reach-out:POST", async (req: Request): Promise<Response> => {
  const user = await currentUser(req.headers.get("cookie"));
  if (!user) return json({ error: "not authenticated" }, 401);

  const rl = await checkRateLimit(`coach:reachout:${user.id}`, REACH_OUT_LIMIT);
  if (!rl.allowed) return json({ error: "rate limit exceeded — try again shortly" }, 429, retryAfterHeader(rl.retryAfterMs!));

  let body: { ws?: unknown; subject?: unknown; message?: unknown };
  try { body = await req.json(); } catch { body = {}; }
  const wsId = typeof body.ws === "string" ? body.ws : "";
  const subject = (typeof body.subject === "string" ? body.subject : "").trim().slice(0, 200);
  const message = (typeof body.message === "string" ? body.message : "").trim().slice(0, 4000);
  if (!wsId || !message) return json({ error: "A workspace and a message are required." }, 400);

  // Only someone who actually coaches this learner (owner or manager of their
  // workspace) or a platform admin may message them.
  const role = await roleOf(wsId, user.id);
  const allowed = role === "owner" || role === "manager" || isAdminEmail(user.email);
  if (!allowed) return json({ error: "You don't coach this learner." }, 403);

  const ws = await getWorkspace(wsId);
  if (!ws) return json({ error: "That workspace no longer exists." }, 404);
  const subj = subject || `A note about ${ws.name}`;

  // The in-app copy always lands (works even with no mail provider configured).
  await sendLearnerMessage(wsId, { fromEmail: user.email, subject: subj, body: message });

  // The email reaches a learner who isn't logging in — best-effort.
  const owner = await getUserById(ws.ownerId);
  let emailSent = false;
  if (owner?.email) {
    const res = await sendMail({ to: owner.email, subject: subj, text: message });
    emailSent = res.sent;
  }

  return json({ sent: { email: emailSent, inApp: true }, emailedTo: emailSent ? owner?.email ?? null : null });
});
