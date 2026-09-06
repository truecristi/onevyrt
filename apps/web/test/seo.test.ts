import test from "node:test";
import assert from "node:assert/strict";
import robots from "../app/robots";
import sitemap from "../app/sitemap";
import { SITE_ORIGIN } from "../lib/site";

test("robots: allows crawling but keeps the app, admin and API out of the index", () => {
  const r = robots();
  const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
  assert.ok(rule, "robots defines a rule");
  assert.equal(rule.allow, "/");
  const disallow = rule.disallow as string[];
  for (const p of ["/api/", "/admin", "/business", "/campaign-studio"]) {
    assert.ok(disallow.includes(p), `robots should disallow ${p}`);
  }
  assert.equal(r.sitemap, `${SITE_ORIGIN}/sitemap.xml`);
});

test("sitemap: lists only the public pages, all absolute, landing prioritised", () => {
  const entries = sitemap();
  const urls = entries.map((e) => e.url);
  assert.deepEqual(urls, [`${SITE_ORIGIN}/`, `${SITE_ORIGIN}/privacy`, `${SITE_ORIGIN}/terms`]);
  for (const u of urls) assert.ok(u.startsWith("https://"), "urls are absolute");
  // No private surface leaks into the sitemap.
  for (const u of urls) {
    for (const bad of ["/admin", "/business", "/campaign-studio", "/api/"]) {
      assert.ok(!u.includes(bad), `sitemap must not contain ${bad}`);
    }
  }
  const landing = entries.find((e) => e.url === `${SITE_ORIGIN}/`)!;
  assert.equal(landing.priority, 1);
});
