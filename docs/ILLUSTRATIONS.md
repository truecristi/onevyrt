# ONEVYRT Illustrations & Visual System

## Overview

ONEVYRT uses a cohesive system of professional, clean SVG illustrations for visual storytelling throughout the app. Illustrations support visual learning, empty states, journey visualization, and engagement.

All illustrations are stored in `/apps/web/public/illustrations/` and are served as static assets.

---

## Available Illustrations

### Journey & Programme

#### `chapter-journey.svg`
- **Purpose:** Visual flowchart of the ONEVYRT programme progression
- **Use Cases:** 
  - Programme landing page (`/programme`)
  - Onboarding flow
  - Marketing/educational contexts
- **Dimensions:** 1200×300px (widescreen)
- **Colors:** Gradient of chapter colors (Blue → Green → Orange → Red → Teal)
- **Features:**
  - Interactive nodes (hover effects)
  - Connection lines showing gates/approvals
  - Psychological state labels
  - Key outputs per chapter

#### `programme-complete.svg`
- **Purpose:** Celebration illustration for finished learners
- **Use Cases:**
  - Programme completion screen
  - Transformation Report page
  - Success messaging
- **Dimensions:** 400×400px (square)
- **Colors:** Multi-colored confetti, trophy in orange, success greens
- **Features:**
  - Animated trophy (bounce)
  - Confetti elements (spinning)
  - Checkmark overlay
  - Text overlay support

#### `bottleneck-funnel.svg`
- **Purpose:** Funnel visualization for identifying business bottlenecks
- **Use Cases:**
  - Chapter 4.1 (Find the Bottleneck) teaching pages
  - Dashboard insights
  - Growth planning context
- **Dimensions:** 500×600px (portrait)
- **Colors:** Green → Orange → Red (showing flow constraints)
- **Features:**
  - Graduated funnel showing narrowing
  - Bottleneck highlighting (pulsing red)
  - Percentage labels at each stage
  - Annotation box

### Dashboard & Business

#### `business-snapshot.svg`
- **Purpose:** Overview of business dimensions (Customer, Strategy, Numbers, Plan)
- **Use Cases:**
  - My Business dashboard
  - Programme context view
  - Business model explainer
- **Dimensions:** 600×400px
- **Colors:** Blue, Green, Orange, Red (chapter progression)
- **Features:**
  - Four primary cards (Customer, Strategy, Numbers)
  - Central Growth/Improvement Plan card
  - Flow connections between cards
  - Icon indicators

### Empty States

Empty state illustrations prompt users to take action when no content exists. They're smaller, compact, and focus on a single concept.

#### `empty-state-projects.svg`
- **Purpose:** No projects/funnels created yet
- **Use Cases:**
  - Funnel list page when empty
  - Campaign dashboard when no campaigns exist
- **Dimensions:** 300×300px
- **Content:** Briefcase with "Start Your First Project" messaging
- **Colors:** Neutral slate/orange accent

#### `empty-state-coaching.svg`
- **Purpose:** No coaching programme assigned
- **Use Cases:**
  - Coaching section when user isn't in a cohort
  - Coach availability pending
- **Dimensions:** 300×300px
- **Content:** Mentor figure with "No Coaching Yet" messaging
- **Colors:** Orange mentor, multi-colored background

#### `empty-state-growth-plan.svg`
- **Purpose:** Growth plan not yet created
- **Use Cases:**
  - Chapter 4 before completion
  - Growth Plan view when empty
- **Dimensions:** 300×300px
- **Content:** Growing chart bars with "Build Your Growth Plan" messaging
- **Colors:** Green bars (growth), red/purple accents

---

## Component Usage

### Illustration Component

The reusable `Illustration` component renders SVGs with responsive sizing, alt text, and accessibility:

```tsx
import { Illustration } from "@/components/illustrations/Illustration";

export function MyComponent() {
  return (
    <Illustration 
      name="chapter-journey" 
      variant="full"
      responsive={true}
    />
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `name` | IllustrationName | required | Illustration identifier (e.g., "chapter-journey") |
| `variant` | "full" \| "compact" | "full" | Full width or constrained compact view |
| `responsive` | boolean | true | Enable responsive scaling |
| `className` | string | "" | Additional CSS classes |
| `alt` | string | auto | Override default alt text |
| `style` | CSSProperties | {} | Inline container styles |

**Illustration Names:**
- `chapter-journey`
- `programme-complete`
- `bottleneck-funnel`
- `business-snapshot`
- `empty-state-projects`
- `empty-state-coaching`
- `empty-state-growth-plan`

**Variants:**
- `full` (100% width, responsive)
- `compact` (max-width: 300px)

**Example: Compact Empty State**
```tsx
<Illustration 
  name="empty-state-projects" 
  variant="compact"
/>
```

**Example: Full-width Journey**
```tsx
<Illustration 
  name="chapter-journey"
  variant="full"
  className="my-custom-class"
/>
```

### Preloading Illustrations

For critical illustrations (shown above the fold), preload them for better performance:

```tsx
import { preloadIllustrations } from "@/components/illustrations/Illustration";

useEffect(() => {
  preloadIllustrations(["chapter-journey", "programme-complete"]);
}, []);
```

### Programme Progress Component

Visual progress tracker with chapter cards and readiness scoring:

```tsx
import { ProgrammeProgress } from "@/components/visualizations/ProgrammeProgress";

export function ProgressDashboard() {
  const chapters = [
    {
      key: "define",
      title: "DEFINE — Business Blueprint",
      number: 1,
      lessonsComplete: 5,
      lessonsTotal: 6,
      status: "approved",
      isCurrentChapter: false,
    },
    // ... more chapters
  ];

  return (
    <ProgrammeProgress
      chapters={chapters}
      completedLessons={5}
      totalLessons={22}
      readinessScore={72}
      readinessLabel="developing"
    />
  );
}
```

**Props:**
- `chapters`: ChapterProgress[] — Progress data per chapter
- `completedLessons`: number — Total completed
- `totalLessons`: number — Total in programme
- `readinessScore`: number | null — 0-100 score (optional)
- `readinessLabel`: "no_data" | "fragile" | "developing" | "strong" (optional)
- `compact`: boolean — Smaller inline view
- `className`: string — Additional CSS classes

---

## Design System & Colors

### Chapter Colors
Illustrations use the semantic chapter color system from `lib/colors/chapter-tokens.ts`:

```typescript
export const CHAPTER_COLORS = {
  start:     "#64748b", // Slate — baseline
  define:    "#2563eb", // Blue — clarity
  implement: "#16a34a", // Green — growth
  control:   "#d97706", // Amber — discipline
  improve:   "#dc2626", // Red — momentum
  finish:    "#0891b2", // Cyan — completion
};
```

### Soft & Dark Variants
For backgrounds and hover states:
```typescript
CHAPTER_COLORS_SOFT   // Light tints (e.g., #eff6ff for blue)
CHAPTER_COLORS_DARK   // Dark variants (e.g., #1e40af)
```

### Status Colors
```typescript
STATUS_COLORS = {
  approved:         "#16a34a", // Green
  awaiting:         "#2563eb", // Blue
  changesRequested: "#d97706", // Amber
  rejected:         "#dc2626", // Red
};
```

---

## Accessibility

### Alt Text & Semantic HTML
All illustrations include:
- Descriptive `alt` text for screen readers
- `title` attribute with context
- `role="img"` semantics where needed

### Color Contrast
- All illustration colors pass WCAG AA contrast on light/dark backgrounds
- Do not rely on color alone to convey information
- Add labels, text, or icons for critical state

### Dark Mode
SVGs use semantic CSS colors (`var(--ds-*)`) that respect user theme preference. Illustrations automatically adapt when the design system color scheme changes.

---

## Adding New Illustrations

### Process
1. **Design** in Figma (or SVG editor)
   - Keep simple and clean (not cartoonish)
   - Use chapter colors or status colors
   - Target 300–1200px width
   - Keep file size < 20KB

2. **Export** as optimized SVG
   - Remove editor metadata
   - Keep meaningful element IDs (for styling if needed)
   - Remove unused gradients/masks

3. **Place** in `/apps/web/public/illustrations/`
   - Name descriptively (kebab-case): `feature-name.svg`
   - Include both light and dark mode variants if needed

4. **Register** in `components/illustrations/Illustration.tsx`
   - Add to `ILLUSTRATIONS` map
   - Provide metadata (dimensions, alt text, description)
   - Add to `IllustrationName` type

5. **Document** in this file
   - Add section under "Available Illustrations"
   - Explain purpose and use cases
   - Link to related pages

---

## Performance Considerations

### Lazy Loading
- Illustrations use `loading="lazy"` by default
- Lazy-load non-critical illustrations below the fold

### File Size
- Keep SVG files under 20KB
- Use `svgo` or similar tools to optimize
- Inline small illustrations if needed

### Responsive Sizing
- Use responsive variants to avoid oversized downloads
- SVGs scale without quality loss
- CSS media queries adjust layout, not illustration dimensions

---

## Examples in Codebase

### Empty State in a Page
```tsx
// app/projects/page.tsx
import { Illustration } from "@/components/illustrations/Illustration";

export default function ProjectsPage() {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <Illustration 
          name="empty-state-projects"
          variant="compact"
        />
        <h2>No projects yet</h2>
        <p>Create your first funnel to get started</p>
        <CreateButton />
      </div>
    );
  }
  // ... render projects
}
```

### Programme Journey Visualization
```tsx
// app/programme/page.tsx
import { Illustration } from "@/components/illustrations/Illustration";

export default function ProgrammePage() {
  return (
    <section>
      <h1>Your Transformation Journey</h1>
      <Illustration 
        name="chapter-journey"
        variant="full"
        preload={true}
      />
      <ProgrammeJourney stages={stages} />
    </section>
  );
}
```

### Progress Dashboard
```tsx
// app/my-business/page.tsx
import { ProgrammeProgress } from "@/components/visualizations/ProgrammeProgress";

export default function MyBusinessPage() {
  return (
    <div>
      <ProgrammeProgress
        chapters={chapters}
        completedLessons={map.completedLessons}
        totalLessons={map.totalLessons}
        readinessScore={snapshot.readinessScore}
        readinessLabel={snapshot.readinessLabel}
      />
      <Illustration name="business-snapshot" />
    </div>
  );
}
```

---

## Troubleshooting

### Illustration Not Showing
- Check file exists in `/apps/web/public/illustrations/`
- Verify name matches exactly (case-sensitive)
- Check browser console for HTTP 404
- Ensure SVG has `<svg>` root element with `viewBox`

### Colors Look Wrong
- Check system CSS variables (`--ds-*`) are loaded
- Verify illustration uses semantic colors, not hardcoded
- Test in both light and dark mode
- Check color contrast with WCAG validator

### Performance Issues
- Reduce SVG file size with optimization tool
- Use compact variant for non-critical illustrations
- Preload only above-the-fold illustrations
- Lazy-load below-the-fold content

---

## Future Enhancements

- [ ] Animated illustration variants (hover/scroll triggers)
- [ ] Dark mode specific illustrations
- [ ] Illustration gallery / showcase
- [ ] Accessible animated transitions library
- [ ] Interactive/clickable illustrations (journey map)
- [ ] Custom color override props
- [ ] SVG sprite sheet optimization

---

## Related Documentation

- [Design System](/docs/DESIGN_SYSTEM.md)
- [Color Tokens](/apps/web/lib/colors/chapter-tokens.ts)
- [Component Library](/docs/COMPONENTS.md)
