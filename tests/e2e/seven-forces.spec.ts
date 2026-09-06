import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review depth slice: register -> open Review -> follow Seven Forces
 * -> assess one force (a low score against a higher target) -> see it become
 * the binding constraint in the diagnosis -> reload and confirm it
 * persisted, end to end through the real UI.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-forces-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, assess a force, and see the binding constraint", async ({ page }) => {
  const email = `${unique("e2e-forces")}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Forces Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Forces Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("link", { name: "Seven Forces" }).click();
  await expect(page).toHaveURL(/\/review\/forces$/);
  await expect(page.getByRole("heading", { name: "Seven Forces", exact: true })).toBeVisible();
  await expect(page.getByText("No binding constraint identified yet")).toBeVisible();

  // Assess sales & marketing low against a higher target.
  await page.getByLabel("Force").selectOption("sales_marketing");
  await page.getByLabel("Score (0-100)").fill("30");
  await page.getByLabel("Target (optional)").fill("80");
  await page.getByRole("button", { name: "Save assessment" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // It becomes the binding constraint, and the assessed row shows its target.
  await expect(page.getByText("Binding constraint", { exact: true })).toBeVisible();
  await expect(page.getByText(/target 80/)).toBeVisible();

  // Reload from the server to prove the assessment persisted.
  await page.reload();
  await expect(page.getByText("Binding constraint", { exact: true })).toBeVisible();
  await expect(page.getByText(/target 80/)).toBeVisible();
});
