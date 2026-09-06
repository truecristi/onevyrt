import { test, expect } from "@playwright/test";

/**
 * Phase 9 Execute depth slice: AI task proposals. Register -> Execute ->
 * AI task proposals (honest empty state) -> ask for a proposal -> review
 * the pending suggestion -> accept it -> see it flip to "accepted" and
 * persist across a reload -> confirm accepting created a real task back on
 * Execute.
 *
 * With no ANTHROPIC_API_KEY in this environment the propose route falls
 * back to a labeled deterministic placeholder built from the instruction
 * (see the route's resolveProposalProvider), so the whole propose ->
 * accept flow is exercisable end to end at $0 - the proposed task's title
 * is the instruction itself, which is what these assertions key on.
 */

// Own rate-limit bucket for this spec's registration - a distinct
// x-forwarded-for per spec file keeps each file's registrations under the
// register endpoint's 5-per-IP limit (see auth.spec.ts).
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-task-proposals-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, propose an AI task, accept it, and see the created task", async ({ page }) => {
  const email = `${unique("e2e-proposals")}@example.test`;
  const instruction = unique("Draft this quarter's pricing experiment");

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Proposals Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Proposals Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  // Execute -> AI task proposals (the "More" link on the Execute page).
  await page.getByRole("link", { name: "Execute", exact: true }).click();
  await expect(page).toHaveURL(/\/execute$/);
  await page.getByRole("link", { name: /AI task proposals/ }).click();
  await expect(page).toHaveURL(/\/execute\/task-proposals$/);
  await expect(page.getByRole("heading", { name: "AI task proposals" })).toBeVisible();
  await expect(page.getByText("No proposals yet")).toBeVisible();

  // Ask for a proposal.
  await page.getByLabel("Instruction").fill(instruction);
  await page.getByRole("button", { name: "Propose a task" }).click();

  // A pending proposal appears, titled with the instruction, with controls.
  await expect(page.getByText(instruction)).toBeVisible();
  await expect(page.getByText("pending", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toBeVisible();

  // Accept it: the proposal flips to "accepted" and the controls go away.
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("accepted", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Accept" })).toHaveCount(0);

  // Persisted across a reload.
  await page.reload();
  await expect(page.getByText(instruction)).toBeVisible();
  await expect(page.getByText("accepted", { exact: true })).toBeVisible();

  // Accepting created a real task - it shows up back on Execute.
  await page
    .getByRole("link", { name: /Execute/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/execute$/);
  await expect(page.getByText(instruction)).toBeVisible();
});
