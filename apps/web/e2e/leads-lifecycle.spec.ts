import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, seedLead, cleanupAccount } from "./helpers";

/**
 * Lead lifecycle stage (§322) — the mutable follow-up state layered over the
 * immutable funnel verdict. Proves the full round-trip: a fresh lead starts at
 * "new", the inbox can move it, and the new stage survives a reload (i.e. it
 * persisted through the PATCH endpoint, not just local state).
 */
test.describe("lead lifecycle", () => {
  test("moving a lead's stage in the inbox persists", async ({ page }) => {
    const prefix = uid("e2e-lifecycle");
    const email = `${prefix}@example.com`;
    try {
      await registerNewAccount(page, prefix);
      // Visiting the inbox once creates the personal workspace server-side, so
      // the seeded lead lands where the inbox will read it.
      await page.goto("/business/leads");
      await page.getByRole("heading", { name: "Leads Inbox" }).waitFor();
      await seedLead(email, `${prefix}-lead@example.com`, "Lifecycle Lead");

      await page.reload();
      const stage = page.getByLabel("Lead stage").first();
      await expect(stage).toBeVisible();
      await expect(stage).toHaveValue("new");

      await stage.selectOption("booked");
      await expect(page.getByText("Moved to Booked")).toBeVisible();

      // Reload — the stage must come back from the server, not local state.
      await page.reload();
      await expect(page.getByLabel("Lead stage").first()).toHaveValue("booked");
    } finally {
      await cleanupAccount(email);
    }
  });

  test("assignee, next action and due date persist from the lead drawer", async ({ page }) => {
    const prefix = uid("e2e-assign");
    const email = `${prefix}@example.com`;
    try {
      await registerNewAccount(page, prefix);
      await page.goto("/business/leads");
      await page.getByRole("heading", { name: "Leads Inbox" }).waitFor();
      await seedLead(email, `${prefix}-lead@example.com`, "Assign Lead");
      await page.reload();

      // Open the lead drawer.
      await page.getByText("Assign Lead").click();
      await expect(page.getByRole("dialog", { name: "Lead details" })).toBeVisible();

      // Assign to self (the only workspace member), set a next action and a due date.
      await page.getByLabel("Assignee").selectOption({ index: 1 });
      await expect(page.getByText("Lead assigned")).toBeVisible();
      await page.getByLabel("Next action").fill("Call to confirm budget");
      await page.getByLabel("Next action").blur();
      await expect(page.getByText("Next action saved")).toBeVisible();
      await page.getByLabel("Due date").fill("2099-01-15");
      await expect(page.getByText("Due date set")).toBeVisible();

      // Reload and reopen — all three must come back from the server.
      await page.reload();
      await page.getByText("Assign Lead").click();
      await expect(page.getByLabel("Next action")).toHaveValue("Call to confirm budget");
      await expect(page.getByLabel("Due date")).toHaveValue("2099-01-15");
      await expect(page.getByLabel("Assignee")).not.toHaveValue("");

      // Those edits are recorded on the lead's activity timeline.
      const dialog = page.getByRole("dialog", { name: "Lead details" });
      await expect(dialog.getByText("Activity")).toBeVisible();
      await expect(dialog.getByText(/Next action: Call to confirm budget/)).toBeVisible();
      await expect(dialog.getByText(/Assigned to/)).toBeVisible();
    } finally {
      await cleanupAccount(email);
    }
  });

  test("repeat submissions from the same contact are grouped, preserving each", async ({ page }) => {
    const prefix = uid("e2e-dupe");
    const email = `${prefix}@example.com`;
    const contact = `${prefix}-dupe@example.com`;
    try {
      await registerNewAccount(page, prefix);
      await page.goto("/business/leads");
      await page.getByRole("heading", { name: "Leads Inbox" }).waitFor();
      // Two submissions, same email → one person, two preserved leads.
      await seedLead(email, contact, "Repeat Contact");
      await seedLead(email, contact, "Repeat Contact");
      await page.reload();

      // The newest row shows the submission count; both leads still exist.
      await expect(page.getByText("2 submissions").first()).toBeVisible();

      // The drawer lists the other submission from the same contact.
      await page.getByText("Repeat Contact").first().click();
      await expect(page.getByRole("dialog", { name: "Lead details" })).toBeVisible();
      await expect(page.getByText(/Other submissions from this contact/)).toBeVisible();
    } finally {
      await cleanupAccount(email);
    }
  });
});
