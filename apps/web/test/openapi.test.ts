import test from "node:test";
import assert from "node:assert/strict";
import { buildOpenApiSpec } from "../lib/api/openapi";
import { SITE_ORIGIN } from "../lib/site";

test("openapi: valid 3.1 doc describing the v1 surface", () => {
  const s = buildOpenApiSpec() as Record<string, any>;
  assert.equal(s.openapi, "3.1.0");
  assert.equal(s.servers[0].url, `${SITE_ORIGIN}/api/v1`);
  // Both documented endpoints are present.
  assert.ok(s.paths["/projects"].get, "GET /projects");
  assert.ok(s.paths["/projects/{id}"].get, "GET /projects/{id}");
  // Bearer auth is declared and required globally.
  assert.equal(s.components.securitySchemes.apiKey.scheme, "bearer");
  assert.deepEqual(s.security, [{ apiKey: [] }]);
});

test("openapi: documents the real response contract (401/404/429/304 + rate-limit headers)", () => {
  const s = buildOpenApiSpec() as Record<string, any>;
  const list = s.paths["/projects"].get.responses;
  for (const code of ["200", "304", "401", "429"]) assert.ok(list[code], `list has ${code}`);
  const one = s.paths["/projects/{id}"].get.responses;
  assert.ok(one["404"], "single-project has a 404");
  // The 200 advertises the rate-limit + ETag headers integrators rely on.
  const headers = list["200"].headers;
  for (const h of ["X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset", "ETag"]) {
    assert.ok(headers[h], `200 advertises ${h}`);
  }
});

test("openapi: serialises to JSON (what the route returns)", () => {
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildOpenApiSpec())));
});
