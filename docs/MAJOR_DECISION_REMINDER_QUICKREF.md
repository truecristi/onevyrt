# MajorDecisionReminder: Quick Reference Card

## 60-Second Overview

`MajorDecisionReminder` is a modal that pauses users before major decisions (payment, level-up, milestone) to remind them of their Why & Creed. It asks: "Does this align with your why?"

User approves → Action proceeds
User reflects → Action cancelled, user stays on page

## 5-Minute Integration Template

```typescript
import { MajorDecisionReminder } from "@/components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";
import { useWhyAndCreedData } from "@/hooks/useWhyAndCreedData";

export function MyFeature() {
  const workspaceId = useWorkspaceId();
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder({ debounceMs: 3000 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Step 1: Click → Show reminder
  const handleActionClick = () => {
    if (reminder.shouldShow("action-id")) {
      reminder.open("action-id", "payment"); // or "level-up", "milestone"
    }
  };

  // Step 2: Approve → Process action
  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      await yourActionHere();
      reminder.close();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button onClick={handleActionClick}>Take Action</button>

      <MajorDecisionReminder
        isOpen={reminder.isOpen}
        onApprove={handleApprove}
        onReflect={reminder.close}
        whyAndCreedData={whyCreedData}
        isLoading={isProcessing}
        decisionContext={{
          title: "Confirm Action",
          description: "You're making an important decision",
          amount: "$497", // or any amount/time/info
          icon: <IconComponent className="w-8 h-8" />,
        }}
      />
    </>
  );
}
```

## Component Props

```typescript
<MajorDecisionReminder
  isOpen={boolean}                    // Required: Modal visibility
  onApprove={() => void}              // Required: User clicked approve
  onReflect={() => void}              // Required: User clicked reflect
  whyAndCreedData={{                  // Required: User's why/creed
    why: string,
    creed: string,
  } | null}
  decisionContext={{                  // Optional: Decision info
    title: string,                    // e.g., "Confirm Payment"
    description?: string,             // e.g., "Invest in growth"
    amount?: string,                  // e.g., "$497"
    icon?: React.ReactNode,           // e.g., <CreditCardIcon />
  }}
  isLoading={boolean}                 // Optional: Show loading state
/>
```

## useMajorDecisionReminder Hook API

```typescript
const reminder = useMajorDecisionReminder({
  debounceMs?: number,        // Default: 0 (ms between shows)
  sessionOnly?: boolean,      // Default: true (clear on reload)
  onApprove?: (meta) => void, // Optional: Approval callback
  onReflect?: (meta) => void, // Optional: Reflection callback
});

// Properties
reminder.isOpen                    // boolean: Is modal visible?
reminder.isLoading                 // boolean: Is processing?

// Methods
reminder.open(id, context)         // boolean: Open modal (false if debounced)
reminder.close()                   // void: Close modal
reminder.shouldShow(id)            // boolean: Is this decision eligible?
reminder.handleApprove()           // Promise<void>: Process approval
reminder.handleReflect()           // void: Process reflection
reminder.resetShownDecisions()     // void: Clear shown set
reminder.getShownDecisions()       // string[]: IDs already shown
reminder.getCurrentDecision()      // Metadata | null
```

## useWhyAndCreedData Hook API

```typescript
const { data, isLoading, error, refetch, isConfigured } =
  useWhyAndCreedData(workspaceId, {
    cache?: boolean,         // Default: true
    cacheDurationMs?: number, // Default: 300000 (5 min)
    skip?: boolean,          // Default: false
  });

// Properties
data                         // { why, creed } | null
isLoading                    // boolean
error                        // Error | null
isConfigured                 // boolean: Has user set why/creed?

// Methods
refetch()                    // Promise<void>: Re-fetch and clear cache
```

## Decision ID Format

```
{action}:{feature}[:{context}]

✓ GOOD
payment:premium-upgrade
chapter-submit:2
milestone:revenue:10000
cohort-book:session-123
funnel-launch:project-abc

✗ BAD
decision-1
payment
Math.random()
```

## Debounce Guidelines

```typescript
// High-frequency (multiple per session) — 2-3 seconds
useMajorDecisionReminder({ debounceMs: 2000 })

// Medium-frequency (few per session) — 3-5 seconds ← RECOMMENDED
useMajorDecisionReminder({ debounceMs: 3000 })

// Low-frequency (once per session) — 5+ seconds
useMajorDecisionReminder({ debounceMs: 5000 })
```

## Analytics Template

```typescript
const reminder = useMajorDecisionReminder({
  onApprove: (metadata) => {
    analytics.track("decision_approved", {
      context: metadata.context,
      decisionId: metadata.id,
      timestamp: metadata.timestamp,
    });
  },
  onReflect: (metadata) => {
    analytics.track("decision_reflected", {
      context: metadata.context,
      decisionId: metadata.id,
      timestamp: metadata.timestamp,
    });
  },
});
```

## Icons (Lucide React)

```typescript
import { 
  CreditCardIcon,    // Payments
  TrendingUpIcon,    // Level-ups
  AwardIcon,         // Milestones
  CalendarIcon,      // Bookings
  RocketIcon,        // Launches
  CheckCircleIcon,   // Confirmations
} from "lucide-react";

decisionContext={{
  icon: <CreditCardIcon className="w-8 h-8 text-blue-600" />
}}
```

## Common Decision Contexts

### Payment/Checkout
```typescript
decisionContext={{
  title: "Confirm Payment",
  description: "Invest in tools that accelerate your growth",
  amount: "$497",
  icon: <CreditCardIcon className="w-8 h-8 text-blue-600" />,
}}
```

### Chapter Submission
```typescript
decisionContext={{
  title: "Submit Chapter 2: IMPLEMENT",
  description: "You've completed your work. Ready for review?",
  icon: <TrendingUpIcon className="w-8 h-8 text-green-600" />,
}}
```

### Milestone
```typescript
decisionContext={{
  title: "Milestone: $10k Revenue",
  description: "Celebrate your progress!",
  amount: "$10,000",
  icon: <AwardIcon className="w-8 h-8 text-amber-600" />,
}}
```

### Cohort Booking
```typescript
decisionContext={{
  title: "Book Coaching Session",
  description: "Secure your spot in the next session",
  amount: "Sep 15 at 2pm UTC",
  icon: <CalendarIcon className="w-8 h-8 text-blue-600" />,
}}
```

### Funnel Launch
```typescript
decisionContext={{
  title: "Launch Funnel",
  description: "You're about to bring your offer to the world",
  icon: <RocketIcon className="w-8 h-8 text-purple-600" />,
}}
```

## Troubleshooting

| Problem | Check |
|---------|-------|
| Reminder not showing | `shouldShow()` result? Decision ID reused? |
| Shows duplicate times | Increase `debounceMs` to 3000+ |
| Why/Creed blank | User configured? API response? |
| Data loads slow | Cache enabled? `cache: false` for testing |
| Modal won't close | Both handlers call `close()`? |

## Testing Checklist

- [ ] Click action → modal appears
- [ ] User clicks approve → action processes, modal closes
- [ ] User clicks reflect → action cancels, modal closes
- [ ] Rapid clicks → only one modal shown (debounce works)
- [ ] No why/creed → modal still shows helpful message
- [ ] Dark mode → styling looks good
- [ ] Mobile → responsive and usable
- [ ] Keyboard → Tab, Escape, Enter work

## Performance Tips

1. **Cache why/creed data**
   ```typescript
   const { data } = useWhyAndCreedData(id, { cache: true });
   ```

2. **Check before opening**
   ```typescript
   if (reminder.shouldShow(id)) { reminder.open(id); }
   ```

3. **Lazy load if on heavy page**
   ```typescript
   const Reminder = dynamic(() => import("...MajorDecisionReminder"));
   ```

4. **Set proper debounce**
   ```typescript
   useMajorDecisionReminder({ debounceMs: 3000 });
   ```

## Files & Docs

| File | Purpose |
|------|---------|
| `components/dialogs/MajorDecisionReminder.tsx` | Main component |
| `hooks/useMajorDecisionReminder.ts` | State management |
| `hooks/useWhyAndCreedData.ts` | Data fetching |
| `docs/MAJOR_DECISION_REMINDER_README.md` | Start here (overview) |
| `docs/MAJOR_DECISION_REMINDER.md` | Complete reference |
| `docs/MAJOR_DECISION_INTEGRATION_GUIDE.md` | Step-by-step patterns |
| `components/examples/MajorDecisionReminderExamples.tsx` | Working code |

## Examples

### Payment Flow
[See `components/examples/MajorDecisionReminderExamples.tsx` → `PaymentDecisionExample`]

### Chapter Submit
[See `components/examples/MajorDecisionReminderExamples.tsx` → `LevelUpDecisionExample`]

### Milestone
[See `components/examples/MajorDecisionReminderExamples.tsx` → `MilestoneDecisionExample`]

### Checkout
[See `components/examples/MajorDecisionReminderExamples.tsx` → `CheckoutFlowExample`]

## Key Metrics

```typescript
// Track these after integration
analytics.track("decision_approved", { decisionType, userId, timestamp });
analytics.track("decision_reflected", { decisionType, userId, timestamp });

// Calculate:
approval_rate = (approved / (approved + reflected)) × 100
avg_reflect_time = (reflect_timestamp - open_timestamp) / 1000
```

## Dark Mode Support

Component automatically adapts to light/dark theme:
- Header: Blue/purple gradient
- Buttons: Green/gray with hover states
- Text: High contrast (WCAG AA)
- Animations: Same in both themes

## Accessibility

- ✅ Keyboard navigation (Tab, Escape, Enter)
- ✅ Screen reader labels
- ✅ Color contrast WCAG AA
- ✅ Focus management
- ✅ Reduced motion support

## Browser Support

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ iOS Safari 13+
✅ Android Chrome 90+

## Summary

```
3 Imports:
  MajorDecisionReminder
  useMajorDecisionReminder
  useWhyAndCreedData

3 Steps:
  1. Split action: click → show reminder
  2. Add callbacks: approve → process, reflect → cancel
  3. Render: <MajorDecisionReminder />

Test:
  ✓ Approval flow works
  ✓ Reflection flow works
  ✓ Debounce works
  ✓ Mobile responsive
  ✓ Dark mode works

Ship: Add analytics, deploy, monitor metrics
```

---

**Next step:** Read `docs/MAJOR_DECISION_REMINDER_README.md` for full overview
