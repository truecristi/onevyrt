import { test, expect } from "@playwright/test";

/**
 * Phase 9 Execute depth slice: register -> open Execute -> follow Projects
 * -> create a project -> move it active -> completed -> reload and confirm
 * it persisted, end to end through the real UI.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-projects-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, create a project, mark it completed, and confirm it persisted", async ({
  page,
}) => {
  const email = `${unique("e2e-projects")}@example.test`;
  const projectName = unique("Q3 launch");
  const descText = unique("Everything needed to ship the Q3 offer");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Projects Execute Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Projects Execute Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Execute", exact: true }).click();
  await expect(page).toHaveURL(/\/execute$/);
  await page.getByRole("link", { name: "Projects" }).click();
  await expect(page).toHaveURL(/\/execute\/projects$/);
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(page.getByText("No projects yet")).toBeVisible();

  await page.getByLabel("Project name").fill(projectName);
  await page.getByLabel("Description (optional)").fill(descText);
  await page.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByText(projectName)).toBeVisible();

  // Move it active -> completed. Wait for the server round-trip + refresh
  // (the status pill re-renders as "completed") before reloading, so the
  // reload can't race the in-flight PATCH.
  await page.getByLabel("Project status").selectOption("completed");
  await expect(page.getByText("completed", { exact: true })).toBeVisible();

  // Reload from the server to prove the status change and description persisted.
  await page.reload();
  await expect(page.getByLabel("Project status")).toHaveValue("completed");
  await expect(page.getByText(descText)).toBeVisible();
});
