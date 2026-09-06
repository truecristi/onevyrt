import { requireAdmin } from "../../../../../lib/admin";
import { bulkExportData } from "../../../../../lib/admin-bulk-ops";
import { withRouteLogging } from "../../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const POST = withRouteLogging(
  "api/admin/bulk/export:POST",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      const body = await req.json() as {
        workspaceId?: string;
        dataTypes: ("users" | "workspaces" | "projects" | "enrollments" | "audit")[];
      };

      if (!Array.isArray(body.dataTypes) || body.dataTypes.length === 0) {
        return json({ error: "dataTypes array required" }, 400);
      }

      const result = await bulkExportData({
        workspaceId: body.workspaceId,
        dataTypes: body.dataTypes,
        actorEmail: admin.email,
      });

      return json({ ok: true, ...result });
    } catch (e) {
      return json(
        { error: e instanceof Error ? e.message : "Failed to create export" },
        400,
      );
    }
  },
);
