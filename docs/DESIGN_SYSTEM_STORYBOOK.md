# Design System — Storybook Integration

Complete guide to setting up and using Storybook for ONEVYRT design tokens and components.

## Quick Start

### 1. Install Storybook

```bash
cd /home/user/onevyrt/apps/web
npx storybook@latest init --type react
npm install --save-dev @storybook/addon-docs @storybook/addon-a11y @storybook/addon-themes
```

### 2. Configure `.storybook/main.ts`

```typescript
import type { StorybookConfig } from '@storybook/nextjs';

const config: StorybookConfig = {
  stories: ['../app/**/*.stories.ts', '../lib/**/*.stories.ts'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {},
  },
};

export default config;
```

### 3. Setup Theme Provider (`.storybook/preview.ts`)

```typescript
import type { Preview } from '@storybook/react';
import { withThemeByDataAttribute } from '@storybook/addon-themes';
import '../app/globals.css';
import '../app/design-system.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    docs: {
      toc: true,
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: 'light',
        dark: 'dark',
      },
      defaultTheme: 'light',
      attributeName: 'data-theme',
    }),
  ],
};

export default preview;
```

---

## Design Token Stories

### 1. Create Color Palette Story

File: `stories/DesignTokens/Colors.stories.tsx`

```tsx
import type { Meta } from '@storybook/react';
import { tokens, searchTokens } from '@/lib/design-tokens';

type Story = Meta<typeof ColorPalette>;

export default {
  title: 'Design System / Tokens / Colors',
  component: ColorPalette,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Complete color palette used across ONEVYRT. Includes brand colors, chapter colors, status indicators, and semantic colors.',
      },
    },
  },
} satisfies Story;

const ColorPalette = () => {
  const colorTokens = searchTokens('');

  return (
    <div style={{ padding: '2rem' }}>
      {/* Brand Colors */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--ds-size-h2)', marginBottom: '1rem' }}>
          Brand Colors
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {['base', 'hover', 'active', 'soft'].map((variant) => (
            <ColorSwatch
              key={`brand-${variant}`}
              name={`Brand — ${variant}`}
              value={tokens.colors.brand[variant as keyof typeof tokens.colors.brand]}
            />
          ))}
        </div>
      </div>

      {/* Chapter Colors */}
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: 'var(--ds-size-h2)', marginBottom: '1rem' }}>
          Chapter Colors
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {Object.entries(tokens.colors.chapter).map(([chapter, colors]) => (
            <div key={chapter}>
              <ColorSwatch
                name={chapter.toUpperCase()}
                value={colors.base}
              />
              <ColorSwatch
                name={`${chapter} (soft)`}
                value={colors.soft}
                small
              />
              <ColorSwatch
                name={`${chapter} (dark)`}
                value={colors.dark}
                small
              />
            </div>
          ))}
        </div>
      </div>

      {/* Semantic Colors */}
      <div>
        <h2 style={{ fontSize: 'var(--ds-size-h2)', marginBottom: '1rem' }}>
          Semantic Colors
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {Object.entries(tokens.colors.semantic).map(([status, colors]) => (
            <div key={status}>
              <ColorSwatch
                name={status.toUpperCase()}
                value={colors.base.light}
              />
              <ColorSwatch
                name={`${status} (soft)`}
                value={colors.soft.light}
                small
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ColorSwatch = ({
  name,
  value,
  small,
}: {
  name: string;
  value: string;
  small?: boolean;
}) => (
  <div>
    <div
      style={{
        width: '100%',
        height: small ? '60px' : '120px',
        backgroundColor: value,
        borderRadius: 'var(--ds-radius-lg)',
        border: '1px solid var(--ds-border-default)',
        marginBottom: '0.5rem',
      }}
    />
    <div style={{ fontSize: 'var(--ds-size-body-sm)', marginBottom: '0.25rem' }}>
      {name}
    </div>
    <code style={{ fontSize: 'var(--ds-size-caption)', color: 'var(--ds-text-tertiary)' }}>
      {value}
    </code>
  </div>
);

export const Default = {};
```

### 2. Create Spacing Scale Story

File: `stories/DesignTokens/Spacing.stories.tsx`

```tsx
import type { Meta } from '@storybook/react';
import { tokens } from '@/lib/design-tokens';

type Story = Meta<{ size: string }>;

export default {
  title: 'Design System / Tokens / Spacing',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: '4px baseline spacing scale for padding, margins, and gaps.',
      },
    },
  },
} satisfies Story;

export const Scale = () => (
  <div style={{ padding: 'var(--ds-space-6)' }}>
    <h2 style={{ fontSize: 'var(--ds-size-h2)', marginBottom: 'var(--ds-space-4)' }}>
      Spacing Scale
    </h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ds-space-4)' }}>
      {Object.entries(tokens.spacing).map(([key, value]) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--ds-space-4)' }}>
          <div
            style={{
              width: value,
              height: '24px',
              backgroundColor: 'var(--ds-brand)',
              borderRadius: 'var(--ds-radius-sm)',
            }}
          />
          <span style={{ minWidth: '80px', fontWeight: 500 }}>
            space-{key}
          </span>
          <code style={{ color: 'var(--ds-text-secondary)' }}>
            {value}
          </code>
        </div>
      ))}
    </div>
  </div>
);
```

### 3. Create Typography Story

File: `stories/DesignTokens/Typography.stories.tsx`

```tsx
import type { Meta } from '@storybook/react';
import { typography } from '@/lib/design-tokens';

type Story = Meta<typeof TypographyShowcase>;

export default {
  title: 'Design System / Tokens / Typography',
  component: TypographyShowcase,
  tags: ['autodocs'],
} satisfies Story;

const TypographyShowcase = () => (
  <div style={{ padding: 'var(--ds-space-8)', maxWidth: '800px' }}>
    <h1 style={{ fontSize: 'var(--ds-size-h1)', marginBottom: 'var(--ds-space-4)' }}>
      Display Large
    </h1>
    <p style={{ color: 'var(--ds-text-secondary)', marginBottom: 'var(--ds-space-6)' }}>
      {typography.sizes.displayLg} / Line-height: {typography.lineHeights.tight}
    </p>

    <h2 style={{ fontSize: 'var(--ds-size-h2)', marginTop: 'var(--ds-space-8)', marginBottom: 'var(--ds-space-4)' }}>
      Heading 2
    </h2>
    <p style={{ color: 'var(--ds-text-secondary)', marginBottom: 'var(--ds-space-6)' }}>
      {typography.sizes.h2} / Line-height: {typography.lineHeights.snug}
    </p>

    <h3 style={{ fontSize: 'var(--ds-size-h3)', marginTop: 'var(--ds-space-6)', marginBottom: 'var(--ds-space-2)' }}>
      Heading 3
    </h3>
    <p style={{ color: 'var(--ds-text-secondary)', marginBottom: 'var(--ds-space-6)' }}>
      {typography.sizes.h3} / Line-height: {typography.lineHeights.normal}
    </p>

    <p style={{ fontSize: 'var(--ds-size-body)', lineHeight: 'var(--ds-line-normal)', marginBottom: 'var(--ds-space-4)' }}>
      Body text — this is the standard typeface for long-form content, paragraphs, and default UI text. The line height is
      optimized for readability on screens.
    </p>

    <p style={{ fontSize: 'var(--ds-size-body-sm)', color: 'var(--ds-text-secondary)', marginBottom: 'var(--ds-space-4)' }}>
      Small body — used for secondary supporting text, metadata, and less prominent information.
    </p>

    <p style={{ fontSize: 'var(--ds-size-caption)', color: 'var(--ds-text-tertiary)' }}>
      Caption — used for hints, help text, and the smallest readable type.
    </p>
  </div>
);

export const Default = {};
```

---

## Component Stories

### Example: Button Component Story

File: `stories/Components/Button.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/react';

const Button = ({ children, variant = 'primary', ...props }: any) => (
  <button className={`btn ${variant}`} {...props}>
    {children}
  </button>
);

type Story = StoryObj<typeof Button>;

export default {
  title: 'Components / Button',
  component: Button,
  tags: ['autodocs'],
  args: {
    children: 'Click me',
  },
} satisfies Meta<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Ghost: Story = {
  args: { variant: 'ghost' },
};

export const Disabled: Story = {
  args: { variant: 'primary', disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--ds-space-4)', flexWrap: 'wrap' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button disabled>Disabled</Button>
    </div>
  ),
};
```

---

## Run Storybook

```bash
cd /home/user/onevyrt/apps/web
npm run storybook

# Build static Storybook
npm run build-storybook
```

Visit: http://localhost:6006

---

## Package.json Scripts

Add to `apps/web/package.json`:

```json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build",
    "token:search": "node scripts/token-search.js",
    "token:export": "node scripts/token-export.js"
  }
}
```

---

## Token Export Script

File: `scripts/token-export.js`

```javascript
const fs = require('fs');
const path = require('path');
const { tokenAPI } = require('../lib/token-search');

const outputDir = path.join(__dirname, '../public/tokens');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Export as JSON
const json = tokenAPI.json();
fs.writeFileSync(
  path.join(outputDir, 'design-tokens.json'),
  JSON.stringify(json, null, 2)
);

// Export as CSS
const css = `:root {\n  ${tokenAPI.cssVariables().split('\n').join('\n  ')}\n}`;
fs.writeFileSync(
  path.join(outputDir, 'design-tokens.css'),
  css
);

console.log('✓ Design tokens exported to public/tokens/');
```

Run: `npm run token:export`

---

## Best Practices

### 1. Grouping & Documentation

```tsx
// Group related stories
export default {
  title: 'Design System / [Category] / [Component]',
  // Add comprehensive description
  parameters: {
    docs: {
      description: {
        component: '...',
      },
    },
  },
};
```

### 2. Live Examples

```tsx
// Show real component usage
export const RealWorldExample: Story = {
  render: () => (
    <form style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div className="ds-field">
        <label htmlFor="email" className="ds-label">Email</label>
        <input id="email" type="email" className="ds-input" />
      </div>
      <button className="btn primary">Submit</button>
    </form>
  ),
};
```

### 3. Accessibility

```tsx
// Include a11y checks
export default {
  title: '...',
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
        ],
      },
    },
  },
};
```

### 4. Dark Mode Testing

Stories automatically support dark mode via the theme toggle in Storybook toolbar.

---

## Deployment

### Deploy to Chromatic (Vercel for Storybook)

```bash
npm install -g chromatic
chromatic --project-token=YOUR_TOKEN
```

### Deploy to Static Host

```bash
npm run build-storybook

# Push build/ directory to:
# - GitHub Pages
# - Vercel
# - Netlify
# - S3 + CloudFront
```

---

## Related Docs

- [Design Tokens Usage](./DESIGN_TOKENS_USAGE.md)
- [Design Tokens Migration](./DESIGN_TOKENS_MIGRATION.md)
- [Design System CSS](../apps/web/app/design-system.css)

