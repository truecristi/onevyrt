/**
 * OpenAPI 3.1 description of the public v1 API — the read-only, API-key-authed
 * surface (see app/api/v1/*). Kept in sync with those routes by hand (the
 * surface is small); served unauthenticated at /api/v1/openapi.json so an
 * integrator can point Postman / a codegen at it. Pure and testable.
 */
import { SITE_ORIGIN } from "../site";
import pkg from "../../package.json";

export function buildOpenApiSpec(): Record<string, unknown> {
  const version = typeof pkg.version === "string" ? pkg.version : "0.0.0";
  const rateLimitHeaders = {
    "X-RateLimit-Limit": { schema: { type: "integer" }, description: "Requests allowed per window." },
    "X-RateLimit-Remaining": { schema: { type: "integer" }, description: "Requests left in the current window." },
    "X-RateLimit-Reset": { schema: { type: "integer" }, description: "When the window resets (epoch seconds)." },
    ETag: { schema: { type: "string" }, description: "Content hash — send it back as If-None-Match to get a 304." },
  };
  const okListHeaders = rateLimitHeaders;

  return {
    openapi: "3.1.0",
    info: {
      title: "OneVYRT Public API",
      version,
      description:
        "Read-only access to your workspace's projects. Authenticate with an API key " +
        "(`Authorization: Bearer ovk_...`) minted in Settings → API keys. Requests are rate " +
        "limited per workspace; every response carries X-RateLimit-* headers and an ETag, and a " +
        "matching If-None-Match returns 304.",
    },
    servers: [{ url: `${SITE_ORIGIN}/api/v1` }],
    security: [{ apiKey: [] }],
    components: {
      securitySchemes: {
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "ovk_...",
          description: "An API key from Settings → API keys.",
        },
      },
      responses: {
        Unauthorized: { description: "Missing or invalid API key." },
        NotFound: { description: "No such project in this workspace." },
        RateLimited: {
          description: "Too many requests — see Retry-After.",
          headers: { "Retry-After": { schema: { type: "integer" }, description: "Seconds to wait." }, ...rateLimitHeaders },
        },
        NotModified: { description: "Your If-None-Match matched — body omitted." },
      },
      schemas: {
        Project: { type: "object", description: "A saved funnel project (opaque JSON blob).", additionalProperties: true },
        ProjectList: {
          type: "object",
          properties: { projects: { type: "array", items: { $ref: "#/components/schemas/Project" } } },
          required: ["projects"],
        },
      },
    },
    paths: {
      "/projects": {
        get: {
          summary: "List projects",
          operationId: "listProjects",
          responses: {
            "200": {
              description: "The workspace's projects.",
              headers: okListHeaders,
              content: { "application/json": { schema: { $ref: "#/components/schemas/ProjectList" } } },
            },
            "304": { $ref: "#/components/responses/NotModified" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/projects/{id}": {
        get: {
          summary: "Get one project",
          operationId: "getProject",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Project id." }],
          responses: {
            "200": {
              description: "The project.",
              headers: okListHeaders,
              content: { "application/json": { schema: { $ref: "#/components/schemas/Project" } } },
            },
            "304": { $ref: "#/components/responses/NotModified" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
    },
  };
}
