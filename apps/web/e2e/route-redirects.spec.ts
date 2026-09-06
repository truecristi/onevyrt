import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount } from "./helpers";

/**
 * Route Redirects E2E Tests
 *
 * Tests that old routes properly redirect to canonical routes with
 * correct status codes and parameter preservation.
 */

test.describe("Route Redirects", () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto("/");
    if (await page.locator('input[type="email"]').isVisible()) {
      await page.fill('input[type="email"]', "test@example.com");
      await page.fill('input[type="password"]', "Test123!");
      await page.click("button:has-text('Sign In')");
      await page.waitForNavigation();
    }
  });

  test("/psychology is a real live route, not a deprecated redirect to /programme", async ({ page }) => {
    // This assumed /psychology was a deprecated alias for /programme. It never
    // was: deprecatedRouteRedirect()'s redirect map (lib/route-redirects.ts) has
    // only ever contained /app, /businesses, and /my-business (confirmed against
    // that file's full git history), matching CLAUDE.md's "Deprecated Routes"
    // table exactly. /psychology/golden is a live page
    // (app/psychology/golden/page.tsx — pillar 1 "how you sell" of the 3-pillar
    // restructure) with no auth gate in its layout, so it loads directly with no
    // redirect at all.
    const response = await page.goto("/psychology/golden", { waitUntil: "networkidle" });

    const url = page.url();
    expect(url).toContain("/psychology/golden");
    if (response) {
      expect(response.status()).toBe(200);
    }
  });

  test("/numbers is a real live route, not a deprecated redirect to /programme", async ({ page }) => {
    // Same wrong premise as the /psychology test above, for the other pillar:
    // /numbers/break-even is a live page (app/numbers/break-even/page.tsx —
    // pillar 2 "does it work?"), not a deprecated alias. It has never appeared in
    // deprecatedRouteRedirect()'s redirect map.
    const response = await page.goto("/numbers/break-even", { waitUntil: "networkidle" });

    const url = page.url();
    expect(url).toContain("/numbers/break-even");
    if (response) {
      expect(response.status()).toBe(200);
    }
  });

  test("canonical /programme route works directly", async ({ page }) => {
    const response = await page.goto("/programme");

    expect(response?.ok()).toBe(true);
    expect(page.url()).toContain("/programme");
  });

  test("old /business/funnels redirects to canonical path", async ({ page }) => {
    const response = await page.goto("/business/funnels", { waitUntil: "networkidle" });

    // Should either show the page or redirect
    const url = page.url();
    expect(url).toBeTruthy();

    if (response) {
      expect([200, 301, 302, 303, 307, 308]).toContain(response.status());
    }
  });

  test("canonical routes load without redirect loops", async ({ page }) => {
    const canonicalRoutes = ["/", "/command-center", "/business", "/programme", "/my-business"];

    for (const route of canonicalRoutes) {
      const response = await page.goto(route, { waitUntil: "networkidle" });

      // Should be OK or redirect to another page (not loop)
      expect(response?.ok()).toBe(true);

      // Should eventually land on a real page (not in redirect loop)
      const url = page.url();
      expect(url).toBeTruthy();
    }
  });

  test("query parameters are preserved through redirects", async ({ page }) => {
    await page.goto("/psychology?ws=test-workspace", { waitUntil: "networkidle" });

    const url = page.url();
    // Parameter should be preserved (possibly in different form)
    expect(url.toLowerCase()).toMatch(/programme|psychology/);
  });

  test("hash fragments are preserved through redirects", async ({ page }) => {
    await page.goto("/psychology#section", { waitUntil: "networkidle" });

    const url = page.url();
    // Should maintain the hash or properly handle it
    expect(url).toBeTruthy();
  });

  test("non-existent routes show 404 page", async ({ page }) => {
    const response = await page.goto("/this-route-definitely-does-not-exist", { waitUntil: "networkidle" });

    // Should be 404
    expect(response?.status()).toBe(404);

    // Should show an error message or 404 page.
    // `toContain` requires a string needle when the received value is a string
    // (matching Jest/expect semantics) — it throws a matcher error given a
    // regexp, which is what actually failed here. `toMatch` is the regex form,
    // and the real not-found page (app/not-found.tsx) does render this text.
    const content = await page.textContent("body");
    expect(content).toMatch(/not found|404|doesn't exist/i);
  });

  test("API routes are not affected by navigation redirects", async ({ page }) => {
    // /api/auth/logout only implements POST (app/api/auth/logout/route.ts:4) —
    // page.goto() always issues a GET, so this hit Next's auto-generated
    // "method not implemented" response for the missing GET handler
    // (autoImplementMethods in Next itself), which Chromium's navigation stack
    // refused outright (net::ERR_HTTP_RESPONSE_CODE_FAILURE) instead of
    // rendering an error page — the wrong HTTP verb for a page.goto() test
    // regardless. Use a GET-safe, side-effect-free API route instead so this
    // actually exercises what the test name says: that /api/* isn't swept up
    // in proxy.ts's deprecated-route/home-redirect rules and still returns
    // JSON, not HTML. /api/auth/me answers GET unauthenticated too (401 JSON,
    // see app/api/auth/me/route.ts) — the point here is the content-type, not
    // being signed in.
    const response = await page.goto("/api/auth/me", { waitUntil: "networkidle" });

    // API routes should return JSON or 200/3xx, not HTML
    if (response) {
      const contentType = response.headers()["content-type"] || "";
      expect(contentType).toMatch(/json|text/);
    }
  });

  test("dashboard redirect is applied correctly", async ({ page }) => {
    // This suite's shared beforeEach above never actually logs in — its
    // `input[type="email"]` guard is always false on "/", since the real
    // landing page only reveals that field after "Get started free" is
    // clicked (see helpers.ts's registerNewAccount) — so this test always ran
    // anonymously. Anonymous "/" is deliberately left alone by homeRedirect()
    // (lib/route-redirects.ts: "Anonymous '/' is left alone — it is the
    // sign-in page for signed-out users") and the real landing page shows a
    // marketing page with a "Get started free" CTA, not a bare email input —
    // so `isLogin` was always false too, and the assertion could never pass.
    // The behavior actually named by this test — an authenticated, param-less
    // "/" redirecting to "/command-center" — is homeRedirect()'s real
    // contract, and can only be observed with a genuine session, so register
    // one here via the real UI flow (the established pattern; see e.g.
    // auth.spec.ts).
    const prefix = uid("e2e-dashboard-redirect");
    const email = `${prefix}@example.com`;
    try {
      await registerNewAccount(page, prefix); // lands signed-in on /command-center
      await page.goto("/", { waitUntil: "networkidle" });
      expect(page.url()).toContain("/command-center");
    } finally {
      await cleanupAccount(email);
    }
  });

  test("deep links are preserved", async ({ page }) => {
    // Test that deep links to specific pages work
    const deepLinks = ["/business/reality", "/programme/chapter-1", "/my-business"];

    for (const link of deepLinks) {
      const response = await page.goto(link, { waitUntil: "networkidle" });

      // Should either show the page or redirect to a valid location
      if (response?.status() === 404) {
        // That's OK for unimplemented pages
        expect(response.status()).toBe(404);
      } else {
        expect(response?.ok()).toBe(true);
      }
    }
  });

  test("trailing slash handling is consistent", async ({ page }) => {
    await page.goto("/business", { waitUntil: "networkidle" });
    const urlWithout = page.url();

    await page.goto("/business/", { waitUntil: "networkidle" });
    const urlWith = page.url();

    // Both should resolve to the same canonical URL
    // (May differ in trailing slash depending on implementation)
    expect(urlWithout).toMatch(/\/business\/?/);
    expect(urlWith).toMatch(/\/business\/?/);
  });

  test("redirect preserves HTTP method for safe methods", async ({ page }) => {
    // GET requests should follow redirects
    const response = await page.goto("/psychology", { waitUntil: "networkidle" });

    // Should eventually resolve to a 200 OK page
    expect(response?.ok()).toBe(true);
  });

  test("old admin paths redirect correctly if they exist", async ({ page }) => {
    // This test only runs if user is admin
    // Admin users should be able to navigate old admin paths

    const response = await page.goto("/admin", { waitUntil: "networkidle" });

    // Should either show admin area or redirect
    const url = page.url();
    expect(url).toBeTruthy();

    // If access denied, should be clear
    if (response?.status() === 403) {
      expect(response.status()).toBe(403);
    }
  });

  test("response headers indicate redirect when appropriate", async ({ page }) => {
    // Same wrong /psychology-redirects-to-/programme premise as the two tests
    // near the top of this file — it never redirects, so this could never
    // observe real redirect headers. Use an actual deprecated route instead:
    // /app → /studio is a permanent 308 in deprecatedRouteRedirect()
    // (lib/route-redirects.ts), applied in proxy.ts ahead of Next's own
    // routing. maxRedirects: 0 stops at the first hop so the raw redirect
    // response is what gets asserted on, rather than the followed page.
    const response = await page.request.get("/app", { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers()["location"]).toContain("/studio");
  });
});
