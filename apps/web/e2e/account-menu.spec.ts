import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount } from "./helpers";

/**
 * The persistent AppNav (Command Centre + business hubs) must expose an
 * account / sign-out control — previously that lived only inside the Studio
 * shell, so a user who landed on /command-center had no visible way to sign
 * out. This proves the account menu shows the signed-in email and signs out.
 */
let currentEmail = "";

test.afterEach(async () => {
  if (currentEmail) { await cleanupAccount(currentEmail); currentEmail = ""; }
});

test("Command Centre nav has an account menu that shows the email and signs out", async ({ page }) => {
  const prefix = uid("e2e-acct");
  currentEmail = `${prefix}@example.com`;
  await registerNewAccount(page, prefix);

  await page.goto("/command-center");
  await page.waitForLoadState("networkidle");

  // Open the account menu from the persistent nav.
  const acctBtn = page.getByRole("button", { name: "Account menu" });
  await expect(acctBtn).toBeVisible();
  await acctBtn.click();

  // It shows who's signed in, and offers Sign out.
  await expect(page.getByText(currentEmail, { exact: false })).toBeVisible();
  const signOut = page.getByRole("menuitem", { name: "Sign out" });
  await expect(signOut).toBeVisible();

  await signOut.click();
  // Signed out → back to the public landing / sign-in (no account menu).
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
});
