import test from "node:test";
import assert from "node:assert/strict";

test("URL safety utilities", async (t) => {
  // Import after we define the test function
  const { isPublicAddress } = await import("../../lib/url-safety");

  await t.test("treats ordinary public IPv4 addresses as public", () => {
    assert.equal(isPublicAddress("8.8.8.8", 4), true);
    assert.equal(isPublicAddress("93.184.216.34", 4), true);
  });

  await t.test("rejects loopback and RFC1918 private ranges", () => {
    assert.equal(isPublicAddress("127.0.0.1", 4), false);
    assert.equal(isPublicAddress("10.0.0.1", 4), false);
    assert.equal(isPublicAddress("192.168.1.1", 4), false);
  });

  await t.test("rejects the cloud-metadata link-local address", () => {
    assert.equal(isPublicAddress("169.254.169.254", 4), false);
  });

  await t.test("rejects IPv6 loopback and unique-local addresses", () => {
    assert.equal(isPublicAddress("::1", 6), false);
    assert.equal(isPublicAddress("fd00::1", 6), false);
  });
});

test("Soft delete utilities", async (t) => {
  const mod = await import("../../lib/soft-delete");

  await t.test("exposes a sane bin retention window", () => {
    assert.equal(typeof mod.BIN_RETENTION_DAYS, "number");
    assert.ok(mod.BIN_RETENTION_DAYS > 0, "retention window is a positive number of days");
  });

  await t.test("exposes the soft-delete / restore / purge surface", () => {
    assert.equal(typeof mod.softDeleteRow, "function");
    assert.equal(typeof mod.restoreRow, "function");
    assert.equal(typeof mod.purgeRow, "function");
    assert.equal(typeof mod.listDeletedRows, "function");
    assert.equal(typeof mod.purgeExpiredRows, "function");
  });
});

test("ETag utilities", async (t) => {
  const { etagFor, ifNoneMatch } = await import("../../lib/etag");

  await t.test("generates consistent ETags for same content", () => {
    const content = JSON.stringify({ data: "test" });
    const etag1 = etagFor(content);
    const etag2 = etagFor(content);
    assert.equal(etag1, etag2);
  });

  await t.test("generates different ETags for different content", () => {
    const etag1 = etagFor("content1");
    const etag2 = etagFor("content2");
    assert.notEqual(etag1, etag2);
  });

  await t.test("ifNoneMatch matches a request carrying the same ETag", () => {
    const etag = etagFor("test-content");
    const req = new Request("http://x/", { headers: { "if-none-match": etag } });
    assert.equal(ifNoneMatch(req, etag), true);
  });

  await t.test("ifNoneMatch is false when the request's ETag differs", () => {
    const etag = etagFor("content1");
    const req = new Request("http://x/", { headers: { "if-none-match": etagFor("content2") } });
    assert.equal(ifNoneMatch(req, etag), false);
  });
});

test("Crypto box utilities", async (t) => {
  process.env.AI_ENCRYPTION_KEY = "utilities-test-encryption-key";
  const { encryptSecret, decryptSecret, secretStorageConfigured } = await import("../../lib/crypto-box");

  await t.test("reports secret storage as configured when a key is set", () => {
    assert.equal(secretStorageConfigured(), true);
  });

  await t.test("encrypts and decrypts data", () => {
    const plaintext = "secret message";
    const encrypted = encryptSecret(plaintext);
    assert.ok(encrypted, "ciphertext produced");
    assert.notEqual(encrypted, plaintext, "encrypted text differs from plaintext");

    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, plaintext, "decrypted text matches original");
  });

  await t.test("handles unicode content", () => {
    const plaintext = "Hello 世界 🔐 مرحبا";
    const encrypted = encryptSecret(plaintext);
    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, plaintext);
  });

  await t.test("fails gracefully (returns null) with a tampered ciphertext", () => {
    const encrypted = encryptSecret("secret");
    assert.ok(encrypted, "ciphertext produced");
    const tampered = encrypted.slice(0, -2) + (encrypted.endsWith("00") ? "11" : "00");
    assert.equal(decryptSecret(tampered), null, "tampered ciphertext does not decrypt");
  });
});

test("Clipboard utilities", async (t) => {
  const { copyText } = await import("../../lib/clipboard");

  await t.test("exposes an async copyText helper", () => {
    assert.equal(typeof copyText, "function");
  });

  await t.test("returns a boolean and never throws outside a real clipboard", async () => {
    const ok = await copyText("hello");
    assert.equal(typeof ok, "boolean");
  });
});

test("Rate limit headers", async (t) => {
  const { rateLimitHeaders } = await import("../../lib/rate-limit");

  await t.test("generates X-RateLimit-* headers for allowed request", () => {
    const headers = rateLimitHeaders({
      allowed: true,
      limit: 100,
      remaining: 50,
      resetAt: 1_700_000_000_000,
    });
    assert.equal(headers["x-ratelimit-limit"], "100");
    assert.equal(headers["x-ratelimit-remaining"], "50");
    assert.equal(headers["x-ratelimit-reset"], "1700000000");
    assert.equal(headers["retry-after"], undefined);
  });

  await t.test("adds Retry-After header when blocked", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 100,
      remaining: 0,
      resetAt: Date.now() + 5000,
      retryAfterMs: 5000,
    });
    assert.ok(headers["retry-after"], "retry-after header present");
    assert.ok(Number(headers["retry-after"]) > 0, "retry-after is positive");
  });

  await t.test("converts ms to seconds for Retry-After", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 4500,
      retryAfterMs: 4500,
    });
    const seconds = Number(headers["retry-after"]);
    assert.ok(seconds >= 4 && seconds <= 5, `retry-after rounds correctly: ${seconds}s`);
  });
});

test("Message utilities", async (t) => {
  const { sanitizeMessage, composeOneLiner, oneLinerComplete } = await import("../../lib/message");

  await t.test("sanitizeMessage coerces junk into a well-formed MessageData", () => {
    const clean = sanitizeMessage({ oneLiner: { problem: "p", solution: "s", result: "r" } });
    assert.equal(clean.oneLiner.problem, "p");
    assert.equal(clean.oneLiner.solution, "s");
    assert.equal(clean.oneLiner.result, "r");
    assert.equal(typeof clean.character, "string");
  });

  await t.test("sanitizeMessage caps overly long fields", () => {
    const clean = sanitizeMessage({ oneLiner: { problem: "x".repeat(1000) } });
    assert.ok(clean.oneLiner.problem.length <= 400, "problem is length-capped");
  });

  await t.test("oneLinerComplete + composeOneLiner reflect a filled one-liner", () => {
    const m = sanitizeMessage({ oneLiner: { problem: "no leads", solution: "our funnel", result: "you grow" } });
    assert.equal(oneLinerComplete(m), true);
    const line = composeOneLiner(m);
    assert.ok(line.includes("no leads"));
    assert.ok(line.length > 0);
  });

  await t.test("an empty one-liner is not complete", () => {
    const m = sanitizeMessage({});
    assert.equal(oneLinerComplete(m), false);
    assert.equal(composeOneLiner(m), "");
  });
});
