import { test, expect } from "@playwright/test";

/**
 * Phase 9 Review depth slice: the AI coaching interface. Register -> Review
 * -> Coach -> ask a question -> get an answer back. With no ANTHROPIC_API_KEY
 * in this environment the route returns a labeled deterministic placeholder
 * answer (echoing the question) so the ask -> answer flow is exercisable end
 * to end at $0 - which is what this test keys on.
 */

// Own rate-limit bucket for this spec's registration (a distinct
// x-forwarded-for per spec file keeps each file's registrations under the
// register endpoint's 5-per-IP limit - see auth.spec.ts).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-coaching-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, ask the coach a question, and get an answer", async ({ page }) => {
  const email = `${unique("e2e-coaching")}@example.test`;
  const question = unique("What should I focus on next");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Coaching Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Coaching Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Review -> Coach.
  await page.getByRole("link", { name: "Review", exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);
  await page.getByRole("link", { name: "Coach" }).click();
  await expect(page).toHaveURL(/\/review\/coach$/);
  await expect(page.getByRole("heading", { name: "Coach", exact: true })).toBeVisible();

  // Ask a question and get an answer (a labeled placeholder, echoing it).
  await page.getByLabel("Ask the coach").fill(question);
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText("Answer", { exact: true })).toBeVisible();
  // The placeholder answer echoes the question; .first() since both the
  // answer paragraph and its container contain the text.
  await expect(page.getByText(question).first()).toBeVisible();
});
