# Design Tokens v4 Implementation Checklist

## Phase 1: Setup (Day 1)

### Files & Dependencies
- [x] Create `design-tokens-optimized.css` (3.2KB gzip, core tokens)
- [x] Create `design-tokens-extended.css` (2.1KB gzip, lazy-loaded)
- [x] Create `token-metadata.json` (tree-shaking metadata)
- [x] Create `token-benchmark.ts` (performance measurement)
- [x] Create `token-lazy-loader.ts` (lazy-loading utility)
- [x] Create `tailwind.config.optimized.cjs` (updated Tailwind config)
- [x] Create documentation (`README.md`, `PERFORMANCE_OPTIMIZATION_GUIDE.md`)

### Initial Integration
- [ ] Backup existing design tokens: `cp design-tokens-enhanced.css design-tokens-enhanced.css.v3`
- [ ] Update `app/layout.tsx` to import `design-tokens-optimized.css`:
  ```typescript
  import '@/app/design-tokens-optimized.css'
  ```
- [ ] Verify CSS loads without errors (check browser console)
- [ ] Test light and dark mode toggle
- [ ] Run `TokenBenchmark.quickBench()` in browser console

### Performance Baseline
- [ ] Measure current page load time (no changes)
- [ ] Run `TokenBenchmark.detailedBench()` and save results
- [ ] Record bundle size: `npm run build && du -h .next`
- [ ] Document baseline metrics in `token-metadata.json`

---

## Phase 2: Tailwind Configuration (Day 2)

### Config Migration
- [ ] Review current `tailwind.config.cjs` for custom extensions
- [ ] Copy custom extensions to `tailwind.config.optimized.cjs`
- [ ] Replace `tailwind.config.cjs` with optimized version:
  ```bash
  mv tailwind.config.cjs tailwind.config.v3.bak
  mv tailwind.config.optimized.cjs tailwind.config.cjs
  ```
- [ ] Run `npm run build` to regenerate Tailwind utilities
- [ ] Verify build completes without warnings

### Validation
- [ ] Check that all Tailwind color utilities still work
- [ ] Verify dark mode switching in DevTools (set `data-theme="dark"`)
- [ ] Test responsive classes (mobile, tablet, desktop)
- [ ] Inspect generated CSS for expected variable references

---

## Phase 3: Component Migration (Days 3-5)

### Search & Replace
- [ ] Find all `--ds-` CSS variable references:
  ```bash
  grep -r "--ds-" apps/web/components --include="*.css" --include="*.tsx"
  ```
- [ ] Find all Tailwind classes using old color naming:
  ```bash
  grep -r "bg-ds-\|text-ds-\|border-ds-" apps/web/components --include="*.tsx"
  ```

### Color Class Updates

**Priority 1: Most Common (First)**
- [ ] `bg-ds-brand` → `bg-action`
- [ ] `text-ds-text` → `text-text-primary`
- [ ] `border-ds-border` → `border-border-default`
- [ ] `bg-ds-surface` → `bg-bg-surface`

**Priority 2: Status Colors**
- [ ] `bg-ds-success` → `bg-status-success`
- [ ] `bg-ds-warning` → `bg-status-warning`
- [ ] `bg-ds-danger` → `bg-status-danger`
- [ ] `bg-ds-info` → `bg-status-info`

**Priority 3: Chapter Colors**
- [ ] `text-ds-chapter-define` → `text-chapter-define`
- [ ] `bg-ds-chapter-implement` → `bg-chapter-implement`
- [ ] (Similar for all 6 chapters)

**Priority 4: CSS Variables**
- [ ] Update hardcoded `--ds-*` to new names
- [ ] Test each component after update

### Verification
- [ ] Visual regression testing (screenshot diff)
- [ ] Test all interactive states (hover, active, focus)
- [ ] Verify dark mode works on updated components
- [ ] Check accessibility (focus rings, contrast ratios)

---

## Phase 4: Testing (Days 6-7)

### Functional Testing
- [ ] Light mode: All colors display correctly
- [ ] Dark mode: All colors display correctly
- [ ] Theme toggle: Switching is smooth (~45ms)
- [ ] All buttons work with new action classes
- [ ] All status indicators show correct colors
- [ ] Chapter progress indicators display correct colors

### Performance Testing
- [ ] Measure new page load time
- [ ] Run `TokenBenchmark.quickBench()` and compare
- [ ] Check token access time < 0.1ms
- [ ] Verify dark mode switch < 100ms
- [ ] Compare bundle sizes (should be ~6.7% smaller)

### Accessibility Testing
- [ ] WCAG AA contrast compliance (4.5:1 minimum)
- [ ] WCAG AAA contrast (7:1 preferred)
- [ ] Focus ring visibility on all interactive elements
- [ ] Keyboard navigation works
- [ ] Screen reader testing (NVDA, JAWS, or VoiceOver)
- [ ] Test with `prefers-reduced-motion` enabled

### Cross-Browser Testing
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

### Device Testing
- [ ] Desktop (1920x1080)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)
- [ ] Low-end mobile (throttle 4x CPU)

---

## Phase 5: Deployment (Day 8)

### Pre-Deployment
- [ ] Create feature branch: `git checkout -b feat/design-tokens-v4`
- [ ] Commit changes with clear messages
- [ ] Run full test suite: `npm test`
- [ ] Build for production: `npm run build`
- [ ] Verify no console errors or warnings

### CI/CD Integration
- [ ] Add token benchmark to CI pipeline:
  ```javascript
  // scripts/verify-token-performance.js
  const { TokenBenchmark } = require('./lib/design-tokens/token-benchmark.ts')
  const results = TokenBenchmark.quickBench()
  if (results.results.overallMetrics.avgAccessTimeMs > 0.1) {
    throw new Error('Token access time degraded')
  }
  ```
- [ ] Add to GitHub Actions workflow
- [ ] Test CI run locally first

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run full end-to-end tests
- [ ] Performance testing (Lighthouse)
- [ ] User acceptance testing (internal team)

### Production Deployment
- [ ] Create pull request with detailed description
- [ ] Link to migration guide
- [ ] Get code review approval
- [ ] Merge to main
- [ ] Deploy to production
- [ ] Monitor error rates and performance metrics

### Post-Deployment
- [ ] Monitor Sentry/error tracking for issues
- [ ] Check performance metrics (Core Web Vitals)
- [ ] Monitor token access patterns via benchmarking
- [ ] Collect user feedback
- [ ] Document any edge cases found

---

## Phase 6: Optimization & Monitoring (Ongoing)

### Lazy Loading
- [ ] Monitor which token categories are being lazy-loaded
- [ ] Analyze lazy-load patterns across user base
- [ ] Optimize pre-load triggers if needed
- [ ] Consider pre-loading for heavy pages

### Performance Monitoring
- [ ] Set up continuous benchmarking (weekly)
- [ ] Track token access times over time
- [ ] Monitor CSS bundle size
- [ ] Track dark mode switch latency
- [ ] Alert on performance regressions (>10% degradation)

### User Feedback
- [ ] Collect feedback from design/dev teams
- [ ] Track any issues with dark mode
- [ ] Monitor accessibility complaints
- [ ] Document improvements needed

### Future Improvements
- [ ] Post-build CSS tree-shaking for unused tokens
- [ ] Experiment with CSS-in-JS if needed
- [ ] Consider CSS containment for performance
- [ ] Evaluate CSS nesting for readability

---

## Rollback Plan

If issues occur during deployment:

### Quick Rollback (< 5 minutes)
1. Revert to previous CSS import in `app/layout.tsx`
2. Reset `tailwind.config.cjs` to v3 backup
3. Redeploy

### Full Rollback (< 30 minutes)
1. Revert commit: `git revert HEAD`
2. Reset Tailwind config
3. Restore old token imports
4. Redeploy and verify

### Post-Incident
- [ ] Document what went wrong
- [ ] Create fix for issue
- [ ] Test fix thoroughly before re-deploying
- [ ] Update testing checklist to prevent recurrence

---

## Success Criteria

### Performance ✓ Must Achieve
- [ ] CSS bundle: ≤ 5.3KB gzip (5% tolerance)
- [ ] Token access: ≤ 0.1ms average
- [ ] Dark mode switch: ≤ 100ms (including repaint)
- [ ] Page load: No regression (< +2% overhead)

### Functionality ✓ Must Maintain
- [ ] All light mode colors identical
- [ ] All dark mode colors identical
- [ ] Theme switching works smoothly
- [ ] No console errors or warnings

### Accessibility ✓ Must Maintain
- [ ] WCAG AA compliance (4.5:1 contrast)
- [ ] Focus ring visibility
- [ ] Reduced motion support
- [ ] Keyboard navigation

### Code Quality ✓ Must Improve
- [ ] Reduced CSS payload (-34.6%)
- [ ] Improved maintainability (flat structure)
- [ ] Better tooling (benchmarking, lazy-loading)
- [ ] Clear documentation

---

## Sign-Off

- [ ] QA Lead: _______________________ Date: _______
- [ ] Design Lead: __________________ Date: _______
- [ ] Dev Lead: _____________________ Date: _______
- [ ] Product: ______________________ Date: _______

---

## Appendix: Quick Links

- **Documentation:** `README.md`, `PERFORMANCE_OPTIMIZATION_GUIDE.md`
- **Files:**
  - CSS (Core): `design-tokens-optimized.css`
  - CSS (Extended): `design-tokens-extended.css`
  - Metadata: `token-metadata.json`
  - Benchmark: `token-benchmark.ts`
  - Lazy Loader: `token-lazy-loader.ts`
  - Config: `tailwind.config.optimized.cjs`

- **Monitoring:**
  - Benchmark: `TokenBenchmark.quickBench()` in console
  - Lazy Loading: `TokenLazyLoader.logReport()` in console
  - Performance: Lighthouse, Chrome DevTools

---

**Last Updated:** 2026-09-03
**Version:** 4.0.0
