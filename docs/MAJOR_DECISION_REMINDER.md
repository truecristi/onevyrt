# MajorDecisionReminder: Alignment Before Big Actions

## Overview

`MajorDecisionReminder` is a powerful component that pauses users before major decisions (payments, level-ups, milestones) to remind them of their deeper purpose (Why & Creed). It implements a conscious decision-making workflow that keeps users aligned with their values.

**Core Principle:** Every major action should move the user *toward* their why, not away from it. This component makes that explicit.

## Architecture

### Components & Hooks

```
MajorDecisionReminder (component)
  ├─ useMajorDecisionReminder (hook) — State & callback management
  ├─ useWhyAndCreedData (hook) — Fetch user's why/creed
  └─ Integration examples (reference)
```

### Component: `MajorDecisionReminder`

**Location:** `components/dialogs/MajorDecisionReminder.tsx`

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Controls modal visibility |
| `onApprove` | () => void | Yes | Called when user approves the decision |
| `onReflect` | () => void | Yes | Called when user chooses to reflect/pause |
| `whyAndCreedData` | { why, creed } \| null | Yes | User's Why & Creed statements |
| `decisionContext` | { title, description?, amount?, icon? } | No | Context about the specific decision |
| `isLoading` | boolean | No | Show loading state during processing |

**Features:**

- ✅ Beautiful slide-in animation from the right
- ✅ Displays why/creed in inspiring gradient design
- ✅ Shows contextual information about the decision
- ✅ Two clear action paths: Approve or Reflect
- ✅ Soft backdrop click to dismiss
- ✅ Responsive design (mobile to desktop)
- ✅ Full dark mode support
- ✅ Accessibility (ARIA labels, keyboard navigation)

**Design:**

```
┌─────────────────────────────────────┐
│ Pause & Reflect              [✕]   │  ← Header
├─────────────────────────────────────┤
│                                     │
│  Decision Context                   │
│  ┌─────────────────────────────┐    │
│  │ 💳 Confirm Payment          │    │
│  │ "You're investing in growth"│    │
│  │ $497                        │    │
│  └─────────────────────────────┘    │
│                                     │
│  Main Question                      │
│  "Does this align with your why?"   │
│                                     │
│  User's Why & Creed                 │
│  ┌─────────────────────────────┐    │
│  │ 🎯 Your Why                 │    │
│  │ "Transform 100 businesses..." │   │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ⚡ Your Creed              │    │
│  │ "I put clients first..."     │    │
│  └─────────────────────────────┘    │
│                                     │
│  Alignment Checklist                │
│  ✓ This moves me toward my why      │
│  ✓ I can afford this                │
│  ✓ I'm making this from clarity     │
│                                     │
├─────────────────────────────────────┤
│ [⏱ Reflect & Pause] [✓ Yes, I Approve] │  ← Actions
└─────────────────────────────────────┘
```

### Hook: `useMajorDecisionReminder`

**Location:** `hooks/useMajorDecisionReminder.ts`

**Purpose:** Manage modal state, track decisions, handle debouncing, and call decision callbacks.

**Usage:**

```typescript
const reminder = useMajorDecisionReminder({
  debounceMs: 3000,           // Don't show more than once per 3s
  sessionOnly: true,          // Clear on page reload
  onApprove: (metadata) => {}, // Optional callback
  onReflect: (metadata) => {}, // Optional callback
});

// Check if decision should be shown
if (reminder.shouldShow("payment:course-123")) {
  reminder.open("payment:course-123", "payment");
}

// Handle user's choice
const handleApprove = async () => {
  await processPayment();
  reminder.handleApprove(); // Calls onApprove + closes modal
};

const handleReflect = () => {
  reminder.handleReflect(); // Calls onReflect + closes modal
};
```

**API:**

| Method | Type | Description |
|--------|------|-------------|
| `isOpen` | boolean | Is modal currently visible? |
| `isLoading` | boolean | Is processing happening? |
| `open(id, context)` | () => boolean | Open reminder, returns false if debounced |
| `close()` | () => void | Close modal |
| `handleApprove()` | () => Promise<void> | User approved — process action |
| `handleReflect()` | () => void | User wants to reflect — pause |
| `shouldShow(id)` | (id) => boolean | Is this decision eligible to show? |
| `resetShownDecisions()` | () => void | Clear all shown decisions |
| `getShownDecisions()` | () => string[] | Get list of shown decision IDs |
| `getCurrentDecision()` | () => Metadata \| null | Get current decision metadata |

### Hook: `useWhyAndCreedData`

**Location:** `hooks/useWhyAndCreedData.ts`

**Purpose:** Fetch and cache user's Why & Creed data from the backend.

**Usage:**

```typescript
const { data, isLoading, error, refetch, isConfigured } = useWhyAndCreedData(
  workspaceId,
  {
    cache: true,           // Enable in-memory caching
    cacheDurationMs: 300000, // 5 minutes
    skip: false,           // Skip fetching if true
  }
);

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;

// Use data
<MajorDecisionReminder whyAndCreedData={data} />;
```

**API:**

| Property | Type | Description |
|----------|------|-------------|
| `data` | { why, creed } \| null | User's why/creed, or null if not set |
| `isLoading` | boolean | Is fetch in progress? |
| `error` | Error \| null | Fetch error, if any |
| `refetch()` | () => Promise<void> | Manually re-fetch (clears cache) |
| `isConfigured` | boolean | Has user set their why/creed? |

## Integration Patterns

### Pattern 1: Payment/Subscription Decision

**Use case:** Before charging user for premium features, course enrollment, or subscription upgrade.

```typescript
"use client";

import { useState } from "react";
import { MajorDecisionReminder } from "@/components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";
import { useWhyAndCreedData } from "@/hooks/useWhyAndCreedData";

export function PremiumUpgradeButton() {
  const workspaceId = useWorkspaceId(); // Your workspace context
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder({ debounceMs: 3000 });
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpgradeClick = () => {
    if (reminder.shouldShow("payment:premium-upgrade")) {
      reminder.open("payment:premium-upgrade", "payment");
    }
  };

  const handleApprovePayment = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/stripe/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 49700, productId: "premium" }),
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Upgrade successful!");
        reminder.close();
      } else {
        throw new Error("Payment failed");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button onClick={handleUpgradeClick}>Upgrade to Premium</button>

      <MajorDecisionReminder
        isOpen={reminder.isOpen}
        onApprove={handleApprovePayment}
        onReflect={reminder.close}
        whyAndCreedData={whyCreedData}
        isLoading={isProcessing}
        decisionContext={{
          title: "Confirm Premium Upgrade",
          description:
            "Invest in tools that will accelerate your growth and transformation",
          amount: "$497/year",
          icon: <CreditCardIcon className="w-8 h-8" />,
        }}
      />
    </>
  );
}
```

### Pattern 2: Chapter Submission (Level-Up)

**Use case:** Before user submits a chapter for coach approval, marking a major milestone.

```typescript
export function ChapterSubmitButton() {
  const workspaceId = useWorkspaceId();
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder({
    debounceMs: 5000,
    onApprove: (metadata) => {
      analytics.track("chapter_submitted", { chapterId: metadata.id });
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitClick = () => {
    // Generate unique ID for this chapter
    const decisionId = `chapter-submit:2:${Date.now()}`;

    if (reminder.shouldShow(decisionId)) {
      reminder.open(decisionId, "level-up");
    }
  };

  const handleApproveSubmission = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/programme/chapters/2/submit", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        toast.success("Chapter submitted! Your coach will review shortly.");
        reminder.close();
      }
    } catch (error) {
      toast.error("Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button onClick={handleSubmitClick} className="...">
        Submit Chapter 2
      </button>

      <MajorDecisionReminder
        isOpen={reminder.isOpen}
        onApprove={handleApproveSubmission}
        onReflect={reminder.close}
        whyAndCreedData={whyCreedData}
        isLoading={isSubmitting}
        decisionContext={{
          title: "Submit Chapter 2: IMPLEMENT",
          description:
            "You've built your working business system. Ready to level up?",
          icon: <TrendingUpIcon className="w-8 h-8" />,
        }}
      />
    </>
  );
}
```

### Pattern 3: Milestone Achievement

**Use case:** When user reaches a major milestone (revenue goal, lead count, customer count).

```typescript
export function MilestoneNotification({ milestone }) {
  const workspaceId = useWorkspaceId();
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder();
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Automatically show reminder when component mounts
    const decisionId = `milestone:${milestone.id}`;
    reminder.open(decisionId, "milestone");
  }, []);

  const handleRecordMilestone = async () => {
    setIsRecording(true);
    try {
      await fetch("/api/business/milestones", {
        method: "POST",
        body: JSON.stringify(milestone),
        credentials: "include",
      });
      reminder.close();
    } finally {
      setIsRecording(false);
    }
  };

  return (
    <MajorDecisionReminder
      isOpen={reminder.isOpen}
      onApprove={handleRecordMilestone}
      onReflect={reminder.close}
      whyAndCreedData={whyCreedData}
      isLoading={isRecording}
      decisionContext={{
        title: `Milestone: ${milestone.title}`,
        description: "Celebrate your progress!",
        amount: milestone.displayValue,
        icon: <AwardIcon className="w-8 h-8" />,
      }}
    />
  );
}
```

## Best Practices

### Decision ID Generation

Use descriptive, hierarchical decision IDs that include context:

```typescript
// ✓ GOOD
const decisionId = `payment:premium-upgrade:${workspaceId}`;
const decisionId = `chapter-submit:2:${enrollmentId}`;
const decisionId = `milestone:revenue:${timestamp}`;

// ✗ BAD
const decisionId = "decision-1";
const decisionId = "payment";
const decisionId = Math.random().toString();
```

### Debouncing

Set appropriate debounce intervals based on decision frequency:

```typescript
// High-frequency decisions (multiple times per session)
useMajorDecisionReminder({ debounceMs: 2000 }); // 2 seconds

// Medium-frequency (few times per session)
useMajorDecisionReminder({ debounceMs: 3000 }); // 3 seconds

// Low-frequency (one or two times per session)
useMajorDecisionReminder({ debounceMs: 5000 }); // 5 seconds
```

### Context Information

Always provide meaningful context in `decisionContext`:

```typescript
// ✓ GOOD
decisionContext={{
  title: "Confirm Payment",
  description: "You're investing in your business education",
  amount: "$497",
  icon: <CreditCardIcon className="w-8 h-8" />,
}}

// ✗ BAD
decisionContext={{
  title: "Continue?",
}}
```

### Loading States

Always pass `isLoading` prop during async operations:

```typescript
const [isProcessing, setIsProcessing] = useState(false);

const handleApprove = async () => {
  setIsProcessing(true);
  try {
    await processPayment();
  } finally {
    setIsProcessing(false);
  }
};

<MajorDecisionReminder isLoading={isProcessing} />;
```

### Data Loading

Fetch why/creed data at component level to avoid loading states in modal:

```typescript
// ✓ GOOD — Load data before modal renders
const { data: whyCreedData } = useWhyAndCreedData(workspaceId);

return (
  <MajorDecisionReminder whyAndCreedData={whyCreedData} />
);

// ✗ BAD — Loading happens inside modal
export function Modal() {
  const { data: whyCreedData, isLoading } = useWhyAndCreedData(workspaceId);
  if (isLoading) return <div>Loading...</div>;
  return <MajorDecisionReminder whyAndCreedData={whyCreedData} />;
}
```

## Analytics & Metrics

Track reminder interactions to measure alignment and decision quality:

```typescript
const reminder = useMajorDecisionReminder({
  onApprove: (metadata) => {
    analytics.track("decision_approved", {
      decisionType: metadata.context,
      decisionId: metadata.id,
      timestamp: metadata.timestamp,
    });
  },
  onReflect: (metadata) => {
    analytics.track("decision_reflected", {
      decisionType: metadata.context,
      decisionId: metadata.id,
      timestamp: metadata.timestamp,
    });
  },
});
```

**Key metrics to track:**

| Metric | Purpose |
|--------|---------|
| `decision_reminded` | How many times reminder was shown |
| `decision_approved` | How many times user approved |
| `decision_reflected` | How many times user chose to reflect |
| `approval_rate` | (approved / (approved + reflected)) × 100 |
| `avg_reflection_time` | Time from open to decision |

## Accessibility

### Keyboard Navigation

- `Escape` — Close modal
- `Tab` — Navigate between buttons
- `Enter` — Activate focused button

### Screen Readers

- Modal has `role="dialog"` (implicit)
- "Pause & Reflect" header clearly identifies purpose
- Action buttons have descriptive labels
- Status updates announced via ARIA live regions

### Color Contrast

All text meets WCAG AA standards (4.8:1 minimum). Gradient backgrounds are paired with sufficient text contrast.

### Motion

Animations use `prefers-reduced-motion` media query where applicable.

## Customization

### Colors

To customize reminder colors, override these CSS classes:

```css
/* Header gradient */
.reminder-header {
  @apply bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950;
}

/* Approve button */
.reminder-approve {
  @apply bg-gradient-to-r from-emerald-600 to-teal-600;
}

/* Reflect button */
.reminder-reflect {
  @apply bg-slate-100 dark:bg-slate-800;
}
```

### Animations

Slide-in animations are controlled by Tailwind's `translate-x` utility. To customize:

```typescript
// In MajorDecisionReminder.tsx
className={`transform transition-transform duration-500 ease-out ${
  isAnimating ? "translate-x-0" : "translate-x-full"
}`}
```

Change `duration-500` to adjust speed, or `ease-out` to change easing function.

## Troubleshooting

### Reminder not showing

1. **Check `shouldShow()` logic** — Decision ID might already be in shown set
2. **Verify debounce** — Last show time might be within debounce window
3. **Confirm workspace ID** — `useWhyAndCreedData` requires valid workspace ID
4. **Test with new decision ID** — Use unique timestamp in ID

### Why/Creed not displaying

1. **Check if user configured it** — They need to have set Why & Creed first
2. **Verify API response** — Check `/api/command-center/why-creed` in browser console
3. **Clear cache** — Try `useWhyAndCreedData` with `cache: false`
4. **Check workspace isolation** — Ensure workspace ID is correct

### Modal not closing

1. **Ensure `onApprove`/`onReflect` are called** — Check that callbacks actually run
2. **Check `reminder.close()` call** — May be missing or inside catch block
3. **Verify state cleanup** — Modal state should reset after close

## Related Docs

- `docs/WHY_CREED_INTEGRATION.md` — How Why & Creed feature works
- `components/dashboard/WhyAndCreedSection.tsx` — Main Why & Creed editor
- `hooks/useWhyAndCreedData.ts` — Data fetching hook
- `components/examples/MajorDecisionReminderExamples.tsx` — Real-world examples
