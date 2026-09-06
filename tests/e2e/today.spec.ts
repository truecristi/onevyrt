import { test, expect } from "@playwright/test";

/**
 * Phase 9's second UI slice: the five-destination workspace shell and
 * the first real destination behind it (Today). A fresh workspace has
 * no goals/tasks/experiments/metrics yet, so this exercises the
 * honest-empty-state path (getRecommendations returning nothing) rather
 * than needing to seed data through the UI first - the seeded-data path
 * is already covered at the domain level (recommendation-isolation.test.ts).
 */

// Own rate-limit bucket for this spec's registrations - see the note in
// auth.spec.ts (a distinct x-forwarded-for per spec file keeps each file's
// registrations under the register endpoint's 5-per-IP limit).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-today-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

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

test("all four other destinations - Learn, Build, Execute, Review - are real pages, no placeholders left", async ({
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

  // Every destination now has a real page - the shared "isn't built yet"
  // placeholder is gone entirely (its component was deleted). Each check
  // confirms the destination's own heading renders. Build/Execute/Review
  // also assert their workspace-scoped empty states (safe on a fresh
  // workspace); Learn's catalog is platform-wide global state, so there we
  // only assert the heading (other specs publish their own programs).
  const checks: { label: string; path: string; heading: string; emptyState?: string }[] = [
    { label: "Learn", path: "learn", heading: "Learn" },
    { label: "Build", path: "build", heading: "Build", emptyState: "No offers yet" },
    { label: "Execute", path: "execute", heading: "Execute", emptyState: "No tasks yet" },
    { label: "Review", path: "review", heading: "Review", emptyState: "No weekly reviews yet" },
  ];

  for (const check of checks) {
    await page.getByRole("link", { name: check.label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${check.path}$`));
    await expect(page.getByRole("heading", { name: check.heading })).toBeVisible();
    if (check.emptyState) {
      await expect(page.getByText(check.emptyState)).toBeVisible();
    }
    await page.goBack();
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);
  }
});
