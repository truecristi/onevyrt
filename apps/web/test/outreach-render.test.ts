import test from "node:test";
import assert from "node:assert/strict";
import { renderTemplate } from "../lib/outreach/render";

test("merge fields substitute a contact's values", () => {
  const c = { name: "Ada Lovelace", email: "ada@x.com", phone: "+15550001" };
  assert.equal(renderTemplate("Hi {{firstName}}, your email is {{email}}", c), "Hi Ada, your email is ada@x.com");
  assert.equal(renderTemplate("Full: {{name}} / {{phone}}", c), "Full: Ada Lovelace / +15550001");
});

test("tokens are case-insensitive and tolerate whitespace", () => {
  const c = { name: "Bo", email: null, phone: null };
  assert.equal(renderTemplate("{{ FirstName }} + {{NAME}}", c), "Bo + Bo");
});

test("empty name falls back so 'Hi {{firstName}},' never reads 'Hi ,'", () => {
  const c = { name: null, email: "x@x.com", phone: null };
  assert.equal(renderTemplate("Hi {{firstName}},", c), "Hi there,");
  assert.equal(renderTemplate("Hi {{firstName}},", c, { nameFallback: "friend" }), "Hi friend,");
});

test("unknown tokens render blank, never echoed", () => {
  const c = { name: "A", email: null, phone: null };
  assert.equal(renderTemplate("Hi {{whatever}}!", c), "Hi !");
  assert.equal(renderTemplate("no tokens here", c), "no tokens here");
});
