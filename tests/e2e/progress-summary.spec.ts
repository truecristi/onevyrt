import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review depth slice: register -> open Review -> follow Progress ->
 * see the progress summary. A fresh workspace has no past weekly-review
 * snapshot, so it shows current values with a "no comparison baseline yet"
 * note; the lookback selector still works. (A real trend needs weekly
 * reviews saved weeks apart, which can't be created within one E2E run.)
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-progress-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register and view the progress summary (no baseline yet)", async ({ page }) => {
  const email = `${unique("e2e-progress")}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Progress Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Progress Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("link", { name: "Progress" }).click();
  await expect(page).toHaveURL(/\/review\/progress$/);
  await expect(page.getByRole("heading", { name: "Progress", exact: true })).toBeVisible();

  // Fresh workspace: no baseline, current values shown.
  await expect(page.getByText(/No comparison baseline yet/)).toBeVisible();
  await expect(page.getByText("Goals achievement rate")).toBeVisible();
  await expect(page.getByText("Experiments completed")).toBeVisible();

  // The lookback selector re-queries (still no baseline for a fresh account).
  await page.getByRole("link", { name: "8 weeks ago" }).click();
  await expect(page).toHaveURL(/weeksBack=8/);
  await expect(page.getByText(/No comparison baseline yet/)).toBeVisible();
});
