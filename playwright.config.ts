import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for ONEVYRT E2E tests
 * Covers web, mobile, and tablet viewports with parallel execution
 */
export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'e2e/test-results' }],
    ['json', { outputFile: 'e2e/results.json' }],
    ['junit', { outputFile: 'e2e/junit.xml' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
    {
      name: 'tablet-ipad',
      use: { ...devices['iPad Pro'] },
    },
  ],

  /**
   * Viewport sizes for responsive testing
   * 375px: mobile phone (iPhone SE)
   * 768px: tablet (iPad)
   * 1024px: desktop (small laptop)
   * 1280px: full desktop
   */
  webServer: undefined, // Define above in use section
});
