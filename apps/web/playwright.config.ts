import { defineConfig, devices } from "@playwright/test";

/**
 * Real-browser coverage for funnel-studio.tsx, which unit tests can't
 * reach — canvas interactions, the inspector, the login/landing screens,
 * the Command Centre. These run against the same real shared Postgres
 * instance the unit tests use (see test/helpers/pg.ts's reasoning), so
 * every spec creates its own uid()-prefixed account and cleans it up
 * afterward rather than relying on fixture data.
 *
 * Not wired into `npm test` (which stays fast, Postgres-only, no browser)
 * — run explicitly via `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // one browser hitting the one shared dev server; keep it simple and deterministic
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4300",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx dotenv -e .env.local -- npx next dev -p 4300",
    url: "http://localhost:4300",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Container-friendly flags: shared /dev/shm is small in CI/sandboxes,
        // and the sandbox can't nest — without these Chromium can OOM or fail to launch.
        // PW_CHROME lets an environment whose pre-installed Chromium build doesn't
        // match this @playwright/test version point at it directly (e.g.
        // /opt/pw-browsers/chromium) instead of downloading; unset in CI, which
        // uses the bundled browser.
        launchOptions: {
          args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-gpu"],
          ...(process.env.PW_CHROME ? { executablePath: process.env.PW_CHROME } : {}),
        },
      },
    },
  ],
});
