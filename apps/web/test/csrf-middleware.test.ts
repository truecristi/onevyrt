/**
 * CSRF Token Tests
 *
 * Tests for CSRF token generation, signing, and verification.
 * These are unit tests that can run without a database or server.
 *
 * Moved here from lib/__tests__/csrf.test.ts: this repo's test runner only
 * discovers `test/**\/*.test.ts` (see package.json's `test`/`test:unit`
 * scripts, and scripts/test-unit.mjs's `walk("test")`) — a `__tests__`
 * co-located under lib/ was never actually executed by `pnpm test`, in CI or
 * otherwise. Same class of bug as the test-runner glob fix elsewhere this
 * session (a suite silently never running), just a different root cause
 * (wrong directory entirely, not a shell-glob recursion limit).
 */

import { describe, it } from "node:test";
import * as assert from "node:assert";
import { generateCsrfToken, signCsrfToken, verifyCsrfToken, readCsrfToken, validateCsrf, CSRF_COOKIE, CSRF_HEADER } from "../lib/middleware/csrf";

describe("CSRF Middleware", () => {
  describe("generateCsrfToken()", () => {
    it("generates a 64-character hex string (32 bytes)", () => {
      const token = generateCsrfToken();
      assert.match(token, /^[0-9a-f]{64}$/);
    });

    it("generates different tokens on each call", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      assert.notEqual(token1, token2);
    });
  });

  describe("signCsrfToken()", () => {
    it("signs a token and returns token.signature format", () => {
      const token = generateCsrfToken();
      const signed = signCsrfToken(token);

      // Should be token.signature (two parts separated by dot)
      const parts = signed.split(".");
      assert.equal(parts.length, 2);
      assert.equal(parts[0], token);
      assert.match(parts[1]!, /^[0-9a-zA-Z_-]+$/); // base64url
    });

    it("signature changes if token changes", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      const signed1 = signCsrfToken(token1);
      const signed2 = signCsrfToken(token2);

      assert.notEqual(signed1, signed2);
    });
  });

  describe("verifyCsrfToken()", () => {
    it("verifies a validly signed token", () => {
      const token = generateCsrfToken();
      const signed = signCsrfToken(token);

      const verified = verifyCsrfToken(signed);
      assert.equal(verified, token);
    });

    it("returns null for invalid signature", () => {
      const token = generateCsrfToken();
      const signed = signCsrfToken(token);

      // Corrupt the signature
      const corrupted = signed.slice(0, -1) + (signed[signed.length - 1] === "a" ? "b" : "a");

      const verified = verifyCsrfToken(corrupted);
      assert.equal(verified, null);
    });

    it("returns null for malformed token (no dot)", () => {
      const verified = verifyCsrfToken("notasignedtoken");
      assert.equal(verified, null);
    });

    it("returns null for empty string", () => {
      const verified = verifyCsrfToken("");
      assert.equal(verified, null);
    });

    it("returns null for null/undefined", () => {
      // @ts-expect-error - testing type guards
      assert.equal(verifyCsrfToken(null), null);
      // @ts-expect-error - testing type guards
      assert.equal(verifyCsrfToken(undefined), null);
    });

    it("returns null for token with tampered payload", () => {
      const token1 = generateCsrfToken();
      const signed1 = signCsrfToken(token1);
      const [, sig] = signed1.split(".");

      // Take signature from token1 but use a different token
      const token2 = generateCsrfToken();
      const tampered = `${token2}.${sig}`;

      const verified = verifyCsrfToken(tampered);
      assert.equal(verified, null);
    });
  });

  describe("readCsrfToken()", () => {
    it("extracts CSRF token from cookie header", () => {
      const token = generateCsrfToken();
      const signed = signCsrfToken(token);
      const cookieHeader = `gb_csrf_token=${signed}; Path=/`;

      const read = readCsrfToken(cookieHeader);
      assert.equal(read, signed);
    });

    it("handles multiple cookies", () => {
      const token = generateCsrfToken();
      const signed = signCsrfToken(token);
      const cookieHeader = `gb_session=xyz123; gb_csrf_token=${signed}; other=value`;

      const read = readCsrfToken(cookieHeader);
      assert.equal(read, signed);
    });

    it("returns null when CSRF token not present", () => {
      const cookieHeader = "gb_session=xyz123; other=value";

      const read = readCsrfToken(cookieHeader);
      assert.equal(read, null);
    });

    it("returns null for null/empty cookie header", () => {
      assert.equal(readCsrfToken(null), null);
      assert.equal(readCsrfToken(""), null);
    });

    it("handles spaces around semicolons", () => {
      const token = generateCsrfToken();
      const signed = signCsrfToken(token);
      const cookieHeader = `gb_session=xyz123 ; gb_csrf_token=${signed} ; other=value`;

      const read = readCsrfToken(cookieHeader);
      assert.equal(read, signed);
    });
  });

  describe("Full CSRF Flow", () => {
    it("end-to-end: generate, sign, verify", () => {
      // 1. Server generates token
      const token = generateCsrfToken();

      // 2. Server signs it for transmission
      const signed = signCsrfToken(token);

      // 3. Client stores in cookie and sends back
      const cookieHeader = `gb_csrf_token=${signed}; Path=/`;
      const clientToken = readCsrfToken(cookieHeader);
      assert.equal(clientToken, signed);

      // 4. Server verifies the token
      const verified = verifyCsrfToken(clientToken!);
      assert.equal(verified, token);
    });

    it("tokens from different generations don't verify for each other", () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      const signed1 = signCsrfToken(token1);

      // Try to verify signed2 but it shouldn't work if we tamper with it
      const tampered = token2 + "." + signed1.split(".")[1];
      const verified = verifyCsrfToken(tampered);
      assert.equal(verified, null);
    });
  });

  describe("Security Properties", () => {
    it("token is cryptographically random (no patterns)", () => {
      const tokens = Array.from({ length: 10 }, () => generateCsrfToken());

      // All should be unique (astronomically unlikely to fail)
      const unique = new Set(tokens);
      assert.equal(unique.size, 10);
    });

    it("signature is deterministic for the same token", () => {
      // Note: This test is informational. In practice, you should never
      // need to verify that signatures are deterministic — they are by design
      // (HMAC is deterministic). Just want to confirm no nonce was added.
      const token = generateCsrfToken();

      // Sign the same token twice
      const sig1 = signCsrfToken(token);
      const sig2 = signCsrfToken(token);

      // Signatures should match (deterministic)
      assert.equal(sig1, sig2);
    });

    it("verification is timing-safe (no data leak on comparison)", () => {
      // This test just confirms verifyCsrfToken doesn't throw
      // and handles both valid and invalid tokens without crashing.
      // A full timing-safe test would need to measure execution time.

      const token = generateCsrfToken();
      const signed = signCsrfToken(token);

      // Valid token
      assert.doesNotThrow(() => verifyCsrfToken(signed));

      // Invalid token (should not throw, just return null)
      assert.doesNotThrow(() => verifyCsrfToken(signed + "tampered"));
    });
  });
});

describe("validateCsrf()", () => {
  // The real client flow (see components/SecurityInitializer.tsx and
  // lib/hooks/use-csrf-token.ts): the cookie carries the RAW token, the
  // x-csrf-token header carries the SIGNED token. This was broken until this
  // change — the initializer wrote the *signed* value into the cookie too,
  // which validateCsrf can never accept (it never re-verifies the cookie's
  // value, only the header's) — so every real request would have 403'd
  // unconditionally the moment any route started calling this. These tests
  // pin the correct pairing so that regression can't come back silently.
  function request(method: string, opts: { cookieToken?: string; headerToken?: string } = {}): Request {
    const headers: Record<string, string> = {};
    if (opts.cookieToken !== undefined) headers.cookie = `${CSRF_COOKIE}=${opts.cookieToken}`;
    if (opts.headerToken !== undefined) headers[CSRF_HEADER] = opts.headerToken;
    return new Request("https://x/", { method, headers });
  }

  it("passes a real client's cookie(raw)/header(signed) pair", async () => {
    const token = generateCsrfToken();
    const signed = signCsrfToken(token);
    const result = await validateCsrf(request("POST", { cookieToken: token, headerToken: signed }));
    assert.equal(result, null, "matching raw cookie + signed header must be accepted");
  });

  it("rejects the pre-fix bug: cookie holding the signed value instead of the raw token", async () => {
    const token = generateCsrfToken();
    const signed = signCsrfToken(token);
    // This is exactly what the old (buggy) CsrfTokenInitializer produced.
    const result = await validateCsrf(request("POST", { cookieToken: signed, headerToken: signed }));
    assert.ok(result instanceof Response, "signed-value-in-cookie must be rejected, not silently accepted");
    assert.equal(result?.status, 403);
  });

  it("rejects a request with no cookie at all", async () => {
    const signed = signCsrfToken(generateCsrfToken());
    const result = await validateCsrf(request("POST", { headerToken: signed }));
    assert.ok(result instanceof Response);
    assert.equal(result?.status, 403);
  });

  it("rejects a request with no x-csrf-token header", async () => {
    const token = generateCsrfToken();
    const result = await validateCsrf(request("POST", { cookieToken: token }));
    assert.ok(result instanceof Response);
    assert.equal(result?.status, 403);
  });

  it("rejects a header signed for a different token than the cookie holds", async () => {
    const cookieToken = generateCsrfToken();
    const otherSigned = signCsrfToken(generateCsrfToken());
    const result = await validateCsrf(request("POST", { cookieToken, headerToken: otherSigned }));
    assert.ok(result instanceof Response);
    assert.equal(result?.status, 403);
  });

  it("rejects a header value with a tampered signature", async () => {
    const token = generateCsrfToken();
    const signed = signCsrfToken(token);
    const tampered = signed.slice(0, -1) + (signed.endsWith("a") ? "b" : "a");
    const result = await validateCsrf(request("POST", { cookieToken: token, headerToken: tampered }));
    assert.ok(result instanceof Response);
    assert.equal(result?.status, 403);
  });

  it("applies to PUT, DELETE, and PATCH the same way it applies to POST", async () => {
    const token = generateCsrfToken();
    const signed = signCsrfToken(token);
    for (const method of ["PUT", "DELETE", "PATCH"]) {
      const ok = await validateCsrf(request(method, { cookieToken: token, headerToken: signed }));
      assert.equal(ok, null, `${method} with a valid pair should pass`);
      const blocked = await validateCsrf(request(method));
      assert.ok(blocked instanceof Response, `${method} with no token should be blocked`);
    }
  });

  it("never checks GET, HEAD, or OPTIONS — safe methods pass with no token at all", async () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const result = await validateCsrf(request(method));
      assert.equal(result, null, `${method} should never require a CSRF token`);
    }
  });
});

describe("CSRF Constants", () => {
  it("exports correct cookie and header names", () => {
    assert.equal(CSRF_COOKIE, "gb_csrf_token");
    assert.equal(CSRF_HEADER, "x-csrf-token");
  });
});
