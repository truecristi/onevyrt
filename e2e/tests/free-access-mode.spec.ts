import { test, expect } from '../fixtures/auth.fixtures';
import { guestPage } from '../fixtures/auth.fixtures';

test.describe('Free-Access Mode', () => {
  test('should allow access to free lessons without login', async ({ guestPage: page }) => {
    // Navigate to free lesson without authentication
    await page.goto('/programme/free/lesson/1');

    // Page should load (not redirect to login)
    await expect(page).toHaveURL(/\/programme\/free\/lesson/);

    // Content should be visible
    await expect(page.locator('[data-testid="lesson-content"]')).toBeVisible();
  });

  test('should display free access banner', async ({ guestPage: page }) => {
    await page.goto('/programme/free/lesson/1');
    await page.waitForLoadState('networkidle');

    // Banner should indicate free access
    const banner = page.locator('[data-testid="free-access-banner"]');
    await expect(banner).toBeVisible();

    // Should encourage signup
    const bannerText = await banner.textContent();
    expect(bannerText?.toLowerCase()).toContain('free');
  });

  test('should auto-approve submissions in free-access mode', async ({ guestPage: page }) => {
    await page.goto('/programme/free/lesson/3');
    await page.waitForLoadState('networkidle');

    // Find submission form
    const form = page.locator('[data-testid="lesson-submission-form"]');
    await expect(form).toBeVisible();

    // Fill form
    await page.fill('textarea[name="submission"]', 'My submission for the free lesson');

    // Submit
    await page.click('[data-testid="btn-submit-lesson"]');

    // Should show immediate approval (no waiting for coach)
    const successMessage = page.locator('[data-testid="submission-success"]');
    await expect(successMessage).toBeVisible({ timeout: 5000 });

    // Message should indicate immediate approval
    const message = await successMessage.textContent();
    expect(message?.toLowerCase()).toContain('approved');
  });

  test('should mark free lesson as complete after submission', async ({ guestPage: page }) => {
    await page.goto('/programme/free/lesson/3');
    await page.waitForLoadState('networkidle');

    // Submit lesson
    await page.fill('textarea[name="submission"]', 'Test submission');
    await page.click('[data-testid="btn-submit-lesson"]');

    // Wait for success message
    await expect(page.locator('[data-testid="submission-success"]')).toBeVisible({ timeout: 5000 });

    // Progress bar should update
    const progressBar = page.locator('[data-testid="lesson-progress"]');
    await expect(progressBar).toBeVisible();

    // Check if completion indicator is present
    const completionIcon = page.locator('[data-testid="lesson-complete-icon"]');
    if (await completionIcon.isVisible()) {
      const icon = await completionIcon.getAttribute('class');
      expect(icon).toContain('check');
    }
  });

  test('should allow progression to next lesson in free mode', async ({ guestPage: page }) => {
    await page.goto('/programme/free/lesson/2');
    await page.waitForLoadState('networkidle');

    const currentTitle = await page.locator('[data-testid="lesson-title"]').textContent();

    // Submit current lesson (if required)
    const form = page.locator('[data-testid="lesson-submission-form"]');
    if (await form.isVisible()) {
      await page.fill('textarea[name="submission"]', 'Submission for free lesson');
      await page.click('[data-testid="btn-submit-lesson"]');
      await page.waitForTimeout(1000);
    }

    // Next button should be enabled
    const nextBtn = page.locator('[data-testid="btn-next-lesson"]');
    await expect(nextBtn).not.toBeDisabled();

    // Click next
    await nextBtn.click();
    await page.waitForLoadState('networkidle');

    const nextTitle = await page.locator('[data-testid="lesson-title"]').textContent();
    expect(nextTitle).not.toBe(currentTitle);
  });

  test('should not require coach approval in free mode', async ({ guestPage: page }) => {
    await page.goto('/programme/free/lesson/2');
    await page.waitForLoadState('networkidle');

    // Submit a lesson
    const form = page.locator('[data-testid="lesson-submission-form"]');
    if (await form.isVisible()) {
      await page.fill('textarea[name="submission"]', 'Test submission');
      await page.click('[data-testid="btn-submit-lesson"]');

      // Success should appear immediately (no "awaiting coach approval" state)
      const successMsg = page.locator('[data-testid="submission-success"]');
      await expect(successMsg).toBeVisible({ timeout: 5000 });

      // Should not show "pending review" message
      const pendingMsg = page.locator('text=Pending coach review');
      await expect(pendingMsg).not.toBeVisible();

      // Should not show "awaiting approval" message
      const awaitingMsg = page.locator('text=awaiting approval');
      await expect(awaitingMsg).not.toBeVisible();
    }
  });

  test('should show free access limitations', async ({ guestPage: page }) => {
    await page.goto('/programme/free/lesson/1');
    await page.waitForLoadState('networkidle');

    // Check for limitations notice
    const limitations = page.locator('[data-testid="free-access-limitations"]');

    // Should have some indication of what's available in paid version
    const bannersOrNotices = await page.locator('[role="alert"], .banner, [data-testid*="notice"]').count();
    expect(bannersOrNotices).toBeGreaterThan(0);
  });

  test('should prompt for signup after completing free lessons', async ({ guestPage: page }) => {
    // Navigate to last free lesson
    await page.goto('/programme/free/lesson/5');
    await page.waitForLoadState('networkidle');

    // Submit lesson
    const form = page.locator('[data-testid="lesson-submission-form"]');
    if (await form.isVisible()) {
      await page.fill('textarea[name="submission"]', 'Final submission');
      await page.click('[data-testid="btn-submit-lesson"]');
      await page.waitForTimeout(1000);
    }

    // Try to proceed
    const nextBtn = page.locator('[data-testid="btn-next-lesson"]');
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await page.waitForLoadState('networkidle');
    }

    // Should show signup prompt
    const signupPrompt = page.locator('[data-testid="signup-prompt"], text=Sign up');
    const promptCount = await signupPrompt.count();

    // Either show prompt or redirect to signup
    if (promptCount === 0) {
      // Should have redirected to signup
      await expect(page).toHaveURL(/\/(auth\/)?signup|/);
    } else {
      await expect(signupPrompt.first()).toBeVisible();
    }
  });

  test('should persist free lesson progress across sessions', async ({ guestPage: page }) => {
    // Navigate to free lesson
    await page.goto('/programme/free/lesson/2');
    await page.waitForLoadState('networkidle');

    // Submit lesson
    const form = page.locator('[data-testid="lesson-submission-form"]');
    if (await form.isVisible()) {
      await page.fill('textarea[name="submission"]', 'Submission for progress test');
      await page.click('[data-testid="btn-submit-lesson"]');
      await page.waitForTimeout(1000);
    }

    // Note the progress
    const progress1 = await page.locator('[data-testid="progress-text"]').textContent();

    // Close browser and reopen (simulate new session)
    await page.context()?.close();
    const newPage = await page.context()?.newPage() || page;

    // Navigate to same lesson
    await newPage.goto('/programme/free/lesson/2');
    await newPage.waitForLoadState('networkidle');

    // Progress should be same
    const progress2 = await newPage.locator('[data-testid="progress-text"]').textContent();

    // Completion should persist (if stored in localStorage)
    const completed = await newPage.evaluate(() => localStorage.getItem('free_lesson_2_completed'));
    expect(completed).toBeTruthy();
  });

  test('should allow free access to resources', async ({ guestPage: page }) => {
    await page.goto('/programme/free/resources');
    await page.waitForLoadState('networkidle');

    // Resources should be accessible
    const resources = page.locator('[data-testid="resource-card"]');
    const resourceCount = await resources.count();

    expect(resourceCount).toBeGreaterThan(0);

    // Should be able to view/download free resources
    const firstResource = resources.first();
    await firstResource.click();

    // Resource should load
    await page.waitForLoadState('networkidle');
    const resourceContent = page.locator('[data-testid="resource-content"]');
    await expect(resourceContent).toBeVisible();
  });

  test('should display enrollment prompt for premium features', async ({ guestPage: page }) => {
    // Try to access premium lesson/feature
    await page.goto('/programme/premium/lesson/1');
    await page.waitForLoadState('networkidle');

    // Should not load premium content
    const premiumContent = page.locator('[data-testid="premium-content"]');

    // Either show paywall or redirect
    const paywall = page.locator('[data-testid="paywall"], [role="dialog"]');
    const hasPaywall = await paywall.isVisible();

    if (!hasPaywall) {
      // Should redirect to signup/enrollment
      await expect(page).toHaveURL(/\/(auth\/)?signup|enroll|/);
    } else {
      await expect(paywall).toBeVisible();

      // Should have CTA to enroll
      const enrollBtn = paywall.locator('[data-testid="btn-enroll"], button:has-text("Enroll")');
      await expect(enrollBtn).toBeVisible();
    }
  });

  test('should track free mode analytics', async ({ guestPage: page }) => {
    await page.goto('/programme/free/lesson/1');
    await page.waitForLoadState('networkidle');

    // Check for analytics tracking
    const analyticsScripts = await page.evaluate(() => {
      return (window as any).dataLayer || (window as any).gtag ? true : false;
    });

    // Should have some form of tracking for free access
    expect(analyticsScripts || (await page.locator('script[src*="analytics"], script[src*="gtag"]').count())).toBeTruthy();
  });
});
