import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount } from "./helpers";

/**
 * Smoke for the guided "path to sell": register → write the Message one-liner →
 * confirm it flows through into a new funnel's intro. Proves, in a real browser,
 * that the Launch Studio, the Message step, and the one-voice flow-through hang
 * together end-to-end. Self-cleaning like the other specs (own uid() account).
 *
 * Broadcast send is intentionally out of scope here — it needs reachable
 * contacts (a funnel submission with an email), which is its own data-seeded
 * spec; this smoke covers the Message→Build spine that everything else builds on.
 */
test.describe("guided path", () => {
  test("the Message one-liner flows into a new funnel's intro", async ({ page }) => {
    const prefix = uid("e2e-path");
    const email = `${prefix}@example.com`;
    const problem = "Most founders spend on ads before they know the funnel makes money";
    const solution = "OneVYRT maps and simulates the whole funnel first";
    const result = "you know exactly what to fix before you spend a dollar";
    try {
      await registerNewAccount(page, prefix);

      // Fill the Message one-liner and save.
      await page.goto("/business/message");
      await page.getByPlaceholder(/Most founders spend on ads/i).fill(problem);
      await page.getByPlaceholder(/maps and simulates the whole funnel/i).fill(solution);
      await page.getByPlaceholder(/exactly what to fix before you spend/i).fill(result);
      // The composed one-liner appears live in the hero (scope to it — the same
      // text also fills a textarea and an asset preview).
      await expect(page.locator(".ol-text").first()).toContainText(problem.slice(0, 30));
      await page.getByRole("button", { name: /Save message/i }).click();
      await expect(page.getByText(/Message saved/i)).toBeVisible({ timeout: 10_000 });

      // A new blank funnel opens with the saved one-liner as its intro.
      await page.goto("/business/funnels");
      await page.getByRole("button", { name: /New funnel/i }).click();
      await page.getByRole("button", { name: /Blank funnel/i }).click();
      // Intro is the first (and only) textarea in the editor Basics card.
      const intro = page.locator("textarea").first();
      await expect(intro).toHaveValue(new RegExp(problem.slice(0, 30)), { timeout: 10_000 });
    } finally {
      await cleanupAccount(email);
    }
  });
});
