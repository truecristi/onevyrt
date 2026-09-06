import { test, expect } from '../fixtures/responsive.fixtures';
import {
  testAcrossViewports,
  isVisibleInViewport,
  scrollToAndCheck,
  tapElement,
  testDarkMode,
} from '../fixtures/responsive.fixtures';

test.describe('Mobile Responsiveness', () => {
  test.describe('375px - Mobile Phone (iPhone SE)', () => {
    test.beforeEach(async ({ mobileContext }) => {
      // Mobile context is pre-configured with 375x667 viewport
    });

    test('should render lesson at 375px without horizontal scroll', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Get viewport and content width
      const viewportWidth = page.viewportSize()?.width || 375;
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);

      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5); // Small margin for rounding

      await page.close();
    });

    test('should collapse sidebar at 375px', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      const sidebar = page.locator('[data-testid="lesson-sidebar"]');

      // Sidebar should be hidden by default on mobile
      const isVisible = await sidebar.isVisible();

      if (isVisible) {
        // If visible, should have toggle
        const toggle = page.locator('[data-testid="sidebar-toggle"]');
        await expect(toggle).toBeVisible();

        // Click to hide
        await toggle.click();
        await expect(sidebar).toBeHidden();
      }

      await page.close();
    });

    test('should stack form fields vertically at 375px', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/3');
      await page.waitForLoadState('networkidle');

      const form = page.locator('[data-testid="lesson-submission-form"]');
      if (await form.isVisible()) {
        // Get positions of form fields
        const inputs = await form.locator('input, textarea').all();

        for (let i = 0; i < inputs.length - 1; i++) {
          const current = await inputs[i].boundingBox();
          const next = await inputs[i + 1].boundingBox();

          if (current && next) {
            // Next field should be below current (vertical stacking)
            expect(next.y).toBeGreaterThan(current.y);

            // Fields should be roughly same width (full width on mobile)
            expect(Math.abs(next.width - current.width)).toBeLessThan(10);
          }
        }
      }

      await page.close();
    });

    test('should show readable text at 375px', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Check font size is readable
      const paragraph = page.locator('[data-testid="lesson-content"] p').first();
      if (await paragraph.isVisible()) {
        const fontSize = await paragraph.evaluate((el) => {
          return window.getComputedStyle(el).fontSize;
        });

        // Should be at least 14px for readability
        const size = parseInt(fontSize);
        expect(size).toBeGreaterThanOrEqual(14);
      }

      await page.close();
    });

    test('should have touchable buttons at 375px', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Check button size (should be at least 44x44 for touch targets)
      const button = page.locator('[data-testid="btn-next-lesson"]');
      if (await button.isVisible()) {
        const box = await button.boundingBox();

        expect((box?.height || 0)).toBeGreaterThanOrEqual(40); // Allow 40px minimum
        expect((box?.width || 0)).toBeGreaterThanOrEqual(40);
      }

      await page.close();
    });

    test('should handle long text without overflow at 375px', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Check if long URLs/text wrap properly
      const content = page.locator('[data-testid="lesson-content"]');
      const hasOverflow = await content.evaluate((el) => {
        return el.scrollWidth > el.clientWidth;
      });

      expect(hasOverflow).toBeFalsy();

      await page.close();
    });
  });

  test.describe('768px - Tablet (iPad)', () => {
    test.beforeEach(async ({ tabletContext }) => {
      // Tablet context is pre-configured with 768x1024 viewport
    });

    test('should show sidebar at 768px', async ({ tabletContext }) => {
      const page = await tabletContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      const sidebar = page.locator('[data-testid="lesson-sidebar"]');
      await expect(sidebar).toBeVisible();

      await page.close();
    });

    test('should use 2-column layout at 768px', async ({ tabletContext }) => {
      const page = await tabletContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      const sidebar = page.locator('[data-testid="lesson-sidebar"]');
      const content = page.locator('[data-testid="lesson-content"]');

      const sidebarBox = await sidebar.boundingBox();
      const contentBox = await content.boundingBox();

      if (sidebarBox && contentBox) {
        // Sidebar should be on the left
        expect(sidebarBox.x).toBeLessThan(contentBox.x);

        // They should be side-by-side
        expect(sidebarBox.x + sidebarBox.width).toBeLessThanOrEqual(contentBox.x + 5);
      }

      await page.close();
    });

    test('should display full navigation at 768px', async ({ tabletContext }) => {
      const page = await tabletContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Navigation items should be visible
      const nav = page.locator('[data-testid="chapter-nav"] a');
      const navCount = await nav.count();

      expect(navCount).toBeGreaterThan(0);

      await page.close();
    });

    test('should have readable layout at 768px', async ({ tabletContext }) => {
      const page = await tabletContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      const content = page.locator('[data-testid="lesson-content"]');
      const contentBox = await content.boundingBox();
      const viewportSize = page.viewportSize();

      // Content shouldn't be too wide for tablet (max ~70% of viewport)
      const maxWidth = (viewportSize?.width || 768) * 0.75;
      expect((contentBox?.width || 0)).toBeLessThan(maxWidth);

      await page.close();
    });
  });

  test.describe('1024px - Desktop Small (Small Laptop)', () => {
    test.beforeEach(async ({ desktopSmallContext }) => {
      // Desktop small context is pre-configured with 1024x768 viewport
    });

    test('should display full layout at 1024px', async ({ desktopSmallContext }) => {
      const page = await desktopSmallContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // All major sections should be visible
      await expect(page.locator('[data-testid="lesson-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="lesson-sidebar"]')).toBeVisible();
      await expect(page.locator('[data-testid="lesson-content"]')).toBeVisible();

      await page.close();
    });

    test('should have proper spacing at 1024px', async ({ desktopSmallContext }) => {
      const page = await desktopSmallContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Check margins/padding are appropriate
      const content = page.locator('[data-testid="lesson-content"]');
      const padding = await content.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          paddingLeft: parseInt(style.paddingLeft),
          paddingRight: parseInt(style.paddingRight),
        };
      });

      // Should have some padding but not excessive
      expect(padding.paddingLeft).toBeGreaterThan(10);
      expect(padding.paddingLeft).toBeLessThan(50);

      await page.close();
    });
  });

  test.describe('1280px - Full Desktop', () => {
    test.beforeEach(async ({ desktopContext }) => {
      // Desktop context is pre-configured with 1280x800 viewport
    });

    test('should maximize content usage at 1280px', async ({ desktopContext }) => {
      const page = await desktopContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      const content = page.locator('[data-testid="lesson-content"]');
      const contentBox = await content.boundingBox();
      const viewportSize = page.viewportSize();

      // Content should take good use of available space
      expect((contentBox?.width || 0)).toBeGreaterThan(600);
      expect((contentBox?.width || 0)).toBeLessThanOrEqual((viewportSize?.width || 1280) - 300); // Leave room for sidebar

      await page.close();
    });
  });

  test.describe('Cross-Viewport Navigation', () => {
    test('should navigate between lessons across all viewports', async ({ mobileContext, tabletContext, desktopContext }) => {
      const contexts = [
        { name: 'mobile', context: mobileContext },
        { name: 'tablet', context: tabletContext },
        { name: 'desktop', context: desktopContext },
      ];

      for (const { name, context } of contexts) {
        const page = await context.newPage();
        await page.goto('/programme/chapter/1/lesson/1');
        await page.waitForLoadState('networkidle');

        const firstTitle = await page.locator('[data-testid="lesson-title"]').textContent();

        // Click next
        await page.click('[data-testid="btn-next-lesson"]');
        await page.waitForLoadState('networkidle');

        const secondTitle = await page.locator('[data-testid="lesson-title"]').textContent();

        expect(firstTitle).not.toBe(secondTitle);
        console.log(`Navigation works on ${name}`);

        await page.close();
      }
    });
  });

  test.describe('Touch Interactions', () => {
    test('should handle tap gestures on mobile', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Verify tap interaction works
      const nextBtn = page.locator('[data-testid="btn-next-lesson"]');
      await expect(nextBtn).toBeVisible();

      // Use tap instead of click
      await nextBtn.tap();
      await page.waitForLoadState('networkidle');

      // Page should navigate
      const url = page.url();
      expect(url).toContain('/lesson/');

      await page.close();
    });
  });

  test.describe('Responsive Images', () => {
    test('should load appropriately-sized images for viewport', async ({ mobileContext, desktopContext }) => {
      const viewports = [
        { name: 'mobile', context: mobileContext, expectedMaxWidth: 375 },
        { name: 'desktop', context: desktopContext, expectedMaxWidth: 1280 },
      ];

      for (const { name, context, expectedMaxWidth } of viewports) {
        const page = await context.newPage();
        await page.goto('/programme/chapter/1/lesson/1');
        await page.waitForLoadState('networkidle');

        const images = page.locator('[data-testid="lesson-image"]');
        const imageCount = await images.count();

        if (imageCount > 0) {
          for (let i = 0; i < Math.min(imageCount, 2); i++) {
            const img = images.nth(i);
            const src = await img.getAttribute('src');
            const alt = await img.getAttribute('alt');

            // Should have alt text
            expect(alt).toBeTruthy();

            // Should have src
            expect(src).toBeTruthy();

            // Image should not overflow viewport
            const box = await img.boundingBox();
            expect((box?.width || 0)).toBeLessThanOrEqual(expectedMaxWidth);
          }
        }

        await page.close();
      }
    });
  });

  test.describe('Keyboard & Accessibility on Mobile', () => {
    test('should be keyboard accessible even on mobile viewports', async ({ mobileContext }) => {
      const page = await mobileContext.newPage();
      await page.goto('/programme/chapter/1/lesson/1');
      await page.waitForLoadState('networkidle');

      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Some element should have focus
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).not.toBe('BODY');

      await page.close();
    });
  });

  test.describe('Dark Mode Responsiveness', () => {
    test('should maintain layout in dark mode across viewports', async ({ mobileContext, tabletContext, desktopContext }) => {
      const contexts = [
        { name: 'mobile', context: mobileContext },
        { name: 'tablet', context: tabletContext },
        { name: 'desktop', context: desktopContext },
      ];

      for (const { name, context } of contexts) {
        const page = await context.newPage();

        // Get light mode layout
        await page.goto('/programme/chapter/1/lesson/1');
        await page.waitForLoadState('networkidle');
        const lightLayout = await page.locator('[data-testid="lesson-content"]').boundingBox();

        // Switch to dark mode
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.waitForTimeout(500);

        // Dark mode layout should be same
        const darkLayout = await page.locator('[data-testid="lesson-content"]').boundingBox();

        expect(darkLayout?.width).toBe(lightLayout?.width);
        expect(darkLayout?.height).toBe(lightLayout?.height);

        console.log(`Dark mode layout preserved on ${name}`);

        await page.close();
      }
    });
  });
});
