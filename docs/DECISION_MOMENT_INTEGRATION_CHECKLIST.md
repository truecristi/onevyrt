# Decision Moment Integration Checklist

Use this checklist to add decision moments to flows throughout ONEVYRT.

---

## Pre-Integration Setup

- [ ] Read `docs/DECISION_MOMENT.md` (overview & architecture)
- [ ] Review `docs/DECISION_MOMENT_EXAMPLES.md` (example implementations)
- [ ] Choose your action type: `payment` | `milestone` | `level-up` | `chapter-submit`
- [ ] Define your context object (what metadata needs to surface?)
- [ ] Test the endpoint manually with curl

---

## Step 1: Add the Hook to Your Component

```typescript
// At top of component file
import { useDecisionMoment } from "@/hooks/useDecisionMoment";
import { DecisionMomentModal } from "@/components/dashboard/DecisionMomentModal";
```

- [ ] Import hook
- [ ] Import modal component
- [ ] Add state: `const [showModal, setShowModal] = useState(false);`
- [ ] Add hook: `const { trigger, isLoading, data } = useDecisionMoment();`

---

## Step 2: Create Trigger Function

```typescript
async function handleActionClick() {
  const reminder = await trigger("YOUR_ACTION_TYPE", {
    // Your context object
  });

  if (reminder) {
    setShowModal(true);
  }
}
```

- [ ] Create async function that calls `trigger()`
- [ ] Pass correct action type from table below
- [ ] Pass relevant context fields
- [ ] Set `showModal = true` on success
- [ ] Handle null reminder (show error toast or retry)

**Action Type Reference:**
| Action | Use For |
|--------|---------|
| `payment` | Before checkout, invoice payment, subscription |
| `milestone` | Achievement reached, goal completed |
| `level-up` | New feature unlocked, lesson started |
| `chapter-submit` | Chapter submitted to coach |

---

## Step 3: Connect Trigger to Button/Action

```typescript
// In your render/JSX
<button onClick={handleActionClick} disabled={isLoading}>
  Continue to Checkout
</button>
```

- [ ] Replace old button/action with new trigger function
- [ ] Disable button while `isLoading`
- [ ] Show loading spinner/text if desired

---

## Step 4: Add Modal Component to JSX

```typescript
<DecisionMomentModal
  isOpen={showModal}
  reminder={data}
  onPrimaryAction={handleProceed}
  onSecondaryAction={() => setShowModal(false)}
  isPrimaryLoading={isProcessing}
/>
```

- [ ] Add modal to JSX
- [ ] Pass `isOpen={showModal}`
- [ ] Pass `reminder={data}`
- [ ] Implement `onPrimaryAction` (confirm the action)
- [ ] Implement `onSecondaryAction` (cancel/close)
- [ ] Add loading states if needed

---

## Step 5: Implement Primary Action Handler

```typescript
async function handleProceed() {
  try {
    // Your actual action logic (e.g., process payment)
    await myAction();
    setShowModal(false);
  } catch (error) {
    // Handle error
  }
}
```

- [ ] Create function that performs the actual action
- [ ] Keep modal open if action fails
- [ ] Close modal on success
- [ ] Show success message if desired

---

## Step 6: Test

**Manual Testing:**
- [ ] Click the button that triggers decision moment
- [ ] Verify modal appears with correct title/colors
- [ ] Verify your why/creed displays (if set)
- [ ] Click primary CTA → action proceeds
- [ ] Try again: click secondary CTA → modal closes, action cancelled
- [ ] Test on mobile (responsive design)
- [ ] Test dark mode
- [ ] Verify no console errors

**Edge Cases:**
- [ ] Test as user with no why/creed set (should still work)
- [ ] Test with empty/minimal context
- [ ] Test rapid successive clicks (should not double-fire)
- [ ] Test on slow network (loading states)

---

## Context Field Examples

**For `payment` actions:**
```typescript
{
  amount: number,           // Price in cents
  description: string,      // "Pro Plan Annual"
  billingCycle: "annual",   // or "monthly"
  couponCode?: string,      // Optional discount code
}
```

**For `milestone` actions:**
```typescript
{
  description: string,      // "Completed Chapter 2"
  milestoneType: string,    // "chapter" | "lead-count" | "revenue"
  progressPercent: number,  // 0-100
}
```

**For `level-up` actions:**
```typescript
{
  lessonTitle: string,      // "Advanced Analytics"
  difficulty: string,       // "beginner" | "intermediate" | "advanced"
  requiredScore?: number,   // If any prerequisite
}
```

**For `chapter-submit` actions:**
```typescript
{
  chapterName: string,      // "Chapter 3: Control"
  chapterNumber: number,    // 3
  lessonCount?: number,     // How many lessons/subchapters
}
```

---

## Common Patterns

### Pattern 1: Simple Payment Flow

```typescript
export function CheckoutButton({ amount }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { trigger, isLoading, data } = useDecisionMoment();

  async function handleCheckout() {
    const reminder = await trigger("payment", { 
      amount,
      description: "Pro Plan Annual" 
    });
    if (reminder) setShowModal(true);
  }

  async function confirmPayment() {
    setIsProcessing(true);
    try {
      await processPayment(amount);
      setShowModal(false);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <button onClick={handleCheckout} disabled={isLoading}>
        Buy Now - ${amount}
      </button>
      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={confirmPayment}
        onSecondaryAction={() => setShowModal(false)}
        isPrimaryLoading={isProcessing}
      />
    </>
  );
}
```

### Pattern 2: Auto-Trigger on Milestone

```typescript
export function MilestoneNotifier({ milestoneId }: Props) {
  const [showModal, setShowModal] = useState(false);
  const { trigger, data } = useDecisionMoment();

  // Auto-trigger when milestone completes
  useEffect(() => {
    const triggerMilestone = async () => {
      const reminder = await trigger("milestone", {
        description: "You did it!",
        milestoneType: milestoneId,
      });
      if (reminder) setShowModal(true);
    };

    triggerMilestone();
  }, [milestoneId, trigger]);

  return (
    <DecisionMomentModal
      isOpen={showModal}
      reminder={data}
      onPrimaryAction={() => setShowModal(false)}
      onSecondaryAction={() => setShowModal(false)}
    />
  );
}
```

### Pattern 3: Conditional (First-Time Only)

```typescript
export function OptionalDecisionMoment({ userId, actionType }: Props) {
  const { trigger, data } = useDecisionMoment();
  const [showModal, setShowModal] = useState(false);

  async function handleAction() {
    // Only show decision moment first time
    const hasSeenBefore = await checkIfUserHasSeenAction(userId, actionType);
    if (hasSeenBefore) {
      // Skip modal, proceed directly
      await performAction();
      return;
    }

    // Show modal on first encounter
    const reminder = await trigger(actionType, {});
    if (reminder) {
      setShowModal(true);
      await recordActionSeen(userId, actionType);
    }
  }

  return (
    <>
      <button onClick={handleAction}>Action</button>
      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={() => {
          setShowModal(false);
          performAction();
        }}
        onSecondaryAction={() => setShowModal(false)}
      />
    </>
  );
}
```

---

## Troubleshooting

**Problem:** Modal doesn't appear after clicking button
- [ ] Check browser console for errors
- [ ] Verify `isLoading` prop isn't stuck as true
- [ ] Confirm `reminder` data is returned from API (check Network tab)
- [ ] Ensure `showModal` state is set to true

**Problem:** Wrong why/creed displayed
- [ ] User hasn't set why/creed yet (should show empty state)
- [ ] Check `/api/command-center/why-creed` to verify stored data
- [ ] Confirm correct workspace is being queried

**Problem:** Button stays disabled after modal closes
- [ ] Add `setIsLoading(false)` in your action handlers
- [ ] Ensure `isLoading` state is properly managed

**Problem:** Action doesn't proceed after clicking primary CTA
- [ ] `onPrimaryAction` handler might have an error (check console)
- [ ] Confirm `setShowModal(false)` is called
- [ ] Verify actual action logic works (test it separately)

**Problem:** Modal looks wrong on mobile
- [ ] Check if `DecisionMomentModal.mobile.tsx` exists (for bottom-sheet version)
- [ ] Verify viewport meta tag in HTML head
- [ ] Test in actual mobile device (not just browser DevTools)

---

## Accessibility Checklist

- [ ] Modal has `role="dialog"` attribute
- [ ] Modal has `aria-modal="true"`
- [ ] Modal title has `id` and modal has `aria-labelledby`
- [ ] Buttons are keyboard accessible (Tab key)
- [ ] Buttons have visible focus state
- [ ] Backdrop doesn't interfere with keyboard nav
- [ ] Escape key closes modal (can add this)
- [ ] Screen readers announce modal title

---

## Performance Checklist

- [ ] API response < 200ms (check Network tab)
- [ ] Modal animates smoothly (no jank)
- [ ] No unnecessary re-renders (check React DevTools)
- [ ] Why/Creed text doesn't overflow on mobile
- [ ] Images/icons load quickly
- [ ] Bundle size impact is minimal

---

## Final Verification

- [ ] Component code reviewed by team lead
- [ ] Tests pass (if applicable)
- [ ] Works in staging environment
- [ ] Works on actual device/browser where it will be used
- [ ] Error messages are user-friendly
- [ ] Loading states provide feedback
- [ ] Success message shown when action completes

---

## Deployment Checklist

- [ ] Code merged to main branch
- [ ] All tests passing in CI/CD
- [ ] Feature flag added (if needed for gradual rollout)
- [ ] Analytics tracking added (optional)
- [ ] Documentation updated
- [ ] Team notified of new feature
- [ ] Monitor error logs for first 24 hours post-deploy

---

## Questions?

- **API Reference:** See `docs/DECISION_MOMENT.md`
- **Code Examples:** See `docs/DECISION_MOMENT_EXAMPLES.md`
- **Architecture:** See `docs/DECISION_MOMENT_IMPLEMENTATION.md`

---

## Post-Launch Monitoring

Track these metrics after launch:

- [ ] API error rate (should be < 1%)
- [ ] Modal impressions (how often shown)
- [ ] Primary CTA conversion rate (should be > 50%)
- [ ] Secondary CTA rate (expected ~10-20%)
- [ ] Page load time impact (should be < 50ms)
- [ ] User feedback/issues reported

Adjust modal copy or triggering logic based on metrics.
