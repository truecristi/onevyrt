import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, seedFunnel, seedLeadWithAnswers, cleanupAccount } from "./helpers";

/**
 * Score reason (§ leads): the drawer should explain a lead's score, not just
 * show the number. Seed a funnel whose "yes" option is worth points and a lead
 * who chose it, then assert the drawer breaks the score down to that rule.
 */
test.describe("lead score reason", () => {
  test("the drawer explains which answers drove the score", async ({ page }) => {
    const prefix = uid("e2e-score");
    const email = `${prefix}@example.com`;
    const slug = `scoretest-${uid("f").replace(/_/g, "-")}`.toLowerCase().slice(0, 40);
    try {
      await registerNewAccount(page, prefix);
      await page.goto("/business/leads");
      await page.getByRole("heading", { name: "Leads Inbox" }).waitFor();

      await seedFunnel(email, {
        slug, title: "Score test",
        questions: [{ id: "ready", prompt: "Ready to start?", kind: "single", required: true, options: [
          { value: "yes", label: "Yes", points: 40 },
          { value: "no", label: "No", points: 0 },
        ] }],
        thresholds: { qualified: 1, nurture: 0 },
        outcomes: {
          qualified: { heading: "In", body: "b", ctaLabel: "c", ctaHref: "#" },
          nurture: { heading: "Almost", body: "b", ctaLabel: "c", ctaHref: "#" },
          unqualified: { heading: "Thanks", body: "b", ctaLabel: "c", ctaHref: "#" },
        },
      });
      await seedLeadWithAnswers(email, { slug, email: `${prefix}-lead@example.com`, name: "Scored Lead", score: 40, answers: { ready: "yes" } });
      await page.reload();

      await page.getByText("Scored Lead").click();
      const dialog = page.getByRole("dialog", { name: "Lead details" });
      await expect(dialog.getByText(/Why this score/)).toBeVisible();
      await expect(dialog.getByText("Ready to start?").first()).toBeVisible();
      await expect(dialog.getByText("+40")).toBeVisible();
    } finally {
      await cleanupAccount(email);
    }
  });
});
