/**
 * Analytics dashboard API endpoint
 * Returns aggregated analytics data for the dashboard
 * Requires admin access
 */

import { requireAdmin } from "@/lib/admin";
import {
  getDailyStats,
  getPageViewStats,
  getUserActionStats,
  getConversionStats,
  getErrorStats,
  getPerformanceStats,
} from "@/lib/analytics-extended";

export async function GET(request: Request) {
  const admin = await requireAdmin(request.headers.get("cookie"));

  if (!admin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(request.url);
    const windowDays = parseInt(url.searchParams.get("windowDays") || "30", 10);

    const [
      dailyStats,
      pageViewStats,
      userActionStats,
      conversionStats,
      errorStats,
      performanceStats,
    ] = await Promise.all([
      getDailyStats(windowDays),
      getPageViewStats(windowDays),
      getUserActionStats(windowDays),
      getConversionStats(windowDays),
      getErrorStats(windowDays),
      getPerformanceStats(windowDays),
    ]);

    return new Response(
      JSON.stringify({
        windowDays,
        summary: {
          totalPageViews: dailyStats.reduce((sum, d) => sum + d.pageViews, 0),
          totalUniqueUsers: new Set(
            dailyStats.flatMap((d) => [d.uniqueUsers])
          ).size,
          totalConversions: dailyStats.reduce((sum, d) => sum + d.conversions, 0),
          totalErrors: dailyStats.reduce((sum, d) => sum + d.errors, 0),
        },
        dailyStats,
        pageViewStats: pageViewStats.slice(0, 20),
        userActionStats: userActionStats.slice(0, 20),
        conversionStats,
        errorStats,
        performanceStats: performanceStats.slice(0, 20),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("[analytics] dashboard error:", e);
    return new Response(JSON.stringify({ error: "Failed to fetch analytics" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
