/**
 * Serves the public API's OpenAPI 3.1 description (unauthenticated, so it can
 * be pointed at from Postman / a codegen). ETagged like the other v1 GETs so
 * repeat fetches are cheap.
 */
import { buildOpenApiSpec } from "../../../../lib/api/openapi";
import { jsonWithETag } from "../../../../lib/etag";
import { withRouteLogging } from "../../../../lib/logger";

export const runtime = "nodejs";

export const GET = withRouteLogging("api/v1/openapi:GET", async (req: Request): Promise<Response> =>
  jsonWithETag(req, JSON.stringify(buildOpenApiSpec())),
);
