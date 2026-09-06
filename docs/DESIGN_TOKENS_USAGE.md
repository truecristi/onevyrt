# Design Tokens — Usage Guide & Examples

Complete copy-paste examples for using ONEVYRT design tokens in your components.

## Table of Contents

1. [Colors](#colors)
2. [Spacing](#spacing)
3. [Typography](#typography)
4. [Shadows & Elevation](#shadows--elevation)
5. [Animation](#animation)
6. [Component Patterns](#component-patterns)
7. [Dark Mode](#dark-mode)
8. [Accessibility](#accessibility)

---

## Colors

### Brand Colors

```css
/* Primary CTA — evergreen use */
.btn-primary {
  background: var(--ds-brand);
  color: var(--ds-brand-contrast);
  border-color: var(--ds-brand);
}
.btn-primary:hover {
  background: var(--ds-brand-hover);
  border-color: var(--ds-brand-hover);
}
```

```tsx
// React component example
<button style={{ backgroundColor: 'var(--ds-brand)' }}>
  Start Programme
</button>
```

### Chapter Colors

```css
/* Colour-code programme progress */
.chapter-badge--define {
  background: var(--ds-chapter-define-soft);
  color: var(--ds-chapter-define);
}
.chapter-badge--implement {
  background: var(--ds-chapter-implement-soft);
  color: var(--ds-chapter-implement);
}
```

```tsx
// Map chapters to colors
const chapterColor = {
  'DEFINE': 'var(--ds-chapter-define)',
  'IMPLEMENT': 'var(--ds-chapter-implement)',
  'CONTROL': 'var(--ds-chapter-control)',
  'IMPROVE': 'var(--ds-chapter-improve)',
  'FINISH': 'var(--ds-chapter-finish)',
};

<span style={{ color: chapterColor[chapter] }}>
  {chapter}
</span>
```

### Status Colors

```css
/* Submission workflow states */
.status-awaiting { color: var(--ds-status-awaiting); }
.status-approved { color: var(--ds-status-approved); }
.status-changes { color: var(--ds-status-changes); }
.status-rejected { color: var(--ds-status-rejected); }
```

```tsx
// Status indicator component
const statusIcons = {
  awaiting: { color: 'var(--ds-status-awaiting)', icon: '⏳' },
  approved: { color: 'var(--ds-status-approved)', icon: '✓' },
  rejected: { color: 'var(--ds-status-rejected)', icon: '✗' },
};

<span style={{ color: statusIcons[status].color }}>
  {statusIcons[status].icon} {status}
</span>
```

### Semantic Colors (Success, Warning, Danger, Info)

```css
/* Form validation & alerts */
.alert-success {
  background: var(--ds-success-soft);
  color: var(--ds-success);
  border: 1px solid var(--ds-success);
}
.alert-danger {
  background: var(--ds-danger-soft);
  color: var(--ds-danger);
  border: 1px solid var(--ds-danger);
}
```

```tsx
// Alert component
export const Alert = ({ type, message }) => (
  <div className={`alert alert-${type}`}>
    {message}
  </div>
);

// Usage
<Alert type="success" message="Submission approved!" />
```

---

## Spacing

### Layout Padding

```css
/* Page wrapper with breathing room */
.page-container {
  padding: var(--ds-space-8) var(--ds-space-6);
  gap: var(--ds-space-4);
}

/* Card internal padding */
.card {
  padding: var(--ds-space-5);
  gap: var(--ds-space-3);
}
```

```tsx
// React component with spacing
<div style={{
  padding: `${getThemeVar('--ds-space-8')} ${getThemeVar('--ds-space-6')}`,
  gap: getThemeVar('--ds-space-4'),
  display: 'flex',
  flexDirection: 'column',
}}>
  {/* Content */}
</div>
```

### Grid & Flex Gaps

```css
/* Consistent gaps between items */
.card-grid {
  display: grid;
  gap: var(--ds-space-4);
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.button-group {
  display: flex;
  gap: var(--ds-space-2);
}
```

### Margin Utilities

```css
/* Margin scale — margin-top / margin-bottom / margin-left / margin-right */
.mt-4 { margin-top: var(--ds-space-4); }
.mb-6 { margin-bottom: var(--ds-space-6); }
.ml-8 { margin-left: var(--ds-space-8); }
.mr-0 { margin-right: var(--ds-space-0); }
```

---

## Typography

### Headings

```css
/* H1 — Page title */
h1 {
  font-size: var(--ds-size-h1);
  line-height: var(--ds-line-tight);
  letter-spacing: var(--ds-letter-tight);
  font-weight: 700;
}

/* H2 — Section heading */
h2 {
  font-size: var(--ds-size-h2);
  line-height: var(--ds-line-snug);
  letter-spacing: var(--ds-letter-tight);
  font-weight: 700;
}

/* H3 — Card title */
h3 {
  font-size: var(--ds-size-h3);
  line-height: var(--ds-line-normal);
  font-weight: 600;
}
```

```tsx
// Heading component
export const Heading = ({ level = 1, children, className }) => {
  const H = `h${level}`;
  return <H className={`ds-title ${className}`}>{children}</H>;
};

<Heading level={1}>Main Programme</Heading>
<Heading level={2}>Chapter 1: DEFINE</Heading>
```

### Body Text

```css
/* Standard body text */
body {
  font-family: var(--ds-font);
  font-size: var(--ds-size-body);
  line-height: var(--ds-line-normal);
  color: var(--ds-text-primary);
}

/* Small text for metadata */
.meta {
  font-size: var(--ds-size-caption);
  color: var(--ds-text-tertiary);
}

/* Monospace for code/data */
code, pre {
  font-family: var(--ds-font-mono);
}
```

### Label & Caption

```css
/* Form labels */
label {
  font-size: var(--ds-size-label);
  font-weight: 500;
  color: var(--ds-text-primary);
}

/* Help text */
.help-text {
  font-size: var(--ds-size-caption);
  color: var(--ds-text-tertiary);
}

/* Eyebrow (section marker) */
.eyebrow {
  font-size: var(--ds-size-overline);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--ds-text-tertiary);
}
```

---

## Shadows & Elevation

### Card Elevation

```css
/* Standard card — base elevation */
.card {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-subtle);
  border-radius: var(--ds-radius-lg);
  box-shadow: var(--ds-shadow-md);
  transition: all var(--ds-dur-hover) var(--ds-ease-out);
}

/* Hover state — lifts up */
.card:hover {
  box-shadow: var(--ds-shadow-lg);
  border-color: var(--ds-brand);
  transform: translateY(-2px);
}
```

### Button Press Effect

```css
/* Buttons with pressed feedback */
.btn {
  transition: box-shadow var(--ds-dur-base) var(--ds-ease-out);
}
.btn:active {
  transform: translateY(0.5px) scale(0.99);
  box-shadow: var(--ds-shadow-sm);
}
```

### Modal/Popover

```css
/* Maximum elevation for floating surfaces */
.modal {
  background: var(--ds-surface);
  box-shadow: var(--ds-shadow-xl);
  border-radius: var(--ds-radius-xl);
}
```

---

## Animation

### Transitions

```css
/* Hover lift — standard interaction */
.interactive {
  transition: 
    transform var(--ds-dur-hover) var(--ds-ease-out),
    box-shadow var(--ds-dur-hover) var(--ds-ease-out),
    border-color var(--ds-dur-hover) var(--ds-ease-out);
}

/* Panel slide — drawer/sidebar */
.drawer {
  transition: transform var(--ds-dur-panel) var(--ds-ease);
  transform: translateX(-100%);
}
.drawer.open {
  transform: translateX(0);
}

/* Modal appear — dialogs */
.modal {
  opacity: 0;
  transform: scale(0.95);
  transition: all var(--ds-dur-modal) var(--ds-ease);
}
.modal.visible {
  opacity: 1;
  transform: scale(1);
}
```

### Keyframe Animations

```css
/* Scroll reveal — fade in as element enters viewport */
.ds-reveal {
  opacity: 0;
  transform: translateY(28px);
  transition: 
    opacity 0.8s var(--ds-ease),
    transform 0.8s var(--ds-ease);
}
.ds-reveal.is-visible {
  opacity: 1;
  transform: none;
}

/* Staggered reveal group */
.ds-reveal-group > * {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 0.7s var(--ds-ease), transform 0.7s var(--ds-ease);
}
.ds-reveal-group.is-visible > :nth-child(1) { transition-delay: 0ms; }
.ds-reveal-group.is-visible > :nth-child(2) { transition-delay: 90ms; }
.ds-reveal-group.is-visible > :nth-child(3) { transition-delay: 180ms; }
```

---

## Component Patterns

### Form Field

```tsx
export const FormField = ({ label, id, error, children }) => (
  <div className="ds-field">
    <label htmlFor={id} className="ds-label">{label}</label>
    {children}
    {error && <span className="ds-help" style={{ color: 'var(--ds-danger)' }}>{error}</span>}
  </div>
);

// Usage
<FormField label="Email" id="email" error="Invalid email">
  <input type="email" id="email" className="ds-input" />
</FormField>
```

### Card with Action

```tsx
export const Card = ({ title, description, action, actionLabel }) => (
  <div className="ds-card">
    <h3 style={{ fontSize: 'var(--ds-size-h3)', marginBottom: 'var(--ds-space-2)' }}>
      {title}
    </h3>
    <p style={{ color: 'var(--ds-text-secondary)', marginBottom: 'var(--ds-space-4)' }}>
      {description}
    </p>
    {action && (
      <button className="btn primary" onClick={action}>
        {actionLabel}
      </button>
    )}
  </div>
);
```

### Status Indicator

```tsx
export const StatusBadge = ({ status }) => {
  const statusConfig = {
    awaiting: { color: 'var(--ds-status-awaiting)', label: 'Awaiting Review' },
    approved: { color: 'var(--ds-status-approved)', label: 'Approved' },
    changes: { color: 'var(--ds-status-changes)', label: 'Changes Requested' },
    rejected: { color: 'var(--ds-status-rejected)', label: 'Rejected' },
  };

  const config = statusConfig[status];
  return (
    <span className="ds-badge" style={{ borderLeft: `3px solid ${config.color}` }}>
      {config.label}
    </span>
  );
};
```

---

## Dark Mode

### Conditional Styling

```css
/* Light mode (default) */
:root {
  --bg: var(--ds-bg-app);  /* #f7f8fc */
  --text: var(--ds-text-primary);  /* #111827 */
}

/* Dark mode (explicit toggle) */
:root[data-theme="dark"] {
  --bg: var(--ds-bg-app);  /* #1a2438 */
  --text: var(--ds-text-primary);  /* #f8fafc */
}

body {
  background: var(--bg);
  color: var(--text);
}
```

```tsx
// React hook for dark mode
const useDarkMode = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    setIsDark(dark);
  }, []);

  const toggle = () => {
    const newState = !isDark;
    document.documentElement.setAttribute('data-theme', newState ? 'dark' : 'light');
    setIsDark(newState);
    localStorage.setItem('theme', newState ? 'dark' : 'light');
  };

  return { isDark, toggle };
};
```

---

## Accessibility

### Focus States

```css
/* Visible focus ring for keyboard navigation */
:where(a, button, input, textarea, select, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--ds-brand);
  outline-offset: 2px;
}

/* High-contrast mode fallback */
@media (prefers-contrast: more) {
  :focus-visible {
    outline-width: 3px;
  }
}
```

### Reduced Motion

```css
/* Respect user's motion preferences */
@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
  }
}
```

### Color Contrast

```css
/* Ensure minimum 4.5:1 contrast for all text */
.text-primary { color: var(--ds-text-primary); }  /* 14:1 */
.text-secondary { color: var(--ds-text-secondary); }  /* 7.2:1 */
.text-tertiary { color: var(--ds-text-tertiary); }  /* 5.4:1 */
.text-disabled { color: var(--ds-text-disabled); }  /* 4.5:1 minimum */
```

---

## Quick Reference

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--ds-brand` | #088057 | #0a9e6e | Primary CTAs, active states |
| `--ds-surface` | #ffffff | #26314c | Card, panel, dropdown backgrounds |
| `--ds-text-primary` | #111827 | #f8fafc | Headings, primary text |
| `--ds-text-secondary` | #475569 | #cbd5e1 | Body text, supporting content |
| `--ds-border-default` | #dde3eb | rgba(148,163,184,0.18) | Form fields, card borders |
| `--ds-shadow-md` | 0 8px 24px... | 0 8px 24px... | Standard card elevation |
| `--ds-space-4` | 16px | 16px | Standard padding/margin |
| `--ds-radius-md` | 12px | 12px | Standard border radius |
| `--ds-dur-base` | 150ms | 150ms | Standard animation duration |

---

## TypeScript Integration

```tsx
import { tokens, searchTokens } from '@/lib/design-tokens';

// Access token values programmatically
const brandColor = tokens.colors.brand.base; // #088057
const spacing = tokens.spacing['4']; // 16px
const shadowMd = tokens.shadows.md.light; // 0 8px 24px...

// Search for tokens
const brandTokens = searchTokens('brand');
// [
//   { path: 'colors.brand.base', value: '#088057', category: 'colors' },
//   { path: 'colors.brand.hover', value: '#077049', category: 'colors' },
//   ...
// ]

// Get all tokens in a category
const allColors = tokens.colors;
const allSpacing = tokens.spacing;
```

---

## Contributing

When adding new tokens:

1. Add to `app/design-system.css` (CSS variables)
2. Add to `lib/design-tokens.ts` (TypeScript source)
3. Add examples above (copy-paste patterns)
4. Add VS Code snippet in `.vscode/design-tokens.code-snippets`
5. Document in migration guide if changing existing tokens

