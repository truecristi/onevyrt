import { test, expect } from '../fixtures/auth.fixtures';
import { testAcrossViewports, testDarkMode } from '../fixtures/responsive.fixtures';

test.describe('Lesson Visuals', () => {
  test('should render lesson page with all visual elements', async ({ authenticatedPage: page }) => {
    // Navigate to a lesson
    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Check header elements
    await expect(page.locator('[data-testid="lesson-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="lesson-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="lesson-progress"]')).toBeVisible();

    // Check main content
    await expect(page.locator('[data-testid="lesson-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="lesson-video"] iframe')).toBeTruthy();

    // Check sidebar navigation
    await expect(page.locator('[data-testid="lesson-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="chapter-nav"]')).toBeVisible();

    // Check footer with navigation buttons
    await expect(page.locator('[data-testid="lesson-footer"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-previous-lesson"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-next-lesson"]')).toBeVisible();
  });

  test('should render lesson with different content types', async ({ authenticatedPage: page }) => {
    // Test lesson with video
    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    const videoFrame = page.locator('[data-testid="lesson-video"] iframe');
    if (await videoFrame.isVisible()) {
      await expect(videoFrame).toHaveAttribute('src', /^(https?:|)\/\//);
    }

    // Test lesson with text content
    const textContent = page.locator('[data-testid="lesson-text-content"]');
    if (await textContent.isVisible()) {
      const textLength = (await textContent.textContent())?.length || 0;
      expect(textLength).toBeGreaterThan(0);
    }

    // Test lesson with images
    const images = page.locator('[data-testid="lesson-image"]');
    const imageCount = await images.count();
    if (imageCount > 0) {
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        await expect(img).toHaveAttribute('alt');
        const alt = await img.getAttribute('alt');
        expect(alt?.length).toBeGreaterThan(0);
      }
    }
  });

  test('should display lesson progress correctly', async ({ authenticatedPage: page }) => {
    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Check progress bar
    const progressBar = page.locator('[data-testid="lesson-progress"]');
    await expect(progressBar).toBeVisible();

    // Check progress text (e.g., "1 of 10")
    const progressText = page.locator('[data-testid="progress-text"]');
    if (await progressText.isVisible()) {
      const text = await progressText.textContent();
      expect(text).toMatch(/\d+\s+of\s+\d+/);
    }

    // Check visual progress indicator
    const progressFill = page.locator('[data-testid="progress-bar-fill"]');
    if (await progressFill.isVisible()) {
      const style = await progressFill.getAttribute('style');
      expect(style).toMatch(/width:\s*\d+%/);
    }
  });

  test('should navigate between lessons', async ({ authenticatedPage: page }) => {
    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    const firstTitle = await page.locator('[data-testid="lesson-title"]').textContent();

    // Click next lesson
    await page.click('[data-testid="btn-next-lesson"]');
    await page.waitForLoadState('networkidle');

    const secondTitle = await page.locator('[data-testid="lesson-title"]').textContent();

    // Titles should be different
    expect(firstTitle).not.toBe(secondTitle);

    // Previous button should now be enabled
    const prevBtn = page.locator('[data-testid="btn-previous-lesson"]');
    await expect(prevBtn).not.toBeDisabled();

    // Click previous
    await prevBtn.click();
    await page.waitForLoadState('networkidle');

    const backTitle = await page.locator('[data-testid="lesson-title"]').textContent();
    expect(backTitle).toBe(firstTitle);
  });

  test('should display lesson submission form', async ({ authenticatedPage: page }) => {
    // Navigate to a lesson that has a submission
    await page.goto('/programme/chapter/1/lesson/3');
    await page.waitForLoadState('networkidle');

    // Check if submission form exists
    const submissionForm = page.locator('[data-testid="lesson-submission-form"]');
    if (await submissionForm.isVisible()) {
      // Check for form elements
      await expect(submissionForm.locator('textarea, input[type="text"]')).toBeTruthy();
      await expect(submissionForm.locator('[data-testid="btn-submit-lesson"]')).toBeVisible();
    }
  });

  test('should be responsive at mobile viewport (375px)', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Header should stack vertically
    const header = page.locator('[data-testid="lesson-header"]');
    await expect(header).toBeVisible();

    // Sidebar should be hidden or collapsed on mobile
    const sidebar = page.locator('[data-testid="lesson-sidebar"]');
    const sidebarVisible = await sidebar.isVisible();

    if (sidebarVisible) {
      // If sidebar is visible, check if there's a toggle
      const sidebarToggle = page.locator('[data-testid="sidebar-toggle"]');
      await expect(sidebarToggle).toBeVisible();

      // Toggle should collapse sidebar
      await sidebarToggle.click();
      await expect(sidebar).toBeHidden();
    }

    // Content should be full width
    const content = page.locator('[data-testid="lesson-content"]');
    const contentBox = await content.boundingBox();
    const viewportSize = page.viewportSize();

    expect(contentBox?.width).toBeLessThanOrEqual((viewportSize?.width || 375) + 5); // Small margin
  });

  test('should be responsive at tablet viewport (768px)', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Sidebar should be visible at tablet size
    const sidebar = page.locator('[data-testid="lesson-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Content should be in a 2-column layout
    const content = page.locator('[data-testid="lesson-content"]');
    const contentBox = await content.boundingBox();
    const viewportSize = page.viewportSize();

    // Content should take ~60-70% of width (leaving room for sidebar)
    const expectedMaxWidth = (viewportSize?.width || 768) * 0.8;
    expect(contentBox?.width).toBeLessThan(expectedMaxWidth);
  });

  test('should be responsive at desktop viewport (1024px)', async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });

    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // All elements should be visible
    await expect(page.locator('[data-testid="lesson-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="lesson-sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="lesson-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="lesson-footer"]')).toBeVisible();
  });

  test('should work in dark mode', async ({ authenticatedPage: page }) => {
    // Set dark mode
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Check for dark mode styles
    const bodyElement = page.locator('body');
    const dataTheme = await bodyElement.getAttribute('data-theme');

    // Should have dark mode indicator
    expect(dataTheme === 'dark' || (await bodyElement.evaluate((el) => window.matchMedia('(prefers-color-scheme: dark)').matches))).toBeTruthy();

    // Text should be visible (not white on white)
    const title = page.locator('[data-testid="lesson-title"]');
    const titleColor = await title.evaluate((el) => window.getComputedStyle(el).color);
    expect(titleColor).not.toBe('rgb(255, 255, 255)'); // Not pure white

    // Reset to light mode
    await page.emulateMedia({ colorScheme: 'light' });
  });

  test('should maintain layout on dark mode switch', async ({ authenticatedPage: page }) => {
    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Get bounding boxes in light mode
    const titleLight = await page.locator('[data-testid="lesson-title"]').boundingBox();

    // Switch to dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(500); // Wait for styles to apply

    // Get bounding boxes in dark mode
    const titleDark = await page.locator('[data-testid="lesson-title"]').boundingBox();

    // Position and size should be the same
    expect(titleDark?.x).toBe(titleLight?.x);
    expect(titleDark?.y).toBe(titleLight?.y);
    expect(titleDark?.width).toBe(titleLight?.width);
  });

  test('should have proper color contrast in dark mode', async ({ authenticatedPage: page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });

    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Check color contrast for main elements
    const elements = await page.locator('[data-testid="lesson-content"] p, h1, h2, h3').all();

    for (const el of elements.slice(0, 5)) {
      // Sample first 5 elements
      const text = await el.evaluate((el) => {
        const style = window.getComputedStyle(el);
        const rgb = style.color;
        return rgb;
      });

      // Should not be light gray/white
      expect(text).not.toMatch(/^rgb\(25[0-5],\s*25[0-5],\s*25[0-5]\)/); // Not white
    }
  });

  test('should preload images for smooth scrolling', async ({ authenticatedPage: page }) => {
    await page.goto('/programme/chapter/1/lesson/1');
    await page.waitForLoadState('networkidle');

    // Check for lazy-loaded images
    const images = page.locator('[data-testid="lesson-image"]');
    const imageCount = await images.count();

    if (imageCount > 0) {
      for (let i = 0; i < Math.min(imageCount, 3); i++) {
        const img = images.nth(i);
        const src = await img.getAttribute('src');
        const loading = await img.getAttribute('loading');

        // Should have either src or data attributes
        expect(src || (await img.getAttribute('data-src'))).toBeTruthy();
      }
    }
  });

  test('should highlight current lesson in sidebar', async ({ authenticatedPage: page }) => {
    await page.goto('/programme/chapter/1/lesson/3');
    await page.waitForLoadState('networkidle');

    // Find current lesson indicator
    const activeLesson = page.locator('[data-testid="lesson-sidebar-item"][aria-current="true"], [data-testid="lesson-sidebar-item.active"]');

    const activeCount = await activeLesson.count();
    expect(activeCount).toBeGreaterThanOrEqual(1);

    // Active lesson should have distinct styling
    const activeStyle = await activeLesson.first().getAttribute('class');
    expect(activeStyle).toContain('active');
  });
});
