import { requireAdmin } from "../../../../../lib/admin";
import { bulkResetProgress } from "../../../../../lib/admin-bulk-ops";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging(
  "api/admin/bulk/reset-progress:POST",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      const body = await req.json() as {
        workspaceId: string;
        userIds?: string[];
        resetChapters?: boolean;
        resetLessons?: boolean;
      };

      if (!body.workspaceId) {
        return json({ error: "workspaceId required" }, 400);
      }

      const result = await bulkResetProgress({
        workspaceId: body.workspaceId,
        userIds: body.userIds,
        resetChapters: body.resetChapters ?? true,
        resetLessons: body.resetLessons ?? true,
        actorEmail: admin.email,
      });

      return json({ ok: true, ...result });
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Failed to reset progress" },
        400,
      );
    }
  },
);
