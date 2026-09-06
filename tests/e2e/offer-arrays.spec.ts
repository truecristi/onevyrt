import { test, expect } from "@playwright/test";

/**
 * Phase 9 Build depth slice: register -> create an offer -> open its detail
 * -> add a component, a bonus and an objection -> save -> reload and
 * confirm all three persisted, end to end through the real UI. This
 * exercises the whole-list-replacement array fields on updateOffer that the
 * offer edit form deliberately leaves alone.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-offerarrays-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, create an offer, and add components, bonuses and objections", async ({ page }) => {
  const email = `${unique("e2e-offerarrays")}@example.test`;
  const offerName = unique("E2E Arrays Offer");
  const componentName = unique("Weekly coaching call");
  const bonusName = unique("Private community access");
  const objectionText = unique("It is too expensive for me right now");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Arrays Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Arrays Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);

  await page.getByLabel("Offer name").fill(offerName);
  await page.getByRole("button", { name: "Create offer" }).click();

  const offerLink = page.getByRole("link", { name: offerName });
  await expect(offerLink).toBeVisible();
  await offerLink.click();
  await expect(page).toHaveURL(/\/build\/offers\/[^/]+$/);

  // Add one of each and fill the required field (the optional fields are
  // left blank to confirm the save tolerates them).
  await page.getByRole("button", { name: "Add component" }).click();
  await page.getByLabel("Component 1 name").fill(componentName);

  await page.getByRole("button", { name: "Add bonus" }).click();
  await page.getByLabel("Bonus 1 name").fill(bonusName);

  await page.getByRole("button", { name: "Add objection" }).click();
  await page.getByLabel("Objection 1", { exact: true }).fill(objectionText);

  await page.getByRole("button", { name: "Save components, bonuses & objections" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Reload from the server to prove the whole-list PATCH persisted.
  await page.reload();
  await expect(page.getByLabel("Component 1 name")).toHaveValue(componentName);
  await expect(page.getByLabel("Bonus 1 name")).toHaveValue(bonusName);
  await expect(page.getByLabel("Objection 1", { exact: true })).toHaveValue(objectionText);
});
