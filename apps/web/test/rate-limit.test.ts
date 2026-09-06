import test, { after } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, rateLimitHeaders, clientIp } from "../lib/rate-limit";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const PREFIX = uid("rl-test");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

after(async () => {
  await pgPool().query("DELETE FROM rate_limits WHERE key LIKE $1", [`${PREFIX}%`]);
});

test("allows up to max, then denies with a retry-after", async () => {
  const key = `${PREFIX}-basic`;
  const opts = { windowMs: 10_000, max: 3 };
  for (let i = 0; i < 3; i++) assert.equal((await checkRateLimit(key, opts)).allowed, true, `hit ${i} allowed`);
  const denied = await checkRateLimit(key, opts);
  assert.equal(denied.allowed, false);
  assert.ok((denied.retryAfterMs ?? 0) > 0, "retryAfterMs set when denied");
});

test("different keys don't share a budget", async () => {
  const opts = { windowMs: 10_000, max: 1 };
  assert.equal((await checkRateLimit(`${PREFIX}-a`, opts)).allowed, true);
  assert.equal((await checkRateLimit(`${PREFIX}-b`, opts)).allowed, true);
  assert.equal((await checkRateLimit(`${PREFIX}-a`, opts)).allowed, false);
});

test("the window resets after it elapses", async () => {
  const key = `${PREFIX}-window`;
  // The limiter is Postgres-backed, so each checkRateLimit is a real round-trip.
  // The window must be comfortably longer than two sequential round-trips take
  // on a loaded CI runner, or the window can genuinely elapse between the first
  // two hits and the second is (correctly) allowed — a false failure. 1.5s gives
  // ample margin; the post-window sleep stays safely past it.
  const opts = { windowMs: 1500, max: 1 };
  assert.equal((await checkRateLimit(key, opts)).allowed, true);
  assert.equal((await checkRateLimit(key, opts)).allowed, false);
  await sleep(1800);
  assert.equal((await checkRateLimit(key, opts)).allowed, true, "allowed again after the window elapsed");
});

test("concurrent hits on one key allow EXACTLY max — no lost increments (the shared-backend guarantee)", async () => {
  const key = `${PREFIX}-race`;
  const max = 5;
  const results = await Promise.all(
    Array.from({ length: 40 }, () => checkRateLimit(key, { windowMs: 10_000, max })),
  );
  const allowed = results.filter((r) => r.allowed).length;
  assert.equal(allowed, max, `exactly ${max} of 40 concurrent hits allowed, got ${allowed}`);
});

test("clientIp: a spoofed X-Forwarded-For prefix cannot rotate the bucket key", () => {
  const req = (xff: string) => new Request("https://x/", { headers: { "x-forwarded-for": xff } });
  // With one trusted hop (our edge, the default), the real client is the
  // rightmost entry our proxy appended — the attacker's forged prefix is ignored.
  assert.equal(clientIp(req("9.9.9.9")), "9.9.9.9", "single entry is the client");
  assert.equal(clientIp(req("1.1.1.1, 9.9.9.9")), "9.9.9.9", "forged prefix ignored, real client used");
  assert.equal(clientIp(req("evil, evil2, 9.9.9.9")), "9.9.9.9", "multiple forged entries ignored");
  // Two clients spoofing different prefixes but hitting from the same real IP
  // must land in the SAME bucket — otherwise the throttle is trivially defeated.
  assert.equal(clientIp(req("a, 9.9.9.9")), clientIp(req("b, 9.9.9.9")), "same real client → same bucket");
});

test("clientIp: falls back to x-real-ip, then 'unknown', when XFF is absent", () => {
  assert.equal(clientIp(new Request("https://x/", { headers: { "x-real-ip": "5.5.5.5" } })), "5.5.5.5");
  assert.equal(clientIp(new Request("https://x/")), "unknown");
});

test("rateLimitHeaders: emits X-RateLimit-* (Reset in epoch seconds); Retry-After only when blocked", () => {
  const ok = rateLimitHeaders({ allowed: true, limit: 100, remaining: 42, resetAt: 1_700_000_000_000 });
  assert.equal(ok["x-ratelimit-limit"], "100");
  assert.equal(ok["x-ratelimit-remaining"], "42");
  assert.equal(ok["x-ratelimit-reset"], "1700000000");
  assert.equal(ok["retry-after"], undefined, "a permitted request carries no Retry-After");

  const blocked = rateLimitHeaders({ allowed: false, limit: 100, remaining: 0, resetAt: 2_000_000, retryAfterMs: 4500 });
  assert.equal(blocked["x-ratelimit-remaining"], "0");
  assert.equal(blocked["retry-after"], "5", "4500ms rounds up to 5s");
});
