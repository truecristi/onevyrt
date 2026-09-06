import { execFileSync } from "node:child_process";
import { test, expect } from "@playwright/test";

/**
 * Phase 9 Learn slice: register -> browse -> enroll -> resume a lesson ->
 * answer a knowledge check -> submit a reflection -> mark complete, end
 * to end through the real UI.
 *
 * Seeding a published program+lesson happens in a separate `tsx` process
 * (tests/e2e/fixtures/seed-learn-content.ts) rather than importing
 * @onevyrt/domain directly into this file - see that script's doc
 * comment for why (Playwright's TS transform can't load
 * @onevyrt/database's ESM migrate.ts, which its own index.ts always
 * re-exports). The seeded program/lesson titles are generated here and
 * passed down as env vars so this test's own assertions and the seeded
 * content agree on unique names without a shared database round-trip.
 */

// Own rate-limit bucket for this spec's registration - see the note in
// auth.spec.ts. (The admin is seeded via a direct domain call in the tsx
// fixture, not the HTTP endpoint, so only the student registration here
// counts against this bucket.)
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `e2e-learn-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  },
});

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

test("register, browse, enroll and complete a seeded lesson", async ({ page }) => {
  const programTitle = unique("E2E Test Program");
  const lessonTitle = unique("E2E Test Lesson");

  execFileSync("pnpm", ["exec", "tsx", "tests/e2e/fixtures/seed-learn-content.ts"], {
    env: {
      ...process.env,
      SEED_PROGRAM_TITLE: programTitle,
      SEED_LESSON_TITLE: lessonTitle,
    },
    stdio: "inherit",
  });

  // The real, browser-driven journey - a separate, normal learner who
  // never sees the seeding above.
  const email = `${unique("e2e-learn-student")}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("a-genuinely-long-password-123");
  await page.getByLabel("Workspace name").fill("Student Workspace");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("link", { name: /Student Workspace/ }).click();
  await expect(page).toHaveURL(/\/workspaces\/[^/]+\/today$/);

  await page.getByRole("link", { name: "Learn", exact: true }).click();
  await expect(page).toHaveURL(/\/learn$/);
  // Curriculum content is platform-wide, not workspace-scoped (by design
  // - see curriculum-use-cases.ts's doc comment), so other published
  // programs may legitimately be listed alongside this run's own seeded
  // one. Scope to this program's own row rather than a bare "Enroll"
  // role query, which would be ambiguous the moment more than one
  // program exists.
  const programRow = page.getByRole("listitem").filter({ hasText: programTitle });
  await expect(programRow).toBeVisible();

  await programRow.getByRole("button", { name: "Enroll" }).click();
  const continueLink = programRow.getByRole("link", { name: "Continue" });
  await expect(continueLink).toBeVisible();
  await continueLink.click();
  await expect(page).toHaveURL(/\/learn\/[^/]+$/);

  await page.getByRole("link", { name: lessonTitle }).click();
  await expect(page).toHaveURL(/\/lessons\/[^/]+$/);

  await expect(page.getByText("This is a read-only concept block.")).toBeVisible();

  await page.getByRole("radio", { name: "4" }).check();
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(page.getByText("Correct.")).toBeVisible();
  await expect(page.getByText("2 + 2 is 4.")).toBeVisible();

  await page.getByLabel("What did you learn?").fill("How the Learn destination works end to end.");
  await page.getByRole("button", { name: "Save reflection" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.getByRole("button", { name: "Mark lesson complete" }).click();
  await expect(page.getByText("Completed")).toBeVisible();
});
