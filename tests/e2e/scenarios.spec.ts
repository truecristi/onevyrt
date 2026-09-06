import { test, expect } from "@playwright/test";

/**
 * Phase 9 Build depth slice: scenarios. Register -> add an assumption with a
 * baseline value -> create a scenario -> open it -> override that assumption
 * for the scenario -> see the resolved value change while the baseline
 * stays put -> confirm it persisted across a reload -> reset the override.
 * Exercises the full scenario-modeling chain against real assumption data.
 */

// Own rate-limit bucket for this spec's registration (a distinct
// x-forwarded-for per spec file keeps each file's registrations under the
// register endpoint's 5-per-IP limit - see auth.spec.ts).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-scenarios-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, add an assumption, and override it in a scenario", async ({ page }) => {
  const email = `${unique("e2e-scenarios")}@example.test`;
  const statement = unique("Reply rate");
  const scenarioName = unique("Aggressive growth");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Scenarios Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Scenarios Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Build -> Assumptions: add one with a baseline value.
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await page.getByRole("link", { name: "Assumptions" }).click();
  await expect(page).toHaveURL(/\/build\/assumptions$/);
  await page.getByLabel("Assumption", { exact: true }).fill(statement);
  await page.getByLabel("Value (optional)").fill("100");
  await page.getByLabel("Unit (optional)").fill("%");
  await page.getByRole("button", { name: "Add assumption" }).click();
  await expect(page.getByText(statement)).toBeVisible();

  // Build -> Scenarios: create one and open it.
  await page.getByRole("link", { name: "Build", exact: true }).click();
  await page.getByRole("link", { name: "Scenarios" }).click();
  await expect(page).toHaveURL(/\/build\/scenarios$/);
  await page.getByLabel("Name").fill(scenarioName);
  await page.getByLabel("Type").selectOption("best");
  await page.getByRole("button", { name: "Create scenario" }).click();
  await page.getByRole("link", { name: scenarioName }).click();
  await expect(page).toHaveURL(/\/build\/scenarios\/[^/]+$/);
  await expect(page.getByText(statement)).toBeVisible();

  // Override this assumption for the scenario; the resolved value changes.
  await page.getByLabel("Scenario value").fill("200");
  await page.getByRole("button", { name: "Override" }).click();
  await expect(page.getByText("200 %")).toBeVisible();
  await expect(page.getByText("overridden")).toBeVisible();

  // Persisted across a reload (the baseline 100 % is untouched).
  await page.reload();
  await expect(page.getByText("200 %")).toBeVisible();
  await expect(page.getByText("overridden")).toBeVisible();

  // Reset the override: it falls back to the baseline, badge gone.
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("overridden")).toHaveCount(0);
});
