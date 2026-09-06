import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { uid, registerNewAccount, cleanupAccount, seedPlan } from "./helpers";

/**
 * Automated accessibility smoke (audit §25/§26 "accessibility smoke test",
 * §30 "key pages have no serious accessibility violations"). Complements the
 * hand-written ARIA-semantics assertions in a11y.spec.ts: axe-core scans the
 * live DOM of the key surfaces and fails on any serious/critical WCAG 2 A/AA
 * violation, so a regression that (re)introduces one is caught in CI.
 *
 * We gate on serious+critical only — the "smoke" bar the audit sets — rather
 * than every minor/moderate advisory, which keeps the signal actionable.
 *
 * All four surfaces (landing, public funnel, Command Centre, Studio) are now
 * WCAG-AA clean and gate STRICTLY — every serious/critical violation, including
 * color-contrast, fails the check. Keep it that way: any regression that
 * reintroduces one is caught here.
 */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

/** A readable failure message: which rule, where, and a sample node. */
function describeViolations(vs: Awaited<ReturnType<typeof seriousViolations>>): string {
  if (!vs.length) return "";
  return "\n" + vs.map((v) => {
    const sample = v.nodes[0]?.target?.join(" ") ?? "";
    return `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.nodes.length} node(s), e.g. ${sample}\n    ${v.helpUrl}`;
  }).join("\n");
}

let currentEmail = "";

test.describe("accessibility (axe)", () => {
  test.afterEach(async () => {
    if (currentEmail) { await cleanupAccount(currentEmail); currentEmail = ""; }
  });

  test("the landing / sign-in page has no serious violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });

  test("the public qualification funnel has no serious violations", async ({ page }) => {
    // The built-in /q/demo renders unauthenticated with no seeding — the
    // canonical public flow, and the highest-traffic page for real visitors.
    await page.goto("/q/demo");
    await page.waitForLoadState("networkidle");
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });

  test("the Command Centre has no serious violations", async ({ page }) => {
    const prefix = uid("e2e-axe-home");
    currentEmail = `${prefix}@example.com`;
    await registerNewAccount(page, prefix);
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });

  test("the Studio has no serious violations", async ({ page }) => {
    const prefix = uid("e2e-axe-studio");
    currentEmail = `${prefix}@example.com`;
    await registerNewAccount(page, prefix);
    await seedPlan(currentEmail);
    await page.goto("/studio");
    await page.waitForLoadState("networkidle");
    // Dismiss the first-run tour so it isn't scanned as a modal overlay.
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });

  // Dark theme is a separate rendering with its own contrast profile — the
  // light-only scans above can't catch a token that fails AA on dark surfaces
  // (exactly the studio ACCENT regression this suite now guards). The theme is
  // read pre-paint from localStorage("gb-theme"), so we seed it before load.
  test("the Studio has no serious violations in DARK mode", async ({ page }) => {
    const prefix = uid("e2e-axe-studio-dk");
    currentEmail = `${prefix}@example.com`;
    await registerNewAccount(page, prefix);
    await seedPlan(currentEmail);
    await page.addInitScript(() => { try { localStorage.setItem("gb-theme", "dark"); } catch { /* private mode */ } });
    await page.goto("/studio");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const skip = page.getByRole("button", { name: "Skip", exact: true });
    if (await skip.isVisible().catch(() => false)) await skip.click();
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });

  test("the Command Centre has no serious violations in DARK mode", async ({ page }) => {
    const prefix = uid("e2e-axe-home-dk");
    currentEmail = `${prefix}@example.com`;
    await registerNewAccount(page, prefix);
    await page.addInitScript(() => { try { localStorage.setItem("gb-theme", "dark"); } catch { /* private mode */ } });
    await page.goto("/command-center");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });

  // The two highest-traffic PUBLIC pages also render in dark mode for visitors
  // whose device prefers it — a dark-only contrast regression here would face
  // real prospects, so scan them too (the re-audit flagged this coverage gap).
  test("the landing / sign-in page has no serious violations in DARK mode", async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem("gb-theme", "dark"); } catch { /* private mode */ } });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });

  test("the public qualification funnel has no serious violations in DARK mode", async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem("gb-theme", "dark"); } catch { /* private mode */ } });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/q/demo");
    await page.waitForLoadState("networkidle");
    const vs = await seriousViolations(page);
    expect(vs, describeViolations(vs)).toEqual([]);
  });
});
