# DESIGN-TOKENS-SNIPPETS.md — Copy-Paste Code Examples

Ready-to-use code snippets for common design token use cases. Copy and paste directly into your components.

---

## 1. Chapter Colors in React

### Basic Chapter Card
```typescript
import { CHAPTER_COLORS, CHAPTER_COLORS_SOFT } from '@/lib/colors/chapter-tokens';

export function ChapterCard({ chapter, title }: { chapter: string; title: string }) {
  const color = CHAPTER_COLORS[chapter as keyof typeof CHAPTER_COLORS] || CHAPTER_COLORS.start;
  const softColor = CHAPTER_COLORS_SOFT[chapter as keyof typeof CHAPTER_COLORS_SOFT];

  return (
    <div
      style={{
        backgroundColor: softColor,
        borderLeft: `4px solid ${color}`,
        padding: '16px',
        borderRadius: '12px',
      }}
    >
      <h3 style={{ color, fontSize: '18px', fontWeight: 600 }}>
        {title}
      </h3>
    </div>
  );
}

// Usage
<ChapterCard chapter="define" title="Define Your Business" />
```

### Chapter Progress Bar
```typescript
import { CHAPTER_COLORS } from '@/lib/colors/chapter-tokens';

export function ChapterProgressBar({ chapter, progress }: { chapter: string; progress: number }) {
  const color = CHAPTER_COLORS[chapter as keyof typeof CHAPTER_COLORS];

  return (
    <div style={{ background: '#f1f4f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
      <div
        style={{
          backgroundColor: color,
          width: `${progress}%`,
          height: '100%',
          transition: 'width 200ms cubic-bezier(0.2, 0.7, 0.3, 1)',
        }}
      />
    </div>
  );
}

// Usage
<ChapterProgressBar chapter="implement" progress={75} />
```

### Chapter Badge with Icon
```typescript
import { CHAPTER_COLORS, CHAPTER_COLORS_SOFT } from '@/lib/colors/chapter-tokens';

export function ChapterBadge({ chapter }: { chapter: string }) {
  const color = CHAPTER_COLORS[chapter as keyof typeof CHAPTER_COLORS];
  const softColor = CHAPTER_COLORS_SOFT[chapter as keyof typeof CHAPTER_COLORS_SOFT];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: softColor,
        color,
        padding: '6px 12px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      ✓ {chapter.charAt(0).toUpperCase() + chapter.slice(1)}
    </span>
  );
}

// Usage
<ChapterBadge chapter="define" />
```

---

## 2. Status Colors in React

### Status Badge
```typescript
import { STATUS_COLORS } from '@/lib/colors/chapter-tokens';

type StatusType = 'awaiting' | 'approved' | 'rejected' | 'inProgress' | 'complete';

export function StatusBadge({ status, label }: { status: StatusType; label: string }) {
  const color = STATUS_COLORS[status];
  const opacity = '15'; // 15% opacity for soft background

  return (
    <span
      style={{
        backgroundColor: `${color}${opacity}`,
        color,
        padding: '6px 12px',
        borderRadius: '999px',
        fontSize: '13px',
        fontWeight: 500,
        border: `1px solid ${color}33`, // 20% opacity border
      }}
    >
      {label}
    </span>
  );
}

// Usage
<StatusBadge status="approved" label="Approved" />
```

### Status Indicator (Dot)
```typescript
import { STATUS_COLORS } from '@/lib/colors/chapter-tokens';

export function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#94a3b8';

  return (
    <div
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: color,
      }}
    />
  );
}

// Usage
<StatusDot status="approved" />
```

### Status Timeline
```typescript
import { STATUS_COLORS } from '@/lib/colors/chapter-tokens';

export function StatusTimeline({ steps }: { steps: Array<{ label: string; status: string }> }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      {steps.map((step, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: STATUS_COLORS[step.status as keyof typeof STATUS_COLORS],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {idx + 1}
          </div>
          <span>{step.label}</span>
          {idx < steps.length - 1 && (
            <div style={{ width: '16px', height: '2px', backgroundColor: '#dde3eb' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// Usage
<StatusTimeline
  steps={[
    { label: 'Define', status: 'approved' },
    { label: 'Implement', status: 'inProgress' },
    { label: 'Control', status: 'awaiting' },
  ]}
/>
```

---

## 3. Navigation Colors

### Nav Link with Underline
```typescript
import { NAV_COLORS } from '@/lib/colors/chapter-tokens';

export function NavLink({ section, label }: { section: keyof typeof NAV_COLORS; label: string }) {
  const color = NAV_COLORS[section];

  return (
    <a
      style={{
        color: '#111827',
        textDecoration: 'none',
        position: 'relative',
        paddingBottom: '4px',
        borderBottom: `2px solid transparent`,
        transition: 'border-color 150ms ease-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderBottomColor = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderBottomColor = 'transparent';
      }}
    >
      {label}
    </a>
  );
}

// Usage
<NavLink section="programme" label="Programme" />
```

### Section Header with Color Bar
```typescript
import { NAV_COLORS } from '@/lib/colors/chapter-tokens';

export function SectionHeader({ section, title }: { section: keyof typeof NAV_COLORS; title: string }) {
  const color = NAV_COLORS[section];

  return (
    <div style={{ borderLeft: `4px solid ${color}`, paddingLeft: '16px', marginBottom: '20px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#111827', margin: 0 }}>
        {title}
      </h1>
    </div>
  );
}

// Usage
<SectionHeader section="business" title="My Business" />
```

---

## 4. Spacing (Tailwind Recommended)

### Manual Spacing with React
```typescript
import { SPACING } from '@/lib/colors/design-tokens';

export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: SPACING[4], // 16px
        gap: SPACING[3],     // 12px
        marginBottom: SPACING[6], // 24px
      }}
    >
      {children}
    </div>
  );
}
```

### Better: Use Tailwind CSS
```html
<!-- 16px padding -->
<div class="p-4">Content</div>

<!-- 24px margin bottom -->
<div class="mb-6">Content</div>

<!-- 12px gap in flex -->
<div class="flex gap-3">
  <div>Item 1</div>
  <div>Item 2</div>
</div>

<!-- 8px padding left -->
<div class="pl-2">Content</div>
```

---

## 5. Typography

### Heading with Type Style
```typescript
import { TYPE_STYLES } from '@/lib/colors/design-tokens';

export function Heading1({ children }: { children: React.ReactNode }) {
  const style = TYPE_STYLES.h1;
  return (
    <h1
      style={{
        fontSize: style.size,
        fontWeight: style.weight,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        margin: 0,
      }}
    >
      {children}
    </h1>
  );
}

// Usage
<Heading1>Page Title</Heading1>
```

### Body Text with Secondary Color
```typescript
import { NEUTRALS_LIGHT } from '@/lib/colors/design-tokens';
import { TYPE_STYLES } from '@/lib/colors/design-tokens';

export function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: TYPE_STYLES.body_md.size,
        fontWeight: TYPE_STYLES.body_md.weight,
        lineHeight: TYPE_STYLES.body_md.lineHeight,
        color: NEUTRALS_LIGHT.text_secondary,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

// Usage
<BodyText>Descriptive text goes here</BodyText>
```

### Label with Tailwind
```html
<label class="text-sm font-medium text-gray-700">
  Form Label
</label>

<p class="text-xs text-gray-500">
  Help text or caption
</p>
```

---

## 6. Shadows & Elevation

### Card with Shadow
```typescript
import { ELEVATIONS } from '@/lib/colors/design-tokens';

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        boxShadow: ELEVATIONS.md,
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      {children}
    </div>
  );
}
```

### Hover Effect with Shadow Elevation
```typescript
import { ELEVATIONS } from '@/lib/colors/design-tokens';

export function HoverCard({ children }: { children: React.ReactNode }) {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      style={{
        backgroundColor: '#fff',
        boxShadow: isHovered ? ELEVATIONS.lg : ELEVATIONS.sm,
        borderRadius: '12px',
        padding: '16px',
        transition: 'box-shadow 150ms ease-out',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
    </div>
  );
}
```

### Using Tailwind
```html
<!-- Small shadow -->
<div class="bg-white shadow-sm rounded-md p-4">Card</div>

<!-- Medium shadow -->
<div class="bg-white shadow-md rounded-lg p-4">Card</div>

<!-- Large shadow -->
<div class="bg-white shadow-lg rounded-xl p-4">Card</div>
```

---

## 7. Borders & Radius

### Button with Rounded Corners
```typescript
import { BORDER_RADIUS, BRAND_COLORS, TYPE_STYLES } from '@/lib/colors/design-tokens';

export function PrimaryButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: BRAND_COLORS.base,
        color: BRAND_COLORS.contrast,
        fontSize: TYPE_STYLES.button.size,
        fontWeight: TYPE_STYLES.button.weight,
        padding: '8px 16px',
        height: '40px',
        borderRadius: BORDER_RADIUS.md,
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 150ms ease-out',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = BRAND_COLORS.hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = BRAND_COLORS.base;
      }}
    >
      {children}
    </button>
  );
}

// Usage
<PrimaryButton onClick={() => alert('Clicked!')}>Click Me</PrimaryButton>
```

### Rounded Badge
```html
<span class="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm">
  Badge
</span>
```

---

## 8. Animation & Motion

### Fade In Animation
```typescript
import { ANIMATIONS } from '@/lib/colors/design-tokens';

export function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div
      style={{
        animation: `fadeIn ${ANIMATIONS.durations.base} ${ANIMATIONS.easing.ease_out} ${delay}ms forwards`,
        opacity: 0,
      }}
    >
      {children}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// Usage
<FadeIn delay={100}>Content</FadeIn>
```

### Slide Up Animation
```typescript
import { ANIMATIONS } from '@/lib/colors/design-tokens';

export function SlideUp({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        animation: `slideUp ${ANIMATIONS.durations.panel} ${ANIMATIONS.easing.spring} forwards`,
        opacity: 0,
        transform: 'translateY(12px)',
      }}
    >
      {children}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
```

### Using Tailwind
```html
<!-- Fade in on hover -->
<div class="transition-opacity duration-150 hover:opacity-75">
  Hover to fade
</div>

<!-- Smooth color transition -->
<button class="bg-green-600 hover:bg-green-700 transition-colors duration-150">
  Button
</button>

<!-- Scale on hover -->
<div class="transition-transform duration-150 hover:scale-105 cursor-pointer">
  Click to scale
</div>
```

---

## 9. Dark Mode

### Dark Mode Aware Component
```typescript
import { NEUTRALS_LIGHT, NEUTRALS_DARK } from '@/lib/colors/design-tokens';
import { useEffect, useState } from 'react';

export function DarkModeCard() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const neutrals = isDark ? NEUTRALS_DARK : NEUTRALS_LIGHT;

  return (
    <div
      style={{
        backgroundColor: neutrals.surface,
        color: neutrals.text_primary,
        border: `1px solid ${neutrals.border_default}`,
        padding: '16px',
        borderRadius: '12px',
      }}
    >
      <p>This adapts to light/dark mode</p>
    </div>
  );
}
```

### Using CSS Variables (Recommended)
```css
/* In your global CSS */
:root {
  --bg-surface: #ffffff;
  --text-primary: #111827;
  --border-default: #dde3eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-surface: #26314c;
    --text-primary: #f8fafc;
    --border-default: rgba(148, 163, 184, 0.18);
  }
}
```

```tsx
export function Card() {
  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-default)',
    }}>
      Content
    </div>
  );
}
```

### Using Tailwind (Native)
```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Automatically adapts to light/dark mode
</div>
```

---

## 10. Component Sizing

### Button Sizes
```typescript
import { COMPONENT_SIZES, TYPE_STYLES } from '@/lib/colors/design-tokens';

export function Button({ size = 'md', children }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; children: string }) {
  const sizeKey = `button_${size}` as keyof typeof COMPONENT_SIZES;
  const height = COMPONENT_SIZES[sizeKey];

  return (
    <button
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        fontSize: TYPE_STYLES.button.size,
        fontWeight: TYPE_STYLES.button.weight,
        borderRadius: '8px',
        backgroundColor: '#088057',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// Usage
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

### Icon Sizing
```typescript
import { COMPONENT_SIZES } from '@/lib/colors/design-tokens';

export function Icon({ size = 'md' }: { size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' }) {
  const sizeKey = `icon_${size}` as keyof typeof COMPONENT_SIZES;
  const dimension = COMPONENT_SIZES[sizeKey];

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      {/* SVG content */}
    </svg>
  );
}
```

---

## 11. Complete Form Example

```typescript
import { COMPONENT_SIZES, TYPE_STYLES, NEUTRALS_LIGHT, BRAND_COLORS } from '@/lib/colors/design-tokens';

export function ContactForm() {
  return (
    <form style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            fontSize: TYPE_STYLES.label.size,
            fontWeight: TYPE_STYLES.label.weight,
            color: NEUTRALS_LIGHT.text_primary,
            marginBottom: '8px',
          }}
        >
          Full Name
        </label>
        <input
          type="text"
          style={{
            width: '100%',
            height: COMPONENT_SIZES.input_md,
            padding: '0 12px',
            fontSize: TYPE_STYLES.button.size,
            border: `1px solid ${NEUTRALS_LIGHT.border_default}`,
            borderRadius: '8px',
            fontFamily: 'inherit',
          }}
          placeholder="Your name"
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            fontSize: TYPE_STYLES.label.size,
            fontWeight: TYPE_STYLES.label.weight,
            color: NEUTRALS_LIGHT.text_primary,
            marginBottom: '8px',
          }}
        >
          Email
        </label>
        <input
          type="email"
          style={{
            width: '100%',
            height: COMPONENT_SIZES.input_md,
            padding: '0 12px',
            fontSize: TYPE_STYLES.button.size,
            border: `1px solid ${NEUTRALS_LIGHT.border_default}`,
            borderRadius: '8px',
            fontFamily: 'inherit',
          }}
          placeholder="your@email.com"
        />
      </div>

      <button
        type="submit"
        style={{
          width: '100%',
          height: COMPONENT_SIZES.button_md,
          backgroundColor: BRAND_COLORS.base,
          color: BRAND_COLORS.contrast,
          fontSize: TYPE_STYLES.button.size,
          fontWeight: TYPE_STYLES.button.weight,
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'background-color 150ms ease-out',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = BRAND_COLORS.hover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = BRAND_COLORS.base;
        }}
      >
        Send Message
      </button>
    </form>
  );
}
```

---

## More Resources

- **Full Reference:** `docs/DESIGN-TOKENS.md`
- **Visual Palette:** `docs/DESIGN-TOKENS-VISUAL.html`
- **Migration Guide:** `docs/DESIGN-TOKENS-MIGRATION.md`
- **Performance:** `docs/DESIGN-TOKENS-PERFORMANCE.md`
- **Source Code:** `apps/web/lib/colors/design-tokens.ts`
