import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount } from "./helpers";

test.describe("landing and auth", () => {
  test("landing page renders for a signed-out visitor", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Turn a raw idea into a/ })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("register: a new account lands on the Command Centre, signed in", async ({ page }) => {
    const prefix = uid("e2e-register");
    const email = `${prefix}@example.com`;
    try {
      await registerNewAccount(page, prefix);
      await expect(page).toHaveURL(/\/command-center/);
      // The signed-in identity lives in the persistent nav's account menu.
      await page.getByRole("button", { name: "Account menu" }).click();
      await expect(page.getByText(email)).toBeVisible();
    } finally {
      await cleanupAccount(email);
    }
  });

  test("sign out returns to the public landing, signed out", async ({ page }) => {
    const prefix = uid("e2e-signout");
    const email = `${prefix}@example.com`;
    try {
      await registerNewAccount(page, prefix);
      await page.getByRole("button", { name: "Account menu" }).click();
      await page.getByRole("menuitem", { name: "Sign out" }).click();
      // Sign out lands on the public landing at "/", signed out: the banner's
      // Sign-in affordance is back and the account menu is gone.
      await expect(page.getByRole("banner").getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole("button", { name: "Account menu" })).toHaveCount(0);
    } finally {
      await cleanupAccount(email);
    }
  });
});
