import { Page, expect } from '@playwright/test';

/**
 * Common test helpers and utilities for E2E tests
 */

/**
 * Wait for specific time
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if element has class
 */
export async function hasClass(page: Page, selector: string, className: string): Promise<boolean> {
  return await page.locator(selector).evaluate(
    (el, cls) => (el as HTMLElement).classList.contains(cls),
    className
  );
}

/**
 * Get computed style property
 */
export async function getComputedStyle(
  page: Page,
  selector: string,
  property: string
): Promise<string> {
  return await page.locator(selector).evaluate(
    (el, prop) => window.getComputedStyle(el as HTMLElement).getPropertyValue(prop),
    property
  );
}

/**
 * Fill form and submit
 */
export async function fillAndSubmit(
  page: Page,
  formData: Record<string, string>,
  submitSelector: string
): Promise<void> {
  for (const [name, value] of Object.entries(formData)) {
    const input = page.locator(`[name="${name}"]`);

    if ((await input.count()) > 0) {
      const type = await input.getAttribute('type');

      if (type === 'checkbox') {
        if (value === 'true') {
          await input.check();
        }
      } else if (type === 'radio') {
        await input.check({ force: true });
      } else {
        await input.fill(value);
      }
    }
  }

  await page.click(submitSelector);
}

/**
 * Get all text content from selector
 */
export async function getAllText(page: Page, selector: string): Promise<string[]> {
  return await page.locator(selector).evaluateAll((elements) =>
    elements.map((el) => (el as HTMLElement).textContent?.trim() || '')
  );
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).evaluate((el) => {
    const rect = (el as HTMLElement).getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  });
}

/**
 * Take screenshot with custom name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
  options?: { mask?: string[] }
): Promise<Buffer> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${name}-${timestamp}.png`;

  return await page.screenshot({
    path: `e2e/screenshots/${fileName}`,
    ...options,
  });
}

/**
 * Monitor console messages
 */
export async function captureConsoleMessages(
  page: Page,
  callback: () => Promise<void>
): Promise<string[]> {
  const messages: string[] = [];

  page.on('console', (msg) => {
    messages.push(`[${msg.type()}] ${msg.text()}`);
  });

  await callback();

  return messages;
}

/**
 * Monitor network requests
 */
export async function captureNetworkRequests(
  page: Page,
  pattern: string | RegExp,
  callback: () => Promise<void>
): Promise<string[]> {
  const urls: string[] = [];

  page.on('request', (request) => {
    if (typeof pattern === 'string') {
      if (request.url().includes(pattern)) {
        urls.push(request.url());
      }
    } else if (pattern.test(request.url())) {
      urls.push(request.url());
    }
  });

  await callback();

  return urls;
}

/**
 * Handle file download
 */
export async function downloadFile(page: Page, selector: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click(selector),
  ]);

  return await download.path();
}

/**
 * Upload file to input
 */
export async function uploadFile(page: Page, selector: string, filePath: string): Promise<void> {
  const input = page.locator(selector);
  await input.setInputFiles(filePath);
}

/**
 * Wait for URL pattern
 */
export async function waitForUrlPattern(page: Page, pattern: RegExp, timeout = 5000): Promise<void> {
  await page.waitForFunction(
    (url) => new RegExp(url).test(window.location.href),
    pattern.toString(),
    { timeout }
  );
}

/**
 * Get localStorage value
 */
export async function getLocalStorage(page: Page, key: string): Promise<string | null> {
  return await page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Set localStorage value
 */
export async function setLocalStorage(page: Page, key: string, value: string): Promise<void> {
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: key, v: value }
  );
}

/**
 * Clear localStorage
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Check accessibility
 */
export async function checkAccessibility(page: Page): Promise<void> {
  // Note: Requires @axe-core/playwright to be installed
  // This is a placeholder - uncomment when library is added
  /*
  const results = await injectAxe(page);
  const violations = await checkA11y(page);
  expect(violations).toHaveLength(0);
  */
}

/**
 * Wait for animation to complete
 */
export async function waitForAnimation(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    return new Promise((resolve) => {
      const element = document.querySelector(sel);
      if (!element) {
        resolve(undefined);
        return;
      }

      const animations = element.getAnimations?.();
      if (!animations || animations.length === 0) {
        resolve(undefined);
        return;
      }

      Promise.all(animations.map((anim) => anim.finished)).then(() => resolve(undefined));
    });
  }, selector);
}

/**
 * Get text content with retries
 */
export async function getTextWithRetry(
  page: Page,
  selector: string,
  maxRetries = 3
): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    const text = await page.locator(selector).textContent();
    if (text) return text;
    await wait(500);
  }
  return null;
}

/**
 * Compare two images for visual regression
 */
export async function compareSnapshots(
  actual: Buffer,
  expected: Buffer,
  tolerance = 0.1
): Promise<boolean> {
  // This is a placeholder - would need pixelmatch or similar library
  return actual.equals(expected);
}

/**
 * Simulate network throttling
 */
export async function throttleNetwork(
  page: Page,
  conditions: 'slow-4g' | 'fast-3g' | 'offline'
): Promise<void> {
  const speeds = {
    'slow-4g': { downloadThroughput: 50 * 1024 / 8, uploadThroughput: 20 * 1024 / 8, latency: 400 },
    'fast-3g': { downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8, latency: 40 },
    offline: { offline: true },
  };

  const cdp = await page.context().newCDPSession(page);
  if (conditions === 'offline') {
    await cdp.send('Network.emulateNetworkConditions', { offline: true, downloadThroughput: -1, uploadThroughput: -1, latency: 0 });
  } else {
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      ...speeds[conditions],
    });
  }
}

/**
 * Mock API response
 */
export async function mockApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  responseData: object,
  status = 200
): Promise<void> {
  await page.route(urlPattern, (route) => {
    route.abort('blockedbyclient');
  });

  await page.route(urlPattern, async (route) => {
    await route.continue();
  });

  // Alternative: intercept and modify
  await page.route(urlPattern, (route) => {
    route.continue(
      (response) => {
        return route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(responseData),
        });
      }
    );
  });
}

/**
 * Get performance metrics
 */
export async function getPerformanceMetrics(page: Page): Promise<Record<string, number>> {
  return await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      ttfb: navigation.responseStart - navigation.requestStart,
      download: navigation.responseEnd - navigation.responseStart,
      domParse: navigation.domInteractive - navigation.domLoading,
      domReady: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      pageLoad: navigation.loadEventEnd - navigation.loadEventStart,
      total: navigation.loadEventEnd - navigation.fetchStart,
    };
  });
}
