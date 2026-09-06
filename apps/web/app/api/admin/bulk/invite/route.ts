import { requireAdmin } from "../../../../../lib/admin";
import { bulkInviteUsers } from "../../../../../lib/admin-bulk-ops";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging(
  "api/admin/bulk/invite:POST",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      const body = await req.json() as {
        workspaceId: string;
        emails: string[];
        role?: "editor" | "viewer" | "manager";
      };

      if (!body.workspaceId || !Array.isArray(body.emails) || body.emails.length === 0) {
        return json({ error: "workspaceId and emails array required" }, 400);
      }

      const result = await bulkInviteUsers({
        workspaceId: body.workspaceId,
        emails: body.emails,
        role: body.role ?? "viewer",
        actorEmail: admin.email,
      });

      return json({ ok: true, ...result });
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Failed to send invitations" },
        400,
      );
    }
  },
);
