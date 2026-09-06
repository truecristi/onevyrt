# Performance Optimization Guide

## Overview

This guide documents performance optimization strategies implemented for ONEVYRT. The goal is to maintain fast load times, smooth interactions, and efficient resource usage as the application scales.

**Current Targets:**
- Initial bundle: < 100 KB (gzipped)
- Route chunks: < 50 KB (gzipped)
- LCP (Largest Contentful Paint): < 2.5 seconds
- FID (First Input Delay): < 100 milliseconds
- CLS (Cumulative Layout Shift): < 0.1

## 1. Bundle Size Optimization

### Largest Components (Lazy Loading Candidates)

These components should be lazy-loaded to reduce initial bundle:

| Component | Size | Lines | Strategy |
|-----------|------|-------|----------|
| ProgramCentre.tsx | ~25 KB | 1657 | Route-based lazy loading |
| ProgrammeCentre.tsx | ~15 KB | 908 | Route-based lazy loading |
| FunnelCanvasBuilder.tsx | ~12 KB | 721 | Route-based lazy loading |
| FunnelTemplateGallery.tsx | ~11 KB | 678 | Route-based lazy loading |
| DropoffAnalysis.tsx | ~10 KB | 674 | Route-based lazy loading |

### Implementation: Lazy Loading

Use the `components/lazy-studio.tsx` module:

```typescript
// Import lazy components
import { 
  LazyFunnelCanvasBuilder, 
  LazyFunnelCalculator 
} from '@/components/lazy-studio';

export default function StudioPage() {
  return (
    <div>
      <h1>Studio</h1>
      {/* Only loaded when component mounts */}
      <LazyFunnelCanvasBuilder />
    </div>
  );
}
```

Note: `LazyProgramCentre`/`LazyProgrammeCentre` previously documented here were
never actually wired up — the real app imports `ProgramCentre.tsx`/
`ProgrammeCentre.tsx` directly (`app/psychology/business-intelligence/page.tsx`,
`app/funnel-studio.tsx`), not lazily. Removed from `lazy-components.tsx`/
`lazy-studio.tsx` as dead code rather than left as a misleading claim.

### Webpack Configuration

Optimized in `next.config.ts`:

1. **Aggressive Tree-Shaking**
   - Enabled `usedExports` for dead code elimination
   - Set `sideEffects: false` for module analysis

2. **Vendor Code Splitting**
   - React/Next.js in separate `framework` chunk
   - jsPDF and @xyflow in `libs-heavy` chunk
   - Common code in `commons` chunk

3. **Optimized Package Imports**
   - Auto tree-shake: @heroicons/react, jspdf, @xyflow/react
   - Reduces unused code in bundle

### Build Analysis

To analyze bundle size:

```bash
# Build with bundle analyzer
ANALYZE=true pnpm build

# Review bundle-report.html for largest modules
```

## 2. Image Optimization

### Formats

Images are automatically optimized to WebP/AVIF formats (40-50% smaller than JPEG):

```typescript
// Automatic with next/image component
import Image from 'next/image';

<Image
  src="/path/to/image.jpg"
  alt="Description"
  width={1200}
  height={600}
  sizes="(max-width: 768px) 100vw, 50vw"
  quality={75}
  priority={false} // Lazy load by default
/>
```

### Responsive Images

Use srcset for responsive loading:

```typescript
import { generateImageSrcset } from '@/lib/performance';

const srcset = generateImageSrcset('/images/hero.jpg', 1200);
// Generates: /images/hero.jpg?w=320&q=75 320w, /images/hero.jpg?w=640&q=75 640w, ...

<img srcset={srcset} alt="Hero" />
```

### Image Breakpoints

Configured in `next.config.ts`:
- Device sizes: 640px, 750px, 828px, 1080px, 1200px, 1920px, 2048px, 3840px
- Caching: 1 year TTL for versioned assets

## 3. Code Splitting Strategy

### Route-Based Splitting

Large components automatically split by route:

```
Initial Bundle: React + Router + Common Components (~50-80 KB)
  ↓
/studio → Lazy load studio components (~40-60 KB chunk)
/programme → Lazy load programme components (~30-50 KB chunk)
/projects → Lazy load canvas editor (~30-50 KB chunk)
```

### Prefetching Hints

Add to frequently visited routes:

```typescript
// In layout.tsx or _app.tsx
import Link from 'next/link';

<Link href="/studio" prefetch={true}>
  Open Studio
</Link>

// Or manually:
import { useRouter } from 'next/router';
const router = useRouter();
router.prefetch('/studio');
```

## 4. CSS Optimization

### Tailwind CSS Purging

Unused Tailwind classes are automatically purged:

- **Dev mode:** All classes available
- **Production:** Only used classes included
- **Safelist:** Keep essential dynamic classes

See `lib/css-optimization.ts` for configuration.

### Critical CSS

Critical styles for above-the-fold content:

```typescript
// Inline critical styles in HTML head
<style dangerouslySetInnerHTML={{ __html: criticalStyles }} />

// Lazy load non-critical CSS
<link rel="preload" as="style" href="/non-critical.css" />
```

### CSS Performance Tips

1. **Avoid expensive selectors**
   - Bad: `body > div > .section > p { ... }`
   - Good: `.content p { ... }`

2. **Use CSS containment**
   ```css
   .isolated-component {
     contain: content;
     /* Prevents style recalculation cascade */
   }
   ```

3. **Animations (GPU accelerated only)**
   ```css
   /* Use transform and opacity */
   .animated {
     transition: transform 0.3s, opacity 0.3s;
     transform: translateX(50px);
   }

   /* Avoid: triggers layout recalc */
   .bad-animation {
     transition: width 0.3s;
   }
   ```

## 5. Font Optimization

### System Fonts (Recommended)

Use system font stack for instant rendering:

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", 
               Roboto, "Helvetica Neue", sans-serif;
  font-display: swap; /* Show fallback immediately */
}
```

### Font Subsetting

If custom fonts needed:

```typescript
// Preload critical font
<link 
  rel="preload" 
  as="font" 
  href="/fonts/inter-var.woff2" 
  type="font/woff2"
  crossOrigin="anonymous"
/>

// Use variable font for all weights
<style>{`
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-var.woff2') format('woff2');
    font-weight: 100 900;
    font-display: swap;
  }
`}</style>
```

## 6. Database Query Optimization

### Indexing Strategy

Add indexes for frequently filtered columns:

```sql
-- Users table
CREATE INDEX idx_users_email ON users(email) 
  WHERE deleted_at IS NULL;

-- Projects table
CREATE INDEX idx_projects_workspace_deleted 
  ON projects(workspace_id, deleted_at);

-- Enrollments table
CREATE INDEX idx_enrollments_workspace_modified 
  ON enrollments(workspace_id, last_modified_at);
```

### Query Patterns

**Eliminate N+1 queries:**
```typescript
// SLOW (N+1)
const projects = await getProjects(workspaceId);
for (const p of projects) {
  const metrics = await getMetrics(p.id); // N queries!
}

// FAST (1 query)
const projectsWithMetrics = await db.query(`
  SELECT p.*, json_agg(m.*) as metrics
  FROM projects p
  LEFT JOIN metrics m ON m.project_id = p.id
  WHERE p.workspace_id = $1
  GROUP BY p.id
`, [workspaceId]);
```

**Use pagination:**
```typescript
const pageSize = 50;
const offset = (page - 1) * pageSize;

const items = await db.query(`
  SELECT * FROM projects
  WHERE workspace_id = $1 AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT $2 OFFSET $3
`, [workspaceId, pageSize, offset]);
```

### Connection Pooling

Configured in `lib/db.ts`:

```typescript
const pool = new Pool({
  max: 20,              // Max connections
  min: 5,               // Idle connections
  idleTimeoutMillis: 30000, // Close idle after 30s
  connectionTimeoutMillis: 5000,
});
```

## 7. API Performance

### Response Compression

Enable gzip/brotli in Next.js (automatic):

```typescript
// Middleware for API routes
export function withCompression(handler) {
  return async (req, res) => {
    res.setHeader('Content-Encoding', 'gzip');
    return handler(req, res);
  };
}
```

### Pagination

All list endpoints should support pagination:

```typescript
GET /api/projects?page=1&limit=50&sort=-created_at

Response:
{
  data: [...],
  total: 150,
  page: 1,
  pages: 3,
  nextCursor: "..."
}
```

### Caching

Cache responses with appropriate TTL:

```typescript
res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
// For immutable assets
res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
```

## 8. Web Vitals Monitoring

### Core Web Vitals

Monitor these metrics:

1. **LCP (Largest Contentful Paint)** - Visual completeness
   - Target: < 2.5 seconds
   - Optimize: Reduce render-blocking resources

2. **FID (First Input Delay)** - Interactivity
   - Target: < 100 milliseconds
   - Optimize: Reduce main thread work

3. **CLS (Cumulative Layout Shift)** - Visual stability
   - Target: < 0.1
   - Optimize: Reserve space for dynamic content

### Implementation

```typescript
// Auto-enabled via lib/performance.ts
import { initWebVitals } from '@/lib/performance';

useEffect(() => {
  initWebVitals();
}, []);

// Reports to /api/analytics/web-vitals
```

## 9. Performance Monitoring

### Metrics to Track

```bash
# Build metrics
pnpm build 2>&1 | tee build.log

# Analyze output:
# - Static pages generated: X
# - Server functions: Y
# - API routes: Z
# - Total build time

# Runtime metrics (via Vercel Dashboard)
# - Core Web Vitals
# - Response times
# - Error rate
```

### Local Testing

```bash
# Lighthouse CLI
npx lighthouse https://localhost:3000 --view

# Chrome DevTools Audits
# 1. Open DevTools (F12)
# 2. Go to Lighthouse tab
# 3. Run audit for Desktop/Mobile
```

## 10. Performance Budgets

### Monthly Checks

- **Initial JS bundle:** < 100 KB (gzipped)
- **Per-route chunks:** < 50 KB (gzipped)
- **Third-party JS:** < 50 KB total (gzipped)
- **CSS:** < 30 KB (gzipped)
- **Images:** < 100 KB average

### Regression Prevention

```bash
# In CI/CD pipeline
# If bundle size increased by > 10%, fail build
npm run build && npm run analyze
```

## 11. Quick Reference

### Files to Modify

| File | Purpose |
|------|---------|
| `next.config.ts` | Webpack, image optimization |
| `lib/performance.ts` | Performance utilities |
| `components/lazy-studio.tsx` | Lazy component exports |
| `lib/css-optimization.ts` | CSS best practices |
| `lib/db-optimization.ts` | Database strategies |

### Common Tasks

**Lazy load a component:**
```typescript
import dynamic from 'next/dynamic';
const MyComponent = dynamic(() => import('./MyComponent'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

**Optimize an image:**
```typescript
<Image 
  src="/image.jpg" 
  alt="..." 
  width={1200} 
  height={600}
  quality={75}
/>
```

**Analyze bundle:**
```bash
ANALYZE=true pnpm build
```

**Test performance:**
```bash
npx lighthouse https://onevyrt.masteryresearch.com --view
```

## Resources

- [Next.js Performance](https://nextjs.org/learn/foundations/how-nextjs-works/rendering)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://www.webpagetest.org)
- [Webpack Bundle Analyzer](https://github.com/webpack-bundle-analyzer/webpack-bundle-analyzer)
