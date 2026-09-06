import { test, expect } from "@playwright/test";

/**
 * Phase 9 Today depth slice: business metrics. Register -> Today -> Track
 * metrics (honest empty state) -> define a metric with a target -> log a
 * current value that reaches the target -> see the "target reached" badge ->
 * confirm it persisted across a reload. Metrics are ordinary
 * workspace-scoped records, so the journey is browser-driven from a fresh
 * account - no seed.
 */

// Own rate-limit bucket for this spec's registration (a distinct
// x-forwarded-for per spec file keeps each file's registrations under the
// register endpoint's 5-per-IP limit - see auth.spec.ts).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-metrics-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, track a metric, and log a value that reaches its target", async ({ page }) => {
  const email = `${unique("e2e-metrics")}@example.test`;
  const metricName = unique("Monthly recurring revenue");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Metrics Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Metrics Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Today -> Track metrics.
  await page.getByRole("link", { name: "Track metrics" }).click();
  await expect(page).toHaveURL(/\/today\/metrics$/);
  await expect(page.getByRole("heading", { name: "Metrics", exact: true })).toBeVisible();
  await expect(page.getByText("No metrics yet")).toBeVisible();

  // Define a metric with a target above the starting current value.
  await page.getByLabel("Metric", { exact: true }).fill(metricName);
  await page.getByLabel("Unit (optional)").fill("$");
  await page.getByLabel("Current (optional)").fill("100");
  await page.getByLabel("Target (optional)").fill("1000");
  await page.getByRole("button", { name: "Track metric" }).click();

  // Shows up; target not reached yet (100 < 1000).
  await expect(page.getByText(metricName)).toBeVisible();
  await expect(page.getByText("target reached")).toHaveCount(0);

  // Log a current value that reaches the target.
  await page.getByLabel("Current value").fill("1200");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("target reached")).toBeVisible();

  // Persisted across a reload.
  await page.reload();
  await expect(page.getByText(metricName)).toBeVisible();
  await expect(page.getByText("target reached")).toBeVisible();
});
