/**
 * Middleware for automatically tracking API calls
 * Can be used to wrap API route handlers with automatic event tracking
 */

import { trackUserAction, trackPerformance, trackError } from "../analytics-extended";
import { trackEventAllIntegrationsServer } from "../integrations/analytics-integrations";

/**
 * Wrapper to track API endpoint calls
 * Usage:
 *   export const POST = withTracking(myHandler, {
 *     actionName: "submit_chapter",
 *     metricName: "submit_chapter_api"
 *   });
 */
export function withTracking(
  handler: (req: Request, context?: any) => Promise<Response>,
  options: {
    actionName: string;
    metricName: string;
    includeBody?: boolean;
  }
) {
  return async (req: Request, context?: any) => {
    const startTime = Date.now();

    // Extract user info from request
    const user = context?.params?.userId || req.headers.get("x-user-id") || null;
    const workspaceId = context?.params?.workspaceId || req.headers.get("x-workspace-id") || null;

    try {
      // Call the actual handler
      const response = await handler(req, context);

      // Track performance
      const duration = Date.now() - startTime;
      const endpoint = new URL(req.url).pathname;

      if (user) {
        await trackPerformance(user, workspaceId, {
          metricType: "api_latency",
          metricName: options.metricName,
          valueMs: duration,
          apiEndpoint: endpoint,
          metadata: {
            method: req.method,
            status: response.status,
          },
        });

        // Track action in external integrations
        await trackEventAllIntegrationsServer(
          user,
          `api_call:${options.actionName}`,
          {
            endpoint,
            method: req.method,
            status: response.status,
            duration_ms: duration,
          }
        );
      }

      return response;
    } catch (error) {
      // Track error
      const duration = Date.now() - startTime;
      const endpoint = new URL(req.url).pathname;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      if (user) {
        await trackError(user, workspaceId, {
          errorType: "api_error",
          errorMessage,
          errorStack: error instanceof Error ? error.stack : undefined,
          pagePath: endpoint,
          severity: "error",
          context: {
            api_endpoint: endpoint,
            method: req.method,
            duration_ms: duration,
          },
        });
      }

      throw error;
    }
  };
}

/**
 * Middleware to automatically track successful actions
 * Usage:
 *   const result = await trackAction(userId, workspaceId, "form_submit", "chapter_submit", async () => {
 *     return await submitChapter(...);
 *   });
 */
export async function trackAction<T>(
  userId: string | null,
  workspaceId: string | null,
  actionType: string,
  actionName: string,
  handler: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await handler();

    const duration = Date.now() - startTime;

    if (userId) {
      await trackUserAction(userId, workspaceId, {
        actionType,
        actionName,
        durationMs: duration,
        metadata: {
          ...metadata,
          success: true,
        },
      });

      await trackEventAllIntegrationsServer(
        userId,
        `action:${actionName}`,
        {
          action_type: actionType,
          action_name: actionName,
          duration_ms: duration,
          ...metadata,
        }
      );
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    if (userId) {
      await trackUserAction(userId, workspaceId, {
        actionType,
        actionName,
        durationMs: duration,
        metadata: {
          ...metadata,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    throw error;
  }
}

/**
 * Middleware to measure performance of a function
 */
export async function measurePerformance<T>(
  userId: string | null,
  workspaceId: string | null,
  metricName: string,
  handler: () => Promise<T>,
  options?: {
    metricType?: string;
    endpoint?: string;
  }
): Promise<T> {
  const startTime = Date.now();

  const result = await handler();

  const duration = Date.now() - startTime;

  if (userId) {
    await trackPerformance(userId, workspaceId, {
      metricType: options?.metricType || "function_execution",
      metricName,
      valueMs: duration,
      apiEndpoint: options?.endpoint,
    });
  }

  return result;
}
