# Bundle Size Optimization Guide

## Overview

ONEVYRT uses a multi-faceted approach to optimize bundle size, targeting a **20-30% reduction** in the final production bundle through code splitting, dependency optimization, SVG compression, and lazy loading strategies.

**Target Bundle Sizes (Gzipped):**
- Main bundle: < 100 KB
- Per-chunk: < 50 KB
- Total: < 300 KB
- Individual chunks: Framework (80 KB), Payments (20 KB), Editors (40 KB), PDF (25 KB)

---

## 1. Webpack Configuration & Code Splitting

### Overview

The `next.config.ts` implements aggressive webpack optimizations:

```typescript
// apps/web/next.config.ts

// Tree-shaking: Remove unused code
usedExports: true
sideEffects: false
minimize: true

// Code splitting into specific chunks:
framework (React, React-DOM, Next.js)
payments (Stripe, payment libraries)
editors (@xyflow, visualization libraries)
pdf (jsPDF, PDF generation)
utilities (@onevyrt, state management)
commons (shared code)
```

### How It Works

1. **Framework Split**: React, React-DOM, and Next.js are isolated into a separate chunk that changes rarely, enabling better browser caching.

2. **Heavy Dependencies Split**: Large libraries like @xyflow (drag-and-drop canvas) and jsPDF are split into dedicated chunks, loaded only when needed.

3. **Tree-Shaking**: Unused exports are automatically removed during the build. Ensures that importing from a large library doesn't include unused functions.

4. **Package Import Optimization**: The `optimizePackageImports` experimental feature automatically tree-shakes specific packages:
   ```typescript
   optimizePackageImports: [
     '@heroicons/react',
     'jspdf',
     '@xyflow/react',
     '@onevyrt/engine',
     'zustand',
   ]
   ```

### How to Test

```bash
# Analyze bundle composition
pnpm build:analyze

# This opens an interactive visualization of what's in each chunk.
# Look for:
# - Unexpectedly large libraries
# - Duplicated code
# - Unused dependencies
```

---

## 2. Lazy Loading Strategy

### Registry

All lazy-loaded components are centralized in `components/lazy-components.tsx`:

```typescript
import { LazyFunnelCanvasBuilder } from '@/components/lazy-components';

// Components only load when the route is accessed
export default function StudioPage() {
  return <LazyFunnelCanvasBuilder />;
}
```

### Categories

#### Studio Components (150-200 KB)
- `LazyFunnelCanvasBuilder` — Drag-and-drop funnel editor
- `LazyInspectorPanels` — Property inspector
- `LazyReportPanels` — Analytics
- `LazySimulatePanels` — Simulation engine

**Strategy**: Load only when user navigates to `/studio`

#### Education Components (50-100 KB)
- `LazyFunnelCalculator` — ROI calculator
- `LazyDropoffAnalysis` — Funnel visualization
- `LazyQualificationWizard` — Lead qualification

**Strategy**: Load when user views `/programme/lesson` pages

#### Coach & Programme Components (100-150 KB)
- `LazyGrowthImprovementPlan` — Chapter 4 artifact
- `LazyTransformationReport` — Journey report

(`LazyProgramCentre`/`LazyProgrammeCentre` previously documented here were
removed 2026-09 as dead code — never actually imported anywhere; the real
app renders `ProgramCentre.tsx`/`ProgrammeCentre.tsx` directly.)

**Strategy**: Load on respective routes, not in initial bundle

### Estimated Savings

With this strategy:
- Initial bundle: **-150-200 KB** (these components not included)
- Per-route chunks: **+10-20 KB** (only loaded when needed)
- **Net saving: 130-180 KB per initial load**

### Adding New Lazy Components

1. Create the component normally
2. Add export to `components/lazy-components.tsx`:
   ```typescript
   export const LazyMyComponent = dynamic(
     () => import('./MyComponent'),
     {
       loading: LazyLoadingFallback,
       ssr: false, // Set to true if component supports SSR
     }
   );
   ```
3. Import from lazy-components instead of direct import:
   ```typescript
   import { LazyMyComponent } from '@/components/lazy-components';
   ```

---

## 3. SVG Optimization

### Webpack Configuration

SVGs are automatically optimized at build time using SVGO:

```typescript
// In next.config.ts webpack config
config.module.rules.push({
  test: /\.svg$/,
  use: [
    {
      loader: '@svgr/webpack',
      options: {
        svgoConfig: {
          plugins: [
            {
              name: 'preset-default',
              params: {
                overrides: {
                  removeViewBox: false,
                  convertPathData: { precision: 2 },
                  cleanupNumericValues: { floatToShort: true },
                },
              },
            },
          ],
        },
      },
    },
  ],
});
```

### Optimization Settings

**Default** (Lossless):
- Remove unnecessary whitespace
- Reduce path precision to 2 decimal places
- Remove default attribute values
- Remove empty containers
- Estimated savings: **20-30%**

**Aggressive** (For production):
- All defaults + remove viewBox
- Reduce path precision to 1 decimal place
- Estimated savings: **30-45%**
- Risk: May affect responsiveness of some SVGs

### Usage

**Option 1: Automatic via Webpack**
```typescript
import { MyIcon } from '@/icons/my-icon.svg'; // Automatically optimized

export function MyComponent() {
  return <MyIcon />;
}
```

**Option 2: Static Image**
```typescript
import Image from 'next/image';
import myIcon from '@/public/icons/my-icon.svg';

export function MyComponent() {
  return <Image src={myIcon} alt="Icon" />;
}
```

### Manual SVG Optimization

Use the SVG optimization utilities:

```typescript
import {
  generateSVGOptimizationReport,
  printSVGOptimizationReport,
  DEFAULT_SVG_OPTIMIZATION,
} from '@/lib/svg-optimization';

// Check optimization potential
const report = generateSVGOptimizationReport(svgFileSize);
printSVGOptimizationReport(report, 'my-icon.svg');
```

---

## 4. Bundle Size Monitoring

### Automated Checks

Run after each build:

```bash
# Check bundle against targets
pnpm build
pnpm bundle:check

# Output:
# ✓ main.js              45 KB
# ✓ framework.js         65 KB
# ✗ libs-heavy.js        55 KB (exceeds 50 KB target)
```

### Generate Detailed Report

```bash
# After build, generate comparison report
pnpm bundle:report

# Creates BUNDLE_REPORT.md with:
# - Comparison to previous baseline
# - Chunk-by-chunk breakdown
# - Optimization opportunities
```

### CI/CD Integration

Add to GitHub Actions (`.github/workflows/build.yml`):

```yaml
- name: Build
  run: pnpm build

- name: Check Bundle Size
  run: pnpm bundle:check
  
# Fails if any chunk exceeds size targets
```

### Baseline Tracking

The `.bundle-sizes.json` file tracks your bundle size over time:

```json
{
  "timestamp": "2024-09-03T10:30:00Z",
  "bundles": {
    "main.js": { "gzipSize": 45000, "rawSize": 150000 },
    "framework.js": { "gzipSize": 65000, "rawSize": 220000 }
  },
  "total": 280000,
  "results": { "passedChecks": 8, "failedChecks": 0 }
}
```

---

## 5. Image Optimization

### Next.js Image Configuration

```typescript
images: {
  formats: ['image/avif', 'image/webp'], // Modern formats, 40-50% smaller
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 31536000, // Cache for 1 year
}
```

### Usage

```typescript
import Image from 'next/image';

export function MyImage() {
  return (
    <Image
      src="/path/to/image.jpg"
      alt="Description"
      width={800}
      height={600}
      priority={false} // Lazy load by default
      quality={75} // Balance quality vs size
      sizes="(max-width: 768px) 100vw, 50vw"
    />
  );
}
```

### Savings
- **Format conversion**: JPEG → WebP/AVIF saves **40-50%**
- **Responsive sizing**: Serves appropriately-sized images, saves **30-50%** per user
- **Caching**: 1-year TTL reduces server load

---

## 6. Dependency Audit

### Finding Unused Dependencies

```bash
# Check for unused packages
npm install depcheck --global
depcheck

# Check for duplicate packages
npm ls [package-name]

# Identify large dependencies
pnpm build:analyze
# Look at bundle visualization for unexpected large packages
```

### Common Optimization Opportunities

| Package | Alternative | Size Saving |
|---------|-------------|------------|
| moment.js | date-fns | 40-60 KB |
| lodash | lodash-es (with tree-shaking) | 50-70 KB |
| @material-ui | Just use components you need | 30-50 KB |
| react-query | swr or native fetch | 20-30 KB |

### Current Dependencies

See `apps/web/package.json` for all dependencies. Key ones:
- `@heroicons/react` (2.2.0) — Auto tree-shaken
- `@xyflow/react` (12.10.2) — Separate chunk
- `jspdf` (4.2.1) — Separate chunk
- `pg` (8.23.0) — Server-only, not in bundle
- `nodemailer` (9.0.1) — Server-only, not in bundle

---

## 7. Tailwind CSS Optimization

### Configuration

`tailwind.config.optimized.cjs` includes production optimizations:

```javascript
// Purge unused utilities in production
purge: {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    // Dynamically added utility classes
    /^bg-/,
    /^text-/,
  ],
}

// Only include utilities actually used in your code
// Savings: 30-50 KB (CSS is typically small; mostly JS)
```

### Usage

```bash
# Build automatically uses optimized config in production
pnpm build

# Dev uses full config for development convenience
pnpm dev
```

---

## 8. Performance Monitoring

### Web Vitals

Monitor real user performance:

```typescript
import { initWebVitals } from '@/lib/performance';

useEffect(() => {
  initWebVitals(); // Tracks LCP, FID, CLS, FCP, TTFB
}, []);
```

### Build Performance

```bash
# Time the build
time pnpm build

# Profile a specific route
PROFILE=true pnpm build
```

---

## 9. Optimization Checklist

### Development

- [ ] Use `LazyComponent` from `lazy-components.tsx` for route-specific code
- [ ] Import only what you need from large libraries (@heroicons, etc.)
- [ ] Avoid importing entire libraries at top level
- [ ] Use dynamic imports for heavy calculations or third-party libraries
- [ ] SVGs: Use optimization utilities before committing

### Before Merging

- [ ] Run `pnpm build:analyze` to check for unexpected growth
- [ ] Look for duplicate dependencies in bundle
- [ ] Ensure lazy loading is used for new large components
- [ ] Test bundle size on slower networks (Chrome DevTools: throttle)

### Before Releasing

- [ ] Run `pnpm bundle:check` — must pass all checks
- [ ] Run `pnpm bundle:report` — review comparison
- [ ] Check CI/CD pipeline: bundle-check should pass
- [ ] Monitor Web Vitals after deployment

---

## 10. Target Metrics & Goals

### Current State (Baseline)
- Establish baseline by running `pnpm build && pnpm bundle:check`

### Target (20-30% Reduction)
- Main bundle: < 100 KB (gzipped)
- Per-chunk: < 50 KB (gzipped)
- Total: < 300 KB (gzipped)
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1

### Measurement

```bash
# After optimization
pnpm build:analyze
pnpm bundle:check
pnpm bundle:report

# Compare to baseline in BUNDLE_REPORT.md
# Should show 20-30% reduction in total size
```

---

## 11. Common Issues & Solutions

### Issue: Bundle Still Large After Optimization

**Solution:**
1. Run `pnpm build:analyze` to identify culprits
2. Check for duplicate dependencies: `npm ls <package>`
3. Verify lazy loading is actually being used
4. Look for large images or assets in public/

### Issue: Components Not Lazy Loading

**Symptoms:** Component still in main bundle despite using `dynamic()`

**Solution:**
1. Ensure using `ssr: false` for interactive components
2. Check that component is actually route-specific
3. Use absolute imports, not relative imports
4. Avoid importing at top level of the page component

### Issue: SVG Still Large

**Solution:**
1. Run `pnpm build:analyze`, check SVG sizes
2. Manually optimize in design tool (remove groups, simplify paths)
3. Consider using CSS for simple shapes
4. Use `<img>` tag instead of React component for static SVGs

---

## 12. Resources

- [Next.js Bundle Analysis](https://nextjs.org/docs/advanced-features/analyzing-bundles)
- [Webpack Bundle Analyzer](https://github.com/webpack-bundle-analyzer/webpack-bundle-analyzer)
- [SVGO Documentation](https://svgo.dev/)
- [Web Vitals](https://web.dev/vitals/)
- [Chrome DevTools Performance Tab](https://developer.chrome.com/docs/devtools/evaluate-performance/)

---

## Summary

Achieving a **20-30% bundle reduction** requires coordination across:

1. **Code Splitting** — Separate framework, payments, editors into chunks
2. **Lazy Loading** — Studio and large components load on-demand
3. **SVG Optimization** — SVGO reduces SVG sizes by 20-45%
4. **Dependency Audit** — Remove unused packages
5. **Image Optimization** — WebP/AVIF formats save 40-50%
6. **Monitoring** — Track bundle size after each build

**Start with**: `pnpm build:analyze` to visualize your bundle, then focus optimizations on the largest chunks.
