# DESIGN-TOKENS-MIGRATION.md — Migration Guide (Old → New)

Guide for migrating from legacy color/token usage to the new cohesive ONEVYRT design token system.

---

## Status

**Current State:** ONEVYRT design tokens are defined and available for use. All new components should use the new tokens. Existing components can be migrated incrementally.

**Timeline:** No hard deprecation deadline; migrate on component-refresh basis.

---

## Old Token System (Legacy)

Legacy color/spacing was scattered across:
- Inline hex values in components
- Tailwind CSS default values
- Inconsistent naming (e.g., `#2563eb` used multiple times without semantic meaning)
- No dark mode support

---

## New Token System (ONEVYRT v2)

**Centralized, semantic, and cohesive:**
- `apps/web/lib/colors/chapter-tokens.ts` — Chapter + status + nav colors
- `apps/web/lib/colors/design-tokens.ts` — Complete tokens (spacing, typography, shadows)
- All colors pass WCAG AA contrast
- Full dark mode support
- Consistent naming and psychology

---

## Migration Checklist

### 1. Chapter Colors

**Old:**
```typescript
// Hardcoded colors, no semantic meaning
const defineBlue = '#2563eb';
const implementGreen = '#16a34a';
```

**New:**
```typescript
import { CHAPTER_COLORS } from '@/lib/colors/chapter-tokens';

const defineColor = CHAPTER_COLORS.define;   // #2563eb
const implementColor = CHAPTER_COLORS.implement; // #16a34a
```

**Migration Steps:**
1. Find all hardcoded chapter color hex values
2. Replace with `CHAPTER_COLORS[chapter]`
3. Use soft/dark variants for backgrounds/hover states

**Search Pattern:**
```bash
grep -r "#2563eb\|#16a34a\|#d97706\|#dc2626\|#0891b2" apps/web --include="*.tsx" --include="*.ts"
```

---

### 2. Status Colors

**Old:**
```typescript
const statusColors = {
  approved: '#16a34a',
  rejected: '#dc2626',
  pending: '#2563eb',
};
```

**New:**
```typescript
import { STATUS_COLORS } from '@/lib/colors/chapter-tokens';

// Direct access with semantic names
const approved = STATUS_COLORS.approved;      // #16a34a
const rejected = STATUS_COLORS.rejected;      // #dc2626
const awaiting = STATUS_COLORS.awaiting;      // #2563eb
```

**Migration Steps:**
1. Replace status color objects with `STATUS_COLORS` imports
2. Update status type definitions to match new keys

---

### 3. Spacing

**Old:**
```typescript
// Inconsistent values
const padding = '16px';
const margin = '20px';
const gap = '12px';
```

**New (TypeScript):**
```typescript
import { SPACING } from '@/lib/colors/design-tokens';

const padding = SPACING[4];  // 16px
const margin = SPACING[5];   // 20px
const gap = SPACING[3];      // 12px
```

**New (Tailwind — RECOMMENDED):**
```html
<!-- Use native Tailwind spacing classes -->
<div class="p-4 m-5 gap-3">Content</div>
```

**Migration Priority:** LOW (Tailwind handles this well)

---

### 4. Typography

**Old:**
```typescript
const heading = {
  fontSize: '32px',
  fontWeight: 700,
  lineHeight: 1.2,
};
```

**New:**
```typescript
import { TYPE_STYLES } from '@/lib/colors/design-tokens';

const heading = TYPE_STYLES.h1;
// { size: '32px', weight: 700, lineHeight: '1.2', letterSpacing: '-0.02em' }
```

**Migration Steps:**
1. Replace inline font size/weight/line-height with `TYPE_STYLES.*`
2. Update font family stack to use `TYPOGRAPHY.family`

**Search Pattern:**
```bash
grep -r "fontSize: '32px'" apps/web --include="*.tsx"
```

---

### 5. Shadows & Elevation

**Old:**
```typescript
const shadow = '0 2px 6px rgba(15, 23, 42, 0.08)';
```

**New:**
```typescript
import { ELEVATIONS, SHADOWS } from '@/lib/colors/design-tokens';

const shadow = ELEVATIONS.sm;  // Semantic level
// or
const shadow = SHADOWS.sm_light; // Explicit variant
```

**Migration Steps:**
1. Replace hardcoded shadow strings with `ELEVATIONS` or `SHADOWS`
2. Consider switching to semantic levels (xs, sm, md, lg) for consistency

---

### 6. Border Radius

**Old:**
```typescript
const radius = '8px';
const fullRadius = '999px';
```

**New:**
```typescript
import { BORDER_RADIUS } from '@/lib/colors/design-tokens';

const radius = BORDER_RADIUS.sm;   // 8px
const fullRadius = BORDER_RADIUS.pill; // 999px
```

**Migration Steps:**
1. Replace hardcoded pixel values with `BORDER_RADIUS` constants
2. Use Tailwind classes where possible (`rounded-sm`, `rounded-full`)

---

### 7. Neutral Colors (Light & Dark)

**Old:**
```typescript
// Hardcoded, no dark mode support
const bgColor = '#ffffff';
const textColor = '#111827';
```

**New:**
```typescript
import { NEUTRALS_LIGHT, NEUTRALS_DARK } from '@/lib/colors/design-tokens';

// Detect dark mode
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const neutrals = isDark ? NEUTRALS_DARK : NEUTRALS_LIGHT;

const bgColor = neutrals.surface;    // #ffffff (light) or #26314c (dark)
const textColor = neutrals.text_primary; // #111827 (light) or #f8fafc (dark)
```

**Better: Use CSS Variables**
```css
:root {
  --bg-surface: #ffffff;
  --text-primary: #111827;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-surface: #26314c;
    --text-primary: #f8fafc;
  }
}
```

```tsx
<div style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
  Auto dark mode support
</div>
```

---

### 8. Navigation Colors

**Old:**
```typescript
const navColor = {
  programme: '#2563eb',
  business: '#16a34a',
};
```

**New:**
```typescript
import { NAV_COLORS } from '@/lib/colors/chapter-tokens';

const programmeColor = NAV_COLORS.programme; // #2563eb
const businessColor = NAV_COLORS.business;   // #16a34a
```

---

### 9. Component Sizing

**Old:**
```typescript
const buttonHeight = '40px';
const inputHeight = '40px';
const iconSize = '24px';
```

**New:**
```typescript
import { COMPONENT_SIZES } from '@/lib/colors/design-tokens';

const buttonHeight = COMPONENT_SIZES.button_md;  // 40px
const inputHeight = COMPONENT_SIZES.input_md;    // 40px
const iconSize = COMPONENT_SIZES.icon_md;        // 24px
```

---

## Migration Workflow

### Phase 1: Setup (30 min)
1. Verify imports are available in codebase
2. Update TypeScript types to match new token keys
3. Create a migration checklist

### Phase 2: High-Impact Components (Week 1)
1. UnifiedNav (navigation colors)
2. ProgrammeJourney (chapter colors)
3. ChapterSubmissionReview (status colors)
4. Recurring components (Button, Card, Badge)

### Phase 3: Low-Impact Components (Ongoing)
1. Utility components
2. Helper sections
3. Admin pages

### Phase 4: Testing & Polish (Week 2)
1. Verify contrast ratios
2. Test dark mode
3. Check animations
4. Performance check

---

## Common Migration Patterns

### Pattern 1: Chapter Color Badge
```typescript
// OLD
function ChapterBadge({ chapter }) {
  const colors = {
    define: '#2563eb',
    implement: '#16a34a',
  };
  return <span style={{ color: colors[chapter] }}>{chapter}</span>;
}

// NEW
import { CHAPTER_COLORS, CHAPTER_COLORS_SOFT } from '@/lib/colors/chapter-tokens';

function ChapterBadge({ chapter }) {
  return (
    <span
      style={{
        backgroundColor: CHAPTER_COLORS_SOFT[chapter],
        color: CHAPTER_COLORS[chapter],
        padding: '6px 12px',
        borderRadius: '999px',
      }}
    >
      {chapter}
    </span>
  );
}
```

### Pattern 2: Status Indicator
```typescript
// OLD
function StatusDot({ status }) {
  const statusMap = {
    approved: '#16a34a',
    rejected: '#dc2626',
    pending: '#2563eb',
  };
  return <div style={{ backgroundColor: statusMap[status], width: 8, height: 8, borderRadius: '50%' }} />;
}

// NEW
import { STATUS_COLORS } from '@/lib/colors/chapter-tokens';

function StatusDot({ status }) {
  return (
    <div
      style={{
        backgroundColor: STATUS_COLORS[status],
        width: 8,
        height: 8,
        borderRadius: '50%',
      }}
    />
  );
}
```

### Pattern 3: Card with Shadow
```typescript
// OLD
function Card({ children }) {
  return (
    <div style={{ boxShadow: '0 2px 6px rgba(15, 23, 42, 0.08)' }}>
      {children}
    </div>
  );
}

// NEW
import { ELEVATIONS } from '@/lib/colors/design-tokens';

function Card({ children }) {
  return (
    <div style={{ boxShadow: ELEVATIONS.sm }}>
      {children}
    </div>
  );
}
```

### Pattern 4: Dark Mode Aware
```typescript
// OLD - No dark mode support
function Panel({ children }) {
  return <div style={{ backgroundColor: '#ffffff', color: '#111827' }}>{children}</div>;
}

// NEW - Full dark mode support
import { NEUTRALS_LIGHT, NEUTRALS_DARK } from '@/lib/colors/design-tokens';

function Panel({ children }) {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const neutrals = isDark ? NEUTRALS_DARK : NEUTRALS_LIGHT;

  return (
    <div style={{ backgroundColor: neutrals.surface, color: neutrals.text_primary }}>
      {children}
    </div>
  );
}

// EVEN BETTER - Use CSS variables
// CSS:
// :root { --surface: #ffffff; --text-primary: #111827; }
// @media (prefers-color-scheme: dark) { :root { --surface: #26314c; --text-primary: #f8fafc; } }

// React:
function Panel({ children }) {
  return (
    <div style={{ backgroundColor: 'var(--surface)', color: 'var(--text-primary)' }}>
      {children}
    </div>
  );
}
```

---

## Search & Replace Guide

**Find all hardcoded chapter colors:**
```bash
grep -r "#2563eb\|#16a34a\|#d97706\|#dc2626\|#0891b2\|#64748b\|#0891b2" apps/web --include="*.tsx" --include="*.ts" --include="*.css"
```

**Find all hardcoded shadows:**
```bash
grep -r "box-shadow.*rgba" apps/web --include="*.tsx" --include="*.ts" | head -20
```

**Find all hardcoded spacing:**
```bash
grep -r "padding:.*'[0-9]" apps/web --include="*.tsx" | head -10
```

---

## Testing Checklist

After migration:
- [ ] Chapter colors display correctly
- [ ] Status colors are semantic and accurate
- [ ] Dark mode works (test with `prefers-color-scheme: dark`)
- [ ] Contrast ratios pass WCAG AA (test with aXe, WebAIM)
- [ ] Spacing is consistent (Tailwind handles most)
- [ ] Shadows elevate correctly
- [ ] Animations are smooth
- [ ] No console errors or TypeScript issues

---

## Rollback Plan

If migration breaks anything:
1. Git revert the specific component
2. File an issue with reproduction steps
3. Migrate incrementally (one component per PR)

---

## Resources

- **Token Source:** `apps/web/lib/colors/chapter-tokens.ts` and `design-tokens.ts`
- **Full Reference:** `docs/DESIGN-TOKENS.md`
- **Snippets:** `docs/DESIGN-TOKENS-SNIPPETS.md`
- **Visual Palette:** `docs/DESIGN-TOKENS-VISUAL.html`
