import { test, expect } from "@playwright/test";

/**
 * Phase 9 Today depth slice: business profile. Register -> Today ->
 * Business profile -> fill in the workspace's identity (name, industry,
 * stage, vision, mission) -> Save -> see the "Saved." confirmation ->
 * reload and confirm the edit form comes back pre-filled with the saved
 * values (the upsert persisted). One editable record per workspace, so the
 * journey is browser-driven from a fresh account - no seed.
 */

// Own rate-limit bucket for this spec's registration (a distinct
// x-forwarded-for per spec file keeps each file's registrations under the
// register endpoint's 5-per-IP limit - see auth.spec.ts).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-profile-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, edit the business profile, and confirm it persisted", async ({ page }) => {
  const email = `${unique("e2e-profile")}@example.test`;
  const businessName = unique("Acme Analytics");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Profile Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Profile Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Today -> Business profile.
  await page.getByRole("link", { name: "Business profile" }).click();
  await expect(page).toHaveURL(/\/today\/profile$/);
  await expect(page.getByRole("heading", { name: "Business profile", exact: true })).toBeVisible();

  // Fill it in and save.
  await page.getByLabel("Business name").fill(businessName);
  await page.getByLabel("Industry (optional)").fill("B2B SaaS");
  await page.getByLabel("Stage").selectOption("growing");
  await page.getByLabel("Vision (optional)").fill("Every team decides with evidence.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Reload: the upsert persisted and the form comes back pre-filled.
  await page.reload();
  await expect(page.getByLabel("Business name")).toHaveValue(businessName);
  await expect(page.getByLabel("Stage")).toHaveValue("growing");
  await expect(page.getByLabel("Industry (optional)")).toHaveValue("B2B SaaS");
});
