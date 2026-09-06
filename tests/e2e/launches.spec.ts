import { test, expect } from "@playwright/test";

/**
 * Phase 9 Execute depth slice: register -> open Execute -> follow Launches
 * -> create a launch -> open its detail -> set status/date/notes and add a
 * completed checklist item -> save -> reload and confirm the whole launch
 * persisted, end to end through the real UI.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-launches-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, create and run a launch, and confirm it persisted", async ({ page }) => {
  const email = `${unique("e2e-launches")}@example.test`;
  const launchName = unique("Spring cohort launch");
  const notesText = unique("Coordinate email + social on the same morning");
  const checklistLabel = unique("Send announcement email");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Launches Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Launches Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Execute", exact: true }).click();
  await expect(page).toHaveURL(/\/execute$/);
  await page.getByRole("link", { name: "Launches" }).click();
  await expect(page).toHaveURL(/\/execute\/launches$/);
  await expect(page.getByRole("heading", { name: "Launches", exact: true })).toBeVisible();
  await expect(page.getByText("No launches yet")).toBeVisible();

  await page.getByLabel("Launch name").fill(launchName);
  await page.getByRole("button", { name: "Create launch" }).click();

  const launchLink = page.getByRole("link", { name: launchName });
  await expect(launchLink).toBeVisible();
  await launchLink.click();
  await expect(page).toHaveURL(/\/execute\/launches\/[^/]+$/);
  await expect(page.getByRole("heading", { name: launchName })).toBeVisible();

  // Flesh out the launch: status, date, notes, and one completed checklist item.
  await page.getByLabel("Status").selectOption("live");
  await page.getByLabel("Launch date").fill("2026-10-01");
  await page.getByLabel("Notes").fill(notesText);
  await page.getByRole("button", { name: "Add checklist item" }).click();
  await page.getByLabel("Checklist item 1 label").fill(checklistLabel);
  await page.getByLabel("Checklist item 1 done").check();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Reload from the server to prove the whole launch persisted.
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("live");
  await expect(page.getByLabel("Launch date")).toHaveValue("2026-10-01");
  await expect(page.getByLabel("Notes")).toHaveValue(notesText);
  await expect(page.getByLabel("Checklist item 1 label")).toHaveValue(checklistLabel);
  await expect(page.getByLabel("Checklist item 1 done")).toBeChecked();
});
