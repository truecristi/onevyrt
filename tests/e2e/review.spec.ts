import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review slice: register -> open Review (honest empty state) ->
 * save a weekly review -> see it in the history with its text and a
 * scorecard snapshot, end to end through the real UI. The save exercises
 * the weekly-review upsert route (which freezes a scorecard snapshot
 * server-side).
 *
 * Weekly reviews are ordinary workspace-scoped records any member can
 * create, so the whole journey is browser-driven from a fresh account -
 * no seed.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-review-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, save a weekly review, and see it in the history with a scorecard snapshot", async ({
  page,
}) => {
  const email = `${unique("e2e-review")}@example.test`;
  const winsText = unique("Shipped the Review destination");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Review Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Review Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await expect(page.getByText("No weekly reviews yet")).toBeVisible();

  // Save this week's review (the date input defaults to today).
  await page.getByLabel("Wins").fill(winsText);
  await page.getByLabel("Challenges").fill("Keeping each slice focused.");
  await page.getByRole("button", { name: "Save weekly review" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // It appears in the history, with its text and the frozen scorecard.
  await expect(page.getByText(winsText)).toBeVisible();
  // exact:true - the page's intro paragraph also contains the phrase
  // "...your scorecard that week", so only the snapshot's own heading
  // should match here.
  await expect(page.getByText("Scorecard that week", { exact: true })).toBeVisible();
  // A fresh workspace's snapshot shows zero-of-zero goals/tasks.
  await expect(page.getByText("0/0 achieved")).toBeVisible();
});
