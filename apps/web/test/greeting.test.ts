import test from "node:test";
import assert from "node:assert/strict";
import { friendlyFirstName } from "../lib/studio/greeting";

test("friendlyFirstName: uses a real first name from the email", () => {
  assert.equal(friendlyFirstName("john@example.com"), "John");
  assert.equal(friendlyFirstName("john.smith@example.com"), "John");
  assert.equal(friendlyFirstName("MARIA_garcia@x.io"), "Maria");
  assert.equal(friendlyFirstName("ana+promo@x.io"), "Ana");
});

test("friendlyFirstName: returns '' for machine-generated handles (no hash as a name)", () => {
  // The exact case the user hit — a hash handle must NOT be shown as a name.
  assert.equal(friendlyFirstName("e2e-audit_1787431159920_53275ba0@example.com"), "");
  assert.equal(friendlyFirstName("user123@example.com"), "");
  assert.equal(friendlyFirstName("a1b2c3@example.com"), "");
  assert.equal(friendlyFirstName("x@example.com"), ""); // too short to read as a name
  assert.equal(friendlyFirstName(""), "");
});
