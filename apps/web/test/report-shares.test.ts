import test, { after } from "node:test";
import assert from "node:assert/strict";
import * as shares from "../lib/report-shares";
import { GET as shareRoute } from "../app/share/[token]/route";
import { pgPool } from "../lib/db";
import { uid } from "./helpers/pg";

const PREFIX = uid("shares-test");
const ws = (n: string) => `${PREFIX}-ws-${n}`;

after(async () => {
  await pgPool().query("DELETE FROM report_shares WHERE workspace_id LIKE $1", [`${PREFIX}%`]);
});

test("share route sandboxes owner HTML so it can't run same-origin script", async () => {
  const workspaceId = ws("sec");
  // A malicious owner embeds a script that would call our API as the viewer.
  const evil = `<p>ok</p><script>fetch('/api/auth/me').then(r=>r.json())</script>`;
  const made = await shares.createShare(workspaceId, "proj-sec", evil);
  assert.ok("token" in made);
  const token = (made as { token: string }).token;

  const res = await shareRoute(new Request(`https://app.example/share/${token}`), { params: Promise.resolve({ token }) });
  assert.equal(res.status, 200);
  const csp = res.headers.get("content-security-policy") ?? "";
  // The `sandbox` directive (no allow-tokens) puts the doc in an opaque origin
  // AND disables scripts — the two properties that defang the stored payload.
  assert.match(csp, /(^|;)\s*sandbox\s*(;|$)/, "response must carry a token-less sandbox directive");
  assert.doesNotMatch(csp, /allow-scripts/, "sandbox must not re-enable scripts");
  assert.doesNotMatch(csp, /allow-same-origin/, "sandbox must not re-enable same-origin");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  // The body is still served (the report renders); it's just inert.
  const body = await res.text();
  assert.match(body, /<p>ok<\/p>/);
});

test("share route returns 404 (still locked down) for an unknown token", async () => {
  const res = await shareRoute(new Request("https://app.example/share/nope"), { params: Promise.resolve({ token: "does-not-exist" }) });
  assert.equal(res.status, 404);
  assert.match(res.headers.get("content-security-policy") ?? "", /sandbox/);
});

test("createShare: a fresh token resolves via getSharedHtml and getActiveShare", async () => {
  const workspaceId = ws("1");
  const result = await shares.createShare(workspaceId, "proj1", "<p>report</p>");
  assert.ok("token" in result);
  const html = await shares.getSharedHtml((result as { token: string }).token);
  assert.equal(html, "<p>report</p>");
  const active = await shares.getActiveShare(workspaceId, "proj1");
  assert.equal(active?.token, (result as { token: string }).token);
});

test("createShare: creating a second link for the same project replaces the first — only one active at a time", async () => {
  const workspaceId = ws("2");
  const first = await shares.createShare(workspaceId, "proj1", "<p>v1</p>") as { token: string };
  const second = await shares.createShare(workspaceId, "proj1", "<p>v2</p>") as { token: string };
  assert.notEqual(first.token, second.token);
  assert.equal(await shares.getSharedHtml(first.token), null, "the old token must stop working");
  assert.equal(await shares.getSharedHtml(second.token), "<p>v2</p>");
});

test("revokeShare: kills the link immediately, before its natural expiry", async () => {
  const workspaceId = ws("3");
  const { token } = await shares.createShare(workspaceId, "proj1", "<p>report</p>") as { token: string };
  const revoked = await shares.revokeShare(workspaceId, "proj1");
  assert.equal(revoked, true);
  assert.equal(await shares.getSharedHtml(token), null);
  assert.equal(await shares.getActiveShare(workspaceId, "proj1"), null);
});

test("revokeShare: revoking a project with no active share reports false, not an error", async () => {
  const workspaceId = ws("4");
  assert.equal(await shares.revokeShare(workspaceId, "no-such-project"), false);
});

test("getSharedHtml: an unknown token returns null, not a throw", async () => {
  assert.equal(await shares.getSharedHtml("nonexistent-token"), null);
});

// Same read-modify-write shape as every other store in this app —
// concurrently sharing many different projects must not lose any of them.
test("createShare: concurrently creating links for many different projects loses none of them", async () => {
  const workspaceId = ws("5");
  const PROJECT_COUNT = 40;
  const results = await Promise.all(
    Array.from({ length: PROJECT_COUNT }, (_, i) => shares.createShare(workspaceId, `proj-${i}`, `<p>report ${i}</p>`)),
  ) as { token: string }[];
  for (let i = 0; i < PROJECT_COUNT; i++) {
    const html = await shares.getSharedHtml(results[i]!.token);
    assert.equal(html, `<p>report ${i}</p>`, `project ${i}'s share was lost to a write race`);
  }
});
