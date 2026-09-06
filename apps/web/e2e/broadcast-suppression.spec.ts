import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount, seedLead, seedOptOut } from "./helpers";

/**
 * Consent/suppression visibility (§ campaigns): before composing, the sender
 * should see not just who is reachable but who is excluded and why. Seed two
 * email contacts, unsubscribe one, and assert the composer shows the opted-out
 * contact as excluded rather than silently dropping it.
 */
test.describe("broadcast suppression visibility", () => {
  test("opted-out contacts are shown as excluded, not silently dropped", async ({ page }) => {
    const prefix = uid("e2e-supp");
    const email = `${prefix}@example.com`;
    const keep = `${prefix}-keep@example.com`;
    const gone = `${prefix}-gone@example.com`;
    try {
      await registerNewAccount(page, prefix);
      await page.goto("/business/segments");
      await seedLead(email, keep, "Keep Contact");
      await seedLead(email, gone, "Gone Contact");
      await seedOptOut(email, gone, "email");

      await page.goto("/business/segments");
      await page.getByRole("button", { name: "+ New segment" }).click();
      await page.getByRole("button", { name: /Email-reachable/i }).click();
      const messageBtn = page.getByRole("button", { name: /Message these people/i });
      await expect(messageBtn).toBeEnabled({ timeout: 10_000 });
      await messageBtn.click();

      // The reach indicator names the excluded opt-out rather than hiding it.
      await expect(page.locator(".reach")).toContainText(/opted out excluded/i, { timeout: 10_000 });
    } finally {
      await cleanupAccount(email);
    }
  });
});
