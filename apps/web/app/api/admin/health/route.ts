import { requireAdmin } from "../../../../lib/admin";
import { pgPool } from "../../../../lib/db";
import { recentClientErrors } from "../../../../lib/client-errors";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";
const json = (d: unknown, s = 200): Response =>
  new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json" } });

interface HealthStatus {
  database: {
    connected: boolean;
    latencyMs?: number;
    error?: string;
  };
  api: {
    healthy: boolean;
    errorRate?: number;
  };
  errorLogs: {
    errorCount: number;
    lastError?: string;
  };
  uptime: number;
  timestamp: string;
}

const startTime = Date.now();

export const GET = withRouteLogging(
  "api/admin/health:GET",
  async (req: Request): Promise<Response> => {
    const admin = await requireAdmin(req.headers.get("cookie"));
    if (!admin) return json({ error: "not authorized" }, 403);

    try {
      // Check database connectivity
      let dbConnected = false;
      let dbLatency = 0;
      let dbError: string | undefined;

      try {
        const before = Date.now();
        const result = await pgPool().query("SELECT 1");
        dbLatency = Date.now() - before;
        dbConnected = result.rows.length > 0;
      } catch (e) {
        dbError = e instanceof Error ? e.message : "Unknown error";
      }

      // Get recent errors
      const errors = await recentClientErrors(10);
      const health: HealthStatus = {
        database: {
          connected: dbConnected,
          ...(dbLatency > 0 && { latencyMs: dbLatency }),
          ...(dbError && { error: dbError }),
        },
        api: {
          healthy: dbConnected,
          ...(errors.length > 0 && { errorRate: Math.min(100, (errors.length / 1000) * 100) }),
        },
        errorLogs: {
          errorCount: errors.length,
          ...(errors.length > 0 && { lastError: errors[0]?.message }),
        },
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
      };

      return json({ ok: true, health });
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : "Failed to get health status" }, 500);
    }
  },
);
