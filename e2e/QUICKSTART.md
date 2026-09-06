# E2E Test Suite - Quick Start Guide

Get ONEVYRT E2E tests running in 5 minutes.

## 1. Install Dependencies

```bash
# Install test framework and browsers
pnpm add -D @playwright/test @testing-library/playwright
pnpm exec playwright install
```

## 2. Update package.json

Copy the scripts from `PACKAGE_JSON_SNIPPET.md` into your root `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:watch": "playwright test --watch",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## 3. Start Development Server

In one terminal:

```bash
pnpm dev
```

Wait for: `ready - started server on 0.0.0.0:3000`

## 4. Run Tests

In another terminal:

```bash
# Run all tests
pnpm test:e2e

# Or use UI mode to see tests live
pnpm test:e2e:ui

# Or run headed (see browser)
pnpm test:e2e:headed
```

## 5. View Results

After tests complete:

```bash
# View HTML report
pnpm test:e2e:report
```

## Test Organization

```
e2e/
├── fixtures/
│   ├── auth.fixtures.ts           # Login & workspace helpers
│   └── responsive.fixtures.ts      # Viewport helpers
├── tests/
│   ├── funnel-builder.spec.ts      # Funnel UI tests (11 tests)
│   ├── lesson-visuals.spec.ts      # Lesson rendering (13 tests)
│   ├── free-access-mode.spec.ts    # Free tier tests (11 tests)
│   └── mobile-responsiveness.spec.ts # Responsive tests (17 tests)
├── helpers/
│   └── test-helpers.ts              # Common utilities
├── playwright.config.ts             # Playwright config
├── tsconfig.json                    # TypeScript config
└── README.md                        # Full documentation
```

## Common Commands

```bash
# Run specific test file
pnpm test:e2e funnel-builder

# Run single test by name
pnpm test:e2e -g "should render lesson at 375px"

# Run on Chrome only
pnpm test:e2e --project=desktop-chrome

# Run on mobile
pnpm test:e2e --project=mobile-safari

# Debug mode (pause on each step)
pnpm test:e2e --debug

# Watch mode (re-run on file change)
pnpm test:e2e --watch
```

## What's Tested

| Suite | Tests | Coverage |
|-------|-------|----------|
| **Funnel Builder** | 11 | UI tabs, metrics, sidebar, CRUD |
| **Lesson Visuals** | 13 | Rendering, dark mode, responsive, navigation |
| **Free-Access Mode** | 11 | Free lessons, auto-approve, no login required |
| **Mobile Responsiveness** | 17 | 375px, 768px, 1024px, 1280px viewports |
| **TOTAL** | 52 | End-to-end user flows |

## Test Files Checklist

Ensure all components have `data-testid` attributes:

### Funnel Builder Component
```tsx
// ✅ Required test IDs
<div data-testid="funnel-sidebar">
  <button data-testid="sidebar-toggle">Toggle</button>
</div>
<div data-testid="funnel-canvas">
  <div data-testid="funnel-step">Step 1</div>
  <button data-testid="add-step-btn">Add Step</button>
</div>
<div data-testid="metrics-panel">
  <div data-testid="metric-card">
    <button data-testid="metric-expand-btn">Expand</button>
  </div>
</div>
```

### Lesson Component
```tsx
// ✅ Required test IDs
<div data-testid="lesson-header">
  <h1 data-testid="lesson-title">Lesson Title</h1>
  <div data-testid="lesson-progress">
    <div data-testid="progress-bar-fill">60%</div>
    <span data-testid="progress-text">6 of 10</span>
  </div>
</div>

<div data-testid="lesson-content">
  <video data-testid="lesson-video"><source /></video>
  <img data-testid="lesson-image" alt="..." />
</div>

<div data-testid="lesson-sidebar">
  <div data-testid="lesson-sidebar-item" aria-current="true">Active Lesson</div>
</div>

<div data-testid="lesson-footer">
  <button data-testid="btn-previous-lesson">Previous</button>
  <button data-testid="btn-next-lesson">Next</button>
</div>

<form data-testid="lesson-submission-form">
  <button data-testid="btn-submit-lesson">Submit</button>
</form>

<div data-testid="submission-success">Approved!</div>
```

### Free-Access Banner
```tsx
<div data-testid="free-access-banner">
  Free access to this lesson
</div>
<div data-testid="free-access-limitations">
  Upgrade to unlock premium features
</div>
```

## Debugging Failed Tests

```bash
# 1. Run in debug mode
pnpm test:e2e --debug

# 2. Or run in UI mode to inspect
pnpm test:e2e:ui

# 3. Check screenshots/videos (on failure)
open e2e/test-results

# 4. Enable trace for detailed debugging
# Add to test:
test.only('debug test', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // Pauses here - use inspector
});
```

## Performance Tips

```bash
# Reduce parallelization for stability
pnpm test:e2e --workers=1

# Run tests serially (slower but more reliable)
pnpm test:e2e --fully-parallel=false

# Increase timeout for slow servers
PLAYWRIGHT_TIMEOUT=30000 pnpm test:e2e
```

## GitHub Actions Setup

1. Copy this to `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: npx playwright install --with-deps
      - run: pnpm build
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: e2e/test-results
```

2. Push to trigger workflow

3. View results in GitHub Actions tab

## Next Steps

1. **Run tests** and fix any failures
2. **Add data-testid** to components not yet covered
3. **Extend tests** for your specific business logic
4. **Add visual regression** tests with `expect(page).toHaveScreenshot()`
5. **Set up CI/CD** with GitHub Actions
6. **Monitor test health** via GitHub Actions dashboard

## File Structure Created

```
e2e/
├── fixtures/
│   ├── auth.fixtures.ts              ← Auth helpers
│   └── responsive.fixtures.ts         ← Responsive testing
├── helpers/
│   └── test-helpers.ts                ← Common utilities
├── tests/
│   ├── funnel-builder.spec.ts         ← Funnel tests
│   ├── lesson-visuals.spec.ts         ← Lesson tests
│   ├── free-access-mode.spec.ts       ← Free tier tests
│   └── mobile-responsiveness.spec.ts  ← Responsive tests
├── playwright.config.ts               ← Playwright config
├── tsconfig.json                      ← TypeScript config
├── QUICKSTART.md                      ← This file
├── README.md                          ← Full docs
└── PACKAGE_JSON_SNIPPET.md            ← Dependencies guide
```

## Troubleshooting

### "Port 3000 already in use"
```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9
# Or use different port
BASE_URL=http://localhost:3001 pnpm test:e2e
```

### "Timeout waiting for element"
```bash
# Increase global timeout
pnpm test:e2e --timeout=60000

# Or in specific test:
test.setTimeout(60000);
```

### "Test fails on CI but passes locally"
```bash
# Add debugging
test.only('debug', async ({ page }) => {
  page.on('console', msg => console.log(msg));
  // your test...
});

# Run with trace
PLAYWRIGHT_TRACE=on pnpm test:e2e
```

### "Screenshots not generated"
```bash
# Ensure screenshot-on-failure is enabled
# Check playwright.config.ts has:
use: {
  screenshot: 'only-on-failure',
  video: 'retain-on-failure'
}
```

## Support

- **Playwright Docs**: https://playwright.dev
- **VS Code Extension**: `ms-playwright.playwright`
- **Debug Guide**: https://playwright.dev/docs/debug

---

**Ready to test?** Run:
```bash
pnpm test:e2e:ui
```

Enjoy! 🎭
