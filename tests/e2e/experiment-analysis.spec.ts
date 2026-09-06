import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review depth slice: register -> open Review -> follow Experiment
 * analysis -> see the read-only aggregation. A fresh workspace has no
 * experiments or assumptions, so it shows the zeroed summary and honest
 * empty states; this proves the page renders and the domain aggregation
 * runs for a real account. (Populating it needs experiments/assumptions,
 * created via other slices/APIs, out of this spec's scope.)
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-expanalysis-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register and view experiment analysis (empty aggregation)", async ({ page }) => {
  const email = `${unique("e2e-expanalysis")}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Analysis Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Analysis Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("link", { name: "Experiment analysis" }).click();
  await expect(page).toHaveURL(/\/review\/experiment-analysis$/);
  await expect(
    page.getByRole("heading", { name: "Experiment analysis", exact: true }),
  ).toBeVisible();

  // Fresh workspace: zeroed summary + honest empty states.
  await expect(page.getByText("No experiments yet")).toBeVisible();
  await expect(page.getByText(/No decisions recorded yet/)).toBeVisible();
  await expect(page.getByText(/No assumptions yet/)).toBeVisible();
});
