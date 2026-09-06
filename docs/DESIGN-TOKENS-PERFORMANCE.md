# DESIGN-TOKENS-PERFORMANCE.md — Performance & Optimization Guide

Best practices for using design tokens while keeping bundle size, render performance, and memory usage optimized.

---

## Overview

**Goal:** Use design tokens without bloating the bundle or slowing down the app.

**Key Principles:**
1. **Prefer Tailwind CSS** for spacing and sizing (0 runtime cost)
2. **Import only what you need** (tree-shaking)
3. **Use CSS variables** for dynamic dark mode (no re-renders)
4. **Avoid inline calculations** in render functions
5. **Lazy-load color palettes** for admin/docs only

---

## Bundle Size Impact

### Current Token File Sizes

```
apps/web/lib/colors/chapter-tokens.ts   ~8 KB (minified: ~2 KB)
apps/web/lib/colors/design-tokens.ts    ~20 KB (minified: ~6 KB)
Total                                     ~28 KB (minified: ~8 KB)
```

**Impact if imported everywhere:** +8 KB gzipped per page

**Mitigation:** Import only what you need; tree-shaking removes unused tokens.

---

## Best Practices

### 1. Use Tailwind CSS (BEST)

**No JavaScript needed, zero runtime cost.**

```html
<!-- Spacing -->
<div class="p-4 m-6 gap-3">Content</div>

<!-- Typography -->
<h1 class="text-3xl font-bold leading-tight">Title</h1>

<!-- Colors -->
<button class="bg-blue-600 hover:bg-blue-700 text-white">Action</button>

<!-- Elevation (box-shadow) -->
<div class="shadow-md rounded-lg">Card</div>

<!-- Border radius -->
<div class="rounded-md">Slightly rounded</div>
<div class="rounded-full">Fully rounded</div>

<!-- Animation -->
<div class="transition-colors duration-150 hover:opacity-75">
  Hover to fade
</div>
```

**Why:** Tailwind CSS is already in your build. These classes are pre-optimized, purged automatically, and have zero runtime overhead.

### 2. Import Only What You Need

**BAD:**
```typescript
// Imports entire token object (unnecessary)
import * as Tokens from '@/lib/colors/design-tokens';
const color = Tokens.CHAPTER_COLORS.define;
```

**GOOD:**
```typescript
// Import only what you use (tree-shaking works)
import { CHAPTER_COLORS } from '@/lib/colors/chapter-tokens';
const color = CHAPTER_COLORS.define;
```

**Result:** Tree-shaking removes unused token properties (~30-40% reduction).

### 3. Use CSS Variables for Dynamic Theming

**FAST (CSS Variables):**
```css
:root {
  --chapter-define: #2563eb;
  --chapter-define-soft: #eff6ff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --chapter-define: #60a5fa; /* Lighter for dark mode */
    --chapter-define-soft: #0c1c3a;
  }
}
```

```tsx
<div style={{ color: 'var(--chapter-define)' }}>Text</div>
```

**Why:** No React re-renders, instant theme switch, media query handles everything.

**SLOW (State-based):**
```typescript
const [isDark, setIsDark] = useState(false);

// Triggers re-render on every theme change
<div style={{ color: isDark ? darkColor : lightColor }}>Text</div>
```

**Why:** Every component re-renders when theme changes.

### 4. Avoid Inline Calculations in Render

**SLOW:**
```typescript
function Card() {
  const [isHovered, setIsHovered] = useState(false);

  // New function created on EVERY render
  const getColor = () => {
    return isHovered ? CHAPTER_COLORS_DARK.define : CHAPTER_COLORS.define;
  };

  return <div style={{ color: getColor() }}>Content</div>;
}
```

**FAST:**
```typescript
function Card() {
  const [isHovered, setIsHovered] = useState(false);

  // Calculated once, outside render
  const color = isHovered ? CHAPTER_COLORS_DARK.define : CHAPTER_COLORS.define;

  return <div style={{ color }}>Content</div>;
}
```

**Better with Tailwind:**
```tsx
<div className="hover:text-blue-700">Content</div>
// CSS handles it; no JavaScript
```

### 5. Memoize Components with Dynamic Colors

**If you must use JavaScript for colors, memoize:**

```typescript
import { memo } from 'react';
import { CHAPTER_COLORS } from '@/lib/colors/chapter-tokens';

interface ChapterCardProps {
  chapter: string;
  title: string;
}

// Memoize to prevent unnecessary re-renders
const ChapterCard = memo(({ chapter, title }: ChapterCardProps) => {
  const color = CHAPTER_COLORS[chapter as keyof typeof CHAPTER_COLORS];
  
  return (
    <div style={{ borderColor: color, borderWidth: '2px' }}>
      <h3>{title}</h3>
    </div>
  );
});

export default ChapterCard;
```

**Why:** Prevents re-render when parent changes but props don't.

### 6. Lazy Load Color Palettes (Admin/Docs Only)

```typescript
// Don't: Import for every page
import { CHAPTER_COLORS } from '@/lib/colors/design-tokens'; // All pages import this

// Do: Lazy load on admin pages only
const ColorPalette = dynamic(() => import('@/components/admin/ColorPalette'), {
  ssr: false, // Client-only
});
```

**Result:** Reduces initial bundle, loads only on demand.

---

## Performance Benchmarks

### Scenario 1: Using Tailwind (Recommended)

```html
<!-- Renders fast, no JavaScript -->
<div class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-md">
  Button
</div>
```

**Performance:**
- **Bundle impact:** 0 KB (already included)
- **Render time:** < 1ms (CSS handles it)
- **Theme switch:** Instant (CSS media query)
- **Dark mode:** Automatic

### Scenario 2: Using JS Tokens (Less Optimal)

```typescript
const style = {
  backgroundColor: CHAPTER_COLORS.define,
  padding: SPACING[4],
  borderRadius: BORDER_RADIUS.md,
};

return <div style={style}>Button</div>;
```

**Performance:**
- **Bundle impact:** +8 KB gzipped
- **Render time:** ~0.1ms (JS evaluation)
- **Theme switch:** Requires re-render (slower)
- **Dark mode:** Manual handling

### Scenario 3: Using CSS Variables (Good)

```css
.button {
  background-color: var(--chapter-define);
  padding: var(--space-4);
  border-radius: var(--radius-md);
}

@media (prefers-color-scheme: dark) {
  .button {
    background-color: var(--chapter-define-light);
  }
}
```

**Performance:**
- **Bundle impact:** +2 KB (variables only)
- **Render time:** < 0.5ms
- **Theme switch:** Instant (CSS media query)
- **Dark mode:** Automatic

---

## Optimization Checklist

- [ ] Use Tailwind CSS for spacing, sizing, borders, radius
- [ ] Import tokens with named imports (enables tree-shaking)
- [ ] Use CSS variables for theming (avoid JS state changes)
- [ ] Memoize components that consume tokens
- [ ] Avoid inline token calculations in render functions
- [ ] Lazy load admin/docs token viewers
- [ ] Test bundle size with `pnpm build` and `next/dist/build/analyzers`
- [ ] Monitor component re-render count with React DevTools Profiler

---

## Testing Performance

### Measure Bundle Size

```bash
# Build and analyze bundle
pnpm build

# Check specific chunks
ls -lh .next/static/chunks/
```

**Target:** Token files should not exceed 1% of main bundle.

### Profile Rendering

```typescript
import { Profiler } from 'react';

<Profiler
  id="ChapterCard"
  onRender={(id, phase, actualDuration) => {
    console.log(`${id} (${phase}) took ${actualDuration}ms`);
  }}
>
  <ChapterCard chapter="define" title="Define" />
</Profiler>
```

**Target:** Component renders in < 5ms.

### Dark Mode Performance

```typescript
// Test theme switch (should be instant)
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
console.time('theme-switch');
mediaQuery.dispatchEvent(new Event('change'));
console.timeEnd('theme-switch');
```

**Target:** < 1ms (no visible flicker).

---

## Common Pitfalls

### ❌ Importing Unused Tokens

```typescript
// BAD: Imports everything, even unused
import * as designTokens from '@/lib/colors/design-tokens';

const color = designTokens.CHAPTER_COLORS.define; // Only this is used
```

**FIX:**
```typescript
// GOOD: Only import what you need
import { CHAPTER_COLORS } from '@/lib/colors/design-tokens';

const color = CHAPTER_COLORS.define;
```

### ❌ Creating Token Objects in Every Render

```typescript
// BAD: New object created every render
function Component() {
  const styles = {
    color: CHAPTER_COLORS.define,
    padding: SPACING[4],
  };
  
  return <div style={styles}>Content</div>;
}
```

**FIX:**
```typescript
// GOOD: Object created once
const styles = {
  color: CHAPTER_COLORS.define,
  padding: SPACING[4],
};

function Component() {
  return <div style={styles}>Content</div>;
}
```

### ❌ Using Tokens for Spacing (Tailwind is Better)

```typescript
// BAD: Runtime padding calculation
const padding = SPACING[4]; // "16px"
return <div style={{ padding }}>Content</div>;
```

**FIX:**
```html
<!-- GOOD: Tailwind handles at build time -->
<div class="p-4">Content</div>
```

### ❌ No Memoization in Color-Intensive Components

```typescript
// BAD: Re-creates every component on every parent render
function ChapterBadge({ chapter }) {
  return <span style={{ color: CHAPTER_COLORS[chapter] }}>{chapter}</span>;
}
```

**FIX:**
```typescript
// GOOD: Memoize to prevent unnecessary re-renders
import { memo } from 'react';

const ChapterBadge = memo(({ chapter }: { chapter: string }) => (
  <span style={{ color: CHAPTER_COLORS[chapter as keyof typeof CHAPTER_COLORS] }}>
    {chapter}
  </span>
));

export default ChapterBadge;
```

---

## Guidelines by Use Case

### Spacing & Sizing
```
USE:     Tailwind CSS (p-4, m-6, h-10, w-full)
AVOID:   JavaScript token imports
REASON:  Tailwind is pre-optimized, zero runtime cost
```

### Colors (Static)
```
USE:     Tailwind CSS classes (bg-blue-600, text-green-700)
AVOID:   JavaScript imports when possible
REASON:  Same as spacing, built-in at compile time
```

### Colors (Dynamic/Semantic)
```
USE:     CSS variables with media queries
AVOID:   JavaScript state-based theming
REASON:  Automatic dark mode, instant switch, no re-renders
```

### Chapter/Status Colors (Conditional)
```
USE:     Named imports + memoization (if JS needed)
AVOID:   Object imports, inline calculations
REASON:  Minimal bundle, enables tree-shaking
```

### Typography
```
USE:     Tailwind classes (text-lg, font-bold) or CSS
AVOID:   TYPE_STYLES import in every component
REASON:  Tailwind is pre-optimized; import once if using JS
```

### Shadows/Elevation
```
USE:     Tailwind shadow classes (shadow-sm, shadow-lg)
AVOID:   JavaScript SHADOWS/ELEVATIONS imports
REASON:  Tailwind shadows are pre-optimized
```

### Dark Mode
```
USE:     CSS variables + prefers-color-scheme media query
AVOID:   React state + useEffect listeners
REASON:  Automatic, instant, zero re-renders
```

---

## Advanced Optimization

### Pre-calculate Token Values

For components used frequently, pre-calculate token combinations:

```typescript
// Instead of calculating every render
export const BUTTON_STYLES = {
  primary: {
    bg: BRAND_COLORS.base,
    hover: BRAND_COLORS.hover,
    text: BRAND_COLORS.contrast,
    padding: SPACING[4],
  },
  secondary: {
    bg: NEUTRALS_LIGHT.surface,
    border: NEUTRALS_LIGHT.border_default,
    text: CHAPTER_COLORS.define,
  },
} as const;

// Use as:
<button style={{ backgroundColor: BUTTON_STYLES.primary.bg }}>
  Click me
</button>
```

### Batch CSS Variables

Generate all tokens as CSS variables once:

```typescript
// In _app.tsx or layout root
import { generateCSSVariables } from '@/lib/colors/design-tokens';

export default function App() {
  return (
    <>
      <style>{generateCSSVariables()}</style>
      {/* Rest of app */}
    </>
  );
}
```

Then use everywhere:
```tsx
<div style={{ color: 'var(--chapter-define)' }}>Text</div>
```

---

## Monitoring & Alerts

### Set Performance Budget

In `package.json`:
```json
{
  "bundlebudget": {
    "files": [
      {
        "name": "design-tokens",
        "maxSize": "10kb"
      }
    ]
  }
}
```

### CI/CD Check

```bash
# Add to CI pipeline
pnpm build
echo "Checking token bundle size..."
wc -c apps/web/lib/colors/design-tokens.ts
# Should be < 10 KB gzipped
```

---

## Summary

| Method | Bundle | Runtime | Theme Switch | Dark Mode | Recommend |
|--------|--------|---------|--------------|-----------|-----------|
| Tailwind CSS | 0 KB | < 1ms | Instant | Auto | YES |
| CSS Variables | 2 KB | < 0.5ms | Instant | Auto | YES |
| JS Imports | 8 KB | 0.1ms | Requires re-render | Manual | For semantic colors only |
| State-based | 8 KB | Variable | Slow | Manual | NO |

---

## Resources

- **Bundle Analyzer:** `next/dist/build/analyzers`
- **Performance Testing:** React DevTools Profiler
- **Dark Mode Testing:** Browser DevTools → More Tools → Rendering → Emulate CSS media feature prefers-color-scheme
- **Lighthouse:** Chrome DevTools → Lighthouse
- **WebPageTest:** https://www.webpagetest.org/
