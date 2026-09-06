# ONEVYRT Icon System

Comprehensive icon system built with Heroicons (24px solid/outline) and semantic organization for visual richness and UI clarity across ONEVYRT.

## Overview

The icon system is organized into four main categories:

1. **Chapter Icons** — Programme stage visual identifiers (DEFINE, IMPLEMENT, CONTROL, IMPROVE & SCALE, FINISH)
2. **Status Icons** — Learner progress and item state indicators (locked, available, completed, etc.)
3. **Action Icons** — UI control icons (add, edit, delete, share, etc.)
4. **Navigation Icons** — Main section icons (Programme, My Business, Coaching, etc.)

Each category has semantic meaning, consistent sizing, and appropriate color coding.

## Architecture

```
components/icons/
├── ChapterIcon.tsx      # Chapter stage visual identifiers
├── StatusIcon.tsx       # Progress and state indicators
├── ActionIcon.tsx       # UI control icons
├── IconButton.tsx       # Reusable icon button wrapper
├── IconSizer.tsx        # Consistent sizing utility
└── index.ts             # Main export point

lib/icons/
└── icon-registry.ts     # Complete icon catalog + color system
```

## Quick Start

### Rendering a Chapter Icon

```typescript
import { ChapterIcon } from "@/components/icons";

export function ChapterHeader({ chapterId }) {
  return (
    <div>
      <ChapterIcon chapter="define" size="md" />
      <h2>Chapter 1: Define</h2>
    </div>
  );
}
```

### Rendering a Status Icon

```typescript
import { StatusIcon } from "@/components/icons";

export function LessonStatus({ status }) {
  return <StatusIcon status="completed" size="sm" />;
}
```

### Rendering Action Buttons

```typescript
import { ActionButton, ActionIcon, IconButton } from "@/components/icons";
import { PencilIcon } from "@heroicons/react/24/solid";

// Quick action button (pre-styled)
export function EditButton({ onClick }) {
  return <ActionButton action="edit" onClick={onClick} />;
}

// Custom icon button (full control)
export function CustomEditButton({ onClick }) {
  return (
    <IconButton label="Edit this item" onClick={onClick}>
      <PencilIcon width="20" height="20" />
    </IconButton>
  );
}
```

## Component Reference

### ChapterIcon

Renders a semantic icon for a programme chapter.

```typescript
interface ChapterIconProps {
  chapter: "define" | "implement" | "control" | "improve" | "finish";
  size?: "xs" | "sm" | "md" | "lg";          // Default: "md"
  withBackground?: boolean;                  // Default: false
  className?: string;
}

// Usage
<ChapterIcon chapter="control" size="lg" withBackground />

// With label (companion component)
<div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
  <ChapterIcon chapter="define" size="md" />
  <ChapterLabel chapter="define" showDescription />
</div>

// Combined badge
<ChapterBadge chapter="implement" size="sm" />
```

**Colors:**
- define → cyan (clarity)
- implement → purple (confidence)
- control → pink (control)
- improve → amber (momentum)
- finish → emerald (freedom)

### StatusIcon

Renders a status indicator for lessons, chapters, and submissions.

```typescript
interface StatusIconProps {
  status:
    | "locked"
    | "available"
    | "inProgress"
    | "completed"
    | "awaitingReview"
    | "approved"
    | "rejected"
    | "skipped";
  size?: "xs" | "sm" | "md" | "lg";          // Default: "sm"
  className?: string;
}

// Usage
<StatusIcon status="awaitingReview" size="md" />

// With badge + label
<StatusBadge status="approved" size="sm" inline />
```

**Status Meanings:**
- `locked` — Prerequisites not met (grey)
- `available` — Ready to start (primary blue)
- `inProgress` — Currently working (amber)
- `completed` — Finished successfully (emerald)
- `awaitingReview` — Submitted, awaiting coach approval (amber)
- `approved` — Coach approved, can proceed (emerald)
- `rejected` — Needs revision (red)
- `skipped` — Not applicable (grey)

### ActionIcon

Renders an icon for common UI operations.

```typescript
interface ActionIconProps {
  action:
    | "add"
    | "edit"
    | "delete"
    | "download"
    | "share"
    | "print"
    | "save"
    | "close"
    | "back"
    | "forward"
    | "search"
    | "filter"
    | "more";
  size?: "xs" | "sm" | "md" | "lg";          // Default: "sm"
  color?: "inherit" | "primary" | "success" | "warning" | "error" | "muted";
  className?: string;
}

// Usage
<ActionIcon action="delete" size="sm" color="error" />
<ActionIcon action="download" size="md" />
```

### ActionButton

Pre-styled button with an action icon.

```typescript
interface ActionButtonProps {
  action: ActionType;
  size?: "xs" | "sm" | "md" | "lg";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Usage
<ActionButton action="edit" onClick={handleEdit} />
<ActionButton action="delete" onClick={handleDelete} />
```

### IconButton

Reusable button for any icon (Heroicon, custom SVG, etc.).

```typescript
interface IconButtonProps {
  label: string;                             // Required for accessibility
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  withBackground?: boolean;
  children: ReactNode;                       // Icon element
}

// Usage
import { CheckIcon } from "@heroicons/react/24/solid";

<IconButton label="Approve this submission" variant="primary">
  <CheckIcon width="20" height="20" />
</IconButton>

// Context menu button
<ContextIconButton label="More options" onClick={openMenu}>
  <EllipsisHorizontalIcon width="20" height="20" />
</ContextIconButton>
```

### IconSizer

Utility component for consistent icon sizing.

```typescript
interface IconSizerProps {
  size?: "xs" | "sm" | "md" | "lg";          // Default: "sm"
  color?: "inherit" | "primary" | "success" | "warning" | "error" | "muted";
  label?: string;                            // Optional aria-title
  children: ReactNode;
}

// Usage
<IconSizer size="lg" color="primary">
  <CustomIcon />
</IconSizer>
```

## Icon Sizes

All icons scale through a standardized size system:

| Size | Pixels | Usage |
|------|--------|-------|
| `xs` | 16px | Tight UI, inline labels, badges |
| `sm` | 20px | Default, most UI elements |
| `md` | 24px | Prominent, navigation icons |
| `lg` | 32px | Large, hero/featured areas |

## Colors & Semantic Meaning

### Chapter Colors (Psychological States)

Tied to learner psychology at each chapter boundary:

```typescript
import { PSYCHOLOGICAL_STATE_COLORS, getPsychologicalStateColor } from "@/components/icons";

const color = getPsychologicalStateColor("clarity");
// { label: "Clarity", color: "#06b6d4", bgColor: "#cffafe" }
```

| State | Chapter | Color | Feeling |
|-------|---------|-------|---------|
| uncertainty | Start | Grey | Baseline |
| clarity | Chapter 1 (DEFINE) | Cyan | Clear direction |
| confidence | Chapter 2 (IMPLEMENT) | Purple | Confidence in action |
| control | Chapter 3 (CONTROL) | Pink | In control |
| momentum | Chapter 4 (IMPROVE & SCALE) | Amber | Growing momentum |
| freedom | FINISH | Emerald | Freedom achieved |

### Coaching Status Colors

For approval workflows and submission reviews:

```typescript
import { COACHING_STATUS_COLORS, getCoachingStatusColor } from "@/components/icons";

const status = getCoachingStatusColor("pending");
// { label: "Awaiting Review", color: "#3b82f6", bgColor: "#dbeafe" }
```

| Status | Color | Meaning |
|--------|-------|---------|
| pending | Blue | Awaiting coach review |
| approved | Emerald | Coach approved |
| rejected | Red | Needs revision |
| revision | Amber | Revision requested |

## Integration Examples

### Navigation Menu

```typescript
import { ChapterIcon } from "@/components/icons";
import { MarketingIcon } from "@/components/MarketingIcons";

export function Navigation() {
  return (
    <nav>
      <a href="/programme">
        <MarketingIcon name="book" size={20} />
        Programme
      </a>
      <a href="/business">
        <MarketingIcon name="plan" size={20} />
        My Business
      </a>
    </nav>
  );
}
```

### Programme Journey

```typescript
import { ChapterIcon, StatusIcon } from "@/components/icons";

export function ProgrammeJourney({ stages }) {
  return (
    <div className="journey">
      {stages.map((stage) => (
        <div key={stage.id} className="stage">
          <ChapterIcon chapter={stage.id} size="lg" withBackground />
          <h3>{stage.title}</h3>
          <StatusIcon status={stage.status} />
        </div>
      ))}
    </div>
  );
}
```

### Chapter Approval Dashboard

```typescript
import { StatusIcon, ActionButton } from "@/components/icons";
import { COACHING_STATUS_COLORS } from "@/components/icons";

export function SubmissionReview({ submission }) {
  const statusColor = COACHING_STATUS_COLORS[submission.status];

  return (
    <div style={{ borderLeft: `3px solid ${statusColor.color}` }}>
      <StatusIcon status={submission.status} />
      <h4>{submission.title}</h4>
      <div className="actions">
        <ActionButton action="download" />
        <ActionButton action="delete" />
      </div>
    </div>
  );
}
```

### Action Bar

```typescript
import { ActionButton } from "@/components/icons";

export function DocumentActions({ onDownload, onShare, onDelete }) {
  return (
    <div className="action-bar">
      <ActionButton action="download" onClick={onDownload} />
      <ActionButton action="share" onClick={onShare} />
      <ActionButton action="delete" onClick={onDelete} />
    </div>
  );
}
```

## Accessibility

All icon components include automatic accessibility:

- **Icon buttons** have `aria-label` and `title` attributes
- **Status/Chapter icons** include descriptive labels
- **Action icons** inherit keyboard focus and keyboard-navigable button states
- **Color is never the only indicator** — each status has a distinct icon shape

Example:
```typescript
// Automatically accessible
<ActionButton action="edit" />
// Renders with: aria-label="Edit", title="Edit"

// With custom label
<IconButton label="Approve this submission">
  <CheckIcon />
</IconButton>
```

## Design Tokens

Icon colors use CSS custom properties, defined in `app/design-system.css`:

```css
--ds-chapter-1: #06b6d4;  /* DEFINE */
--ds-chapter-2: #8b5cf6;  /* IMPLEMENT */
--ds-chapter-3: #ec4899;  /* CONTROL */
--ds-chapter-4: #f59e0b;  /* IMPROVE & SCALE */
--ds-chapter-5: #10b981;  /* FINISH */

/* Semantic status */
--ds-success: #12703a;
--ds-warning: #b45309;
--ds-danger: #c81e1e;
--ds-info: #2563eb;
```

Dark mode variants are automatically applied via `[data-theme="dark"]`.

## Extending the Icon System

### Adding a New Icon Category

1. Add icon definitions to `lib/icons/icon-registry.ts`
2. Create a component (e.g., `components/icons/NewIcon.tsx`)
3. Import Heroicons needed for that category
4. Export from `components/icons/index.ts`

### Adding Heroicons

```typescript
// In icon-registry.ts
export const NEW_CATEGORY = {
  concept1: { label: "...", description: "..." },
  // ...
} as const;
```

```typescript
// In components/icons/NewIcon.tsx
import { DesiredIcon } from "@heroicons/react/24/solid";

const ICON_MAP = {
  concept1: DesiredIcon,
  // ...
};
```

## Migration Guide

### From MarketingIcon to New Icon System

The new icon system coexists with the existing `MarketingIcon` component. Legacy navigation still uses `MarketingIcon`; new UI uses the structured icon system.

**Navigation (use existing MarketingIcon):**
```typescript
import { MarketingIcon } from "@/components/MarketingIcons";
<MarketingIcon name="book" size={20} />
```

**Programme chapters (use new ChapterIcon):**
```typescript
import { ChapterIcon } from "@/components/icons";
<ChapterIcon chapter="define" size="md" />
```

**Actions (use new ActionIcon):**
```typescript
import { ActionIcon } from "@/components/icons";
<ActionIcon action="edit" size="sm" />
```

## Files & Paths

```
/apps/web/
├── components/icons/
│   ├── ChapterIcon.tsx
│   ├── StatusIcon.tsx
│   ├── ActionIcon.tsx
│   ├── IconButton.tsx
│   ├── IconSizer.tsx
│   └── index.ts
├── lib/icons/
│   └── icon-registry.ts
├── app/design-system.css (icon system styles)
└── docs/ICON-SYSTEM.md (this file)
```

## Testing & QA

When testing the icon system:

- [ ] All chapter icons render with correct colors
- [ ] Status icons are distinguishable by shape and color
- [ ] Action buttons work with keyboard navigation
- [ ] Icons scale correctly at xs/sm/md/lg sizes
- [ ] Dark mode colors are legible
- [ ] Icon buttons have accessible labels
- [ ] Hover states provide visual feedback
- [ ] No duplicate icon usage across the app
- [ ] Icons feel cohesive as one system

## Future Enhancements

- SVG sprite sheet for production optimization
- Icon animation library (loading, success states)
- Icon usage metrics and audit dashboard
- Design token generator from Figma
- Storybook integration for icon showcase
