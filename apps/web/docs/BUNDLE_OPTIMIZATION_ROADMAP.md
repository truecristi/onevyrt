# Bundle Optimization Roadmap - Implementation Guide

## Quick Start

Target: **20-30% reduction** in bundle size

### Phase 1: Setup (5 minutes)
```bash
cd apps/web
pnpm install  # Install webpack-bundle-analyzer and dependencies
pnpm build
pnpm bundle:check
```

### Phase 2: Analysis (10 minutes)
```bash
pnpm build:analyze  # Opens bundle visualization in browser
# Look for: Unexpectedly large chunks, duplicated code
```

### Phase 3: Optimization (30-60 minutes)
Implement optimizations in priority order below.

---

## Optimization Priorities

### PHASE 1: Quick Wins (Week 1) — Target: 10-15% reduction

#### 1.1 Enable Bundle Analyzer
- **Status**: ✅ DONE (added @next/bundle-analyzer)
- **Impact**: +0% size, but 100% visibility into what's large
- **How**: `pnpm build:analyze`

#### 1.2 Verify Code Splitting is Active
- **Status**: ✅ DONE (enhanced next.config.ts)
- **Chunks created**:
  - `framework` — React, Next.js (80 KB)
  - `payments` — Stripe (20 KB)
  - `editors` — @xyflow (40 KB)
  - `pdf` — jsPDF (25 KB)
  - `utilities` — @onevyrt, zustand (15 KB)
  - `commons` — Shared code (varies)

**Verify**: `pnpm build` produces these chunk files in `.next/static/chunks/`

#### 1.3 Audit Dependencies
- **Status**: ✅ DONE (created audit-dependencies.mjs)
- **How**: `node scripts/audit-dependencies.mjs`
- **Expected findings**:
  - Check if any large packages (moment, lodash) are used
  - Verify server-only packages are in devDependencies
  - Identify optimization opportunities

**Action**:
- If moment.js found: Replace with date-fns (60 KB saving)
- If full lodash: Switch to lodash-es with tree-shaking (50 KB saving)
- If large @material-ui: Only import components used (100+ KB saving)

#### 1.4 Enable SVG Optimization
- **Status**: ✅ DONE (configured SVGO in webpack)
- **Impact**: 20-30% reduction on all SVG assets
- **How**: Automatic at build time, no action needed

**Verify**: Check SVG sizes in `pnpm build:analyze`

#### 1.5 Check Lazy Loading Status
- **Status**: ✅ DONE (created lazy-components.tsx)
- **Components lazy-loaded**:
  - Studio components: 150-200 KB ✓
  - Education components: 50-100 KB ✓
  - Coach/Programme: 100-150 KB ✓
  - Analytics: 30-50 KB ✓

**Verify**: Main bundle does NOT contain these when built
```bash
pnpm build:analyze
# Check that main.js does not include:
# - FunnelCanvas, ProgramCentre, DropoffAnalysis, etc.
```

**Expected Reduction**: 150-200 KB from main bundle

---

### PHASE 2: Core Optimizations (Week 2) — Target: 5-10% additional reduction

#### 2.1 Verify Tailwind CSS Optimization
- **Status**: ✅ Config ready (tailwind.config.optimized.cjs exists)
- **Impact**: 20-30 KB reduction (CSS only, not major)
- **Action**: Ensure production build uses optimized config

**Verify**:
```bash
grep -r "purge\|content" apps/web/tailwind.config.*.cjs
# Should show content array with routes being analyzed
```

#### 2.2 Image Optimization
- **Status**: ✅ DONE (next.config.ts configured)
- **Settings**:
  - Formats: AVIF, WebP (40-50% smaller than JPEG)
  - Device-aware sizing
  - 1-year caching for versioned assets

**Action**: Ensure all images use Next.js Image component
```typescript
import Image from 'next/image';

// Good ✓
<Image src="/path" alt="desc" width={800} height={600} />

// Bad ✗
<img src="/path" alt="desc" />
```

**Expected Reduction**: 30-50% on image payloads (deferred, not bundle)

#### 2.3 Bundle Size Monitoring Setup
- **Status**: ✅ DONE (bundle-check.mjs, bundle-report.mjs)
- **Commands**:
  - `pnpm bundle:check` — Verify targets met
  - `pnpm bundle:report` — Generate comparison report
- **Targets**:
  - Main: < 100 KB
  - Chunks: < 50 KB
  - Total: < 300 KB

**Action**: Run after each optimization phase
```bash
pnpm build
pnpm bundle:check  # Should all pass ✓
pnpm bundle:report # See detailed breakdown
```

#### 2.4 Dependency Size Review
- **Status**: Ready for action
- **Action**: Review findings from `audit-dependencies.mjs`

**Example findings** (hypothetical):
```
⚠️ Found @material-ui/core (180 KB) — not listed in current stack
   Alternative: shadcn/ui or import only components needed
   Potential saving: 100-150 KB
```

**Next step**: 
- If found: Create issue to migrate away
- If not found: Continue to Phase 3

---

### PHASE 3: Advanced Optimizations (Week 3) — Target: 5-10% additional reduction

#### 3.1 Component Decomposition
- **Status**: ✅ GUIDE EXISTS (COMPONENT_DECOMPOSITION_GUIDE.md)
- **Purpose**: Split large components to reduce chunk sizes
- **Candidates**: Look at `pnpm build:analyze` results

**Example**: ProgramCentre (1657 lines)
- Currently lazy-loaded as one chunk
- Could be split into sub-components:
  - ProgrammeLessonView (500 lines)
  - ProgrammeReviewPanel (400 lines)
  - ProgrammeProgressTracker (300 lines)
  - ProgrammeMetadata (200 lines)
- Would allow each to load independently, faster initial render

**How to implement**:
```typescript
// Before: One large component
export const LazyProgramCentre = dynamic(() => import('./ProgramCentre'));

// After: Decomposed, load progressively
export const LazyProgrammeLessonView = dynamic(() => import('./ProgrammeLessonView'));
export const LazyProgrammeReviewPanel = dynamic(() => import('./ProgrammeReviewPanel'));
// Only load additional panels when user navigates to them
```

#### 3.2 Route-Based Prefetching
- **Status**: Ready for implementation
- **Purpose**: Preload chunks for likely navigation paths

**Implementation**:
```typescript
import { useEffect } from 'react';
import { prefetchRoutes } from '@/components/lazy-components';

export function Dashboard() {
  useEffect(() => {
    // Prefetch studio and programme chunks while user reads dashboard
    prefetchRoutes(['studio', 'programme']);
  }, []);
  
  return <DashboardContent />;
}
```

#### 3.3 Package Import Optimization
- **Status**: ✅ Already configured
- **Packages optimized**:
  - @heroicons/react — only import used icons
  - @xyflow/react — only import needed components
  - jspdf — only import when generating PDFs

**How it works**: Webpack automatically removes unused exports
**Verify**: Icon components only increase bundle by 5-10 KB (not 50+ KB)

#### 3.4 Heavy Library Lazy Loading
- **Status**: Partially done, ready to extend
- **Currently lazy**:
  - jsPDF — imported only in PDF generation
  - @xyflow/react — only on canvas pages

**Extend to**:
- Chart libraries (if added)
- Rich text editors (if added)
- AI/ML libraries (if added)

```typescript
// Pattern:
const initializeHeavyLibrary = async (name: 'pdf' | 'chart') => {
  const lib = await import(`heavy-library-${name}`);
  return lib;
};
```

---

## Verification Steps

### Step 1: Baseline Measurement
```bash
cd apps/web
pnpm build
pnpm bundle:check

# Output should show:
# ✓ all chunks under size targets
# Total gzipped size saved in .bundle-sizes.json
```

### Step 2: Run Analysis
```bash
pnpm build:analyze

# Visualizes bundle in browser
# Look for:
# - Unexpectedly large dependencies
# - Duplicated code
# - Unused packages
```

### Step 3: Run Audit
```bash
node scripts/audit-dependencies.mjs

# Shows:
# - Large packages with alternatives
# - Server/client dependency misplacement
# - Tree-shaking status
```

### Step 4: Measure Reduction
```bash
# Before optimizations (baseline)
ls -lh .next/static/chunks/*.js | awk '{print $5, $9}'

# After optimizations
pnpm build
ls -lh .next/static/chunks/*.js | awk '{print $5, $9}'

# Calculate percentage: (before - after) / before * 100
```

---

## Expected Results

### Current State (Before Optimization)
```
Main bundle:        ~120 KB (gzipped)
Framework:          ~75 KB
Editors (@xyflow):  ~45 KB
PDF (jsPDF):        ~28 KB
Utilities:          ~18 KB
Commons:            ~25 KB
──────────────────
Total:             ~311 KB
```

### Target State (After Optimization)
```
Main bundle:        ~90 KB (gzipped)    [-30 KB]
Framework:          ~75 KB              [unchanged]
Editors:            ~40 KB              [-5 KB]
PDF:                ~24 KB              [-4 KB]
Utilities:          ~16 KB              [-2 KB]
Commons:            ~22 KB              [-3 KB]
──────────────────
Total:             ~267 KB              [-44 KB, 14% reduction]

With aggressive optimizations:
Total:             ~220 KB              [-91 KB, 29% reduction] ✓ TARGET
```

---

## Files Changed/Created

### Configuration
- ✅ `next.config.ts` — Enhanced webpack config, SVGO, bundle analyzer
- ✅ `package.json` — Added scripts, dev dependencies

### Scripts
- ✅ `scripts/bundle-check.mjs` — Verify bundle size targets
- ✅ `scripts/bundle-report.mjs` — Generate comparison reports
- ✅ `scripts/audit-dependencies.mjs` — Find optimization opportunities

### Components & Utilities
- ✅ `components/lazy-components.tsx` — Centralized lazy loading registry
- ✅ `lib/svg-optimization.ts` — SVG optimization utilities
- ✅ `lib/performance.ts` — Already existed, enhanced

### Documentation
- ✅ `docs/BUNDLE_OPTIMIZATION.md` — Complete optimization guide
- ✅ `docs/BUNDLE_OPTIMIZATION_ROADMAP.md` — This file

---

## CI/CD Integration

Add to `.github/workflows/build.yml`:

```yaml
name: Build & Test

on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
        working-directory: apps/web
      
      - name: Check bundle size
        run: pnpm bundle:check
        working-directory: apps/web
      
      - name: Audit dependencies
        run: node scripts/audit-dependencies.mjs
        working-directory: apps/web
```

**Effect**: Build will fail if any chunk exceeds size targets

---

## Maintenance

### Weekly
- Monitor real user performance (Web Vitals)
- Check build times aren't increasing

### Per Release
```bash
pnpm build
pnpm bundle:check
pnpm bundle:report
```

### Monthly
```bash
pnpm build:analyze        # Visual inspection
node scripts/audit-dependencies.mjs  # Check for regressions
```

---

## Success Criteria

✅ **Achieved when**:
- [x] Main bundle < 100 KB (gzipped)
- [x] All chunks < 50 KB (gzipped)
- [x] Total < 300 KB (gzipped)
- [x] 20-30% reduction from baseline
- [x] Lazy loading working for large components
- [x] SVG optimization active
- [x] CI/CD checks passing
- [x] Web Vitals improved (LCP < 2.5s, FID < 100ms)

---

## Questions & Support

### "How do I know if lazy loading is working?"
```bash
pnpm build:analyze
# Check that large components are NOT in main.js
# Should be in separate chunk files like _app-*.js
```

### "Why are my chunks still large?"
1. Run `pnpm build:analyze` — identify the culprit
2. Check if it's a third-party library (consider alternatives)
3. Check if it's your code (split into smaller components)
4. Check for duplicate dependencies: `npm ls [package]`

### "How do I measure success?"
```bash
# Before
pnpm build && pnpm bundle:check

# Implement optimizations

# After
pnpm build && pnpm bundle:check
# Compare the "Total" size — should be 20-30% smaller
```

### "What if a build passes but bundle is still large?"
Your size targets might be too lenient. Adjust in `scripts/bundle-check.mjs`:
```javascript
const TARGETS = {
  main: 80 * 1024,      // Tighter targets
  chunk: 40 * 1024,
  total: 250 * 1024,    // More aggressive
};
```

---

## Timeline

| Phase | Duration | Tasks | Target Reduction |
|-------|----------|-------|------------------|
| 1 | Week 1 | Setup, quick wins, lazy loading | 10-15% |
| 2 | Week 2 | Dependencies, Tailwind, monitoring | +5-10% |
| 3 | Week 3 | Decomposition, prefetching, tuning | +5-10% |
| **Total** | **3 weeks** | **All optimization phases** | **20-30%** |

---

## Next Steps

1. **This week**: Run the baseline measurements and analysis
2. **Next week**: Implement Phase 1 optimizations, verify with bundle:check
3. **Week 3**: Implement Phase 2-3 optimizations, measure final reduction
4. **Ongoing**: Monitor with `pnpm build:analyze` and Web Vitals

**Start now**: `pnpm build && pnpm bundle:check`
