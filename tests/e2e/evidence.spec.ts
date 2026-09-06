import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review depth slice: register -> open Review -> follow Evidence ->
 * record a piece of evidence with a strength -> reload and confirm it
 * persisted, end to end through the real UI.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-evidence-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, record a piece of evidence, and confirm it persisted", async ({ page }) => {
  const email = `${unique("e2e-evidence")}@example.test`;
  const evidenceTitle = unique("12 of 20 interviews named pricing as the blocker");
  const descText = unique("Pattern held across both segments");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Evidence Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Evidence Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("link", { name: "Evidence" }).click();
  await expect(page).toHaveURL(/\/review\/evidence$/);
  await expect(page.getByRole("heading", { name: "Evidence", exact: true })).toBeVisible();
  await expect(page.getByText("No evidence yet")).toBeVisible();

  await page.getByLabel("Title").fill(evidenceTitle);
  await page.getByLabel("Description (optional)").fill(descText);
  await page.getByLabel("Source URL (optional)").fill("https://example.test/interviews");
  await page.getByLabel("Strength").selectOption("strong");
  await page.getByRole("button", { name: "Record evidence" }).click();
  await expect(page.getByText(evidenceTitle)).toBeVisible();

  // Reload from the server to prove it persisted, with its strength.
  await page.reload();
  await expect(page.getByText(evidenceTitle)).toBeVisible();
  await expect(page.getByText("strong", { exact: true })).toBeVisible();
});
