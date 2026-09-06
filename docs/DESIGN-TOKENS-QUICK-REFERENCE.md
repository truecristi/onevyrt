# Design Tokens Quick Reference

## Import Cheat Sheet

```typescript
import { 
  // Colors
  CHAPTER_COLORS, CHAPTER_COLORS_SOFT, CHAPTER_COLORS_DARK,
  STATUS_COLORS, NAV_COLORS, BRAND_COLORS,
  SEMANTIC_COLORS, NEUTRALS_LIGHT, NEUTRALS_DARK,
  
  // Spacing & Sizing
  SPACING, GAPS, COMPONENT_SIZES, BREAKPOINTS,
  
  // Typography
  TYPOGRAPHY, TYPE_STYLES,
  
  // Elevation & Shadows
  SHADOWS, ELEVATIONS,
  
  // Borders & Animation
  BORDER_RADIUS, ANIMATIONS, ANIMATION_PRESETS,
  
  // Utilities
  getChapterColor, getStatusColor, getNavColor, DesignTokens
} from '@/lib/colors';
```

---

## Colors at a Glance

### Chapter Colors
| Name | Light | Soft | Dark | Usage |
|------|-------|------|------|-------|
| START | #64748b | #f1f5f9 | #334155 | Baseline |
| DEFINE | #2563eb | #eff6ff | #1e40af | Ch 1 |
| IMPLEMENT | #16a34a | #dcfce7 | #15803d | Ch 2 |
| CONTROL | #d97706 | #fef3c7 | #b45309 | Ch 3 |
| IMPROVE | #dc2626 | #fee2e2 | #b91c1c | Ch 4 |
| FINISH | #0891b2 | #ecf8fa | #0e7490 | Ch 5 |

### Status Colors
| Status | Color | Usage |
|--------|-------|-------|
| Awaiting | #2563eb (Blue) | Pending review |
| Approved | #16a34a (Green) | Completed ✓ |
| Changes | #d97706 (Amber) | Needs attention |
| Rejected | #dc2626 (Red) | Blocked ✗ |

### Navigation
| Section | Color |
|---------|-------|
| Home | #0891b2 (Cyan) |
| Programme | #2563eb (Blue) |
| Business | #16a34a (Green) |
| Coaching | #d97706 (Amber) |
| Resources | #8b5cf6 (Violet) |

### Brand
| State | Light | Dark |
|-------|-------|------|
| Base | #088057 | #0a9e6e |
| Hover | #077049 | #12b981 |
| Active | #066b46 | #34d399 |
| Soft | #e7f6f0 | #0e2b22 |

---

## Spacing Scale (4px Base)

```
1 = 4px     2 = 8px     3 = 12px    4 = 16px ← most common
5 = 20px    6 = 24px    8 = 32px    10 = 40px
12 = 48px   16 = 64px   20 = 80px   24 = 96px
```

**Common Usage:**
- Card padding: `16px` (space-4)
- Button padding: `8px` horizontal (space-2)
- Input padding: `12px` (space-3)
- Section margin: `24px` (space-6)
- Container gutter: `16px` (space-4)

---

## Typography Sizes

```
Display XL: 64px    Display SM: 32px
H1: 32px            H2: 24px
H3: 20px            H4: 18px
Body Large: 16px    Body: 14px ← standard
Body Small: 13px    Label: 13px
Caption: 12px       Overline: 11px
```

---

## Borders & Radius

**Radius Scale:**
```
xs = 4px    sm = 8px    md = 12px   lg = 14px
xl = 18px   2xl = 24px  pill = 999px
```

**Usage:**
- Buttons: `md` (12px)
- Inputs: `sm` (8px)
- Cards: `lg` (14px)
- Modals: `2xl` (24px)
- Badges: `pill` (999px)

---

## Shadows & Elevation

| Level | Usage | CSS |
|-------|-------|-----|
| None | Flat elements | `--ds-shadow-none` |
| XS | Badges, tooltips | `--ds-shadow-xs` |
| SM | Cards, buttons | `--ds-shadow-sm` |
| MD | Dropdowns, popovers | `--ds-shadow-md` |
| LG | Modals, sheets | `--ds-shadow-lg` |
| XL | Fullscreen overlays | `--ds-shadow-xl` |

---

## Animation

**Durations:**
```
micro: 75ms    fast: 120ms    base: 150ms ← standard
panel: 200ms   modal: 240ms   slow: 300ms
```

**Easing:**
```
linear        ease-in-out (standard transitions)
ease-out      (entering)
ease-in       (exiting)
spring        (delightful UI) ← recommended
bounce        (playful entrances)
```

**CSS Usage:**
```css
transition: all var(--ds-dur-hover) var(--ds-ease);
```

---

## Component Sizing

| Component | Size |
|-----------|------|
| Button XS | 28px |
| Button SM | 32px |
| Button MD | 40px ← standard |
| Button LG | 44px |
| Input MD | 40px |
| Icon XS | 16px |
| Icon MD | 24px ← most common |
| Icon LG | 32px |

---

## CSS Variables

### Most Common
```css
/* Colors */
--ds-text-primary       /* #111827 */
--ds-text-secondary     /* #475569 */
--ds-surface            /* #ffffff */
--ds-border-default     /* #dde3eb */
--ds-brand              /* #088057 */

/* Spacing */
--ds-space-4            /* 16px */
--ds-space-6            /* 24px */

/* Radius */
--ds-radius-md          /* 12px */
--ds-radius-lg          /* 14px */

/* Shadow */
--ds-shadow-sm          /* Card shadow */
--ds-shadow-md          /* Dropdown shadow */

/* Animation */
--ds-dur-base           /* 150ms */
--ds-ease               /* Spring */
```

---

## Dark Mode

**Automatically applied when:**
```typescript
<html data-theme="dark">
```

**Key differences:**
- Background: Light navy-blue-grey (not pure black)
- Text: Bright (f8fafc)
- Shadows: Deeper (higher opacity)
- Status colors: Brightened (better contrast)
- Brand: Lighter green (5.6:1 contrast)

**All CSS variables update automatically** — no need to write separate dark mode styles.

---

## Accessibility Checklist

- ✓ All colors pass WCAG AA (4.5:1 contrast minimum)
- ✓ Focus rings visible (2px, colored)
- ✓ Animations respect `prefers-reduced-motion`
- ✓ Touch targets ≥ 44px (mobile)
- ✓ Text contrast ≥ 4.5:1 (body), 7:1 (AAA)
- ✓ Icon sizes: min 20px for interactive elements

---

## Common Patterns

### Primary Button
```css
background: var(--ds-brand);
color: var(--ds-brand-contrast);
border-radius: var(--ds-radius-md);
height: var(--ds-button-md);
```

### Card
```css
background: var(--ds-surface);
border: 1px solid var(--ds-border-subtle);
border-radius: var(--ds-radius-lg);
padding: var(--ds-space-5);
box-shadow: var(--ds-shadow-sm);
```

### Input
```css
border: 1px solid var(--ds-border-default);
border-radius: var(--ds-radius-sm);
padding: var(--ds-space-3);
height: var(--ds-button-md);
```

### Status Badge
```css
background: var(--ds-success-soft);
color: var(--ds-success);
border-radius: var(--ds-radius-pill);
padding: var(--ds-space-1) var(--ds-space-3);
```

---

## Quick Testing

### Light Mode
```bash
# Check default (should be light)
# Check all chapters, statuses, sections
```

### Dark Mode
```bash
# Toggle <html data-theme="dark">
# Check contrast ratios
# Check shadow depth
# Check status colors (should be brighter)
```

### Accessibility
```bash
# Check focus rings (Tab key)
# Check color contrast (WCAG AA)
# Check with prefers-reduced-motion enabled
# Check mobile touch targets (44px min)
```

---

## Files Reference

- **Tokens Source:** `apps/web/lib/colors/design-tokens.ts`
- **CSS Variables:** `apps/web/app/design-system.css`
- **Full Guide:** `docs/DESIGN-TOKENS.md`
- **Icon System:** `docs/ICON-SYSTEM.md`

---

## Common Mistakes to Avoid

❌ **Don't hardcode colors**
```typescript
// WRONG
<div style={{ color: '#2563eb' }}>
```

✅ **Use tokens instead**
```typescript
// RIGHT
<div style={{ color: CHAPTER_COLORS.define }}>
```

---

❌ **Don't use arbitrary spacing**
```css
/* WRONG */
padding: 13px;
margin: 17px;
```

✅ **Use spacing scale**
```css
/* RIGHT */
padding: var(--ds-space-3);
margin: var(--ds-space-4);
```

---

❌ **Don't set raw animation durations**
```css
/* WRONG */
transition: all 0.2s ease;
```

✅ **Use animation tokens**
```css
/* RIGHT */
transition: all var(--ds-dur-panel) var(--ds-ease);
```

---

## Questions?

See `docs/DESIGN-TOKENS.md` for comprehensive documentation.
