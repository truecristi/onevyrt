import { test, expect } from "@playwright/test";

/**
 * Phase 9 Execute depth slice: register -> open Execute (honest empty state
 * for experiments) -> start an experiment -> open its detail -> run it
 * (status -> running) -> complete it with a result and a decision -> reload
 * and confirm the whole loop persisted, end to end through the real UI. The
 * status transitions exercise the domain's automatic startedAt/endedAt
 * stamping.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-experiments-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, run an experiment through to a decision, and confirm it persisted", async ({
  page,
}) => {
  const email = `${unique("e2e-experiments")}@example.test`;
  const experimentName = unique("Cold-email subject-line test");
  const resultText = unique("Variant B lifted open rate by 22%");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Experiments Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Experiments Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Execute", exact: true }).click();
  await expect(page).toHaveURL(/\/execute$/);
  await expect(page.getByRole("heading", { name: "Execute" })).toBeVisible();
  await expect(page.getByText("No experiments yet")).toBeVisible();

  // Start the experiment (the "Experiment name" label is unique - the task
  // form uses its own labels).
  await page.getByLabel("Experiment name").fill(experimentName);
  await page.getByRole("button", { name: "Create experiment" }).click();

  const experimentLink = page.getByRole("link", { name: experimentName });
  await expect(experimentLink).toBeVisible();
  await experimentLink.click();
  await expect(page).toHaveURL(/\/execute\/experiments\/[^/]+$/);
  await expect(page.getByRole("heading", { name: experimentName })).toBeVisible();

  // Run it: planned -> running (stamps startedAt server-side).
  await page.getByLabel("Status").selectOption("running");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Complete it with a result and a decision (stamps endedAt server-side).
  await page.getByLabel("Status").selectOption("completed");
  await page.getByLabel("Result").fill(resultText);
  await page.getByLabel("Decision").selectOption("adopt");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  // Reload from the server to prove the whole loop persisted.
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("completed");
  await expect(page.getByLabel("Result")).toHaveValue(resultText);
  await expect(page.getByLabel("Decision")).toHaveValue("adopt");
});
