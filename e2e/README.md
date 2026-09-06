# ONEVYRT E2E Test Suite

Comprehensive end-to-end testing for ONEVYRT using **Playwright**. Tests cover funnel builder UI, lesson visuals, free-access mode, and mobile responsiveness across multiple viewports.

## Directory Structure

```
e2e/
├── fixtures/
│   ├── auth.fixtures.ts          # Authentication & API helpers
│   └── responsive.fixtures.ts     # Viewport & responsive testing
├── tests/
│   ├── funnel-builder.spec.ts     # Funnel builder UI tests
│   ├── lesson-visuals.spec.ts     # Lesson rendering & dark mode
│   ├── free-access-mode.spec.ts   # Free tier access tests
│   └── mobile-responsiveness.spec.ts # Viewport responsiveness
├── test-results/                  # HTML reports (generated)
├── README.md                       # This file
└── playwright.config.ts            # Playwright configuration
```

## Installation

```bash
# Install Playwright and dependencies
pnpm add -D @playwright/test @testing-library/playwright

# Install browsers
npx playwright install
```

## Running Tests

### All Tests
```bash
# Run all tests in all browsers
pnpm test:e2e

# Run with watch mode (useful during development)
pnpm test:e2e --watch

# Run headed (see browser UI)
pnpm test:e2e --headed

# Run in UI debug mode
pnpm test:e2e --ui
```

### Specific Test Files
```bash
# Funnel builder tests only
pnpm test:e2e funnel-builder

# Lesson visuals tests only
pnpm test:e2e lesson-visuals

# Free access mode tests only
pnpm test:e2e free-access-mode

# Mobile responsiveness tests only
pnpm test:e2e mobile-responsiveness
```

### Specific Test
```bash
# Run a single test by name
pnpm test:e2e -g "should render lesson at 375px"
```

### Specific Browsers
```bash
# Chrome only
pnpm test:e2e --project=desktop-chrome

# Mobile Safari only
pnpm test:e2e --project=mobile-safari

# Firefox only
pnpm test:e2e --project=desktop-firefox
```

### Debugging
```bash
# Debug mode (pause on each step)
pnpm test:e2e --debug

# Show trace viewer for failed tests
pnpm test:e2e --trace on

# Verbose output
pnpm test:e2e --reporter=list
```

## Test Coverage

### 1. Funnel Builder UI (`funnel-builder.spec.ts`)

Tests for the funnel builder interface:

- ✅ Render all tabs (Funnel Steps, Metrics, Settings, Audience)
- ✅ Tab switching functionality
- ✅ Metric card expansion/collapse
- ✅ Sidebar toggle visibility
- ✅ Add funnel steps
- ✅ Delete funnel steps
- ✅ Display metrics in metrics tab
- ✅ Persist sidebar toggle state
- ✅ Form validation errors
- ✅ Metric updates on step changes

**Data-testid attributes used:**
- `tab-funnel-steps`, `tab-metrics`, `tab-settings`, `tab-audience`
- `funnel-canvas`, `metrics-panel`, `settings-panel`
- `metric-card`, `metric-expand-btn`, `metric-details`
- `funnel-sidebar`, `sidebar-toggle`
- `funnel-step`, `step-menu-btn`, `step-delete-option`
- `add-step-btn`, `step-form`, `step-form-submit`

### 2. Lesson Visuals (`lesson-visuals.spec.ts`)

Tests for lesson rendering and responsiveness:

- ✅ Render all lesson page elements
- ✅ Support different content types (video, text, images)
- ✅ Display lesson progress correctly
- ✅ Navigate between lessons
- ✅ Lesson submission form
- ✅ Responsive at 375px (mobile)
- ✅ Responsive at 768px (tablet)
- ✅ Responsive at 1024px (desktop)
- ✅ Dark mode rendering
- ✅ Dark mode layout consistency
- ✅ Color contrast in dark mode
- ✅ Image preloading
- ✅ Highlight current lesson in sidebar

**Data-testid attributes used:**
- `lesson-header`, `lesson-title`, `lesson-progress`
- `lesson-content`, `lesson-video`, `lesson-sidebar`
- `lesson-footer`, `btn-previous-lesson`, `btn-next-lesson`
- `lesson-submission-form`, `btn-submit-lesson`
- `lesson-image`, `lesson-text-content`
- `progress-text`, `progress-bar-fill`, `lesson-complete-icon`
- `sidebar-toggle`, `lesson-sidebar-item`

### 3. Free-Access Mode (`free-access-mode.spec.ts`)

Tests for free tier lessons without authentication:

- ✅ Access free lessons without login
- ✅ Free access banner displayed
- ✅ Auto-approve submissions (no coach review)
- ✅ Mark lessons complete after submission
- ✅ Allow progression to next lesson
- ✅ No coach approval required
- ✅ Show free access limitations
- ✅ Prompt for signup after free content
- ✅ Persist progress across sessions
- ✅ Access to free resources
- ✅ Display enrollment prompt for premium features
- ✅ Track analytics

**Data-testid attributes used:**
- `free-access-banner`, `free-access-limitations`
- `lesson-submission-form`, `btn-submit-lesson`
- `submission-success`, `lesson-complete-icon`
- `btn-next-lesson`, `signup-prompt`
- `paywall`, `btn-enroll`
- `resource-card`, `resource-content`
- `premium-content`

### 4. Mobile Responsiveness (`mobile-responsiveness.spec.ts`)

Comprehensive viewport testing across device sizes:

#### 375px (Mobile iPhone SE)
- ✅ No horizontal scrolling
- ✅ Sidebar collapses
- ✅ Form fields stack vertically
- ✅ Text is readable (≥14px)
- ✅ Touch targets are 44x44px minimum
- ✅ Long text wraps without overflow

#### 768px (Tablet iPad)
- ✅ Sidebar visible
- ✅ 2-column layout
- ✅ Navigation fully displayed
- ✅ Readable content width

#### 1024px (Desktop Small)
- ✅ Full layout displayed
- ✅ Proper spacing and margins

#### 1280px (Full Desktop)
- ✅ Content maximizes available space

#### Cross-Viewport
- ✅ Navigation works across all viewports
- ✅ Touch interactions on mobile
- ✅ Appropriately-sized images per viewport
- ✅ Keyboard accessibility on mobile
- ✅ Dark mode layout consistency across viewports

## Configuration

### Playwright Config (`playwright.config.ts`)

Key settings:

```typescript
// Test discovery
testDir: './e2e/tests'
fullyParallel: true

// Retries & workers
retries: 2 (CI only)
workers: undefined (uses all cores locally)

// Reporting
reporter: ['html', 'json', 'junit', 'list']

// Screenshots & videos
screenshot: 'only-on-failure'
video: 'retain-on-failure'
trace: 'on-first-retry'

// Base URL for navigation
baseURL: process.env.BASE_URL || 'http://localhost:3000'

// Web server
webServer:
  command: 'pnpm dev'
  url: 'http://localhost:3000'
  reuseExistingServer: !process.env.CI
```

### Browsers Tested

- Chrome (Desktop)
- Firefox (Desktop)
- Safari (Mobile - iPhone 12)
- iPad (Tablet)

## Using Fixtures

### Authentication Fixture

```typescript
import { test, expect, apiLogin, logout, createTestWorkspace } from '../fixtures/auth.fixtures';

test('example', async ({ authenticatedPage: page }) => {
  // page is already logged in
  await page.goto('/dashboard');
});

test('fast login with API', async ({ page }) => {
  // Login programmatically (faster than UI)
  await apiLogin(page, 'test@onevyrt.local', 'TestPassword123!');
});

test('cleanup', async ({ page }) => {
  const workspaceId = await createTestWorkspace(page, 'My Workspace');
  // Use workspace...
  await deleteTestWorkspace(page, workspaceId);
});
```

### Responsive Fixture

```typescript
import { test, testAcrossViewports, testDarkMode } from '../fixtures/responsive.fixtures';

test('test across viewports', async ({ page }) => {
  await testAcrossViewports(page, '/page', async (page, viewport) => {
    // Test code runs at each viewport
    console.log(`Testing ${viewport.name}`);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test('test dark mode', async ({ page }) => {
  await testDarkMode(page, { width: 375, height: 667, name: 'Mobile' }, async (page) => {
    // Dark mode test
    const style = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    console.log('Dark mode background:', style);
  });
});
```

## Data-TestID Convention

All components must include `data-testid` attributes for test reliability:

```tsx
// ✅ Good - clear test selectors
<div data-testid="lesson-content">
  <button data-testid="btn-next-lesson">Next</button>
</div>

// ❌ Bad - no test selector
<div className="content">
  <button>Next</button>
</div>
```

### Naming Convention

- Components: `{feature}-{element}` (e.g., `lesson-header`)
- Buttons: `btn-{action}` (e.g., `btn-submit-lesson`)
- Containers: `{feature}-{section}` (e.g., `funnel-sidebar`)
- Form elements: `{form}-{field}` (e.g., `step-form`)
- Status indicators: `{feature}-{status}` (e.g., `submission-success`)

## Troubleshooting

### Tests fail with "page timeout"
```bash
# Increase timeout in playwright.config.ts
use: { navigationTimeout: 30000 }
```

### Browser download fails
```bash
# Re-install browsers
npx playwright install --with-deps
```

### Tests run slow
```bash
# Increase parallelization
pnpm test:e2e --workers=4
```

### Can't find element
```bash
# Check if element is actually rendered
# Enable trace: true in config for debugging
# Run in UI mode to inspect live
pnpm test:e2e --ui
```

### Dark mode not applying
```bash
# Ensure app responds to prefers-color-scheme
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(500); // Wait for CSS to apply
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: pnpm

      - run: pnpm install
      - run: pnpm run build
      - run: pnpm test:e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: e2e/test-results
          retention-days: 30
```

## Next Steps

1. **Add test fixtures** for other features (e.g., community, coaching)
2. **Expand coverage** for edge cases and error states
3. **Add performance tests** with `page.metrics()`
4. **Set up visual regression testing** with `expect(page).toHaveScreenshot()`
5. **Integrate with Slack** for CI failure notifications
6. **Add accessibility tests** with `@axe-core/playwright`

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Selectors Guide](https://playwright.dev/docs/selectors)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)
