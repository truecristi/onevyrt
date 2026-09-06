import { test, expect } from "@playwright/test";

/**
 * Phase 9 Execute slice: register -> open Execute (honest empty state) ->
 * create a task -> see it under "Open" -> move it to "In progress" ->
 * move it to "Done", end to end through the real UI. The status changes
 * exercise the dedicated PATCH route (which sets/clears completedAt
 * server-side) and the status-grouped rendering.
 *
 * Tasks are ordinary workspace-scoped records any member can create, so
 * the whole journey is browser-driven from a fresh account - no seed.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-execute-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, create a task, and move it Open -> In progress -> Done", async ({ page }) => {
  const email = `${unique("e2e-execute")}@example.test`;
  const taskTitle = unique("E2E Execute Task");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Execute Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Execute Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Execute", exact: true }).click();
  await expect(page).toHaveURL(/\/execute$/);
  await expect(page.getByRole("heading", { name: "Execute" })).toBeVisible();
  await expect(page.getByText("No tasks yet")).toBeVisible();

  // Create a task (with a due date to exercise the date -> ISO path).
  await page.getByLabel("Task title").fill(taskTitle);
  await page.getByLabel("Priority").selectOption("high");
  await page.getByLabel("Due date (optional)").fill("2030-01-15");
  await page.getByRole("button", { name: "Create task" }).click();

  // Lands under the "Open" group.
  await expect(page.getByRole("heading", { name: /^Open \(1\)/ })).toBeVisible();
  await expect(page.getByText(taskTitle)).toBeVisible();

  // Move it through the workflow via the per-row status control.
  await page.getByLabel("Status").selectOption("in_progress");
  await expect(page.getByRole("heading", { name: /^In progress \(1\)/ })).toBeVisible();

  await page.getByLabel("Status").selectOption("done");
  await expect(page.getByRole("heading", { name: /^Done \(1\)/ })).toBeVisible();
  await expect(page.getByText(taskTitle)).toBeVisible();
});
