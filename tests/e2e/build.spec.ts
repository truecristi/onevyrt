import { test, expect } from "@playwright/test";

/**
 * Phase 9 Build slice: register -> open Build (honest empty state) ->
 * create an offer -> see it listed -> open its detail -> edit it ->
 * run the deterministic unit-economics calculation -> see the LTV:CAC
 * ratio with its formula provenance, end to end through the real UI.
 *
 * Unlike learn.spec.ts, nothing here needs a platform-admin seed script:
 * offers are ordinary workspace-scoped records any member can create
 * through the UI, so the whole journey is browser-driven from a fresh
 * account.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-build-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, create an offer, edit it, and calculate its unit economics", async ({ page }) => {
  const email = `${unique("e2e-build")}@example.test`;
  const offerName = unique("E2E Build Offer");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Build Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Build Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByRole("heading", { name: "Build" })).toBeVisible();
  await expect(page.getByText("No offers yet")).toBeVisible();

  // Quick-create an offer with a price so unit economics is available.
  await page.getByLabel("Offer name").fill(offerName);
  await page.getByLabel("Price (optional)").fill("100");
  await page.getByRole("button", { name: "Create offer" }).click();

  const offerLink = page.getByRole("link", { name: offerName });
  await expect(offerLink).toBeVisible();
  await offerLink.click();
  await expect(page).toHaveURL(/\/build\/offers\/[^/]+$/);

  // Edit: flip the offer to Active and confirm it saves.
  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Deterministic unit-economics calculation over the offer's price.
  await page.getByLabel("Cost per unit ($)").fill("20");
  await page.getByLabel("Acquisition spend ($)").fill("1000");
  await page.getByLabel("Customers acquired").fill("10");
  await page.getByLabel("Average order value ($)").fill("100");
  await page.getByLabel("Purchases / year").fill("2");
  await page.getByLabel("Customer lifespan (years)").fill("3");
  await page.getByRole("button", { name: "Calculate unit economics" }).click();

  // The report renders every metric with its formula-provenance envelope.
  await expect(page.getByRole("cell", { name: "LTV : CAC ratio" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Customer lifetime value (LTV)" })).toBeVisible();
});
