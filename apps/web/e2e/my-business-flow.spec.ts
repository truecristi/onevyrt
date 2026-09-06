import { test, expect, type Browser, type Page } from "@playwright/test";
import { uid, registerNewAccount, loginViaAPI, cleanupAccount } from "./helpers";

/**
 * My Business Flow E2E Tests
 *
 * Tests the complete user journey through the My Business dashboard,
 * including loading profile data, viewing completeness, and editing sections.
 *
 * One account is registered in beforeAll and reused (via the fast
 * loginViaAPI, not the UI) across all tests — see growth-plan-share.spec.ts
 * for the same pattern and why (that file's own beforeEach used to hang
 * forever on a hardcoded, never-seeded account and a deprecated Playwright
 * API; this file had the identical bug, just against a different page).
 *
 * Every test below was rewritten against the REAL current app, verified by
 * reading the actual source, not by guessing selectors:
 * - The old target route, /my-business, is deprecated and 308-redirects to
 *   /business (lib/route-redirects.ts) — but /business is the Business-OS
 *   HUB page (a workflow overview, <h1>Your business, as one workflow</h1>),
 *   not a dashboard. The real successor to what this file originally tested
 *   is /business/profile, which explicitly says in its own header comment
 *   it "renders the existing MyBusinessDashboard — the same component the
 *   deprecated /my-business page used, now living inside the canonical
 *   /business namespace" (app/business/profile/page.tsx).
 * - components/my-business/MyBusinessDashboard.tsx has no
 *   data-testid="my-business-dashboard" (or any data-testid at all) —
 *   it's plain Tailwind utility classes. Real, stable anchors used below:
 *   the <h1>My Business</h1> heading, the "Profile Completeness" label,
 *   and each section's real title rendered as an <h3> inside a toggle
 *   <button> (e.g. "Business Identity", "Direction & Vision") — all 10
 *   section buttons render regardless of fill state, since
 *   assembleMyBusiness() always returns the full field shape per section
 *   (Object.keys() on it is never 0, even when every value is undefined).
 * - GET /api/my-business/summary's real shape (packages/engine/src/my-business.ts):
 *   `myBusiness.identity.name` / `myBusiness.identity.industry` (not
 *   top-level companyName/industry), and `completeness.percent` (not
 *   `.percentage`).
 * - POST /api/auth/logout is POST-only (no GET handler at all) — a
 *   page.goto() there fails outright; use page.request.post() instead,
 *   the same way helpers.ts's loginViaAPI does for login.
 */

let email: string;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const setupContext = await browser.newContext();
  const setupPage: Page = await setupContext.newPage();
  try {
    email = await registerNewAccount(setupPage, uid("e2e-my-business"));
  } finally {
    await setupContext.close();
  }
});

test.afterAll(async () => {
  await cleanupAccount(email);
});

test.describe("My Business Page", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, email);
  });

  test("displays My Business page when authenticated", async ({ page }) => {
    await page.goto("/business/profile");

    await expect(page.getByRole("heading", { name: "My Business", exact: true })).toBeVisible({ timeout: 5000 });
  });

  test("loads business data from database", async ({ page }) => {
    await page.goto("/business/profile");

    // The dashboard fetches GET /api/my-business/summary client-side; the
    // real "loaded" signal is the completeness label it renders once state
    // moves past "loading" (see MyBusinessDashboard.tsx).
    await expect(page.getByText("Profile Completeness")).toBeVisible({ timeout: 5000 });
  });

  test("displays profile completeness indicator", async ({ page }) => {
    await page.goto("/business/profile");

    // The real bar (MyBusinessDashboard.tsx) is a plain styled div, no
    // role="progressbar"/aria-label (that combination exists on a DIFFERENT
    // page's own summary widget — app/business/page.tsx — not this one).
    // The one stable signal here is the percent figure text next to the
    // "Profile Completeness" label, e.g. "0%".
    await expect(page.getByText(/^\d+%$/)).toBeVisible({ timeout: 5000 });
  });

  test("sections are organized logically", async ({ page }) => {
    await page.goto("/business/profile");

    // Real section titles (MyBusinessDashboard.tsx's SECTIONS array) render
    // as toggle-button headings, all 10 present regardless of fill state.
    const sections = page.getByRole("heading", { level: 3, name: /Business Identity|Direction & Vision|Your Customer|Strategy|Your Offer|Current Numbers|Your Message|Brand Position|Transformation Story|Next 90 Days/ });
    await expect(sections.first()).toBeVisible({ timeout: 5000 });
    expect(await sections.count()).toBeGreaterThan(0);
  });

  test("displays empty state when no data filled in", async ({ page }) => {
    await page.goto("/business/profile");

    // A freshly registered account has filled every field 0 — the real
    // empty-state copy, not just "some text exists on the page".
    await expect(page.getByText("Complete the programme lessons to build your My Business profile.")).toBeVisible({ timeout: 5000 });
  });

  test("data persists after page refresh", async ({ page }) => {
    await page.goto("/business/profile");
    await expect(page.getByRole("heading", { name: "My Business", exact: true })).toBeVisible({ timeout: 5000 });

    // Comparing the whole body's textContent is unreliable here: it also
    // picks up each render's own React/RSC hydration payload (a fresh,
    // legitimately-different script blob every load), which has nothing to
    // do with whether the actual business data persisted. Compare the one
    // real data-bearing figure instead — the completeness percentage.
    const initialPercent = await page.getByText(/^\d+%$/).first().textContent();

    await page.reload();
    await expect(page.getByRole("heading", { name: "My Business", exact: true })).toBeVisible({ timeout: 5000 });

    const newPercent = await page.getByText(/^\d+%$/).first().textContent();
    expect(initialPercent).toBe(newPercent);
  });

  test("API returns correct response structure", async ({ page }) => {
    const responsePromise = page.waitForResponse((r) => r.url().includes("/api/my-business/summary"));
    await page.goto("/business/profile");
    const response = await responsePromise;
    const apiResponse = await response.json();

    expect(apiResponse).toHaveProperty("myBusiness");
    expect(apiResponse).toHaveProperty("completeness");
    expect(apiResponse).toHaveProperty("workspace");

    // Real shape (MyBusiness in packages/engine/src/my-business.ts): each
    // section is its own nested object (identity, direction, customer, ...),
    // not top-level companyName/industry. NOTE: for a freshly registered
    // account every leaf field is undefined, and JSON.stringify drops
    // undefined-valued keys entirely — so e.g. `identity` itself is present
    // but comes back as `{}`, with no "name"/"industry" keys to assert on
    // yet. Assert the section keys exist, not their (currently empty) insides.
    for (const section of ["identity", "direction", "customer", "strategy", "offer", "brand", "numbers", "message", "transformation", "next90"]) {
      expect(apiResponse.myBusiness).toHaveProperty(section);
    }

    // Real field is "percent", not "percentage" (MyBusinessCompleteness).
    expect(apiResponse.completeness).toHaveProperty("percent");
    expect(apiResponse.completeness).toHaveProperty("filled");
    expect(apiResponse.completeness).toHaveProperty("total");
  });

  test("shows error message on API failure", async ({ page }) => {
    await page.route("**/api/my-business/summary", (route) => {
      route.abort("failed");
    });

    await page.goto("/business/profile");

    // Real error copy from components/ui/Notice.tsx's error state in
    // app/business/profile/page.tsx — doesn't literally contain "error" or
    // "failed", so match the actual rendered text instead of guessing.
    await expect(page.getByText("Couldn't load your profile")).toBeVisible({ timeout: 5000 });
  });

  test("handles missing authentication gracefully", async ({ page }) => {
    // Logout is POST-only (no GET route at all) — page.goto() 500s outright.
    // It's also correctly NOT on proxy.ts's CSRF-exempt list (unlike
    // login/register, a session already exists here, so it should be
    // protected like any other authenticated mutation) — a bare POST with
    // no token just gets silently 403'd, logout never happens, and the
    // page below stays authenticated. Load a page first so the CSRF meta
    // tag + cookie exist, then send the same header the app's own global
    // fetch patch would (see components/SecurityInitializer.tsx).
    await page.goto("/business/profile");
    const csrfToken = await page.locator('meta[name="csrf-token"]').getAttribute("content");
    await page.request.post("/api/auth/logout", {
      headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
    });

    await page.goto("/business/profile");

    // The page's own client-side fetch sees 401 and renders a "Please sign
    // in" prompt in place (no server-side redirect) — see
    // app/business/profile/page.tsx's "not-authenticated" state.
    await expect(page.getByText("Please sign in")).toBeVisible({ timeout: 5000 });
  });
});
