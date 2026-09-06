import { test, expect } from "@playwright/test";

/**
 * Spec §46's first minimum critical journey: "Register, verify identity,
 * create a workspace and complete onboarding." Real domain-level coverage
 * already existed (packages/domain/src/auth-workspace-isolation.test.ts);
 * this is the actual browser-driven version tests/e2e/README.md said
 * would come "once apps/web has an actual register/login form to click
 * through" - Phase 9's first UI slice.
 */

// Give this spec its own rate-limit bucket. The register endpoint limits
// to 5 attempts per client identifier per 15 minutes, and the whole E2E
// suite drives many fresh registrations from one runner IP - enough,
// collectively, to trip that limit. getClientIdentifier keys the limiter
// on x-forwarded-for (which it trusts by design - apps/web/lib/client-ip.ts,
// ADR-0004), so a distinct value per spec file keeps each file's handful
// of registrations in its own bucket, well under the limit, without
// touching or weakening the real production limit.
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-auth-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
}

test("register, land on the dashboard, log out, then log back in", async ({ page }) => {
  const email = uniqueEmail();
  const password = "a-genuinely-long-password-123";
  const workspaceName = "E2E Test Workspace";

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Workspace name").fill(workspaceName);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText(workspaceName)).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();
});

test("rejects login with the wrong password", async ({ page }) => {
  const email = uniqueEmail();
  const password = "a-genuinely-long-password-123";

  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Workspace name").fill("Another Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("definitely-the-wrong-password");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("unauthenticated visitors are redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
