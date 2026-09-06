import test from "node:test";
import assert from "node:assert/strict";
import { homeRedirect } from "../lib/route-redirects";

// Proposal §3: the canonical-home redirect decision. Pure, no server/DB.

test("authenticated, param-less / → /command-center (the one Home)", () => {
  assert.equal(homeRedirect({ pathname: "/", search: "", hasSession: true }), "/command-center");
  assert.equal(homeRedirect({ pathname: "/", search: "?", hasSession: true }), "/command-center");
});

test("anonymous / is left alone (it is the sign-in page)", () => {
  assert.equal(homeRedirect({ pathname: "/", search: "", hasSession: false }), null);
});

test("/ with the password-reset param is NEVER redirected (params preserved)", () => {
  assert.equal(homeRedirect({ pathname: "/", search: "?resetToken=abc123", hasSession: false }), null);
  // even if somehow authenticated, a param-carrying root is left untouched
  assert.equal(homeRedirect({ pathname: "/", search: "?resetToken=abc123", hasSession: true }), null);
});

test("/ with any other query string is left untouched (legacy/deep-link params preserved)", () => {
  assert.equal(homeRedirect({ pathname: "/", search: "?ws=abc", hasSession: true }), null);
  assert.equal(homeRedirect({ pathname: "/", search: "?foo=bar&baz=1", hasSession: true }), null);
});

test("/command-center is NOT redirected (it is the Home — redirecting it would loop)", () => {
  assert.equal(homeRedirect({ pathname: "/command-center", search: "", hasSession: true }), null);
  assert.equal(homeRedirect({ pathname: "/command-center", search: "", hasSession: false }), null);
});

test("the Studio URLs (/studio, /app) are never redirected", () => {
  for (const p of ["/studio", "/app"]) {
    assert.equal(homeRedirect({ pathname: p, search: "", hasSession: true }), null, `${p} must not redirect`);
  }
});

test("non-root paths are never redirected (APIs/pages/insights untouched)", () => {
  for (const p of ["/command-center", "/command-center/insights", "/app", "/studio", "/api/command-center", "/business/funnels", "/welcome"]) {
    assert.equal(homeRedirect({ pathname: p, search: "", hasSession: true }), null, `${p} must not redirect`);
    assert.equal(homeRedirect({ pathname: p, search: "?x=1", hasSession: false }), null, `${p} must not redirect`);
  }
});
