import { test, expect } from "@playwright/test";

/**
 * Phase 9 Today depth slice: goals. Register -> Today -> Manage goals
 * (honest empty state) -> set a goal with a target date -> see it active ->
 * mark it achieved -> confirm it persisted across a reload -> back on Today,
 * the scorecard's "Goals achieved" now counts it. Goals are ordinary
 * workspace-scoped records, so the whole journey is browser-driven from a
 * fresh account - no seed.
 */

// Own rate-limit bucket for this spec's registration (a distinct
// x-forwarded-for per spec file keeps each file's registrations under the
// register endpoint's 5-per-IP limit - see auth.spec.ts).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-goals-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, set a goal, mark it achieved, and see it in the scorecard", async ({ page }) => {
  const email = `${unique("e2e-goals")}@example.test`;
  const goalTitle = unique("Reach $10k MRR");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Goals Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Goals Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Today -> Manage goals.
  await page.getByRole("link", { name: "Manage goals" }).click();
  await expect(page).toHaveURL(/\/today\/goals$/);
  await expect(page.getByRole("heading", { name: "Goals", exact: true })).toBeVisible();
  await expect(page.getByText("No goals yet")).toBeVisible();

  // Set a goal with a target date.
  await page.getByLabel("Goal", { exact: true }).fill(goalTitle);
  await page.getByLabel("Target date (optional)").fill("2030-06-30");
  await page.getByRole("button", { name: "Set goal" }).click();

  // Shows up, active by default.
  await expect(page.getByText(goalTitle)).toBeVisible();
  await expect(page.getByText("active", { exact: true })).toBeVisible();

  // Mark it achieved via the per-row status control.
  await page.getByLabel("Status").selectOption("achieved");
  await expect(page.getByText("achieved", { exact: true })).toBeVisible();

  // Persisted across a reload.
  await page.reload();
  await expect(page.getByText(goalTitle)).toBeVisible();
  await expect(page.getByText("achieved", { exact: true })).toBeVisible();

  // Back on Today, the scorecard's "Goals achieved" now counts it.
  await page.getByRole("link", { name: /Today/ }).first().click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText("Goals achieved")).toBeVisible();
  await expect(page.getByText("1 / 1")).toBeVisible();
});
