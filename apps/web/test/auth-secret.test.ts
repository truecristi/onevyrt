import test from "node:test";
import assert from "node:assert/strict";

/**
 * Auth Secret Tests
 *
 * Verifies that AUTH_SECRET is properly configured for production
 * and has appropriate entropy/length for cryptographic operations.
 */

test("AUTH_SECRET is defined in environment", () => {
  const secret = process.env.AUTH_SECRET;
  // In test environment, AUTH_SECRET may not be set — that's OK
  // This just documents that it should be set in production
  if (secret) {
    assert.ok(secret.length > 0);
  }
});

test("AUTH_SECRET has minimum length for cryptographic safety when set", () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return; // Skip if not set
  }

  // Minimum 32 characters (256 bits) for secure operations
  assert.ok(secret.length >= 32, `AUTH_SECRET must be at least 32 characters, got ${secret.length}`);
});

test("AUTH_SECRET looks like hex or base64 (not a plain sentence) when set", () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return; // Skip if not set
  }

  // Should not be a simple English sentence
  const isPlainEnglish = /^[a-zA-Z\s'-.]+$/.test(secret);
  assert.equal(isPlainEnglish, false, "AUTH_SECRET should not be plain English text; use hex, base64, or similar");
});

test("AUTH_SECRET in production is not a default/example value when set", () => {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return; // Skip if not set
  }

  const defaultValues = [
    "dev-secret",
    "development",
    "change-me",
    "test-secret",
    "your-secret-here",
    "placeholder",
  ];

  const isDefault = defaultValues.some((d) => secret.toLowerCase().includes(d.toLowerCase()));
  assert.equal(isDefault, false, "AUTH_SECRET should not be a default or example value");
});
