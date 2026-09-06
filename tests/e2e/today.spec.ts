import { test, expect } from "@playwright/test";

/**
 * Phase 9's second UI slice: the five-destination workspace shell and
 * the first real destination behind it (Today). A fresh workspace has
 * no goals/tasks/experiments/metrics yet, so this exercises the
 * honest-empty-state path (getRecommendations returning nothing) rather
 * than needing to seed data through the UI first - the seeded-data path
 * is already covered at the domain level (recommendation-isolation.test.ts).
 */

function uniqueEmail(): string {
  return `e2e-today-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
}

test("a fresh workspace's Today page shows real, empty scorecard stats and an honest empty state", async ({
  page,
}) => {
  const email = uniqueEmail();
  const workspaceName = "Fresh Workspace";

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: new RegExp(workspaceName) }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(page.getByText("0 / 0")).toHaveCount(2); // goals and tasks, both zero
  await expect(page.getByText("No recommendations yet")).toBeVisible();
});

test("Learn, Build, Execute and Review are real links that honestly say they aren't built yet", async ({
  page,
}) => {
  const email = uniqueEmail();

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Nav Test Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("link", { name: /Nav Test Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  for (const destination of ["Learn", "Build", "Execute", "Review"]) {
    await page.getByRole("link", { name: destination, exact: true }).click();
    // Each of these destination pages sits under a dynamic layout that
    // re-runs a real DB query (listWorkspacesForUser, for the
    // membership re-check) on every single navigation - there's no
    // static/cached page here, and next's client-side router updates
    // the URL before that server round trip resolves. Confirmed via two
    // real CI failures: the URL assertion alone passed (route changed)
    // while the text assertion still timed out at the default 5000ms,
    // consistently, on real CI hardware (never reproduced locally on
    // faster hardware) - so this needs real headroom for that DB round
    // trip under CI's shared, slower runners, not just a navigation
    // checkpoint. A longer timeout here is calibrating for genuine
    // per-navigation server latency, not masking a race.
    await expect(page).toHaveURL(new RegExp(`/${destination.toLowerCase()}$`), { timeout: 15_000 });
    await expect(page.getByText(`${destination} isn't built yet`)).toBeVisible({ timeout: 15_000 });
  }
});
