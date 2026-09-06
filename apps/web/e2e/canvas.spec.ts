import { test, expect } from "@playwright/test";
import { uid, registerNewAccount, cleanupAccount, seedPlan } from "./helpers";

/**
 * Covers the areas of funnel-studio.tsx that were split into
 * components/studio/* this session (ReportPanels, SimulatePanels,
 * InspectorPanels) plus the notification bell — the same flows verified
 * manually via the browser tool during that work, now permanent.
 */
let currentEmail = "";

test.describe("canvas", () => {
  test.beforeEach(async ({ page }) => {
    const prefix = uid("e2e-canvas");
    currentEmail = `${prefix}@example.com`;
    await registerNewAccount(page, prefix);
    // Registration now lands on /command-center; the Studio (and its home
    // view's "Open full report") is reached explicitly.
    await page.goto("/studio");
    await page.getByRole("button", { name: "Open full report" }).click();
    await page.waitForSelector("text=Live model", { timeout: 15_000 });
  });

  test.afterEach(async () => {
    if (currentEmail) await cleanupAccount(currentEmail);
  });

  test("the model workspace loads with the Plan / Actual / Improve stage nav", async ({ page }) => {
    // The three-stage loop nav is the studio shell's backbone. Its presence
    // proves StudioInner mounted and rendered after the domain-state hooks
    // were extracted (regression guard for that refactor).
    for (const stage of ["Start", "Run", "Improve"]) {
      await expect(page.getByRole("button", { name: stage, exact: true })).toBeVisible();
    }
    await expect(page.locator('[title="Plan the business"]')).toBeVisible();
    await expect(page.locator('[title="Model, simulate, decide"]')).toBeVisible();
  });

  test("the canvas header exposes File, Tools, Live tracking and the layer toggles", async ({ page }) => {
    // Title-attribute selectors: these are the always-visible canvas-header
    // controls (some are icon-only, and "Tools" as a role/name is ambiguous
    // with the collapsed-toolbar reopen button, so match the title verbatim).
    await expect(page.getByRole("button", { name: "File ▾" })).toBeVisible();
    await expect(page.locator('[title="Readiness, risk, history, AI Copilot and more"]')).toBeVisible();
    await expect(page.locator('[title="Live tracking"]')).toBeVisible();
    await expect(page.locator('[title="Canvas layers — toggle what shows on the map"]')).toBeVisible();
  });

});

test.describe("canvas editing", () => {
  // Editing the model (the library "Add" buttons, the inspector's node editor)
  // is gated behind a non-free plan. The studio fetches the workspace once on
  // mount, so upgrading the plan in Postgres and THEN doing a full navigation to
  // /studio (which renders the same FunnelStudio and re-fetches the now-paid
  // workspace) is the deterministic way to land with canEdit true. A plain
  // reload of "/" can't be used — middleware 307s a signed-in root to
  // /command-center, which drops the "Open full report" entry.
  test.beforeEach(async ({ page }) => {
    const prefix = uid("e2e-edit");
    currentEmail = `${prefix}@example.com`;
    await registerNewAccount(page, prefix);
    await seedPlan(currentEmail);
    await page.goto("/studio");
    await page.getByRole("button", { name: "Open full report" }).click();
    await page.waitForSelector("text=Live model", { timeout: 15_000 });
    const skipTour = page.getByRole("button", { name: "Skip", exact: true });
    if (await skipTour.isVisible().catch(() => false)) await skipTour.click();
  });

  test.afterEach(async () => {
    if (currentEmail) await cleanupAccount(currentEmail);
  });

  test("adding a block from the library selects it and the inspector opens its editor", async ({ page }) => {
    // The real regression guard for the funnel-studio split: exercise the full
    // add → auto-select → inspector-render pipeline end to end. addFromLib
    // appends the node and sets it selected — exactly what the extraction risks
    // breaking. "Open full report" lands in the read-only report mode, so switch
    // to the editable Plan stage first (the library "Add" buttons are gated to it).
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.getByRole("button", { name: /Add Custom Source/ }).click();

    // The inspector now shows the selected block's editor. BLOCK SIZE / NOTE
    // only render when `selected` is set, so their presence proves the node was
    // created AND auto-selected AND the inspector re-rendered for it.
    await expect(page.getByText("BLOCK SIZE", { exact: true })).toBeVisible();
    await expect(page.getByText("NOTE", { exact: true })).toBeVisible();

    // Editing an inspector field flows back to the block on the canvas — type a
    // note and confirm the textarea holds it (round-trips patch() → node data).
    const note = page.getByPlaceholder("Page copy, offer notes, tracking URL, why this rate…");
    await note.fill("smoke-test note");
    await expect(note).toHaveValue("smoke-test note");
  });
});

test.describe("Command Centre", () => {
  test.afterEach(async () => {
    if (currentEmail) await cleanupAccount(currentEmail);
  });

  test("notification bell opens to an empty state for a brand-new account", async ({ page }) => {
    // Deliberately NOT inside the canvas describe block above: the bell
    // lives in the home/library header, not the separate canvas toolbar
    // (File/zoom/etc.) that "Open full report" navigates into.
    const prefix = uid("e2e-home");
    currentEmail = `${prefix}@example.com`;
    await registerNewAccount(page, prefix);
    // The notification bell lives in the Studio home header (StudioTopBar), so
    // reach the Studio explicitly now that registration lands on /command-center.
    await page.goto("/studio");
    await page.locator('[title="Notifications"]').click();
    await expect(page.getByText("Nothing yet.")).toBeVisible();
  });
});
