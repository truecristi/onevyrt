import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review depth slice: register -> create a priced offer and mark it
 * active -> open Review -> follow "financial results" -> see that offer
 * reflected in the read-only financial dashboard (active-offer table and
 * value), end to end through the real UI. This proves the dashboard's
 * aggregation renders live workspace data, not placeholders.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-financials-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, activate a priced offer, and see it in the Review financial dashboard", async ({
  page,
}) => {
  const email = `${unique("e2e-financials")}@example.test`;
  const offerName = unique("E2E Financials Offer");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Financials Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Financials Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Create a $100 offer and mark it active (an offer only counts on the
  // dashboard once its status is active).
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
  await page.getByLabel("Offer name").fill(offerName);
  await page.getByLabel("Price (optional)").fill("100");
  await page.getByRole("button", { name: "Create offer" }).click();

  await page.getByRole("link", { name: offerName }).click();
  await expect(page).toHaveURL(/\/build\/offers\/[^/]+$/);
  await page.getByLabel("Status").selectOption("active");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Review -> financial results.
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("link", { name: "View financial results" }).click();
  await expect(page).toHaveURL(/\/review\/financials$/);
  await expect(page.getByRole("heading", { name: "Financial results" })).toBeVisible();

  // The active offer shows up in the active-offers table, and its value is
  // rendered as money.
  await expect(page.getByRole("cell", { name: offerName })).toBeVisible();
  await expect(page.getByText("Active offer value")).toBeVisible();
  await expect(page.getByText("$100.00").first()).toBeVisible();
});
