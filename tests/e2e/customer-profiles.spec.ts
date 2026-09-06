import { test, expect } from "@playwright/test";

/**
 * Phase 9 Build depth slice: register -> open Build (honest empty state
 * for profiles) -> quick-create a customer profile -> see it listed ->
 * open its detail -> fill in the deeper positioning fields -> save ->
 * reload and confirm they persisted, end to end through the real UI.
 *
 * Customer profiles are ordinary workspace-scoped records any member can
 * create through the UI, so the whole journey is browser-driven from a
 * fresh account - no seed script needed.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-profiles-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, create a customer profile, flesh it out, and confirm it persisted", async ({
  page,
}) => {
  const email = `${unique("e2e-profiles")}@example.test`;
  const profileName = unique("Early-stage SaaS founders");
  const painPoints = unique("Launching offers that nobody buys");
  const desiredOutcome = unique("A repeatable path to paying customers");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Profiles Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Profiles Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Build", exact: true }).click();
  await expect(page).toHaveURL(/\/build$/);
  await expect(page.getByRole("heading", { name: "Build" })).toBeVisible();
  await expect(page.getByText("No customer profiles yet")).toBeVisible();

  // Quick-create a profile with just a name (the "Profile name" label is
  // unique on this page - the offer form uses "Offer name").
  await page.getByLabel("Profile name").fill(profileName);
  await page.getByRole("button", { name: "Create profile" }).click();

  const profileLink = page.getByRole("link", { name: profileName });
  await expect(profileLink).toBeVisible();
  await profileLink.click();
  await expect(page).toHaveURL(/\/build\/customers\/[^/]+$/);
  await expect(page.getByRole("heading", { name: profileName })).toBeVisible();

  // Flesh out the deeper positioning fields and save.
  await page.getByLabel("Pain points").fill(painPoints);
  await page.getByLabel("Desired outcome").fill(desiredOutcome);
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Reload from the server to prove the PATCH persisted, not just client
  // state: the freshly fetched form fields carry the saved values.
  await page.reload();
  await expect(page.getByLabel("Pain points")).toHaveValue(painPoints);
  await expect(page.getByLabel("Desired outcome")).toHaveValue(desiredOutcome);
});
