import { test, expect } from "@playwright/test";

/**
 * Phase 9 Build depth slice: assumptions. Register -> Build -> Assumptions
 * (honest empty state) -> add an assumption with a value and confidence ->
 * see it under "All assumptions" -> mark it validated -> confirm it
 * persisted across a reload. Assumptions are ordinary workspace-scoped
 * records any member can create, so the whole journey is browser-driven
 * from a fresh account - no seed.
 */

// Own rate-limit bucket for this spec's registration (a distinct
// x-forwarded-for per spec file keeps each file's registrations under the
// register endpoint's 5-per-IP limit - see auth.spec.ts).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-assumptions-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, add an assumption, and mark it validated", async ({ page }) => {
  const email = `${unique("e2e-assumptions")}@example.test`;
  const statement = unique("Cold email reply rate is 3%");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Assumptions Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Assumptions Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Build -> Assumptions (the "More" link on the Build page).
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
  await page.getByRole("link", { name: "Assumptions" }).click();
  await expect(page).toHaveURL(/\/build\/assumptions$/);
  await expect(page.getByRole("heading", { name: "Assumptions", exact: true })).toBeVisible();
  await expect(page.getByText("No assumptions yet")).toBeVisible();

  // Add one with a value, unit and confidence.
  await page.getByLabel("Assumption", { exact: true }).fill(statement);
  await page.getByLabel("Value (optional)").fill("3");
  await page.getByLabel("Unit (optional)").fill("%");
  await page.getByLabel("Confidence").selectOption("high");
  await page.getByRole("button", { name: "Add assumption" }).click();

  // It shows up, unvalidated by default.
  await expect(page.getByText(statement)).toBeVisible();
  await expect(page.getByText("unvalidated", { exact: true })).toBeVisible();

  // Mark it validated via the per-row status control.
  await page.getByLabel("Status").selectOption("validated");
  await expect(page.getByText("validated", { exact: true })).toBeVisible();

  // Persisted across a reload.
  await page.reload();
  await expect(page.getByText(statement)).toBeVisible();
  await expect(page.getByText("validated", { exact: true })).toBeVisible();
});
