# Design Token Migration Guide

**Goal:** Migrate existing hardcoded colors to the design token system  
**Timeline:** Phase-based rollout (foundation → components → pages)  
**Priority:** High (blocks dark mode compliance, improves consistency)

---

## Quick Reference: Before & After

### Buttons

**Before (hardcoded colors):**
```jsx
<button style={{ backgroundColor: '#088057', color: '#fff' }}>
  Submit
</button>
```

**After (tokens):**
```jsx
<button style={{ 
  backgroundColor: 'var(--ds-brand)', 
  color: 'var(--ds-brand-contrast)' 
}}>
  Submit
</button>
```

### Form Inputs

**Before:**
```jsx
<input style={{ 
  borderColor: '#dde3eb', 
  backgroundColor: '#fff' 
}} />
```

**After:**
```jsx
<input style={{ 
  borderColor: 'var(--ds-border-interactive-default)', 
  backgroundColor: 'var(--ds-surface)' 
}} />
```

### Status Badges

**Before:**
```jsx
<div style={{ 
  background: '#ecfdf3', 
  color: '#12703a' 
}}>
  ✓ Approved
</div>
```

**After:**
```jsx
<div style={{ 
  background: 'var(--ds-success-soft)', 
  color: 'var(--ds-success)' 
}}>
  ✓ Approved
</div>
```

---

## Phase 1: Foundation (Week 1)

### 1.1 Update Global CSS

**File:** `apps/web/app/globals.css`

**Action:** Import the new enhanced token file

```css
/* At the top of globals.css */
@import url('design-tokens-enhanced.css');

/* Keep existing HTML/body styles, but reference tokens */
:root {
  --background: var(--ds-bg-app);
  --foreground: var(--ds-text-primary);
}

:root[data-theme="dark"] {
  --background: var(--ds-bg-app);
  --foreground: var(--ds-text-primary);
}
```

### 1.2 Update design-system.css

**File:** `apps/web/app/design-system.css`

**Action:** Replace with new tokens while maintaining component classes

```css
/* Remove old :root definitions; they're now in design-tokens-enhanced.css */
/* Keep .ds-btn, .ds-card, .ds-input classes */
/* Update class implementations to use new token names */

/* Example: Update button classes to use interactive states */
.ds-btn--primary {
  background: var(--ds-brand);
  color: var(--ds-brand-contrast);
}

.ds-btn--primary:hover {
  background: var(--ds-brand-hover);
}

.ds-btn--primary:active {
  background: var(--ds-brand-active);
}

/* Ensure all variants have dark mode equivalents */
:root[data-theme="dark"] .ds-btn--primary {
  background: var(--ds-brand-solid); /* Use solid on both modes */
  color: var(--ds-brand-contrast);
}
```

### 1.3 Verify Token Coverage

**Checklist:**
- [ ] All chapter colors have dark equivalents
- [ ] All status colors have dark equivalents
- [ ] All navigation colors have dark equivalents
- [ ] Interactive states defined for brand, success, warning, danger, info
- [ ] Neutral colors cover all hierarchy levels

**Script to check:**
```bash
grep -r "style={{ background:" apps/web --include="*.tsx" --include="*.jsx" | head -20
# Identify most common hardcoded colors
```

---

## Phase 2: Component Library (Week 2-3)

### 2.1 Update UI Components

**Files to update:**
- `components/Button.tsx`
- `components/Input.tsx`
- `components/Badge.tsx`
- `components/Card.tsx`
- `components/Dialog.tsx`
- Any custom `.css` files with hardcoded colors

**Example: Button Component**

**Before:**
```tsx
export function Button({ 
  children, 
  variant = 'primary' 
}: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' }) {
  const styles = {
    primary: { 
      background: '#088057', 
      color: '#fff', 
      border: 'none' 
    },
    secondary: { 
      background: '#f1f5f9', 
      color: '#111827', 
      border: '1px solid #dde3eb' 
    },
    danger: { 
      background: '#c81e1e', 
      color: '#fff', 
      border: 'none' 
    },
  };

  return <button style={styles[variant]}>{children}</button>;
}
```

**After:**
```tsx
export function Button({ 
  children, 
  variant = 'primary',
  isHovered = false,
  isActive = false,
  isDisabled = false,
}: { 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'danger';
  isHovered?: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
}) {
  const getStyles = () => {
    if (variant === 'primary') {
      return {
        background: isActive 
          ? 'var(--ds-brand-active)' 
          : isHovered 
          ? 'var(--ds-brand-hover)' 
          : 'var(--ds-brand)',
        color: 'var(--ds-brand-contrast)',
        border: 'none',
        opacity: isDisabled ? 0.55 : 1,
      };
    }
    if (variant === 'secondary') {
      return {
        background: isActive
          ? 'var(--ds-surface-interactive-active)'
          : isHovered
          ? 'var(--ds-surface-interactive-hover)'
          : 'var(--ds-surface-interactive-default)',
        color: 'var(--ds-text-primary)',
        border: `1px solid var(--ds-border-interactive-${isActive ? 'active' : 'default'})`,
        opacity: isDisabled ? 0.55 : 1,
      };
    }
    if (variant === 'danger') {
      return {
        background: isActive
          ? 'var(--ds-danger-active)'
          : isHovered
          ? 'var(--ds-danger-hover)'
          : 'var(--ds-danger)',
        color: '#fff',
        border: 'none',
        opacity: isDisabled ? 0.55 : 1,
      };
    }
  };

  return <button style={getStyles()}>{children}</button>;
}
```

**Example: Badge Component**

**Before:**
```tsx
export function Badge({ status }: { status: 'approved' | 'pending' | 'rejected' }) {
  const colors = {
    approved: { bg: '#ecfdf3', color: '#12703a' },
    pending: { bg: '#fef3c7', color: '#b45309' },
    rejected: { bg: '#fff1f1', color: '#c81e1e' },
  };

  const { bg, color } = colors[status];
  return <div style={{ background: bg, color, padding: '0.5rem 1rem' }}>{status}</div>;
}
```

**After:**
```tsx
export function Badge({ status }: { status: 'approved' | 'pending' | 'rejected' }) {
  const tokenMap = {
    approved: { bg: '--ds-success-soft', color: '--ds-success' },
    pending: { bg: '--ds-warning-soft', color: '--ds-warning' },
    rejected: { bg: '--ds-danger-soft', color: '--ds-danger' },
  };

  const { bg, color } = tokenMap[status];
  return (
    <div style={{ 
      background: `var(${bg})`, 
      color: `var(${color})`, 
      padding: '0.5rem 1rem' 
    }}>
      {status}
    </div>
  );
}
```

### 2.2 Update Tailwind Config

**File:** `apps/web/tailwind.config.cjs`

**Before:**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        gear: {
          bg: "#f8fafd",
          surface: "#ffffff",
          "surface-soft": "#f1f3f4",
          // ... other hardcoded colors
        },
      },
    },
  },
};
```

**After:**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        ds: {
          // Neutrals
          'bg-app': 'var(--ds-bg-app)',
          'bg-subtle': 'var(--ds-bg-subtle)',
          surface: 'var(--ds-surface)',
          'surface-subtle': 'var(--ds-surface-subtle)',
          'surface-raised': 'var(--ds-surface-raised)',
          
          // Interactive states
          'surface-interactive-default': 'var(--ds-surface-interactive-default)',
          'surface-interactive-hover': 'var(--ds-surface-interactive-hover)',
          'surface-interactive-active': 'var(--ds-surface-interactive-active)',
          'surface-interactive-disabled': 'var(--ds-surface-interactive-disabled)',
          
          // Text
          'text-primary': 'var(--ds-text-primary)',
          'text-secondary': 'var(--ds-text-secondary)',
          'text-tertiary': 'var(--ds-text-tertiary)',
          'text-disabled': 'var(--ds-text-disabled)',
          'text-muted': 'var(--ds-text-muted)',
          
          // Borders
          'border-subtle': 'var(--ds-border-subtle)',
          'border-default': 'var(--ds-border-default)',
          'border-strong': 'var(--ds-border-strong)',
          
          // Status
          success: 'var(--ds-success)',
          'success-soft': 'var(--ds-success-soft)',
          warning: 'var(--ds-warning)',
          'warning-soft': 'var(--ds-warning-soft)',
          danger: 'var(--ds-danger)',
          'danger-soft': 'var(--ds-danger-soft)',
          info: 'var(--ds-info)',
          'info-soft': 'var(--ds-info-soft)',
          
          // Brand
          brand: 'var(--ds-brand)',
          'brand-hover': 'var(--ds-brand-hover)',
          'brand-soft': 'var(--ds-brand-soft)',
          
          // Chapter colors
          'chapter-start': 'var(--ds-chapter-start)',
          'chapter-define': 'var(--ds-chapter-define)',
          'chapter-implement': 'var(--ds-chapter-implement)',
          'chapter-control': 'var(--ds-chapter-control)',
          'chapter-improve': 'var(--ds-chapter-improve)',
          'chapter-finish': 'var(--ds-chapter-finish)',
        },
        
        // Keep old 'gear' for backward compatibility during migration
        gear: {
          bg: 'var(--ds-bg-app)',
          surface: 'var(--ds-surface)',
          "surface-soft": 'var(--ds-surface-subtle)',
          border: 'var(--ds-border-default)',
          "border-soft": 'var(--ds-border-subtle)',
          text: 'var(--ds-text-primary)',
          "text-soft": 'var(--ds-text-secondary)',
          muted: 'var(--ds-text-muted)',
          blue: 'var(--ds-info)',
          "blue-soft": 'var(--ds-info-soft)',
          green: 'var(--ds-brand)',
          red: 'var(--ds-danger)',
          amber: 'var(--ds-warning)',
        },
      },
    },
  },
};
```

### 2.3 Update CSS Modules

**Pattern:** Replace hardcoded colors with token references

**Before:**
```css
/* styles/badge.module.css */
.badge {
  background: #ecfdf3;
  color: #12703a;
  padding: 0.5rem 1rem;
  border-radius: 999px;
}

.badge.danger {
  background: #fff1f1;
  color: #c81e1e;
}

.badge:hover {
  background: #d1fae5;
}
```

**After:**
```css
/* styles/badge.module.css */
.badge {
  background: var(--ds-success-soft);
  color: var(--ds-success);
  padding: 0.5rem 1rem;
  border-radius: var(--ds-radius-pill);
  transition: background var(--ds-dur-hover) var(--ds-ease);
}

.badge.danger {
  background: var(--ds-danger-soft);
  color: var(--ds-danger);
}

.badge:hover {
  background: var(--ds-success);
  color: var(--ds-success-soft);
}
```

---

## Phase 3: Feature Pages (Week 3-4)

### 3.1 Audit All Pages

**Script to find hardcoded colors:**
```bash
# Find all hex colors in JSX/TSX files
grep -r "#[0-9a-fA-F]\{6\}" apps/web/app --include="*.tsx" --include="*.jsx" | \
  grep -v node_modules | \
  grep "style" | \
  head -50
```

**Script to find hardcoded RGB colors:**
```bash
grep -r "rgb(" apps/web/app --include="*.tsx" --include="*.jsx" | \
  grep -v "rgba(148,163,184" | \
  grep -v "var(--ds" | \
  head -30
```

### 3.2 Common Patterns to Replace

**Pattern 1: Text on backgrounds**

**Before:**
```jsx
<div style={{ 
  background: '#f1f5f9', 
  color: '#111827', 
  padding: '1rem' 
}}>
  Content
</div>
```

**After:**
```jsx
<div style={{ 
  background: 'var(--ds-bg-subtle)', 
  color: 'var(--ds-text-primary)', 
  padding: 'var(--ds-space-4)' 
}}>
  Content
</div>
```

**Pattern 2: Borders**

**Before:**
```jsx
<div style={{ 
  border: '1px solid #dde3eb', 
  borderRadius: '8px' 
}}>
  Card
</div>
```

**After:**
```jsx
<div style={{ 
  border: '1px solid var(--ds-border-default)', 
  borderRadius: 'var(--ds-radius-sm)' 
}}>
  Card
</div>
```

**Pattern 3: Chapter/Section badges**

**Before:**
```jsx
function ChapterBadge({ chapter }) {
  const colors = {
    define: { bg: '#eff6ff', color: '#2563eb' },
    implement: { bg: '#dcfce7', color: '#16a34a' },
    control: { bg: '#fef3c7', color: '#d97706' },
    improve: { bg: '#fee2e2', color: '#dc2626' },
    finish: { bg: '#ecf8fa', color: '#0891b2' },
  };
  
  const { bg, color } = colors[chapter];
  return <span style={{ background: bg, color }}>{chapter}</span>;
}
```

**After:**
```jsx
function ChapterBadge({ chapter }) {
  const tokenMap = {
    define: { bg: '--ds-chapter-define-soft', color: '--ds-chapter-define' },
    implement: { bg: '--ds-chapter-implement-soft', color: '--ds-chapter-implement' },
    control: { bg: '--ds-chapter-control-soft', color: '--ds-chapter-control' },
    improve: { bg: '--ds-chapter-improve-soft', color: '--ds-chapter-improve' },
    finish: { bg: '--ds-chapter-finish-soft', color: '--ds-chapter-finish' },
  };
  
  const { bg, color } = tokenMap[chapter];
  return <span style={{ background: `var(${bg})`, color: `var(${color})` }}>{chapter}</span>;
}
```

### 3.3 Progressive Enhancement Strategy

**Timeline for page migration:**

**Week 3:**
- Dashboard (high traffic, high impact)
- Programme enrollment flow
- Programme chapter pages

**Week 4:**
- Coaching pages
- Community pages
- Settings/account pages

**Post-launch:**
- Public funnel pages (lower priority, can use override if needed)
- Internal admin pages

---

## Phase 4: Testing & Validation (Week 4-5)

### 4.1 Manual Testing Checklist

For each page/component:

```markdown
- [ ] Light mode: Colors match design system tokens
- [ ] Dark mode: All elements visible, sufficient contrast
- [ ] Hover states: Interactive elements respond correctly
- [ ] Focus states: Keyboard navigation has visible focus rings
- [ ] Disabled states: Disabled elements visually distinct
- [ ] Mobile responsive: Colors remain consistent at all sizes
- [ ] Print mode: Dark mode doesn't print (if applicable)
- [ ] Color blindness: Use Stark or similar plugin to test
```

### 4.2 Automated Testing

**Contrast check script:**
```bash
npm install --save-dev pa11y

# Run contrast audit on all pages
pa11y-ci --config .pa11yci.json
```

**CSS variable validation:**
```bash
# Find any remaining hardcoded colors
grep -r "#[0-9a-fA-F]\{6\}" apps/web/app \
  --include="*.tsx" --include="*.jsx" --include="*.css" | \
  grep -v "design-tokens" | \
  grep -v "^[[:space:]]*//.*#" | \
  wc -l
# Should be 0 (or close to it for unavoidable cases)
```

### 4.3 Browser Testing

Test on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Safari (iOS)
- Chrome Android

Test dark mode toggle:
- Immediate switch works
- Persistence across page reloads
- No flash on page load

---

## Post-Migration: Maintenance

### Document New Practices

**Create style guide:**
```markdown
# Styling Guidelines

1. **Always use design tokens for colors**
   - Use `var(--ds-brand)` not `#088057`
   - Use `var(--ds-text-primary)` not `#111827`

2. **Never hardcode hex colors**
   - Exception: Temporary debugging (remove before commit)

3. **Interactive states**
   - Default: `var(--ds-surface-interactive-default)`
   - Hover: `var(--ds-surface-interactive-hover)`
   - Active: `var(--ds-surface-interactive-active)`

4. **Status colors**
   - Success: `var(--ds-success)` + `var(--ds-success-soft)`
   - Warning: `var(--ds-warning)` + `var(--ds-warning-soft)`
   - Danger: `var(--ds-danger)` + `var(--ds-danger-soft)`
   - Info: `var(--ds-info)` + `var(--ds-info-soft)`

5. **Spacing and radius**
   - Use `var(--ds-space-*)` for padding/margin
   - Use `var(--ds-radius-*)` for border-radius

See: /docs/DESIGN_TOKENS_DARK_MODE.md
```

### Create PR Template

**`.github/pull_request_template.md`:**
```markdown
## Color & Token Compliance

- [ ] No hardcoded hex colors (except temporary debug comments)
- [ ] All colors use `var(--ds-*)` tokens
- [ ] Dark mode tested (toggle in DevTools)
- [ ] Contrast verified (4.5:1 minimum)
- [ ] Interactive states defined (hover, active, disabled)

See: /docs/DESIGN_TOKENS_DARK_MODE.md
```

### Regular Audits

**Monthly:**
```bash
# Check for hardcoded colors introduced since last audit
git log --since="1 month ago" --oneline | \
  xargs -I {} git show {} | \
  grep "^\+.*#[0-9a-fA-F]\{6\}" | \
  grep -v "design-tokens" | \
  wc -l
```

**Quarterly:**
- Full contrast audit using WebAIM
- Color blindness testing (Stark plugin)
- Accessibility review (WAVE, Axe)

---

## Rollback Plan

If critical issues arise during migration:

1. **Keep old `design-system.css` as backup**
   - Rename to `design-system-v2.css`
   - Leave in repo but commented in globals.css

2. **Quick rollback:**
   ```css
   /* In globals.css, temporarily comment out new tokens */
   /* @import url('design-tokens-enhanced.css'); */
   @import url('design-system-v2.css');
   ```

3. **Post-rollback:**
   - File issue with root cause
   - Fix in feature branch
   - Re-deploy with fix

---

## Success Criteria

Migration is complete when:

- ✓ 100% of components use design tokens
- ✓ 95%+ of pages use design tokens (allow 5% for third-party/legacy)
- ✓ Dark mode toggle works on all pages
- ✓ All text has 4.5:1+ contrast on both modes
- ✓ Keyboard focus visible on all interactive elements
- ✓ Zero hardcoded colors in active codebase (except comments)
- ✓ All PR reviews check for token compliance
- ✓ Documentation updated with token guidelines

---

## Questions?

- **Tokens not working?** Check that `design-tokens-enhanced.css` is imported before your component CSS
- **Dark mode not switching?** Verify `[data-theme="dark"]` is set on `<html>` element
- **Contrast issues?** Use `var(--ds-{color}-soft)` background or check contrast matrix in DESIGN_TOKENS_DARK_MODE.md
- **Need new token?** Add to `design-tokens-enhanced.css` and document in the matrix
