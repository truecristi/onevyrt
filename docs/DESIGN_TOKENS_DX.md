# Design Tokens — Developer Experience Improvements

Comprehensive guide to using and maintaining ONEVYRT's design token system.

## What's New

Six DX improvements to make design tokens easier to use, discover, and maintain:

### 1. JSDoc Comments on Every Token

**File**: `lib/design-tokens.ts`

Every token now has complete JSDoc documentation:

```typescript
/**
 * Chapter color identifiers for programme stage visualization.
 * Used to color-code curriculum progress, chapter badges, and status indicators.
 */
export const chapterColors = {
  /** START — Baseline & setup (grey/neutral) */
  start: { base: '#64748b', soft: '#f1f5f9', dark: '#334155' },
  /** DEFINE — Strategy & blueprint (blue) */
  define: { base: '#2563eb', soft: '#eff6ff', dark: '#1e40af' },
  // ...
};
```

**Benefits**:
- IDE autocomplete shows descriptions
- Hover tooltips explain each token
- Self-documenting code
- Type-safe token access

### 2. Token Usage Examples (Copy-Paste Ready)

**File**: `docs/DESIGN_TOKENS_USAGE.md`

Complete copy-paste examples for every common pattern:

```css
/* Copy this directly into your CSS */
.card {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-subtle);
  padding: var(--ds-space-5);
  box-shadow: var(--ds-shadow-md);
  transition: all var(--ds-dur-hover) var(--ds-ease-out);
}
```

```tsx
// Copy this into your React components
import { tokens } from '@/lib/design-tokens';
const brandColor = tokens.colors.brand.base; // #088057
```

**Benefits**:
- No guessing about token usage
- Consistent patterns across codebase
- Faster development (copy-paste = 5 sec vs. exploring = 5 min)

### 3. VS Code Snippets File

**File**: `.vscode/design-tokens.code-snippets`

Type shortcuts and get instant completions:

```
ds-brand        → var(--ds-brand)
ds-space-4      → var(--ds-space-4)
btn-primary     → <button className="btn primary">Click me</button>
card            → <div className="ds-card">Content</div>
```

**How to use**:
1. Open any CSS or TSX file
2. Type `ds-brand` (or any shortcut)
3. Press Tab or Enter for instant completion
4. Shortcuts include:
   - Colors: `ds-brand`, `ds-surface`, `ds-text-primary`
   - Spacing: `ds-space-4`, `ds-space-8`
   - Components: `btn-primary`, `card`, `badge`
   - React: `import-tokens`, `search-tokens`

**Benefits**:
- 3x faster coding
- Reduces typos
- Keeps team aligned on naming

### 4. Token Search Utility

**File**: `lib/token-search.ts`

Programmatic access to discover and validate tokens:

```typescript
import { findTokens, getTokenValue, validateToken } from '@/lib/token-search';

// Find all brand-related tokens
const brandTokens = findTokens('brand');
// [
//   { name: 'brand-base', value: '#088057', type: 'color', ... },
//   { name: 'brand-hover', value: '#077049', type: 'color', ... },
//   ...
// ]

// Get a specific token value
const bgColor = getTokenValue('--ds-surface'); // #ffffff

// Validate token existence
if (validateToken('--ds-brand')) {
  // Use it...
}

// Export all tokens as JSON (for design tools, CI/CD)
const json = getTokensAsJSON();
const css = getCSSVariables();
```

**Use cases**:
- ESLint plugins to enforce token usage
- CLI tools to export tokens to design apps
- CI/CD to validate tokens before deploy
- Building token documentation generators

**Benefits**:
- Never hardcode colors/spacing again
- Catch token errors in CI
- Integrate with external design tools

### 5. Token Migration Guide

**File**: `docs/DESIGN_TOKENS_MIGRATION.md`

Step-by-step guide to updating code when tokens change:

```bash
# Find & replace old tokens with new ones (automated)
find . -name "*.css" -o -name "*.tsx" | xargs sed -i \
  -e 's/--color-brand/--ds-brand/g' \
  -e 's/: 16px/: var(--ds-space-4)/g'

# Validate changes
npm run token:search "brand"

# Test visually (visual regression testing)
npm run test:visual
```

**Sections**:
- Token changes log (what changed and why)
- Migration scripts (automated find & replace)
- File-by-file guide (before/after examples)
- Common pitfalls and how to avoid them
- Testing checklist

**Benefits**:
- Update codebase in minutes, not hours
- Prevent migration bugs
- Team alignment on token deprecation

### 6. Storybook Integration

**File**: `docs/DESIGN_SYSTEM_STORYBOOK.md`

Complete Storybook setup with interactive token showcase:

Visit: http://localhost:6006 after setup

```bash
cd apps/web
npm run storybook
```

**What's included**:
- Color palette explorer (all tokens visualized)
- Spacing scale showcase
- Typography specimens
- Component stories (buttons, cards, forms)
- Accessibility checks (a11y addon)
- Dark mode toggle
- Live component examples

**Benefits**:
- Design tokens documented visually
- Non-technical stakeholders can review
- Team reference library
- Component versioning
- CI/CD integration (visual tests)

---

## Quick Start

### Step 1: Install & Setup (5 min)

```bash
# Copy the files (already done)
# No new dependencies needed!

# Enable VS Code snippets
# Restart VS Code, then type: ds-brand
```

### Step 2: Use in Your Code (10 sec)

```tsx
// Instead of:
<button style={{ backgroundColor: '#088057' }} />

// Type:
ds-brand
// Press Tab → var(--ds-brand)
```

### Step 3: Search for Tokens (when unsure)

```typescript
import { findTokens } from '@/lib/token-search';

const results = findTokens('spacing');
console.log(results);
// [{ name: 'space-1', value: '4px' }, { name: 'space-2', value: '8px' }, ...]
```

---

## File Map

| File | Purpose | Audience |
|------|---------|----------|
| `lib/design-tokens.ts` | TypeScript token definitions + JSDoc | Developers (IDE) |
| `.vscode/design-tokens.code-snippets` | VS Code shortcuts | Developers (IDE) |
| `lib/token-search.ts` | Token discovery API | Tool builders |
| `docs/DESIGN_TOKENS_USAGE.md` | Copy-paste examples | Developers (docs) |
| `docs/DESIGN_TOKENS_MIGRATION.md` | Update guide | Developers (refactoring) |
| `docs/DESIGN_SYSTEM_STORYBOOK.md` | Visual component library | All stakeholders |
| `app/design-system.css` | CSS source of truth | (unchanged) |

---

## Workflow Examples

### Scenario 1: Building a New Component

```tsx
// 1. Type shortcut
<div className="ds-card">

// 2. Import types (IDE autocomplete)
import { tokens } from '@/lib/design-tokens';

// 3. Access token
const padding = tokens.spacing['5']; // 20px

// Done! Consistent with entire codebase.
```

### Scenario 2: Changing Token Value

```css
/* Before */
:root { --ds-brand: #088057; }

/* After */
:root { --ds-brand: #077049; /* new green */ }

/* All components automatically update! */
```

### Scenario 3: Validating in CI

```bash
# .github/workflows/design-tokens.yml
- name: Validate tokens
  run: npm run token:search "invalid" || exit 1

- name: Check for hardcoded colors
  run: grep -r "#[0-9a-f]\{6\}" src/ && exit 1 || exit 0
```

---

## Best Practices

### DO ✓

- [ ] Use token variables in CSS and React
- [ ] Import tokens from `lib/design-tokens.ts` for programmatic access
- [ ] Search tokens when unsure: `findTokens('spacing')`
- [ ] Use VS Code snippets for fast coding
- [ ] Check migration guide before updating tokens

### DON'T ✗

- [ ] Hardcode colors: `backgroundColor: '#088057'` ❌
- [ ] Use arbitrary spacing: `padding: '17px'` ❌ (use grid: 16px or 20px)
- [ ] Duplicate token values: Create new token instead ❌
- [ ] Mix old and new token names in same file ❌

---

## Troubleshooting

### VS Code Snippets Not Working?

```
1. Restart VS Code
2. Check .vscode/design-tokens.code-snippets exists
3. Extensions → Settings → "snippet" → Enable snippets
```

### Token Doesn't Exist?

```typescript
import { validateToken } from '@/lib/token-search';

if (!validateToken('--ds-invalid')) {
  console.error('Token not found. Available:');
  console.log(findTokens('').map(t => t.name));
}
```

### Dark Mode Not Working?

```css
/* Ensure data-theme attribute is set */
:root[data-theme="dark"] {
  /* Dark values */
}

/* In JS: */
document.documentElement.setAttribute('data-theme', 'dark');
```

---

## Next Steps

### For Developers
1. Use VS Code snippets daily (type `ds-` for autocomplete)
2. Reference `DESIGN_TOKENS_USAGE.md` for patterns
3. Search tokens when building: `findTokens('...')`

### For Designers
1. Review color palette in Storybook (http://localhost:6006)
2. Share component stories with stakeholders
3. Propose token changes in design doc

### For Design System Owner
1. Update migration guide when tokens change
2. Add new token stories to Storybook
3. Monitor hardcoded values in CI (eslint rule)

---

## Related Docs

- **Usage**: [DESIGN_TOKENS_USAGE.md](./DESIGN_TOKENS_USAGE.md) — Copy-paste examples
- **Migration**: [DESIGN_TOKENS_MIGRATION.md](./DESIGN_TOKENS_MIGRATION.md) — Update guide
- **Storybook**: [DESIGN_SYSTEM_STORYBOOK.md](./DESIGN_SYSTEM_STORYBOOK.md) — Component library
- **Source**: `/apps/web/app/design-system.css` — CSS variables
- **TypeScript**: `/apps/web/lib/design-tokens.ts` — Token definitions

---

## Feedback & Issues

Found a typo in token docs? Missing example?

1. Check [token search](../apps/web/lib/token-search.ts) for all available tokens
2. Reference [usage guide](./DESIGN_TOKENS_USAGE.md) for patterns
3. Open issue with example: "Add spacing scale to button component"

---

## Summary

| Improvement | Saves Time | Reduces Errors | Improves DX |
|------------|-----------|-----------------|-----------|
| JSDoc comments | - | ✓ | ✓ |
| Usage examples | ✓ | ✓ | ✓ |
| VS Code snippets | ✓ | ✓ | ✓ |
| Token search | ✓ | ✓ | ✓ |
| Migration guide | ✓ | ✓ | - |
| Storybook | - | - | ✓ |

**Result**: Design tokens are now discoverable, documented, and consistent across the entire codebase.

