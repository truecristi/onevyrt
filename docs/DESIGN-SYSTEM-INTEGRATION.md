# Design System Integration Guide

## How to Use Design Tokens in Components

This guide shows practical examples of integrating design tokens into React components and CSS.

---

## React Components with Inline Styles

### Using TypeScript Tokens

```typescript
import { CHAPTER_COLORS, SPACING, TYPOGRAPHY, BRAND_COLORS } from '@/lib/colors';

export const ChapterCard = ({ chapter = 'define' }) => {
  const color = CHAPTER_COLORS[chapter as keyof typeof CHAPTER_COLORS];
  
  return (
    <div
      style={{
        padding: SPACING[4],
        borderLeft: `4px solid ${color}`,
        background: '#fff',
        borderRadius: '12px',
      }}
    >
      <h3 style={{
        fontSize: TYPOGRAPHY.sizes.heading_4,
        fontWeight: TYPOGRAPHY.weights.bold,
        color: color,
        margin: 0,
      }}>
        Chapter {chapter}
      </h3>
    </div>
  );
};
```

### Button Component

```typescript
import { BRAND_COLORS, COMPONENT_SIZES, ANIMATIONS } from '@/lib/colors';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
}) => {
  const sizeMap = {
    sm: COMPONENT_SIZES.button_sm,
    md: COMPONENT_SIZES.button_md,
    lg: COMPONENT_SIZES.button_lg,
  };

  const variantStyles = {
    primary: {
      background: BRAND_COLORS.base,
      color: BRAND_COLORS.contrast,
      border: 'none',
    },
    secondary: {
      background: '#f1f4f9',
      color: '#111827',
      border: '1px solid #dde3eb',
    },
    ghost: {
      background: 'transparent',
      color: '#475569',
      border: 'none',
    },
  };

  return (
    <button
      onClick={onClick}
      style={{
        height: sizeMap[size],
        padding: '0 16px',
        borderRadius: '12px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: `all ${ANIMATIONS.durations.hover} ${ANIMATIONS.easing.spring}`,
        ...variantStyles[variant],
      }}
      onMouseEnter={(e) => {
        if (variant === 'primary') {
          (e.target as HTMLButtonElement).style.background = BRAND_COLORS.hover;
        }
      }}
      onMouseLeave={(e) => {
        if (variant === 'primary') {
          (e.target as HTMLButtonElement).style.background = BRAND_COLORS.base;
        }
      }}
    >
      {children}
    </button>
  );
};
```

### Card Component

```typescript
import { NEUTRALS_LIGHT, SPACING, SHADOWS, BORDER_RADIUS } from '@/lib/colors';

interface CardProps {
  title: string;
  children: React.ReactNode;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ title, children, elevated = false }) => {
  return (
    <div
      style={{
        background: NEUTRALS_LIGHT.surface,
        border: `1px solid ${NEUTRALS_LIGHT.border_subtle}`,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING[5],
        boxShadow: elevated ? SHADOWS.md_light : SHADOWS.sm_light,
        transition: `all 0.3s cubic-bezier(0.2, 0.7, 0.3, 1)`,
      }}
    >
      <h3
        style={{
          fontSize: '18px',
          fontWeight: 600,
          color: NEUTRALS_LIGHT.text_primary,
          margin: `0 0 ${SPACING[3]} 0`,
        }}
      >
        {title}
      </h3>
      <div style={{ color: NEUTRALS_LIGHT.text_secondary }}>
        {children}
      </div>
    </div>
  );
};
```

---

## CSS Modules with Tokens

### Button.module.css

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ds-space-2);
  height: var(--ds-button-md);
  padding: 0 var(--ds-space-4);
  border-radius: var(--ds-radius-md);
  font-size: var(--ds-size-body);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all var(--ds-dur-hover) var(--ds-ease);
}

.button:hover {
  transform: translateY(-1px);
}

.button:active {
  transform: translateY(0.5px) scale(0.99);
}

.button:focus-visible {
  outline: none;
  box-shadow: var(--ds-ring);
}

.button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

/* Variant: Primary */
.button.primary {
  background: var(--ds-brand);
  color: var(--ds-brand-contrast);
  border-color: var(--ds-brand);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}

.button.primary:hover {
  background: var(--ds-brand-hover);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 2px 8px rgba(10, 158, 110, 0.3);
}

/* Variant: Secondary */
.button.secondary {
  background: var(--ds-surface);
  color: var(--ds-text-primary);
  border-color: var(--ds-border-default);
}

.button.secondary:hover {
  background: var(--ds-surface-subtle);
  border-color: var(--ds-border-strong);
}

/* Size: Small */
.button.sm {
  height: var(--ds-button-sm);
  padding: 0 var(--ds-space-3);
  font-size: 13px;
}

/* Size: Large */
.button.lg {
  height: var(--ds-button-lg);
  padding: 0 var(--ds-space-5);
  font-size: 15px;
}
```

### Card.module.css

```css
.card {
  background: var(--ds-surface);
  border: 1px solid var(--ds-border-subtle);
  border-radius: var(--ds-radius-lg);
  padding: var(--ds-space-5);
  box-shadow: var(--ds-shadow-sm);
  transition: all var(--ds-dur-panel) var(--ds-ease);
}

.card:hover {
  border-color: var(--ds-border-default);
  box-shadow: var(--ds-shadow-md);
}

.card.elevated {
  box-shadow: var(--ds-shadow-lg);
}

.title {
  font-size: var(--ds-size-heading_4);
  font-weight: 600;
  color: var(--ds-text-primary);
  margin: 0 0 var(--ds-space-3) 0;
}

.content {
  font-size: var(--ds-size-body);
  line-height: var(--ds-line-normal);
  color: var(--ds-text-secondary);
}
```

---

## Tailwind Integration

### Configure Tailwind

Add this to `tailwind.config.ts`:

```typescript
import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Chapter colors
        'chapter-define': 'var(--ds-chapter-define)',
        'chapter-implement': 'var(--ds-chapter-implement)',
        'chapter-control': 'var(--ds-chapter-control)',
        'chapter-improve': 'var(--ds-chapter-improve)',
        'chapter-finish': 'var(--ds-chapter-finish)',
        
        // Status colors
        'status-approved': 'var(--ds-status-approved)',
        'status-rejected': 'var(--ds-status-rejected)',
        
        // Brand
        'brand': 'var(--ds-brand)',
        'brand-hover': 'var(--ds-brand-hover)',
        
        // Neutrals
        'text-primary': 'var(--ds-text-primary)',
        'text-secondary': 'var(--ds-text-secondary)',
        'surface': 'var(--ds-surface)',
      },
      spacing: {
        'ds-1': 'var(--ds-space-1)',
        'ds-2': 'var(--ds-space-2)',
        'ds-4': 'var(--ds-space-4)',
        'ds-6': 'var(--ds-space-6)',
        'ds-8': 'var(--ds-space-8)',
      },
      fontSize: {
        'ds-h1': 'var(--ds-size-h1)',
        'ds-h2': 'var(--ds-size-h2)',
        'ds-body': 'var(--ds-size-body)',
        'ds-caption': 'var(--ds-size-caption)',
      },
      borderRadius: {
        'ds-sm': 'var(--ds-radius-sm)',
        'ds-md': 'var(--ds-radius-md)',
        'ds-lg': 'var(--ds-radius-lg)',
        'ds-xl': 'var(--ds-radius-xl)',
      },
      boxShadow: {
        'ds-sm': 'var(--ds-shadow-sm)',
        'ds-md': 'var(--ds-shadow-md)',
        'ds-lg': 'var(--ds-shadow-lg)',
      },
      transitionDuration: {
        'ds-fast': 'var(--ds-dur-fast)',
        'ds-base': 'var(--ds-dur-base)',
        'ds-slow': 'var(--ds-dur-slow)',
      },
      transitionTimingFunction: {
        'ds-ease': 'var(--ds-ease)',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

### Use Tailwind Classes

```typescript
export const ChapterBadge = ({ chapter = 'define' }) => {
  return (
    <span className={`
      inline-flex items-center gap-ds-2
      px-ds-3 py-ds-2
      rounded-ds-full
      text-ds-caption font-medium
      bg-chapter-define/10
      text-chapter-define
    `}>
      {chapter}
    </span>
  );
};
```

---

## Global Styles with Tokens

### In globals.css or design-system.css

```css
/* Apply tokens globally */
:root {
  font-family: var(--ds-font);
  font-size: 14px;
  line-height: 1.6;
  color: var(--ds-text-primary);
}

body {
  background: var(--ds-bg-app);
  color: var(--ds-text-primary);
  transition: background var(--ds-dur-panel) var(--ds-ease),
              color var(--ds-dur-panel) var(--ds-ease);
}

/* All inputs use design tokens */
input:not([type="checkbox"]):not([type="radio"]),
textarea,
select {
  padding: var(--ds-space-3);
  height: var(--ds-button-md);
  border: 1px solid var(--ds-border-default);
  border-radius: var(--ds-radius-sm);
  font-size: var(--ds-size-body);
  background: var(--ds-surface);
  color: var(--ds-text-primary);
  transition: all var(--ds-dur-base) var(--ds-ease);
}

input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  border-color: var(--ds-brand);
  box-shadow: var(--ds-ring);
}

/* All buttons use design tokens */
button {
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
}

/* Focus visible for all interactive elements */
:where(a, button, input, textarea, select):focus-visible {
  outline: 2px solid var(--ds-brand);
  outline-offset: 2px;
}
```

---

## Dark Mode Usage

Tokens automatically update with `[data-theme="dark"]`:

```typescript
// No CSS needed — all vars update automatically!
<div style={{
  background: 'var(--ds-surface)',      // Auto-switches in dark mode
  color: 'var(--ds-text-primary)',      // Auto-switches
  boxShadow: 'var(--ds-shadow-md)',     // Auto-deeper in dark
}}>
  Content adapts to dark mode
</div>
```

---

## Animation Examples

### Fade In

```typescript
import { ANIMATIONS } from '@/lib/colors';

const FadeIn = () => (
  <div
    style={{
      animation: 'fadeIn ease-out',
      animationDuration: ANIMATIONS.durations.slow,
      '@keyframes fadeIn': {
        from: { opacity: 0 },
        to: { opacity: 1 },
      },
    }}
  >
    Content
  </div>
);
```

### Slide Up with Spring

```css
.slideUp {
  animation: slideUp 0.3s cubic-bezier(0.2, 0.7, 0.3, 1);
}

@keyframes slideUp {
  from {
    transform: translateY(1rem);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

### Hover Lift

```css
.card {
  transition: transform var(--ds-dur-hover) var(--ds-ease),
              box-shadow var(--ds-dur-hover) var(--ds-ease);
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: var(--ds-shadow-lg);
}
```

---

## Status Color Application

### Badge Component

```typescript
import { STATUS_COLORS, SEMANTIC_COLORS } from '@/lib/colors';

const statusMap = {
  approved: SEMANTIC_COLORS.success,
  rejected: SEMANTIC_COLORS.danger,
  pending: SEMANTIC_COLORS.info,
  warning: SEMANTIC_COLORS.warning,
};

export const StatusBadge = ({ status }: { status: keyof typeof statusMap }) => {
  const colors = statusMap[status];
  
  return (
    <span style={{
      background: colors.soft_light,
      color: colors.light,
      padding: '4px 8px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: 500,
    }}>
      {status}
    </span>
  );
};
```

---

## Responsive Design with Tokens

```css
/* Mobile first */
.container {
  padding: var(--ds-space-4);
  font-size: var(--ds-size-body);
}

/* Tablet */
@media (min-width: 640px) {
  .container {
    padding: var(--ds-space-6);
    font-size: var(--ds-size-body-lg);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
    margin: 0 auto;
    padding: var(--ds-space-8);
  }
}
```

---

## Accessibility with Tokens

### High Contrast Focus Ring

```css
button:focus-visible {
  outline: 2px solid var(--ds-brand);
  outline-offset: 2px;
  box-shadow: var(--ds-ring);
}

/* Dark mode adjusts automatically */
:root[data-theme="dark"] button:focus-visible {
  box-shadow: 0 0 0 3px rgba(124, 110, 255, 0.28);
}
```

### Respect prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## Component Library Pattern

### Create a UI Component Library

```typescript
// lib/ui/Button.tsx
import { BRAND_COLORS, COMPONENT_SIZES, ANIMATIONS } from '@/lib/colors';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', ...props }, ref) => {
    // Implementation using tokens
  }
);

// lib/ui/Card.tsx
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ elevated, ...props }, ref) => {
    // Implementation using tokens
  }
);

// lib/ui/index.ts
export { Button } from './Button';
export { Card } from './Card';
```

### Use Component Library

```typescript
import { Button, Card } from '@/lib/ui';

export const Page = () => (
  <Card>
    <h1>Welcome</h1>
    <Button variant="primary" size="lg">
      Get Started
    </Button>
  </Card>
);
```

---

## Testing with Tokens

### Visual Regression Testing

```typescript
describe('Button Component', () => {
  it('uses correct brand color from tokens', () => {
    render(<Button variant="primary">Click me</Button>);
    const button = screen.getByRole('button');
    
    expect(button).toHaveStyle({
      background: BRAND_COLORS.base,
    });
  });

  it('uses correct spacing from tokens', () => {
    const { container } = render(
      <Card>Content</Card>
    );
    const card = container.firstChild;
    
    expect(card).toHaveStyle({
      padding: SPACING[5],
    });
  });
});
```

---

## Migrating Existing Components

### Before (Hardcoded)

```typescript
const Card = ({ children }) => (
  <div style={{
    padding: '16px',
    background: '#fff',
    border: '1px solid #dde3eb',
    borderRadius: '14px',
    boxShadow: '0 2px 6px rgba(15,23,42,.08)',
    color: '#111827',
  }}>
    {children}
  </div>
);
```

### After (Tokens)

```typescript
import { SPACING, NEUTRALS_LIGHT, BORDER_RADIUS, SHADOWS } from '@/lib/colors';

const Card = ({ children }) => (
  <div style={{
    padding: SPACING[5],
    background: NEUTRALS_LIGHT.surface,
    border: `1px solid ${NEUTRALS_LIGHT.border_default}`,
    borderRadius: BORDER_RADIUS.lg,
    boxShadow: SHADOWS.sm_light,
    color: NEUTRALS_LIGHT.text_primary,
  }}>
    {children}
  </div>
);
```

---

## Next Steps

1. **Start new components** with tokens
2. **Migrate high-traffic pages** incrementally
3. **Create a component library** using tokens
4. **Document team patterns** for consistency
5. **Set up token validation** in CI/CD (no hardcoded colors)

For more details, see:
- `docs/DESIGN-TOKENS.md` — Comprehensive guide
- `docs/DESIGN-TOKENS-QUICK-REFERENCE.md` — Quick reference
- `apps/web/lib/colors/design-tokens.ts` — Token source
