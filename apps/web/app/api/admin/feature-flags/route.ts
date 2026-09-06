import { requireAdmin } from "../../../../lib/admin";
import {
  getAllFeatureFlags,
  getWorkspaceFeatureFlags,
  setFeatureFlag,
  deleteFeatureFlag,
} from "../../../../lib/admin-feature-flags";
import { recordAudit } from "../../../../lib/audit-log";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

export const GET = withRouteLogging(
  "api/admin/feature-flags:GET",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      const url = new URL(req.url);
      const workspaceId = url.searchParams.get("workspaceId");

      const flags = workspaceId
        ? await getWorkspaceFeatureFlags(workspaceId)
        : await getAllFeatureFlags();

      return json({ ok: true, flags });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Failed to fetch flags" }, 400);
    }
  },
);

export const POST = withRouteLogging(
  "api/admin/feature-flags:POST",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      const body = await req.json() as {
        flagName: string;
        enabled: boolean;
        workspaceId?: string;
        metadata?: Record<string, unknown>;
      };

      if (!body.flagName) {
        return json({ error: "flagName required" }, 400);
      }

      const flag = await setFeatureFlag({
        flagName: body.flagName,
        enabled: body.enabled,
        workspaceId: body.workspaceId,
        updatedByEmail: admin.email,
        metadata: body.metadata,
      });

      await recordAudit({
        actorEmail: admin.email,
        action: "feature_flag.update",
        targetType: "feature_flag",
        targetLabel: body.flagName,
        detail: `${body.workspaceId ? `workspace ${body.workspaceId}: ` : ""}${body.enabled ? "enabled" : "disabled"}`,
      });

      return json({ ok: true, flag });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Failed to update flag" }, 400);
    }
  },
);

export const DELETE = withRouteLogging(
  "api/admin/feature-flags:DELETE",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      const body = await req.json() as { id: string };

      if (!body.id) {
        return json({ error: "id required" }, 400);
      }

      await deleteFeatureFlag(body.id);

      await recordAudit({
        actorEmail: admin.email,
        action: "feature_flag.delete",
        targetType: "feature_flag",
        targetLabel: body.id,
      });

      return json({ ok: true });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Failed to delete flag" }, 400);
    }
  },
);
