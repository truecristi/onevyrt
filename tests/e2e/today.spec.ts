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

test("Build, Execute and Review are real links that honestly say they aren't built yet; Learn has a real page", async ({
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

  // Learn got a real page this slice (tests/e2e/learn.spec.ts covers its
  // actual browse-enroll-learn loop) - just confirm it's a real page here,
  // not the shared "isn't built yet" placeholder the other three still
  // are. Not asserting on an empty catalog: curriculum content is
  // platform-wide, not workspace-scoped (curriculum-use-cases.ts), so
  // whether any programs are published is global state this test
  // shouldn't depend on - other specs (learn.spec.ts) publish one of
  // their own, and fullyParallel test order isn't guaranteed.
  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await expect(page).toHaveURL(/\/learn$/);
  await expect(page.getByRole("heading", { name: "Learn" })).toBeVisible();
  await expect(page.getByText("Learn isn't built yet")).not.toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  for (const destination of ["Build", "Execute", "Review"]) {
    await page.getByRole("link", { name: destination, exact: true }).click();
    // Wait for the route itself to change before asserting on the new
    // page's text - a real navigation checkpoint, not just relying on
    // the text assertion's own polling to notice the DOM changed.
    await expect(page).toHaveURL(new RegExp(`/${destination.toLowerCase()}$`));
    await expect(page.getByText(`${destination} isn't built yet`)).toBeVisible();
  }
});
