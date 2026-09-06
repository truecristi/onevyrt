/**
 * Next.js instrumentation hook (https://nextjs.org/docs/app/guides/instrumentation).
 * Stable/on-by-default since Next 15 — no config flag needed.
 *
 * `onRequestError` is genuinely new coverage, not a duplicate of
 * lib/logger.ts's existing withRouteLogging: that wrapper only sees errors
 * thrown inside a route.ts handler it wraps. This hook is the one place that
 * also sees a Server Component render failure, a Server Action throw, or an
 * uncaught throw in proxy.ts itself — errors that would otherwise vanish into
 * Next's default opaque handling with no trace in the logs at all. Feeds the
 * same structured JSON logger (stdout -> journald / Vercel's log capture,
 * whichever is the current deploy target) rather than a second logging path.
 *
 * No `register()` export: nothing here needs to run once at boot (no tracer
 * SDK to initialize), so there's nothing to register.
 */
import { logError } from "./lib/logger";

export async function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string; headers: NodeJS.Dict<string | string[]> }>,
  context: Readonly<{
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "proxy";
    renderSource?: "react-server-components" | "react-server-components-payload" | "server-rendering";
    revalidateReason: "on-demand" | "stale" | undefined;
  }>,
): Promise<void> {
  logError(`instrumentation:${context.routerKind}:${context.routeType}`, error, {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    ...(context.renderSource ? { renderSource: context.renderSource } : {}),
  });
}
