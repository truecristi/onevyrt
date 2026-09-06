# Design Tokens — Migration Guide

How to update existing code when design tokens change.

## Overview

This guide helps you migrate existing code to use the new design token system when tokens are:
- Renamed
- Replaced with new values
- Deprecated
- Consolidated

---

## Token Changes Log

### v2 → v3 (Current)

#### Color Token Consolidation

| Old Token | New Token | Migration | Impact |
|-----------|-----------|-----------|--------|
| `--color-brand` | `--ds-brand` | Find & Replace | All brand colors |
| `--color-text-light` | `--ds-text-primary` | Find & Replace + color inversion | Text hierarchy |
| `--bg-white` | `--ds-surface` | Find & Replace | Surface backgrounds |

#### Spacing Scale Changes

Old scale (1px, 2px, 4px...):
```css
padding: 8px;
margin: 12px;
gap: 16px;
```

New scale (4px baseline, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24):
```css
padding: var(--ds-space-2);    /* 8px */
margin: var(--ds-space-3);     /* 12px */
gap: var(--ds-space-4);        /* 16px */
```

---

## Migration Scripts

### Find & Replace Patterns

**Step 1: Colors**

```bash
# Replace old color tokens with new ones
find . -name "*.css" -o -name "*.tsx" -o -name "*.ts" | xargs sed -i \
  -e 's/--color-brand/--ds-brand/g' \
  -e 's/--color-text/--ds-text/g' \
  -e 's/--bg-primary/--ds-bg-app/g'
```

**Step 2: Spacing**

```bash
# Convert inline pixel values to token variables
# Before: padding: 16px;
# After:  padding: var(--ds-space-4);
find . -name "*.css" | xargs sed -i \
  -e 's/: 4px/: var(--ds-space-1)/g' \
  -e 's/: 8px/: var(--ds-space-2)/g' \
  -e 's/: 12px/: var(--ds-space-3)/g' \
  -e 's/: 16px/: var(--ds-space-4)/g'
```

---

## File-by-File Guide

### Update Your Components

#### Before (Old tokens)

```tsx
// Old: Hardcoded colors and spacing
export const Button = ({ children }) => (
  <button style={{
    backgroundColor: '#088057',
    padding: '16px 20px',
    borderRadius: '12px',
    fontSize: '14px',
    transition: 'all 0.15s ease',
  }}>
    {children}
  </button>
);
```

#### After (New tokens)

```tsx
// New: Token-based, consistent, maintainable
export const Button = ({ children }) => (
  <button style={{
    backgroundColor: 'var(--ds-brand)',
    padding: `var(--ds-space-4) var(--ds-space-5)`,
    borderRadius: 'var(--ds-radius-md)',
    fontSize: 'var(--ds-size-body)',
    transition: `all var(--ds-dur-hover) var(--ds-ease-out)`,
  }}>
    {children}
  </button>
);
```

### CSS Class Updates

#### Before

```css
.card {
  background: white;
  border: 1px solid #dde3eb;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.12);
}

.card:hover {
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.20);
  border-color: #088057;
  transform: translateY(-2px);
}
```

#### After

```css
.card {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-subtle);
  border-radius: var(--ds-radius-lg);
  padding: var(--ds-space-5);
  box-shadow: var(--ds-shadow-md);
  transition: all var(--ds-dur-hover) var(--ds-ease);
}

.card:hover {
  box-shadow: var(--ds-shadow-lg);
  border-color: var(--ds-brand);
  transform: translateY(-2px);
}
```

### Tailwind Classes

If using Tailwind, extend config:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        ds: {
          brand: 'var(--ds-brand)',
          'text-primary': 'var(--ds-text-primary)',
          surface: 'var(--ds-surface)',
        }
      },
      spacing: {
        'ds-1': 'var(--ds-space-1)',
        'ds-2': 'var(--ds-space-2)',
        'ds-3': 'var(--ds-space-3)',
        'ds-4': 'var(--ds-space-4)',
      }
    }
  }
};
```

Then use:

```tsx
// Before
<div className="bg-blue-600 p-4 rounded-lg">

// After
<div className="bg-ds-brand p-ds-4 rounded-lg">
```

---

## Backwards Compatibility

### Phase 1: Deprecation Notice (0 days)

New tokens available, old tokens still work:

```css
/* Old tokens redirected to new ones */
--color-brand: var(--ds-brand);
--bg-white: var(--ds-surface);
```

### Phase 2: Transition Period (30 days)

Update your code at your pace. Linter warnings on old tokens:

```javascript
// .eslintrc.json
{
  "rules": {
    "no-restricted-syntax": [
      "warn",
      {
        "selector": "VariableDeclarator[id.name=/^color/]",
        "message": "Use --ds-* tokens instead of --color-* (deprecated)"
      }
    ]
  }
}
```

### Phase 3: Hard Cutover

Old tokens removed. All code must use new tokens.

---

## Testing Your Changes

### Visual Regression Testing

```bash
# Before migration (screenshot baseline)
npm run test:visual -- --baseline

# After migration
npm run test:visual

# Compare and approve changes
```

### Token Value Testing

```typescript
// lib/__tests__/design-tokens.test.ts
import { tokens } from '@/lib/design-tokens';

describe('Design Tokens', () => {
  it('brand color matches CSS variable', () => {
    const brandFromTS = tokens.colors.brand.base;
    const brandFromCSS = getComputedStyle(document.documentElement)
      .getPropertyValue('--ds-brand')
      .trim();
    expect(brandFromTS).toBe(brandFromCSS); // #088057
  });

  it('spacing scale is consistent', () => {
    expect(tokens.spacing['4']).toBe('16px');
    expect(tokens.spacing['8']).toBe('32px');
  });

  it('dark mode tokens exist', () => {
    const darkBrand = tokens.colors.brand.base;
    expect(darkBrand).toBeDefined();
  });
});
```

---

## Common Patterns & Gotchas

### Gotcha 1: Hardcoded Hex Colors in Inline Styles

```tsx
// BAD: Colors won't update when tokens change
<div style={{ color: '#111827' }} />

// GOOD: Tokens update automatically
<div style={{ color: 'var(--ds-text-primary)' }} />
```

### Gotcha 2: Missing Token for a Value

```tsx
// BAD: Falls back to hardcoded
const padding = '18px'; // Not in spacing scale!

// GOOD: Use nearest token
const padding = 'var(--ds-space-5)'; // 20px (closest standard spacing)
```

### Gotcha 3: Dark Mode Not Updating

```css
/* BAD: Dark mode value not set */
:root {
  --my-color: #111827;
}

/* GOOD: Explicit light + dark */
:root {
  --my-color: #111827; /* light */
}
:root[data-theme="dark"] {
  --my-color: #f8fafc; /* dark */
}
```

### Gotcha 4: Spacing Not Aligned to 4px Grid

```tsx
// BAD: 17px doesn't align to grid
padding: '17px';

// GOOD: Use scale (16px or 20px)
padding: 'var(--ds-space-4)'; // 16px
padding: 'var(--ds-space-5)'; // 20px
```

---

## Checklist

When updating a file to use tokens:

- [ ] All colors use `--ds-*` variables
- [ ] All spacing uses `--ds-space-*` scale
- [ ] Border radius uses `--ds-radius-*`
- [ ] Shadows use `--ds-shadow-*`
- [ ] Animations use `--ds-dur-*` + `--ds-ease-*`
- [ ] Typography uses `--ds-size-*` + `--ds-line-*`
- [ ] Focus states use `--ds-ring`
- [ ] Dark mode values defined for light-only tokens
- [ ] No hardcoded pixel values for spacing
- [ ] No hardcoded colors except brand accents

---

## Need Help?

1. **Search for tokens**: Run `npm run token:search "brand"` to find all brand-related tokens
2. **VS Code snippets**: Type `ds-brand` or `ds-space-4` for instant completions
3. **Token docs**: See `DESIGN_TOKENS_USAGE.md` for copy-paste examples
4. **Ask in Slack**: #design-tokens channel

---

## Related Docs

- [DESIGN_TOKENS_USAGE.md](./DESIGN_TOKENS_USAGE.md) — Copy-paste examples
- [Design System CSS](../apps/web/app/design-system.css) — Single source of truth
- [TypeScript Tokens](../apps/web/lib/design-tokens.ts) — Programmatic access

