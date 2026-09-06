import test from "node:test";
import assert from "node:assert/strict";
import { withRouteLogging, scrub } from "../lib/logger";

test("scrub: redacts credential-looking keys, including camel/snake variants", () => {
  const out = scrub({
    email: "a@b.com",              // kept
    password: "hunter2",           // redacted (exact word)
    apiKey: "sk_live_xyz",         // redacted (substring apikey)
    accessToken: "tok_abc",        // redacted (substring token)
    clientSecret: "cs_123",        // redacted (substring secret)
    webhookSecret: "whsec_1",      // redacted
    sessionToken: "st_9",          // redacted
    Authorization: "Bearer zzz",   // redacted (case-insensitive)
    api_key: "k",                  // redacted (snake)
  }) as Record<string, unknown>;
  assert.equal(out.email, "a@b.com");
  for (const k of ["password", "apiKey", "accessToken", "clientSecret", "webhookSecret", "sessionToken", "Authorization", "api_key"]) {
    assert.equal(out[k], "[redacted]", `${k} must be redacted`);
  }
});

test("scrub: does NOT over-redact innocent keys that merely contain short words", () => {
  const out = scrub({ author: "Ada", passenger: "x", compass: "N", authorId: "u1" }) as Record<string, unknown>;
  // "auth"/"pass" only match as WHOLE keys, so these are kept verbatim.
  assert.equal(out.author, "Ada");
  assert.equal(out.passenger, "x");
  assert.equal(out.compass, "N");
  assert.equal(out.authorId, "u1");
});

test("scrub: recurses into nested objects and arrays", () => {
  const out = scrub({ user: { id: 1, token: "t" }, items: [{ secret: "s" }, { name: "ok" }] }) as { user: Record<string, unknown>; items: Record<string, unknown>[] };
  assert.equal(out.user.id, 1);
  assert.equal(out.user.token, "[redacted]");
  assert.equal(out.items[0]?.secret, "[redacted]");
  assert.equal(out.items[1]?.name, "ok");
});

test("withRouteLogging: stamps an X-Request-Id on the response", async () => {
  const wrapped = withRouteLogging("test:ok", async (_req: Request) => new Response("ok", { status: 200 }));
  const res = await wrapped(new Request("http://x/test"));
  assert.ok(res.headers.get("x-request-id"), "response carries a request id");
  assert.equal(await res.text(), "ok", "body is preserved");
});

test("withRouteLogging: reuses an inbound x-request-id", async () => {
  const wrapped = withRouteLogging("test:reuse", async (_req: Request) => new Response("ok"));
  const res = await wrapped(new Request("http://x/test", { headers: { "x-request-id": "abc-123" } }));
  assert.equal(res.headers.get("x-request-id"), "abc-123");
});

test("withRouteLogging: a handler throw becomes a 500 with a request id", async () => {
  const wrapped = withRouteLogging("test:boom", async (_req: Request) => { throw new Error("kaboom"); });
  const res = await wrapped(new Request("http://x/test", { headers: { "x-request-id": "trace-9" } }));
  assert.equal(res.status, 500);
  assert.equal(res.headers.get("x-request-id"), "trace-9");
  const body = await res.json() as { error: string };
  assert.equal(body.error, "internal error");
});
