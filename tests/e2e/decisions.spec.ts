import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review depth slice: register -> open Review -> follow the decision
 * log -> record a decision -> move it proposed -> decided -> reload and
 * confirm it persisted with its stamped decided date, end to end through the
 * real UI. Marking it "decided" exercises the domain's decidedAt stamping.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-decisions-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, record a decision, mark it decided, and confirm it persisted", async ({ page }) => {
  const email = `${unique("e2e-decisions")}@example.test`;
  const decisionTitle = unique("Focus on the SMB segment first");
  const contextText = unique("Enterprise sales cycles are too long for our runway");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Decisions Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Decisions Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("link", { name: "Decision log" }).click();
  await expect(page).toHaveURL(/\/review\/decisions$/);
  await expect(page.getByRole("heading", { name: "Decision log" })).toBeVisible();
  await expect(page.getByText("No decisions yet")).toBeVisible();

  // Record a decision ("Decision" exact - the status <select> is labelled
  // "Decision status", a superstring of "Decision").
  await page.getByLabel("Decision", { exact: true }).fill(decisionTitle);
  await page.getByLabel("Context (optional)").fill(contextText);
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByText(decisionTitle)).toBeVisible();

  // Move it proposed -> decided (stamps decidedAt server-side).
  await page.getByLabel("Decision status").selectOption("decided");
  await expect(page.getByText(/^Decided /)).toBeVisible();

  // Reload from the server to prove the status change and context persisted.
  await page.reload();
  await expect(page.getByLabel("Decision status")).toHaveValue("decided");
  await expect(page.getByText(contextText)).toBeVisible();
});
