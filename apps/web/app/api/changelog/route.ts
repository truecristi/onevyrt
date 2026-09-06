/**
 * Serves the product changelog (public, unauthenticated) so an in-app
 * "What's new" panel — or anyone — can read it. ETagged so the panel can poll
 * cheaply and only re-render when there's actually something new.
 */
import { CHANGELOG, latestChangeDate } from "../../../lib/changelog";
import { jsonWithETag } from "../../../lib/etag";
import { withRouteLogging } from "../../../lib/logger";

export const runtime = "nodejs";

export const GET = withRouteLogging("api/changelog:GET", async (req: Request): Promise<Response> =>
  jsonWithETag(req, JSON.stringify({ latest: latestChangeDate(), entries: CHANGELOG })),
);
