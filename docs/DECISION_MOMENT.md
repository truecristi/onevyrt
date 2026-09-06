# Decision Moment: Purpose Check Before Major Actions

## Overview

The **Decision Moment** feature surfaces a user's **Why** and **Creed** at critical junctures in their journey—before payments, milestones, level-ups, or chapter submissions. This keeps users connected to their deeper purpose during moments of hesitation or commitment.

**Core Concept:** Before big decisions, pause and remember *why* you started.

---

## Architecture

### API Endpoint

**POST `/api/dashboard/trigger-decision-moment`**

Accepts an action type and optional context, returns the user's Why & Creed plus formatted modal metadata.

**Request:**
```json
{
  "actionType": "payment|milestone|level-up|chapter-submit",
  "context": {
    "amount": 497,
    "description": "Annual membership renewal",
    "chapterName": "Chapter 3: Control",
    ...
  }
}
```

**Response:**
```json
{
  "ok": true,
  "reminder": {
    "actionType": "payment",
    "why": "To transform my business and achieve financial freedom",
    "creed": "I commit to showing up daily and measuring what matters",
    "modal": {
      "title": "Before You Invest",
      "subtitle": "Take a moment to reconnect with your deeper purpose. This investment is part of your journey.",
      "primaryCta": "Yes, continue",
      "secondaryCta": "Pause & reflect",
      "color": "#2563eb",
      "icon": "credit-card"
    },
    "context": {
      "amount": 497,
      "description": "Annual membership renewal"
    }
  }
}
```

---

## Action Types

| Action | Use Case | Modal Color | Primary CTA |
|--------|----------|-------------|------------|
| `payment` | Before checkout/invoice payment | Blue (#2563eb) | "Yes, continue" |
| `milestone` | Celebrate achievement reached | Green (#16a34a) | "Celebrate & continue" |
| `level-up` | Before unlocking new capability | Amber (#d97706) | "Level up" |
| `chapter-submit` | Before submitting work to coach | Cyan (#0891b2) | "Submit" |

---

## Client-Side Usage

### 1. Using the Hook (Recommended)

```typescript
import { useDecisionMoment } from "@/hooks/useDecisionMoment";
import { DecisionMomentModal } from "@/components/dashboard/DecisionMomentModal";

export function PaymentButton() {
  const { trigger, isLoading, data } = useDecisionMoment();
  const [showModal, setShowModal] = useState(false);

  const handleClick = async () => {
    const reminder = await trigger("payment", { amount: 497 });
    if (reminder) setShowModal(true);
  };

  const handleConfirm = () => {
    setShowModal(false);
    // Proceed with payment
    processPayment();
  };

  return (
    <>
      <button onClick={handleClick} disabled={isLoading}>
        {isLoading ? "Loading..." : "Complete Purchase"}
      </button>

      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={handleConfirm}
        onSecondaryAction={() => setShowModal(false)}
      />
    </>
  );
}
```

### 2. Using the Utility Function Directly

```typescript
import { triggerDecisionMoment } from "@/lib/dashboard/decision-moment";

async function handleCheckout() {
  const result = await triggerDecisionMoment("payment", { 
    amount: 497,
    description: "Pro Plan Annual" 
  });

  if (result.ok && result.reminder) {
    // Display modal with result.reminder
    showDecisionModal(result.reminder);
  }
}
```

### 3. Manual API Call

```typescript
const response = await fetch("/api/dashboard/trigger-decision-moment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({
    actionType: "chapter-submit",
    context: { chapterName: "Chapter 3: Control" }
  })
});

const data = await response.json();
if (data.ok) {
  // Use data.reminder
}
```

---

## Component Integration

### DecisionMomentModal Props

```typescript
interface DecisionMomentModalProps {
  isOpen: boolean;                    // Show/hide modal
  reminder: DecisionMomentReminder;   // Data from API
  onPrimaryAction?: () => void;       // "Yes, continue" clicked
  onSecondaryAction?: () => void;     // "Pause & reflect" clicked
  isPrimaryLoading?: boolean;         // Disable primary CTA
  isSecondaryLoading?: boolean;       // Disable secondary CTA
}
```

### Styling & Theme

The modal:
- ✅ Supports light and dark modes
- ✅ Uses the action's brand color for the header bar
- ✅ Displays Why & Creed in a highlighted section
- ✅ Provides responsive padding and touch-friendly buttons
- ✅ Includes backdrop blur for visual focus

---

## Example: Payment Checkout Flow

```typescript
import { useState } from "react";
import { useDecisionMoment } from "@/hooks/useDecisionMoment";
import { DecisionMomentModal } from "@/components/dashboard/DecisionMomentModal";

export function CheckoutForm() {
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { trigger, isLoading, data } = useDecisionMoment();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Trigger decision moment reminder
    const reminder = await trigger("payment", {
      amount: 497,
      description: "Pro Plan - Annual Billing"
    });

    if (!reminder) {
      // Error occurred, handle it
      return;
    }

    // Modal will show with Why & Creed
  }

  async function handleConfirmPayment() {
    try {
      setIsCheckingOut(true);
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 497 })
      });

      if (response.ok) {
        // Payment succeeded
        window.location.href = "/thank-you";
      }
    } finally {
      setIsCheckingOut(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <button type="submit" disabled={isLoading}>
          Complete Purchase
        </button>
      </form>

      <DecisionMomentModal
        isOpen={data !== null}
        reminder={data}
        onPrimaryAction={handleConfirmPayment}
        onSecondaryAction={() => {}}
        isPrimaryLoading={isCheckingOut}
      />
    </>
  );
}
```

---

## Example: Chapter Submission

```typescript
export function ChapterSubmitButton() {
  const { trigger } = useDecisionMoment();
  const [showModal, setShowModal] = useState(false);

  async function handleSubmit() {
    const reminder = await trigger("chapter-submit", {
      chapterName: "Chapter 3: Control",
      chapterNumber: 3
    });

    if (reminder) {
      setShowModal(true);
    }
  }

  async function confirmSubmit() {
    // Actually submit chapter to coach
    await submitChapter();
    setShowModal(false);
  }

  return (
    <>
      <button onClick={handleSubmit}>Submit for Review</button>

      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={confirmSubmit}
        onSecondaryAction={() => setShowModal(false)}
      />
    </>
  );
}
```

---

## Behavior When Why & Creed Are Missing

If the user hasn't set their Why & Creed yet:
- The modal still appears with the action-specific title and subtitle
- A helpful message prompts them to set up their Why & Creed
- The modal doesn't block the action—they can still proceed
- They can navigate to Dashboard → "Set Your Why & Creed" to add them later

---

## Context Object

The `context` parameter is flexible and action-dependent:

**For `payment` actions:**
```json
{
  "amount": 497,
  "description": "Pro Plan Annual",
  "currency": "USD",
  "billingCycle": "annual"
}
```

**For `milestone` actions:**
```json
{
  "description": "Completed Chapter 2",
  "milestoneType": "chapter",
  "progressPercent": 50
}
```

**For `level-up` actions:**
```json
{
  "lessonTitle": "Advanced Analytics",
  "requiredScore": 80
}
```

**For `chapter-submit` actions:**
```json
{
  "chapterName": "Chapter 3: Control",
  "chapterNumber": 3,
  "lessonCount": 5
}
```

---

## Security & Access Control

- ✅ **Authentication Required:** All requests must be authenticated via session cookie
- ✅ **Workspace Scoped:** Always fetches from the user's primary workspace
- ✅ **No Data Leakage:** Why & Creed is never logged or exposed to anyone else
- ✅ **Soft-Delete Safe:** Respects soft-deleted workspace records

---

## Testing

### Manual Test: Payment Flow

1. Navigate to checkout page
2. Click "Complete Purchase"
3. Decision moment modal appears with your Why & Creed
4. Click "Yes, continue" to proceed
5. Verify payment goes through

### Manual Test: No Why & Creed

1. Create a new user account (no why/creed set)
2. Trigger a decision moment
3. Verify modal appears with helpful prompt
4. Proceed button should still work

### API Test

```bash
curl -X POST http://localhost:3000/api/dashboard/trigger-decision-moment \
  -H "Content-Type: application/json" \
  -b "auth-cookie=..." \
  -d '{
    "actionType": "payment",
    "context": { "amount": 497 }
  }'
```

---

## Performance Notes

- **Single DB Query:** Fetches Why & Creed in one query (via existing `getWhyAndCreed`)
- **Modal Animation:** Uses CSS transitions (no JS animation libraries)
- **No Network Blocker:** Fetching reminder data doesn't block user interaction (async)
- **Cached on Client:** Consider caching reminder data for repeated actions in same session

---

## Future Enhancements

- [ ] Customizable modal themes per action type
- [ ] Analytics: Track decision-moment engagement & conversion rates
- [ ] A/B Testing: Compare modal copy variants
- [ ] Delay Option: Surface reminder after a delay (e.g., "remind me in 5 minutes")
- [ ] Scheduled Decision Moments: Auto-trigger at key milestones (e.g., 50% completion)
- [ ] Multi-language Support: Translate modal copy per user locale

---

## Files Reference

| File | Purpose |
|------|---------|
| `/api/dashboard/trigger-decision-moment/route.ts` | API endpoint handler |
| `lib/dashboard/decision-moment.ts` | Types & utilities |
| `hooks/useDecisionMoment.ts` | React hook |
| `components/dashboard/DecisionMomentModal.tsx` | UI component |
| `docs/DECISION_MOMENT.md` | This guide |

---

## Support & Debugging

**Modal not appearing?**
- Check browser console for network errors
- Verify user is authenticated
- Confirm workspace has Why & Creed data set (not required, but helpful)

**Wrong modal config?**
- Double-check `actionType` spelling (must be one of: `payment|milestone|level-up|chapter-submit`)
- Verify action type is supported in `MODAL_CONFIGS`

**API returning 401?**
- Ensure session cookie is included in request
- Check if session has expired or been revoked

**Why & Creed not showing?**
- Verify user has navigated to Dashboard and set their Why & Creed
- Check `/api/command-center/why-creed` directly to see stored data
