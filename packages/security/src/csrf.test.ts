import { describe, expect, it } from "vitest";
import { generateCsrfToken, verifyCsrfToken } from "./csrf";

describe("CSRF double-submit token", () => {
  it("verifies when the header matches the cookie", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, token)).toBe(true);
  });

  it("rejects a mismatched header", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, generateCsrfToken())).toBe(false);
  });

  it("rejects when either side is missing", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(undefined, token)).toBe(false);
    expect(verifyCsrfToken(token, null)).toBe(false);
  });

  it("generates tokens that differ each time", () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });
});
