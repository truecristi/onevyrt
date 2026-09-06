import { defineConfig, devices } from "@playwright/test";

/**
 * Phase 9: the first real Playwright config, now that apps/web has an
 * actual register/login/dashboard flow to click through (tests/e2e's own
 * README explained why this didn't exist before). Deliberately scoped to
 * one browser (chromium) for now - a cross-browser matrix is easy to add
 * later and not worth the CI time until there are more than a handful of
 * journeys covered.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Lets a sandboxed dev environment point at a pre-installed
        // browser binary that doesn't match this package's pinned
        // Chromium build, instead of downloading one - unset in CI,
        // where `playwright install --with-deps chromium` fetches the
        // exact matching build normally.
        ...(process.env.PLAYWRIGHT_LOCAL_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_LOCAL_EXECUTABLE_PATH } }
          : {}),
      },
    },
  ],
  // CI starts the server itself (a real production build against a real
  // Postgres, not `next dev`) before running tests - see ci.yml. Locally,
  // this starts the dev server for you if E2E_BASE_URL isn't already
  // pointed at a running one.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm --filter @onevyrt/web dev -- -p 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
