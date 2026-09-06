import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, seedFunnel, cleanupAccount } from "./helpers";

/**
 * The public funnel's paid step (§56). A qualified visitor on a payable funnel
 * is offered a Pay CTA that starts a destination charge. With no Stripe key in
 * the test env the server declines honestly ("Payments aren't configured…"),
 * which is exactly what we assert — it proves the whole client wiring
 * (qualify → Pay CTA → /pay call → honest error surfaced) without needing live
 * Stripe credentials or a connected account.
 */
test.describe("funnel paid step", () => {
  test("a qualified visitor is offered a Pay CTA, and the server declines honestly with no provider", async ({ page }) => {
    const prefix = uid("e2e-pay");
    const email = `${prefix}@example.com`;
    const slug = `paytest-${uid("f").replace(/_/g, "-")}`.toLowerCase().slice(0, 40);
    try {
      await registerNewAccount(page, prefix);
      // Create the personal workspace (the funnel needs an owner).
      await page.goto("/business/leads");
      await page.getByRole("heading", { name: "Leads Inbox" }).waitFor();

      await seedFunnel(email, {
        slug, title: "Paid step test",
        questions: [{ id: "ready", prompt: "Ready to start?", kind: "single", required: true, options: [
          { value: "yes", label: "Yes, let's go", points: 10 },
          { value: "no", label: "Not yet", points: 0 },
        ] }],
        thresholds: { qualified: 1, nurture: 0 },
        payment: { enabled: true, priceCents: 5000, currency: "usd", label: "Reserve your spot" },
        outcomes: {
          qualified: { heading: "You're in", body: "Reserve your spot below.", ctaLabel: "Book a call", ctaHref: "#" },
          nurture: { heading: "Almost", body: "…", ctaLabel: "Learn more", ctaHref: "#" },
          unqualified: { heading: "Thanks", body: "…", ctaLabel: "OK", ctaHref: "#" },
        },
      });

      await page.goto(`/q/${slug}`);
      await page.getByRole("button", { name: /Start/ }).click();
      await page.getByRole("radio", { name: "Yes, let's go" }).click();
      await page.getByRole("button", { name: "See my result →" }).click();

      // Qualified → the payable funnel shows the Pay CTA instead of the plain CTA.
      await expect(page.getByRole("heading", { name: "You're in" })).toBeVisible();
      const payCta = page.getByRole("button", { name: "Reserve your spot" });
      await expect(payCta).toBeVisible();
      await payCta.click();

      // No Stripe key in test env → the server declines honestly and the pay
      // step surfaces that as an alert rather than a broken form.
      await expect(page.getByText(/Payments aren.t configured|Payments are missing|hasn.t connected a payout/i)).toBeVisible({ timeout: 10_000 });
    } finally {
      await cleanupAccount(email);
    }
  });
});
