# Package.json Updates for E2E Tests

Add the following to your project's `package.json`:

## Scripts

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:watch": "playwright test --watch",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:mobile": "playwright test --project=mobile-safari",
    "test:e2e:chrome": "playwright test --project=desktop-chrome",
    "test:e2e:firefox": "playwright test --project=desktop-firefox",
    "test:e2e:report": "playwright show-report e2e/test-results"
  }
}
```

## DevDependencies

```json
{
  "devDependencies": {
    "@playwright/test": "^1.46.0",
    "@testing-library/playwright": "^0.2.0"
  }
}
```

## Installation

```bash
# Install packages
pnpm add -D @playwright/test @testing-library/playwright

# Install Playwright browsers
npx playwright install

# Install system dependencies (Linux)
npx playwright install-deps
```

## Complete Example

Here's what a typical section of your root `package.json` should look like:

```json
{
  "name": "onevyrt",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:watch": "playwright test --watch",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:report": "playwright show-report e2e/test-results"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "prisma": "^5.0.0",
    "stripe": "^13.0.0",
    "@onevyrt/engine": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "vitest": "^1.0.0",
    "@playwright/test": "^1.46.0",
    "@testing-library/playwright": "^0.2.0"
  },
  "pnpm": {
    "overrides": {
      "some-package": "1.0.0"
    }
  }
}
```

## GitHub Actions CI/CD Setup

Add this workflow file at `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master, develop]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Build application
        run: pnpm run build

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: e2e/test-results
          retention-days: 30

      - name: Upload test videos
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-videos
          path: e2e/test-results/**/*.webm
          retention-days: 7

      - name: Publish test report
        if: always()
        uses: dorny/test-reporter@v1
        with:
          name: Playwright Test Results
          path: e2e/results.json
          reporter: java-junit
```

## Local Testing Workflow

```bash
# Install everything first
pnpm install
pnpm exec playwright install

# Start development server in one terminal
pnpm dev

# In another terminal, run tests
pnpm test:e2e

# Or run with UI for debugging
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e funnel-builder.spec.ts

# Run with headed browser
pnpm test:e2e:headed

# View test report
pnpm test:e2e:report
```

## Environment Variables

Create `.env.e2e` for E2E test configuration:

```env
# Base URL for tests
BASE_URL=http://localhost:3000

# Test user credentials
TEST_EMAIL=test@onevyrt.local
TEST_PASSWORD=TestPassword123!

# Test workspace
TEST_WORKSPACE_ID=test-workspace-123

# Optional: Disable animations for faster tests
PLAYWRIGHT_DISABLE_ANIMATIONS=true

# Optional: Slow down tests for debugging
PLAYWRIGHT_SLOW_MOTION=500

# CI detection
CI=true
```

Then load in `playwright.config.ts`:

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '.env.e2e' });

export default defineConfig({
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
  },
});
```

## VS Code Extensions (Recommended)

Install these extensions for better E2E development experience:

1. **Playwright Test for VSCode** by Microsoft
   - Run tests directly from editor
   - Debug support
   - Install: `ms-playwright.playwright`

2. **Playwright Inspector**
   - Built-in debugging
   - Element inspection
   - Install with: `npx playwright open-trace`

## Troubleshooting Installation

### Issue: `playwright install` fails

```bash
# Try with system dependencies
npx playwright install-deps

# Or manually install browsers
npx playwright install chromium firefox webkit
```

### Issue: Tests timeout on CI

Update `.github/workflows/e2e.yml`:

```yaml
- name: Run E2E tests
  run: pnpm test:e2e
  timeout-minutes: 60  # Increase timeout
  env:
    PLAYWRIGHT_LAUNCH_ARGS: --no-sandbox
```

### Issue: Port 3000 already in use

```bash
# Kill existing process
lsof -ti:3000 | xargs kill -9

# Or use different port
BASE_URL=http://localhost:3001 pnpm test:e2e
```
