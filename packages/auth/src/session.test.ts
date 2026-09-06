import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  hashSessionToken,
  verifySessionTokenHash,
  newSessionExpiry,
  isSessionExpired,
} from "./session";

const SECRET = "a".repeat(64);

describe("session tokens", () => {
  it("generates unique tokens", () => {
    const a = generateSessionToken();
    const b = generateSessionToken();
    expect(a).not.toBe(b);
  });

  it("verifies a token against its own hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token, SECRET);
    expect(verifySessionTokenHash(token, SECRET, hash)).toBe(true);
  });

  it("rejects a token that doesn't match the stored hash", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token, SECRET);
    expect(verifySessionTokenHash(generateSessionToken(), SECRET, hash)).toBe(false);
  });

  it("rejects the right token under the wrong secret", () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token, SECRET);
    expect(verifySessionTokenHash(token, "b".repeat(64), hash)).toBe(false);
  });
});

describe("session expiry", () => {
  it("is not expired immediately after creation", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(isSessionExpired(newSessionExpiry(now), now)).toBe(false);
  });

  it("is expired after the TTL has passed", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const expiry = newSessionExpiry(now);
    const later = new Date(expiry.getTime() + 1);
    expect(isSessionExpired(expiry, later)).toBe(true);
  });
});
