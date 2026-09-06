import { test as base, Page, BrowserContext } from '@playwright/test';

/**
 * Responsive fixtures for testing multiple viewport sizes
 * Tests: 375px (mobile), 768px (tablet), 1024px (desktop small), 1280px (desktop)
 */

interface ViewportFixtures {
  mobileContext: BrowserContext;
  tabletContext: BrowserContext;
  desktopSmallContext: BrowserContext;
  desktopContext: BrowserContext;
}

interface ViewportSize {
  width: number;
  height: number;
  name: string;
}

const VIEWPORTS: Record<string, ViewportSize> = {
  mobile: { width: 375, height: 667, name: 'iPhone SE' },
  tablet: { width: 768, height: 1024, name: 'iPad' },
  desktopSmall: { width: 1024, height: 768, name: 'Small Laptop' },
  desktop: { width: 1280, height: 800, name: 'Desktop' },
};

export const test = base.extend<ViewportFixtures>({
  mobileContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: VIEWPORTS.mobile,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    await use(context);
    await context.close();
  },

  tabletContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: VIEWPORTS.tablet,
      userAgent:
        'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    });
    await use(context);
    await context.close();
  },

  desktopSmallContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: VIEWPORTS.desktopSmall,
    });
    await use(context);
    await context.close();
  },

  desktopContext: async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: VIEWPORTS.desktop,
    });
    await use(context);
    await context.close();
  },
});

export { expect } from '@playwright/test';

/**
 * Helper: Test a page across all viewports
 * Usage: await testAcrossViewports(baseURL, '/page', async (page, viewport) => { ... })
 */
export async function testAcrossViewports(
  page: Page,
  url: string,
  callback: (page: Page, viewport: ViewportSize) => Promise<void>
): Promise<void> {
  const viewportEntries = Object.entries(VIEWPORTS);

  for (const [key, viewport] of viewportEntries) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(url);
    await page.waitForLoadState('networkidle');

    console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
    await callback(page, viewport);
  }
}

/**
 * Helper: Check if element is visible in current viewport
 */
export async function isVisibleInViewport(page: Page, selector: string): Promise<boolean> {
  try {
    const element = page.locator(selector);
    return await element.isVisible();
  } catch {
    return false;
  }
}

/**
 * Helper: Scroll to element and check if visible
 */
export async function scrollToAndCheck(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  return await element.isVisible();
}

/**
 * Helper: Test touch interactions (mobile-specific)
 */
export async function tapElement(page: Page, selector: string): Promise<void> {
  const element = page.locator(selector);
  await element.tap();
}

/**
 * Helper: Simulate swipe gesture
 */
export async function swipeLeft(page: Page): Promise<void> {
  const width = page.viewportSize()?.width || 375;
  const height = page.viewportSize()?.height || 667;

  await page.touchscreen.tap(width * 0.8, height * 0.5);
  await page.touchscreen.swipe(width * 0.2, height * 0.5);
}

/**
 * Helper: Simulate pinch zoom (mobile)
 */
export async function pinchZoom(page: Page, scale: number): Promise<void> {
  await page.evaluate((s) => {
    document.body.style.transform = `scale(${s})`;
  }, scale);
}

/**
 * Helper: Check dark mode with viewport
 */
export async function testDarkMode(
  page: Page,
  viewport: ViewportSize,
  callback: (page: Page) => Promise<void>
): Promise<void> {
  // Set dark color scheme
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.waitForLoadState('networkidle');

  console.log(`Testing dark mode at ${viewport.name}`);
  await callback(page);

  // Reset to light
  await page.emulateMedia({ colorScheme: 'light' });
}
