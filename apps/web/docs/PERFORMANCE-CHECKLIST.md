# Performance Optimization Checklist

Use this checklist when developing new features to ensure performance doesn't regress.

## Pre-Development

- [ ] Review component size with `find components -name "*.tsx" -exec wc -l {} \; | sort -rn`
- [ ] Check if feature involves heavy library (PDF, charts, canvas)
- [ ] Plan for lazy loading if component will be > 500 lines
- [ ] Identify data fetching needs and pagination strategy

## During Development

### Bundle Size

- [ ] Component < 500 lines (split if larger)
- [ ] Heavy dependencies imported dynamically, not at top-level
- [ ] No unused imports or commented-out code
- [ ] Tree-shaking friendly (ES modules, no side effects)

### Images

- [ ] Use `next/image` component (never `<img>`)
- [ ] Provide responsive sizes: `sizes="(max-width: 768px) 100vw, 50vw"`
- [ ] Set `quality={75}` (default 100)
- [ ] Add `loading="lazy"` for below-fold images
- [ ] Provide alt text for accessibility

### Code Splitting

- [ ] Large modals/panels use dynamic import
- [ ] Canvas/heavy features use dynamic import with `ssr: false`
- [ ] Route components import from `components/lazy-studio.tsx` if large
- [ ] No circular dependencies blocking tree-shaking

### CSS & Styling

- [ ] Use Tailwind utilities (not inline styles)
- [ ] Avoid `!important` (use proper cascade)
- [ ] No unused CSS classes
- [ ] Animations use `transform` and `opacity` (GPU accelerated)
- [ ] Critical above-fold styles inlined, non-critical deferred

### Fonts

- [ ] Use system font stack (avoid Google Fonts unless necessary)
- [ ] If custom fonts: preload, subset, use `font-display: swap`
- [ ] Variable fonts preferred (single file, all weights)

### Database & API

- [ ] List endpoints implement pagination (max 50-100 items)
- [ ] No N+1 queries (use JOINs instead of loops)
- [ ] Expensive queries cached with appropriate TTL
- [ ] API responses < 1 MB per endpoint
- [ ] Batch operations for bulk writes

### Animations

- [ ] Animate only transform/opacity (GPU accelerated)
- [ ] Use `requestAnimationFrame` for smooth 60fps
- [ ] No animations on scroll (use Intersection Observer instead)
- [ ] Test on low-end devices (iPhone 6, Android budget phones)

## Before Deployment

### Testing

- [ ] `npm run build` completes without warnings
- [ ] No TypeScript errors in modified files
- [ ] Lighthouse score >= 90 for Performance
- [ ] Time to Interactive < 3 seconds

### Performance Measurements

- [ ] Bundle size increase < 10 KB
- [ ] Route chunk size < 50 KB (gzipped)
- [ ] LCP decrease or no change (ideally < 2.5s)
- [ ] No CLS regressions (ideally < 0.1)

### Code Quality

- [ ] No console.log statements left
- [ ] No commented-out code
- [ ] ESLint passes: `npm run lint`
- [ ] No circular dependencies
- [ ] Proper error boundaries for lazy components

## After Deployment

### Monitoring

- [ ] Check Vercel analytics for performance regression
- [ ] Monitor Core Web Vitals for 24 hours
- [ ] No spike in error rates
- [ ] Database query performance unchanged

### Documentation

- [ ] Update CLAUDE.md if adding new patterns
- [ ] Document heavy components that need lazy loading
- [ ] Add performance tips to component JSDoc
- [ ] Update PERFORMANCE.md if new strategies implemented

## Performance Anti-Patterns (Avoid!)

### ❌ Don't:

```typescript
// 1. Import everything at top-level
import { ProgramCentre } from '@/components/ProgramCentre'; // Large component!

// 2. Use useEffect for expensive operations on render
useEffect(() => {
  expensiveCalculation(); // Runs on every render!
}, []); // Missing dependency array

// 3. Create new objects in render
const config = { x: 1, y: 2 }; // New object every render
<MyComponent config={config} /> // Unnecessary re-render

// 4. Missing dependency in useCallback
const handleClick = useCallback(() => {
  doSomething(data); // Missing 'data' in deps
}, []);

// 5. Inline styles (not optimizable by Tailwind)
<div style={{ color: 'red', padding: '10px' }} />

// 6. Fetching data without pagination
SELECT * FROM large_table; // Could return millions!

// 7. Animating expensive properties
transform: `translate(${x}px, ${y}px)`; // Avoid in hot loops

// 8. Loading all images eagerly
<Image src={url} priority={true} /> // Only for above-fold

// 9. Global listeners without cleanup
window.addEventListener('scroll', handler); // Memory leak!

// 10. Serializing large objects to localStorage
localStorage.setItem('big', JSON.stringify(hugeObject)); // Slows down page
```

### ✅ Do:

```typescript
// 1. Lazy load large components
const ProgramCentre = dynamic(() => import('@/components/ProgramCentre'));

// 2. Optimize effects with proper dependencies
useEffect(() => {
  setupListener();
  return () => cleanup();
}, [dependency]); // Correct dependencies

// 3. Memoize objects/functions
const config = useMemo(() => ({ x: 1, y: 2 }), []);
<MyComponent config={config} />;

// 4. Include all dependencies
const handleClick = useCallback(() => {
  doSomething(data);
}, [data]); // Include all deps

// 5. Use Tailwind classes
<div className="text-red-600 p-2.5" />

// 6. Implement pagination
SELECT * FROM large_table LIMIT 50 OFFSET $1;

// 7. Animate GPU-accelerated properties
transform: `translateX(${x}px)` // GPU accelerated

// 8. Load images lazily by default
<Image src={url} /> // Lazy by default, use priority only for LCP

// 9. Clean up listeners
window.addEventListener('scroll', handler);
return () => window.removeEventListener('scroll', handler);

// 10. Cache selectively
const cached = useMemo(() => JSON.parse(small_json), []);
// Only cache what's expensive
```

## Common Performance Issues

### Issue: Large Initial Bundle

**Symptoms:** LCP > 3s, Time to Interactive > 4s

**Solution:**
```typescript
// Identify culprit
ANALYZE=true pnpm build

// Split into chunks
const HeavyComponent = dynamic(() => import('./Heavy'));
```

### Issue: Slow Route Navigation

**Symptoms:** Page transitions feel sluggish

**Solution:**
```typescript
// Prefetch routes
import { useRouter } from 'next/router';
const router = useRouter();
router.prefetch('/studio');

// Use shallow routing for simple state
router.push('/studio?tab=editor', undefined, { shallow: true });
```

### Issue: Layout Shift After Load

**Symptoms:** CLS regression, jank on interaction

**Solution:**
```typescript
// Reserve space for dynamic content
<div className="h-10"> {/* Reserve height before load */}
  {data && <DataComponent data={data} />}
</div>

// Or use Skeleton loader
<Skeleton height={40} />
```

### Issue: N+1 Database Queries

**Symptoms:** API response time increases with load

**Solution:**
```typescript
// Use JOIN instead of loop
const data = await db.query(`
  SELECT p.*, json_agg(m.*) as metrics
  FROM projects p
  LEFT JOIN metrics m ON m.project_id = p.id
  WHERE p.workspace_id = $1
  GROUP BY p.id
`);
```

### Issue: CSS Bundle Growing

**Symptoms:** Main CSS chunk > 50 KB, slow paint

**Solution:**
```typescript
// Review Tailwind safelist - remove unnecessary
// Remove unused @apply rules
// Split non-critical CSS into separate chunk

// In next.config.ts
const { withOptimizedCss } = require('@next/bundle-analyzer');
module.exports = withOptimizedCss({
  // config
});
```

## Performance Tools

| Tool | Purpose | Command |
|------|---------|---------|
| Lighthouse | Audit performance | `npx lighthouse https://localhost:3000` |
| WebPageTest | Real-world testing | https://www.webpagetest.org |
| Chrome DevTools | Debug performance | F12 → Performance tab |
| Next.js Analyzer | Bundle size | `ANALYZE=true pnpm build` |
| SpeedCurve | Monitor trends | https://www.speedcurve.com |
| Vercel Analytics | Production metrics | Dashboard |

## Resources

- [Web Vitals Guide](https://web.dev/vitals/)
- [Next.js Performance](https://nextjs.org/learn/seo/web-performance)
- [React Performance](https://react.dev/reference/react/Profiler)
- [CSS Performance](https://developer.mozilla.org/en-US/docs/Learn/Performance/CSS)
- [Database Performance](https://www.postgresql.org/docs/current/performance.html)
