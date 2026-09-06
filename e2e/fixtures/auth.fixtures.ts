import { test as base, expect } from '@playwright/test';
import { Page } from '@playwright/test';

/**
 * Auth fixtures for E2E tests
 * Handles user login and session management
 */

interface AuthFixtures {
  authenticatedPage: Page;
  guestPage: Page;
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page, baseURL }, use) => {
    // Navigate to login
    await page.goto('/auth/login');

    // Fill login form with test credentials
    await page.fill('input[name="email"]', 'test@onevyrt.local');
    await page.fill('input[name="password"]', 'TestPassword123!');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify session is established
    await expect(page.locator('[data-testid="user-avatar"]')).toBeVisible();

    await use(page);
  },

  guestPage: async ({ page }, use) => {
    // Use page as-is for unauthenticated tests
    await use(page);
  },
});

export { expect };

/**
 * Helper: Login programmatically via API (faster than UI automation)
 * Use this when you need to login but don't need to test the login UI itself
 */
export async function apiLogin(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${response.statusText()}`);
  }

  // Cookies are automatically set by Playwright
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
}

/**
 * Helper: Logout and clear session
 */
export async function logout(page: Page): Promise<void> {
  await page.goto('/api/auth/logout');
  await page.waitForURL('/auth/login');

  // Verify session cleared
  const cookies = await page.context().cookies();
  const authCookie = cookies.find((c) => c.name === 'session');
  if (authCookie) {
    throw new Error('Session cookie still present after logout');
  }
}

/**
 * Helper: Create test workspace with API
 */
export async function createTestWorkspace(
  page: Page,
  name: string = 'Test Workspace'
): Promise<string> {
  const response = await page.request.post('/api/workspaces', {
    data: { name },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create workspace: ${response.status()}`);
  }

  const data = await response.json();
  return data.id;
}

/**
 * Helper: Delete test workspace
 */
export async function deleteTestWorkspace(
  page: Page,
  workspaceId: string
): Promise<void> {
  const response = await page.request.delete(`/api/workspaces/${workspaceId}`);

  if (!response.ok()) {
    throw new Error(`Failed to delete workspace: ${response.status()}`);
  }
}

/**
 * Helper: Create test project/funnel
 */
export async function createTestFunnel(
  page: Page,
  workspaceId: string,
  name: string = 'Test Funnel'
): Promise<string> {
  const response = await page.request.post('/api/projects', {
    data: {
      workspace_id: workspaceId,
      type: 'funnel',
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
    },
  });

  if (!response.ok()) {
    throw new Error(`Failed to create funnel: ${response.status()}`);
  }

  const data = await response.json();
  return data.id;
}
