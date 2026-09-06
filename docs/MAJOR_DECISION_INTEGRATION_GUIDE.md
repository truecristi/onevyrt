# Integration Guide: MajorDecisionReminder

This guide shows how to integrate `MajorDecisionReminder` into existing ONEVYRT features. Copy these patterns into your code.

## Quick Start (5 minutes)

### Step 1: Import Components & Hooks

```typescript
import { MajorDecisionReminder } from "@/components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";
import { useWhyAndCreedData } from "@/hooks/useWhyAndCreedData";
```

### Step 2: Add State Management

```typescript
const workspaceId = useWorkspaceId(); // Your workspace context
const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
const reminder = useMajorDecisionReminder({ debounceMs: 3000 });
const [isProcessing, setIsProcessing] = useState(false);
```

### Step 3: Add to Existing Action Handler

```typescript
// BEFORE
const handlePayment = async () => {
  await processPayment();
};

// AFTER
const handlePaymentClick = () => {
  if (reminder.shouldShow("payment:course-123")) {
    reminder.open("payment:course-123", "payment");
    // Modal opens; user sees their why/creed
    // User clicks approve or reflect
  }
};

const handleApprovePayment = async () => {
  setIsProcessing(true);
  try {
    await processPayment(); // Your existing payment logic
    reminder.close();
  } finally {
    setIsProcessing(false);
  }
};
```

### Step 4: Add Component to JSX

```typescript
<MajorDecisionReminder
  isOpen={reminder.isOpen}
  onApprove={handleApprovePayment}
  onReflect={reminder.close}
  whyAndCreedData={whyCreedData}
  isLoading={isProcessing}
  decisionContext={{
    title: "Confirm Payment",
    amount: "$497",
    description: "Invest in your growth",
  }}
/>
```

## Detailed Integration Examples

### Integration 1: Stripe Checkout Flow

**Location:** `app/checkout/page.tsx` or wherever checkout happens

**Current Code:**
```typescript
async function handleCheckout() {
  const stripe = useStripe();
  const result = await stripe.redirectToCheckout({
    lineItems: [{ priceId: "price_123", quantity: 1 }],
  });
}
```

**Updated Code:**
```typescript
"use client";

import { MajorDecisionReminder } from "@/components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";
import { useWhyAndCreedData } from "@/hooks/useWhyAndCreedData";

export function CheckoutPage() {
  const stripe = useStripe();
  const workspaceId = useWorkspaceId();
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder({
    debounceMs: 2000,
    onApprove: (meta) => {
      analytics.track("checkout_approved", { decisionId: meta.id });
    },
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [productInfo] = useState({
    title: "Mastermind Course",
    amount: "$297",
    description: "Join our 12-week business accelerator",
  });

  // STEP 1: Click checkout button → show reminder
  const handleCheckoutClick = () => {
    const decisionId = `checkout:${productInfo.title}:${Date.now()}`;
    if (reminder.shouldShow(decisionId)) {
      reminder.open(decisionId, "payment");
    }
  };

  // STEP 2: User approves → process payment
  const handleApproveCheckout = async () => {
    setIsProcessing(true);
    try {
      const result = await stripe.redirectToCheckout({
        lineItems: [{ priceId: "price_123", quantity: 1 }],
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      reminder.close();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // STEP 3: User reflects → pause checkout
  const handleReflectCheckout = () => {
    analytics.track("checkout_reflected");
    reminder.close();
    // User stays on page; can read more or come back later
  };

  return (
    <>
      <div className="checkout-form">
        {/* Existing form elements */}
        <button
          onClick={handleCheckoutClick}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg"
        >
          Complete Purchase
        </button>
      </div>

      {/* NEW: Add reminder modal */}
      <MajorDecisionReminder
        isOpen={reminder.isOpen}
        onApprove={handleApproveCheckout}
        onReflect={handleReflectCheckout}
        whyAndCreedData={whyCreedData}
        isLoading={isProcessing}
        decisionContext={{
          title: productInfo.title,
          description: productInfo.description,
          amount: productInfo.amount,
          icon: <CreditCardIcon className="w-8 h-8 text-blue-600" />,
        }}
      />
    </>
  );
}
```

### Integration 2: Programme Chapter Submission

**Location:** `app/programme/chapter-[num]/page.tsx`

**Current Code:**
```typescript
async function submitChapter() {
  await fetch(`/api/programme/chapters/${chapterId}/submit`, {
    method: "POST",
    credentials: "include",
  });
}
```

**Updated Code:**
```typescript
"use client";

import { TrendingUpIcon } from "lucide-react";
import { MajorDecisionReminder } from "@/components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";
import { useWhyAndCreedData } from "@/hooks/useWhyAndCreedData";

export function ChapterPage({ chapterId }) {
  const workspaceId = useWorkspaceId();
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder({
    debounceMs: 5000,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const chapterName = CHAPTERS[chapterId]; // e.g., "IMPLEMENT"

  // STEP 1: Click submit → show reminder
  const handleSubmitClick = () => {
    const decisionId = `chapter-submit:${chapterId}:${workspaceId}`;
    if (reminder.shouldShow(decisionId)) {
      reminder.open(decisionId, "level-up");
    }
  };

  // STEP 2: User approves → submit chapter
  const handleApproveSubmission = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/programme/chapters/${chapterId}/submit`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        toast.success("Chapter submitted! Your coach will review shortly.");
        reminder.close();
        // Optionally redirect to next chapter
      } else {
        throw new Error("Submission failed");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 3: User reflects → pause submission
  const handleReflectSubmission = () => {
    toast.info(
      "Take time to review your work. You can submit whenever you're ready."
    );
    reminder.close();
  };

  return (
    <>
      <div className="chapter-content">
        {/* Existing chapter content */}

        <div className="mt-8 flex gap-3">
          <button
            onClick={handleSubmitClick}
            className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium"
          >
            Submit Chapter
          </button>
          <button className="px-6 py-3 bg-slate-200 text-slate-900 rounded-lg font-medium">
            Save Draft
          </button>
        </div>
      </div>

      {/* NEW: Add reminder modal */}
      <MajorDecisionReminder
        isOpen={reminder.isOpen}
        onApprove={handleApproveSubmission}
        onReflect={handleReflectSubmission}
        whyAndCreedData={whyCreedData}
        isLoading={isSubmitting}
        decisionContext={{
          title: `Submit Chapter ${chapterId}: ${chapterName}`,
          description: `You've completed your ${chapterName.toLowerCase()} work. Ready for your coach to review?`,
          icon: <TrendingUpIcon className="w-8 h-8 text-green-600" />,
        }}
      />
    </>
  );
}
```

### Integration 3: Cohort Booking / Session Attendance

**Location:** `components/cohort/SessionBooking.tsx`

**Current Code:**
```typescript
async function bookSession() {
  await fetch(`/api/cohorts/sessions/${sessionId}/book`, {
    method: "POST",
    credentials: "include",
  });
}
```

**Updated Code:**
```typescript
"use client";

import { CalendarIcon } from "lucide-react";
import { MajorDecisionReminder } from "@/components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";
import { useWhyAndCreedData } from "@/hooks/useWhyAndCreedData";

export function SessionBooking({ sessionId, sessionTitle, date, time }) {
  const workspaceId = useWorkspaceId();
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder({
    debounceMs: 3000,
  });
  const [isBooking, setIsBooking] = useState(false);

  // STEP 1: Click book → show reminder
  const handleBookClick = () => {
    const decisionId = `cohort-book:${sessionId}:${workspaceId}`;
    if (reminder.shouldShow(decisionId)) {
      reminder.open(decisionId, "commitment");
    }
  };

  // STEP 2: User approves → book session
  const handleApproveBooking = async () => {
    setIsBooking(true);
    try {
      const response = await fetch(
        `/api/cohorts/sessions/${sessionId}/book`,
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ confirmed: true }),
        }
      );

      if (response.ok) {
        toast.success(
          `You're booked! See you ${date} at ${time}. Add to calendar.`
        );
        reminder.close();
      } else {
        throw new Error("Booking failed");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <>
      <button
        onClick={handleBookClick}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg"
      >
        Book Session
      </button>

      <MajorDecisionReminder
        isOpen={reminder.isOpen}
        onApprove={handleApproveBooking}
        onReflect={reminder.close}
        whyAndCreedData={whyCreedData}
        isLoading={isBooking}
        decisionContext={{
          title: sessionTitle,
          description: `You're committing to join us live. This is a valuable investment in your growth.`,
          amount: `${date} at ${time}`,
          icon: <CalendarIcon className="w-8 h-8 text-blue-600" />,
        }}
      />
    </>
  );
}
```

### Integration 4: Funnel Launch / Campaign Publishing

**Location:** `components/studio/LaunchButton.tsx`

**Current Code:**
```typescript
async function launchFunnel() {
  await fetch(`/api/projects/${projectId}/publish`, {
    method: "POST",
    credentials: "include",
  });
}
```

**Updated Code:**
```typescript
"use client";

import { RocketIcon } from "lucide-react";
import { MajorDecisionReminder } from "@/components/dialogs/MajorDecisionReminder";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";
import { useWhyAndCreedData } from "@/hooks/useWhyAndCreedData";

export function LaunchButton({ projectId, projectName }) {
  const workspaceId = useWorkspaceId();
  const { data: whyCreedData } = useWhyAndCreedData(workspaceId);
  const reminder = useMajorDecisionReminder({
    debounceMs: 5000,
    onApprove: () => analytics.track("funnel_launch_approved"),
    onReflect: () => analytics.track("funnel_launch_reflected"),
  });
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunchClick = () => {
    const decisionId = `funnel-launch:${projectId}`;
    if (reminder.shouldShow(decisionId)) {
      reminder.open(decisionId, "milestone");
    }
  };

  const handleApproveLaunch = async () => {
    setIsLaunching(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        toast.success(`${projectName} is now live!`);
        reminder.close();
      } else {
        throw new Error("Launch failed");
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <>
      <button
        onClick={handleLaunchClick}
        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold flex items-center gap-2"
      >
        <RocketIcon className="w-5 h-5" />
        Launch Funnel
      </button>

      <MajorDecisionReminder
        isOpen={reminder.isOpen}
        onApprove={handleApproveLaunch}
        onReflect={reminder.close}
        whyAndCreedData={whyCreedData}
        isLoading={isLaunching}
        decisionContext={{
          title: `Launch: ${projectName}`,
          description:
            "You're about to bring your offer to the world. Are you ready?",
          icon: <RocketIcon className="w-8 h-8 text-purple-600" />,
        }}
      />
    </>
  );
}
```

## Step-by-Step Integration Checklist

For each new integration:

- [ ] **Identify the decision point** — Where does user take a major action?
- [ ] **Import components & hooks** — Add three imports (MajorDecisionReminder, useMajorDecisionReminder, useWhyAndCreedData)
- [ ] **Add state** — Initialize reminder hook and whyCreedData fetch
- [ ] **Split handler** — Separate click handler from action handler
  - Click handler: `handleXxxClick()` — calls `reminder.open()`
  - Approve handler: `handleApproveXxx()` — calls `reminder.close()` after action succeeds
  - Reflect handler: calls `reminder.close()` without action
- [ ] **Add modal JSX** — Insert `<MajorDecisionReminder />` component
- [ ] **Set context** — Provide meaningful `decisionContext` with title, description, amount/icon
- [ ] **Test approval flow** — Click action → modal appears → approve → action completes
- [ ] **Test reflection flow** — Click action → modal appears → reflect → modal closes, action NOT taken
- [ ] **Add analytics** — Track approval/reflection rates in `onApprove`/`onReflect`
- [ ] **Verify debounce** — Try clicking action twice rapidly; modal should only show once
- [ ] **Test with no why/creed** — User hasn't set their why yet; modal still shows with helpful message

## Analytics Integration

Add decision tracking to your analytics:

```typescript
const reminder = useMajorDecisionReminder({
  onApprove: (metadata) => {
    analytics.track("decision_approved", {
      decisionType: metadata.context,
      decisionId: metadata.id,
      timestamp: metadata.timestamp,
      feature: "checkout", // or "chapter-submit", "cohort-book", etc.
    });
  },
  onReflect: (metadata) => {
    analytics.track("decision_reflected", {
      decisionType: metadata.context,
      decisionId: metadata.id,
      timestamp: metadata.timestamp,
      feature: "checkout",
    });
  },
});
```

## Performance Tips

### 1. Cache Why/Creed Data

Don't fetch why/creed on every render. Cache it:

```typescript
// ✓ GOOD: Fetch once at page level
const { data: whyCreedData } = useWhyAndCreedData(workspaceId);

// ✓ ALSO GOOD: Use caching options
const { data: whyCreedData } = useWhyAndCreedData(workspaceId, {
  cache: true,
  cacheDurationMs: 10 * 60 * 1000, // 10 minutes
});
```

### 2. Lazy Load Modal Component

For pages with many buttons, lazy load the modal:

```typescript
const MajorDecisionReminder = dynamic(() =>
  import("@/components/dialogs/MajorDecisionReminder").then(
    (mod) => mod.MajorDecisionReminder
  )
);
```

### 3. Prevent Duplicate Shows

Always check `shouldShow()` before opening:

```typescript
// ✓ GOOD: Check before opening
if (reminder.shouldShow(decisionId)) {
  reminder.open(decisionId);
}

// ✗ BAD: Always opens
reminder.open(decisionId);
```

## Testing

### Unit Tests

```typescript
import { renderHook, act } from "@testing-library/react";
import { useMajorDecisionReminder } from "@/hooks/useMajorDecisionReminder";

describe("useMajorDecisionReminder", () => {
  it("should not show reminder twice for same decision", () => {
    const { result } = renderHook(() => useMajorDecisionReminder());

    act(() => {
      expect(result.current.open("test-id")).toBe(true);
      expect(result.current.shouldShow("test-id")).toBe(false); // Already shown
    });
  });

  it("should respect debounce", async () => {
    const { result } = renderHook(() =>
      useMajorDecisionReminder({ debounceMs: 1000 })
    );

    act(() => {
      result.current.open("test-1");
    });

    // Should be debounced
    act(() => {
      expect(result.current.shouldShow("test-2")).toBe(false);
    });
  });
});
```

### E2E Tests

```typescript
// Cypress example
describe("Payment flow with MajorDecisionReminder", () => {
  it("should show reminder and process payment on approve", () => {
    cy.visit("/checkout");
    cy.contains("Complete Purchase").click();

    // Modal should appear
    cy.contains("Does this align with your why?").should("be.visible");

    // Click approve
    cy.contains("Yes, I Approve").click();

    // Payment should be processed
    cy.url().should("include", "/success");
  });

  it("should pause on reflect", () => {
    cy.visit("/checkout");
    cy.contains("Complete Purchase").click();

    cy.contains("Reflect & Pause").click();

    // Should still be on checkout page
    cy.url().should("include", "/checkout");
  });
});
```

## Migration Guide

If you have existing decision flows without the reminder, follow this pattern:

### Before

```typescript
async function handleCheckout() {
  await processPayment();
}

<button onClick={handleCheckout}>Pay Now</button>
```

### After

```typescript
const reminder = useMajorDecisionReminder();
const { data: whyCreedData } = useWhyAndCreedData(workspaceId);

const handleCheckoutClick = () => {
  if (reminder.shouldShow("checkout:now")) {
    reminder.open("checkout:now", "payment");
  }
};

const handleApproveCheckout = async () => {
  await processPayment();
  reminder.close();
};

<>
  <button onClick={handleCheckoutClick}>Pay Now</button>
  <MajorDecisionReminder
    isOpen={reminder.isOpen}
    onApprove={handleApproveCheckout}
    onReflect={reminder.close}
    whyAndCreedData={whyCreedData}
    decisionContext={{ title: "Confirm Payment", amount: "$497" }}
  />
</>
```

## FAQ

**Q: Should I show reminder for all decisions?**
A: No, only major decisions: payments, level-ups, milestones, significant commitments. Skip routine actions like editing, saving drafts, or marking items as done.

**Q: Can I customize the modal design?**
A: Yes! Override the CSS classes in `MajorDecisionReminder.tsx` or fork the component. The design is intentionally minimal for flexibility.

**Q: What if user hasn't set their why/creed?**
A: The modal still shows with a helpful message encouraging them to set it. They can still proceed with the action.

**Q: How do I reset the reminder state?**
A: Call `reminder.resetShownDecisions()` to clear all shown decisions (useful for testing).

**Q: Can I track which specific why/creed text the user saw?**
A: Yes! Add `whyCreedData` to your analytics event in `onApprove`:

```typescript
onApprove: (metadata) => {
  analytics.track("decision_approved", {
    ...metadata,
    whyLength: whyCreedData?.why.length,
    creedLength: whyCreedData?.creed.length,
  });
}
```

## Support

- **Component API:** `components/dialogs/MajorDecisionReminder.tsx`
- **Hook API:** `hooks/useMajorDecisionReminder.ts`, `hooks/useWhyAndCreedData.ts`
- **Full Docs:** `docs/MAJOR_DECISION_REMINDER.md`
- **Examples:** `components/examples/MajorDecisionReminderExamples.tsx`
