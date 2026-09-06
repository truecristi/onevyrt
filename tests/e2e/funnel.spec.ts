import { test, expect } from "@playwright/test";

/**
 * Phase 9 Build depth slice: register -> open Build -> follow Funnel ->
 * add two ordered stages (a top-of-funnel stage and one with a 25%
 * conversion rate) -> calculate requirements for a target at the final
 * stage -> see the deterministic backward walk (50 at the final stage
 * needs 200 at the top), end to end through the real UI.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-funnel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, build a funnel, and calculate its requirements", async ({ page }) => {
  const email = `${unique("e2e-funnel")}@example.test`;

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Funnel Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Funnel Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
  await page.getByRole("link", { name: "Funnel" }).click();
  await expect(page).toHaveURL(/\/build\/funnels$/);
  await expect(page.getByRole("heading", { name: "Funnel", exact: true })).toBeVisible();
  await expect(page.getByText("No funnel stages yet")).toBeVisible();

  // Stage 1: top of funnel, no conversion rate.
  await page.getByLabel("Stage name").fill("Visits");
  await page.getByLabel("Position").fill("0");
  await page.getByRole("button", { name: "Add stage" }).click();
  await expect(page.getByText("Top of funnel")).toBeVisible();

  // Stage 2: converts at 25% from the stage above.
  await page.getByLabel("Stage name").fill("Signups");
  await page.getByLabel("Position").fill("1");
  await page.getByLabel("Conversion rate (optional)").fill("0.25");
  await page.getByRole("button", { name: "Add stage" }).click();
  await expect(page.getByText("25% from the stage above")).toBeVisible();

  // Requirements: 50 at the final stage -> 200 at the top (50 / 0.25).
  await page.getByLabel("Target at final stage").fill("50");
  await page.getByRole("button", { name: "Calculate requirements" }).click();
  await expect(page.getByRole("cell", { name: "200" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "25%" })).toBeVisible();
});
