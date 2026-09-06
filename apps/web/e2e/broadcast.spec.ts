import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount, seedLead } from "./helpers";

/**
 * Smoke for the last leg of the "path to sell" the guided-path spec leaves out:
 * building an audience and sending a broadcast to it. The prerequisite — a
 * reachable contact — is seeded straight into Postgres (a qualified lead with an
 * email) rather than driven through the whole public-funnel submission, so the
 * spec stays deterministic and focused on the broadcast UI: pick a preset
 * audience → see it's reachable → compose → send → land on the confirmation.
 *
 * No email provider is configured in the test env, so nothing is actually
 * delivered — the server records the broadcast and the confirmation screen says
 * so. That's the honest, provider-free outcome we assert. Self-cleaning (own
 * uid() account; cleanupAccount also clears the seeded lead + broadcast rows).
 */
test.describe("broadcast", () => {
  test("build an email audience from a lead and send a broadcast", async ({ page }) => {
    const prefix = uid("e2e-cast");
    const email = `${prefix}@example.com`;
    const contactEmail = `${prefix}-lead@example.com`;
    try {
      await registerNewAccount(page, prefix);
      // Visit the inbox first so the personal workspace exists server-side,
      // then seed one reachable contact into it.
      await page.goto("/business/segments");
      await seedLead(email, contactEmail);
      await page.reload();

      // Build an audience from the "Email-reachable" preset.
      await page.getByRole("button", { name: "+ New segment" }).click();
      await page.getByRole("button", { name: /Email-reachable/i }).click();

      // The live preview counts the seeded lead, then "Message these people" enables.
      const messageBtn = page.getByRole("button", { name: /Message these people/i });
      await expect(messageBtn).toBeEnabled({ timeout: 10_000 });
      await messageBtn.click();

      // Composer opens on the email channel; write a subject + body and send.
      await expect(page.getByRole("heading", { name: /Message/i })).toBeVisible();
      await page.getByPlaceholder(/Quick question about your goals/i).fill("A quick note");
      await page.locator("textarea").first().fill("Hi {{firstName}}, testing the broadcast path.");

      // The review button carries the reachable count and enables once known.
      const reviewBtn = page.getByRole("button", { name: /Review .*send/i });
      await expect(reviewBtn).toBeEnabled({ timeout: 10_000 });
      await reviewBtn.click();

      // Mandatory pre-send review step (§ campaigns): a summary dialog appears,
      // and only its confirm button actually sends.
      await expect(page.getByRole("dialog", { name: /Review before sending/i })).toBeVisible();

      // Test-send goes to the sender; no provider, so it reports "logged".
      await page.getByRole("button", { name: "Send test to me" }).click();
      await expect(page.getByText(/Logged to .*no provider|Test sent to/i)).toBeVisible({ timeout: 10_000 });

      await page.getByRole("button", { name: /^Send to \d+/ }).click();

      // Confirmation screen — no provider configured, so it's recorded, not delivered.
      await expect(page.getByRole("heading", { name: /Message sent/i })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/No .* provider is configured/i)).toBeVisible();

      // Back to the list; the sent broadcast shows a delivery-rate summary and
      // can be duplicated into a fresh, pre-filled composer (§ campaigns).
      await page.getByRole("button", { name: "Done" }).click();
      await page.goto("/business/segments"); // clean list view with the sent broadcast
      await page.locator(".brow-btn").first().click(); // opens the delivery log
      const log = page.getByRole("dialog", { name: /Delivery log/ });
      await expect(log.getByText(/% delivered/)).toBeVisible();
      await log.getByRole("button", { name: /Duplicate/ }).click();
      // Composer reopens pre-filled with the original message.
      await expect(page.locator("textarea").first()).toHaveValue(/testing the broadcast path/);

      // The send is recorded on the contacted lead's activity timeline.
      await page.goto("/business/leads");
      await page.getByText("E2E Lead").first().click();
      await expect(page.getByRole("dialog", { name: "Lead details" }).getByText(/Included in broadcast/)).toBeVisible();
    } finally {
      await cleanupAccount(email);
    }
  });
});
