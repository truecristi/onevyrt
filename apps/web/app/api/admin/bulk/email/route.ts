import { requireAdmin } from "../../../../../lib/admin";
import { bulkSendEmail } from "../../../../../lib/admin-bulk-ops";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging(
  "api/admin/bulk/email:POST",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      const body = await req.json() as {
        workspaceId?: string;
        recipientEmails: string[];
        subject: string;
        body: string;
      };

      if (!Array.isArray(body.recipientEmails) || body.recipientEmails.length === 0) {
        return json({ error: "recipientEmails array required" }, 400);
      }

      if (!body.subject || !body.body) {
        return json({ error: "subject and body required" }, 400);
      }

      const result = await bulkSendEmail({
        workspaceId: body.workspaceId,
        recipientEmails: body.recipientEmails,
        subject: body.subject,
        body: body.body,
        actorEmail: admin.email,
      });

      return json({ ok: true, ...result });
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Failed to send emails" },
        400,
      );
    }
  },
);
