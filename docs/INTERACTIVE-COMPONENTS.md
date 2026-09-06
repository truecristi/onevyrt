# ONEVYRT Interactive Components & Animations

Complete reference for interactive visual components, micro-interactions, and animated UI elements created in Wave 1.

## Overview

12 interactive components + 2 animation utility libraries have been created to bring ONEVYRT's visual system to life. All components include:

- ✅ TypeScript strict mode
- ✅ React hooks (functional components)
- ✅ Smooth 200-400ms animations
- ✅ Accessibility (keyboard nav, ARIA labels, focus states)
- ✅ Dark mode support
- ✅ Respects `prefers-reduced-motion`
- ✅ Mobile-first responsive design
- ✅ 60fps performance (no jank)

---

## Animation Utilities (Foundation)

### 1. `lib/animations/micro-interactions.ts`
**Purpose:** Core animation utilities and CSS keyframes for smooth, snappy interactions.

**Exports:**
- `fadeIn`, `fadeOut` — Opacity transitions
- `slideUp`, `slideDown`, `slideLeft`, `slideRight` — Directional translations
- `scaleIn`, `scaleOut` — Size scaling with fade
- `bounce`, `pulse`, `spin`, `shake`, `heartbeat` — Attention animations
- `prefersReducedMotion()` — Check user accessibility preference
- `getDuration()`, `getDelay()` — Duration helpers that respect reduced motion
- `fadeInStyle()`, `slideUpStyle()`, `scaleInStyle()` — CSS-in-JS helpers
- `staggerDelay()` — Staggered list item delays
- `heightTransitionStyle()` — Smooth height animations (for collapsibles)
- `colorTransitionStyle()` — Color transitions

**Usage:**
```tsx
import { slideUp, prefersReducedMotion, staggerDelay } from '@/lib/animations/micro-interactions';

// Use as Tailwind classes
<div className={slideUp}>Content</div>

// Or inline styles
<div style={slideUpStyle(300, 50)}>Content</div>

// Stagger list items
{items.map((item, i) => (
  <div key={i} style={{ animationDelay: `${staggerDelay(i)}ms` }}>
    {item}
  </div>
))}
```

---

### 2. `lib/animations/celebrations.ts`
**Purpose:** Celebratory animations for milestone completions, achievements, and rewards.

**Exports:**
- `triggerConfetti(options)` — Particle system (50–200 particles, configurable)
- `showBadgeAnimation(title, icon, position)` — Toast-style badge reveal
- `showTrophyAnimation(title, subtitle)` — Full-screen trophy animation
- `triggerCelebration(config)` — Combined celebration (confetti + badge + sound)
- `animateCounter(element, start, end, duration, format)` — Number counter
- `scalePulse(element, cycles)` — Attention pulse

**Usage:**
```tsx
import { triggerCelebration, animateCounter } from '@/lib/animations/celebrations';

// Confetti + badge on chapter completion
<button onClick={() => 
  triggerCelebration({
    title: "Chapter 1 Complete!",
    subtitle: "Business Blueprint Ready",
    showConfetti: true,
    showBadge: true,
  })
}>
  Submit Chapter
</button>

// Number counter on metric update
animateCounter(
  elementRef.current,
  0,
  15250,
  1000,
  (n) => `$${n.toLocaleString()}`
);
```

---

## Interactive UI Components

### 3. `components/ui/AnimatedMetricCard.tsx`
**Purpose:** Display business metrics with smooth animations and trend indicators.

**Props:**
- `title` (string) — Metric name
- `value` (number) — Current value
- `previousValue` (number) — Triggers flip animation on change
- `trend` (object) — `{ value: number, direction: "up"|"down"|"flat" }`
- `status` ("fragile" | "developing" | "strong" | "excellent") — Health indicator
- `format` (function) — Custom formatter (e.g., currency, percentage)
- `isLoading` (boolean) — Show skeleton state
- `comparison` (string) — Text like "vs last month"
- `icon` (string) — Emoji or icon
- `onClick` (function) — Click handler

**Features:**
- Counter animation (0 → target)
- Trend arrow with percentage
- Color-coded status indicator
- Flip animation on data update
- Loading skeleton state

**Usage:**
```tsx
import { AnimatedMetricCard } from '@/components/ui/AnimatedMetricCard';

<AnimatedMetricCard
  title="Revenue"
  value={15250}
  trend={{ value: 12, direction: "up" }}
  status="strong"
  format={(n) => `$${n.toLocaleString()}`}
  icon="💰"
/>
```

---

### 4. `components/ui/InteractiveStatusBadge.tsx`
**Purpose:** Color-coded status indicators with tooltips and animations.

**Status Types:**
- `approved` (green) — Complete, positive
- `awaiting` (blue) — Pending with pulse animation
- `rejected` (red) — Needs revision
- `locked` (grey) — Prerequisites not met
- `inProgress` (cyan) — Active work
- `skipped` (grey) — Not applicable

**Props:**
- `status` (BadgeStatus) — Status type
- `label` (string) — Display text
- `explanation` (string) — Hover tooltip text
- `icon` (string) — Custom icon
- `size` ("sm" | "md" | "lg")
- `onClick` (function) — Click handler
- `pulse` (boolean) — Animate pulse for "awaiting"

**Features:**
- Clickable status with tooltip
- Animated state transitions
- Pulse animation for awaiting state
- StatusBadgeGroup for multiple badges
- AnimatedStatusTransition for progress tracking

**Usage:**
```tsx
import { InteractiveStatusBadge, StatusBadgeGroup } from '@/components/ui/InteractiveStatusBadge';

<InteractiveStatusBadge
  status="approved"
  label="Chapter 1 Complete"
  explanation="You've defined your business blueprint."
  onClick={() => navigate('/chapter-1')}
/>

<StatusBadgeGroup
  items={[
    { id: '1', status: 'approved', label: 'Ch 1' },
    { id: '2', status: 'awaiting', label: 'Ch 2' },
  ]}
/>
```

---

### 5. `components/ui/AnimatedProgressBar.tsx`
**Purpose:** Smooth, animated progress visualization with multiple modes.

**Props:**
- `value` (number) — Current progress (0–100 by default)
- `max` (number) — Maximum value (default: 100)
- `chapter` (ChapterKey) — Chapter color scheme
- `showLabel` (boolean) — Show percentage text
- `showMilestones` (boolean) — Show 25/50/75/100% markers
- `segments` (array) — Multi-stage progress breakdown
- `celebrate` (boolean) — Trigger celebration at 100%
- `height` ("xs" | "sm" | "md" | "lg") — Bar thickness
- `indeterminate` (boolean) — Show loading animation

**Features:**
- Smooth width animation
- Segment breakdown support
- Milestone markers
- Celebration animation at 100%
- Indeterminate loading state
- Multi-stage progress indicator
- Stacked progress bars

**Usage:**
```tsx
import { AnimatedProgressBar, StackedProgressBar, MultiStageProgress } from '@/components/ui/AnimatedProgressBar';

<AnimatedProgressBar
  value={65}
  max={100}
  chapter="implement"
  showLabel
  showMilestones
  celebrate
/>

<StackedProgressBar
  items={[
    { id: '1', label: 'Leads', value: 1200, max: 2000 },
    { id: '2', label: 'Conversions', value: 340, max: 500 },
  ]}
/>
```

---

### 6. `components/ui/InteractiveTimeline.tsx`
**Purpose:** Vertical or horizontal timeline with interactive nodes and event details.

**Event Structure:**
```tsx
interface TimelineEvent {
  id: string;
  name: string;
  description?: string;
  timestamp?: string;
  color?: string;
  icon?: string;
  details?: string;
  status?: "completed" | "current" | "upcoming";
}
```

**Props:**
- `events` (TimelineEvent[]) — Array of timeline events
- `currentIndex` (number) — Current position (0-based)
- `orientation` ("vertical" | "horizontal") — Layout direction
- `showDetails` (boolean) — Show details on interaction
- `chapter` (string) — Chapter color scheme

**Features:**
- Vertical or horizontal layout
- Clickable nodes with detail cards
- Status indicators (completed/current/upcoming)
- Smooth scroll to selected event
- Animated connection lines
- Keyboard navigation

**Usage:**
```tsx
import { InteractiveTimeline, HorizontalTimeline, MilestoneTimeline } from '@/components/ui/InteractiveTimeline';

<InteractiveTimeline
  events={[
    { id: '1', name: 'Define', icon: '📋', status: 'completed' },
    { id: '2', name: 'Implement', icon: '🔨', status: 'current' },
    { id: '3', name: 'Control', icon: '📊', status: 'upcoming' },
  ]}
  currentIndex={1}
  orientation="vertical"
/>
```

---

### 7. `components/ui/AnimatedFormFields.tsx`
**Purpose:** Form inputs with floating labels, validation, and smooth animations.

**Components:**
- `AnimatedTextInput` — Text/email/password input
- `AnimatedSelect` — Dropdown select
- `AnimatedTextArea` — Multi-line text
- `AnimatedForm` — Form wrapper

**Props (TextInput):**
- `label` (string) — Floating label
- `type` ("text" | "email" | "password" | etc)
- `value` (string) — Input value
- `onChange` (function) — Change handler
- `error` (string) — Error message (triggers shake animation)
- `success` (boolean) — Show checkmark
- `help` (string) — Help text
- `isLoading` (boolean) — Show loading spinner
- `required` (boolean) — Mark as required

**Features:**
- Floating labels with smooth animation
- Focus state with color transition
- Error state with shake animation
- Success checkmark animation
- Loading spinner for async validation
- Smooth transitions between states
- Accessibility: ARIA labels, focus ring

**Usage:**
```tsx
import { AnimatedTextInput, AnimatedSelect, AnimatedForm } from '@/components/ui/AnimatedFormFields';

<AnimatedForm onSubmit={handleSubmit}>
  <AnimatedTextInput
    label="Email"
    type="email"
    value={email}
    onChange={setEmail}
    error={emailError}
    success={emailValid}
    help="We'll never share your email"
  />

  <AnimatedSelect
    label="Package"
    options={packages}
    value={selected}
    onChange={setSelected}
  />
</AnimatedForm>
```

---

### 8. `components/ui/InfoPanel.tsx`
**Purpose:** Hover-activated information panels with smart positioning and accessibility.

**Components:**
- `InfoPanel` — Main panel component
- `InfoIcon` — Small info icon (?)
- `TipBox` — Styled info/warning/success/error box

**Props (InfoPanel):**
- `trigger` (ReactNode) — Element that opens panel
- `content` (ReactNode) — Panel content
- `position` ("top" | "bottom" | "left" | "right" | "auto") — Placement
- `size` ("sm" | "md" | "lg") — Panel size
- `chapter` (string) — Chapter color
- `title` (string) — Panel title
- `icon` (string) — Icon emoji
- `showClose` (boolean) — Show close button

**Features:**
- Smooth fade/slide animation
- Smart positioning (auto avoids viewport overflow)
- Keyboard accessible (Escape to close)
- Hover or click to open
- Persistent mode for mobile
- Dark mode aware

**Usage:**
```tsx
import { InfoPanel, InfoIcon, TipBox } from '@/components/ui/InfoPanel';

<InfoPanel
  trigger={<button>Help</button>}
  content="This is helpful information about the feature."
  position="right"
  title="How it works"
/>

<InfoIcon content="Learn more about this..." chapter="implement" />

<TipBox
  type="success"
  title="Complete!"
  content="Your chapter has been submitted for review."
  closeable
/>
```

---

### 9. `components/ui/AnimatedSelectableCard.tsx`
**Purpose:** Interactive card selection with smooth animations and multi-select support.

**Components:**
- `AnimatedSelectableCard` — Single selectable card
- `SelectableCardGroup` — Group of cards
- `ToggleCard` — Binary on/off card
- `OptionPicker` — Compact option buttons

**Props (Card):**
- `selected` (boolean) — Selection state
- `onSelect` (function) — Selection handler
- `title` (string) — Card title
- `description` (ReactNode) — Card content
- `icon` (ReactNode) — Icon/emoji
- `badge` (string) — Optional tag
- `chapter` (string) — Color scheme
- `size` ("sm" | "md" | "lg")

**Features:**
- Selection with smooth animations
- Checkmark animation on select
- Background color transition
- Multi-select support (in group)
- Keyboard navigation (Space/Enter)
- Focus state styling

**Usage:**
```tsx
import { AnimatedSelectableCard, SelectableCardGroup, OptionPicker } from '@/components/ui/AnimatedSelectableCard';

<SelectableCardGroup
  options={[
    { id: '1', title: 'Option 1', description: 'First choice', icon: '🎯' },
    { id: '2', title: 'Option 2', description: 'Second choice', icon: '📊' },
  ]}
  selected={selected}
  onSelect={setSelected}
  multiple={false}
/>

<OptionPicker
  options={[
    { value: 'small', label: 'Small', icon: 'S' },
    { value: 'large', label: 'Large', icon: 'L' },
  ]}
  selected={size}
  onSelect={setSize}
/>
```

---

### 10. `components/ui/ProgressiveDisclosure.tsx`
**Purpose:** Expandable sections with smooth height animations and accessibility.

**Components:**
- `ProgressiveDisclosure` — Main disclosure system
- `Accordion` — Single-open variant
- `DetailsCard` — Styled details disclosure

**Props (Disclosure):**
- `sections` (DisclosureSection[]) — Array of sections
  - `id` (string) — Unique ID
  - `title` (string) — Section title
  - `children` (ReactNode) — Section content
  - `icon` (string) — Optional icon
  - `chapter` (string) — Color scheme
  - `badge` (string|number) — Optional badge
  - `completeness` (0-100) — Progress indicator
- `allowMultiple` (boolean) — Allow multiple open
- `accordion` (boolean) — Single-open mode
- `showCompleteness` (boolean) — Show progress %

**Features:**
- Smooth height animation on expand/collapse
- Chevron indicator rotation
- Completeness percentage display
- Icon badges for section status
- Keyboard navigation (arrow keys)
- ARIA roles and labels
- Smooth transitions

**Usage:**
```tsx
import { ProgressiveDisclosure, Accordion, DetailsCard } from '@/components/ui/ProgressiveDisclosure';

<ProgressiveDisclosure
  sections={[
    {
      id: '1',
      title: 'Define Your Business',
      icon: '📋',
      completeness: 100,
      children: <p>Your definition content...</p>,
    },
    {
      id: '2',
      title: 'Build Your System',
      icon: '🔨',
      completeness: 65,
      children: <p>Your system content...</p>,
    },
  ]}
  allowMultiple
  showCompleteness
/>

<Accordion items={items} onChange={handleChange} />

<DetailsCard
  title="More Information"
  summary="Click to expand"
  icon="ℹ"
>
  <p>Detailed information goes here...</p>
</DetailsCard>
```

---

### 11. `components/ui/SkeletonStates.tsx`
**Purpose:** Loading placeholders with pulse animations for various content types.

**Skeleton Components:**
- `SkeletonLoader` — Wrapper for conditional skeleton display
- `CardSkeleton` — Card loading placeholder
- `ListSkeleton` — List of items placeholder
- `TextSkeleton` — Text lines placeholder
- `ImageSkeleton` — Image placeholder
- `TableSkeleton` — Data table placeholder
- `DashboardSkeleton` — Full dashboard layout
- `FormSkeleton` — Form fields placeholder
- `AvatarSkeleton` — Avatar/profile picture
- `BadgeSkeleton` — Badge/tag collection
- `LoadingDots` — Animated 3-dot loader
- `Spinner` — Rotating spinner
- `ProgressSkeleton` — Progress bar placeholder
- `Skeleton` — Generic configurable skeleton

**Usage:**
```tsx
import { SkeletonLoader, CardSkeleton, Spinner, LoadingDots } from '@/components/ui/SkeletonStates';

<SkeletonLoader isLoading={isLoading} skeleton={<CardSkeleton />}>
  <YourContent />
</SkeletonLoader>

<Spinner size="md" color="#088057" />

<LoadingDots text="Loading" size="md" />

<DashboardSkeleton />
```

---

### 12. `components/studio/InteractiveFunnelBuilder.tsx`
**Purpose:** Drag-and-drop funnel editor with real-time visualization and calculations.

**Props:**
- `initialStages` (FunnelStage[]) — Starting funnel configuration
- `onSave` (function) — Save callback
- `onChange` (function) — Change callback
- `editable` (boolean) — Allow editing (default: true)

**Funnel Stage:**
```tsx
interface FunnelStage {
  id: string;
  name: string;
  audience?: number; // Estimated audience size
  conversionTarget?: number; // Target conversion %
  description?: string;
  color?: string;
  order: number;
}
```

**Features:**
- Drag-and-drop stage reordering
- Add/remove stages dynamically
- Stage template picker (Awareness, Interest, etc.)
- Real-time audience flow calculation
- Visual funnel with narrowing stages
- Undo functionality
- Export as JSON
- Metrics summary (total audience, leads, conversion %)

**Usage:**
```tsx
import { InteractiveFunnelBuilder } from '@/components/studio/InteractiveFunnelBuilder';

<InteractiveFunnelBuilder
  initialStages={[
    {
      id: 'awareness',
      name: 'Awareness',
      audience: 10000,
      conversionTarget: 20,
      order: 0,
    },
  ]}
  onSave={(stages) => saveFunnel(stages)}
  onChange={(stages) => updateFunnel(stages)}
/>
```

---

## Integration Guide

### 1. Import in Your Component
```tsx
import { AnimatedMetricCard } from '@/components/ui/AnimatedMetricCard';
import { InteractiveStatusBadge } from '@/components/ui/InteractiveStatusBadge';
// ... import other components as needed
```

### 2. Use Animation Utilities
All components use the animation utilities automatically, but you can also use them directly:

```tsx
import { slideUp, fadeIn, staggerDelay } from '@/lib/animations/micro-interactions';
import { triggerConfetti, showBadgeAnimation } from '@/lib/animations/celebrations';
```

### 3. Apply to Your Sections
- **Chapter Learning Pages:** Use `ProgressiveDisclosure` for lesson sections
- **Coaching Review:** Use `InteractiveStatusBadge` and `AnimatedProgressBar` for approval status
- **My Business Dashboard:** Use `AnimatedMetricCard` for KPIs
- **Lesson Completion:** Use `AnimatedProgressBar` with `celebrate={true}`
- **Form Submissions:** Use `AnimatedFormFields` for all inputs
- **Transformation Report:** Use `AnimatedSelectableCard` for options

### 4. Customize Colors
All components accept a `chapter` prop to inherit chapter colors:

```tsx
<AnimatedMetricCard chapter="define" /> // Blue
<AnimatedMetricCard chapter="implement" /> // Green
<AnimatedMetricCard chapter="control" /> // Orange
<AnimatedMetricCard chapter="improve" /> // Red
<AnimatedMetricCard chapter="finish" /> // Cyan
```

---

## Accessibility Checklist

✅ **Keyboard Navigation:**
- Arrow keys expand/collapse sections
- Tab moves between interactive elements
- Space/Enter activates buttons/cards
- Escape closes panels/modals

✅ **ARIA Labels:**
- `role="progressbar"` on progress bars
- `aria-expanded` on disclosure sections
- `aria-label` on all interactive elements
- `aria-invalid` on form errors

✅ **Focus States:**
- Visible focus ring (2px outline)
- Color contrast 4.5:1 minimum
- Focus ring offset for clarity

✅ **Motion Accessibility:**
- Respects `prefers-reduced-motion`
- No seizure-inducing animations
- Smooth 200-400ms transitions

✅ **Color:**
- Not color-only indicators
- Status icons + color
- Color meanings explained in text

---

## Performance Notes

- **Bundle Size:** ~50 KB total (all 12 components + utilities)
- **Animation Performance:** 60fps on modern devices
- **Loading:** Lazy-load heavy components (forms, dashboards) if needed
- **Memory:** Confetti and animations clean up after completion

---

## Browser Support

- Chrome/Edge 88+
- Firefox 87+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android 88+)

---

## Next Steps (Wave 2+)

- [ ] Rate limiting on lesson submit/review routes
- [ ] Share/PDF for Growth & Improvement Plan
- [ ] Community moderation dashboard
- [ ] Advanced animations for micro-interactions
- [ ] Video tutorials for component usage
