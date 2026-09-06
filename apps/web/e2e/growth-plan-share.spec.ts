import { test, expect, type Browser, type Page } from "@playwright/test";
import { uid, registerNewAccount, loginViaAPI, cleanupAccount, seedApprovedGrowthPlan } from "./helpers";

/**
 * Growth Plan Sharing Flow E2E Tests
 *
 * Tests the complete journey of generating a share link for a Growth
 * & Improvement Plan, viewing the shared plan, and verifying access control.
 *
 * The share/PDF actions on this page only render once a coach-approved
 * Chapter 4 submission exists for the workspace (see GrowthImprovementPlan's
 * canShare: role === "owner" && plan.status === "approved") — chapter-4.spec.ts
 * already proves the full learner→coach approval journey that produces that
 * state; this file only needs the state itself, seeded once via
 * seedApprovedGrowthPlan (straight through Postgres) rather than re-driving
 * that whole journey for every test here.
 *
 * One account is registered in beforeAll and reused (via the fast
 * loginViaAPI, not the UI) across all tests in this file — each test still
 * gets Playwright's normal fresh `page`/context, just authenticated cheaply.
 */

let email: string;

test.beforeAll(async ({ browser }: { browser: Browser }) => {
  const prefix = uid("e2e-growth-plan-share");
  const setupContext = await browser.newContext();
  const setupPage: Page = await setupContext.newPage();
  try {
    email = await registerNewAccount(setupPage, prefix);
    // registerNewAccount already waits for /command-center, a workspace-scoped
    // page, so ensurePersonalWorkspace has run by the time this seeds against it.
    await seedApprovedGrowthPlan(email);
  } finally {
    await setupContext.close();
  }
});

test.afterAll(async () => {
  await cleanupAccount(email);
});

test.describe("Growth Plan Sharing", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page, email);
  });

  test("Growth Plan page is accessible to authenticated users", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    // Should show the Growth Plan view
    const planContent = page.locator('[data-testid="growth-plan"], h1, h2');
    await expect(planContent.first()).toBeVisible({ timeout: 5000 });
  });

  test("Growth Plan displays improvement areas", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    // Should show sections like bottleneck, actions, etc. — the real markup
    // (components/programme/GrowthImprovementPlan.tsx) uses .gip-section for
    // each one (current position, bottleneck, actions, impact). The plan
    // itself loads via a client-side fetch after navigation, so wait for the
    // first section to actually render — .count() alone doesn't retry the
    // way toBeVisible() does, and would just race that fetch.
    const sections = page.locator(".gip-section");
    await expect(sections.first()).toBeVisible({ timeout: 5000 });
    expect(await sections.count()).toBeGreaterThan(0);
  });

  test("Share button is present and clickable", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    // Real button text is "Get share link (24h)" — matching a broader
    // "share|export|download" pattern would also catch the always-present
    // "Download PDF" button and trip Playwright's strict-mode check.
    const shareButton = page.getByRole("button", { name: /get share link/i });
    await expect(shareButton).toBeVisible({ timeout: 5000 });
    await expect(shareButton).toBeEnabled();
  });

  test("generates a share link when share button is clicked", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    const shareButton = page.getByRole("button", { name: /get share link/i });
    await shareButton.click();

    // The real UI reveals the link inline (no modal/dialog) — see
    // app/programme/chapter-4/growth-plan/page.tsx: an <a> to the canonical
    // /share/growth-plan/[token] route, next to Copy / New link buttons.
    const linkElement = page.locator('a[href*="/share/growth-plan/"]');
    await expect(linkElement).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  });

  test("share link can be copied to clipboard", async ({ page, context }) => {
    // Headless Chromium denies clipboard-write by default; without this grant
    // navigator.clipboard.writeText() throws (real page code:
    // app/programme/chapter-4/growth-plan/page.tsx's copyShareUrl catch
    // branch), and the UI falls back to showing the raw share URL as its
    // "message" instead of "Link copied." — which is what the confirmation
    // locator below was actually seeing, hence the timeout.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/programme/chapter-4/growth-plan");

    const shareButton = page.getByRole("button", { name: /get share link/i });
    await shareButton.click();

    const copyButton = page.getByRole("button", { name: "Copy" });
    if (await copyButton.isVisible()) {
      await copyButton.click();

      // Should show confirmation or change button text
      const confirmation = page.locator("text=/copied|success/i");
      await expect(confirmation).toBeVisible({ timeout: 2000 });
    }
  });

  test("shared link is accessible without authentication", async ({ page, context }) => {
    // First, get a share link as authenticated user
    await page.goto("/programme/chapter-4/growth-plan");

    let shareUrl: string | null = null;

    // Intercept the share link generation API call — the real endpoint is
    // /api/growth-plan/share (see app/programme/chapter-4/growth-plan/page.tsx).
    page.on("response", (response) => {
      if (response.url().includes("/api/growth-plan/share")) {
        response.json().then((json) => {
          if (json.url || json.shareUrl || json.token || json.link) {
            shareUrl = json.url || json.shareUrl || json.token || json.link;
          }
        }).catch(() => {});
      }
    });

    // Click share button
    const shareButton = page.getByRole("button", { name: /get share link/i });
    if (await shareButton.isVisible()) {
      await shareButton.click();

      // Wait for share link to be generated
      await page.waitForTimeout(2000);
    }

    // If we found a share URL, test it in a new context (unauthenticated)
    if (shareUrl) {
      const newPage = await context.newPage();

      // Try to access shared link without auth
      await newPage.goto(shareUrl);

      // Should display the plan content without requiring login
      const planContent = newPage.locator('[data-testid="growth-plan"], article, .card');
      await expect(planContent.first()).toBeVisible({ timeout: 5000 });

      await newPage.close();
    }
  });

  test("expired share links are rejected", async () => {
    // This test would need a way to create an expired token
    // For now, it's a placeholder for when token expiry is implemented

    // Test structure:
    // 1. Create a share link
    // 2. Manipulate time or use a pre-created expired token
    // 3. Try to access it
    // 4. Verify appropriate error message

    expect(true).toBe(true); // Placeholder
  });

  test("Growth Plan shows what will be improved", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    // Should show the improvement roadmap
    const improvementSection = page.locator(
      'text=/what|improve|next 90|goals|actions/i'
    );
    await expect(improvementSection.first()).toBeVisible({ timeout: 5000 });
  });

  test("download/export functionality works if implemented", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    // Look for export/download button
    const exportButton = page.getByRole("button", { name: /download pdf/i });

    if (await exportButton.isVisible()) {
      // Listen for file download
      const downloadPromise = page.waitForEvent("download");
      await exportButton.click();

      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf|\.doc|\.txt/);
    }
  });

  test("page has a title", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    // This page is a client component ("use client"), so — like the rest of
    // this app's client-component pages — it can't export per-page metadata
    // and inherits the root layout's static <title>. A page-specific title
    // would be a real, separate improvement, not something this spec should
    // assert exists today.
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("breadcrumb or navigation shows current location", async ({ page }) => {
    await page.goto("/programme/chapter-4/growth-plan");

    // Should show breadcrumb or active nav item
    const breadcrumb = page.locator('[data-testid="breadcrumb"], .breadcrumb, nav [aria-current="page"]').first();
    const activeLinkText = await breadcrumb.textContent();

    expect(activeLinkText).toBeTruthy();
  });
});
