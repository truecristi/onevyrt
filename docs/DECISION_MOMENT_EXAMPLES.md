# Decision Moment: Implementation Examples

Real-world examples of integrating decision-moment reminders into ONEVYRT flows.

---

## Example 1: Stripe Checkout Page

Trigger a decision moment before the user enters their payment information.

```typescript
// components/checkout/StripeCheckout.tsx
"use client";

import { useState } from "react";
import { useDecisionMoment } from "@/hooks/useDecisionMoment";
import { DecisionMomentModal } from "@/components/dashboard/DecisionMomentModal";
import { loadStripe } from "@stripe/js";

export function StripeCheckout({ priceId, amount }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { trigger, isLoading, data } = useDecisionMoment();

  async function handleCheckout() {
    // First: trigger decision moment
    const reminder = await trigger("payment", {
      amount,
      description: "ONEVYRT Pro Plan - Annual",
      priceId,
    });

    if (!reminder) {
      console.error("Failed to trigger decision moment");
      return;
    }

    setShowModal(true);
  }

  async function confirmAndPay() {
    setIsProcessing(true);
    try {
      // Now proceed with actual payment
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY);

      const response = await fetch("/api/stripe/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });

      const { sessionId } = await response.json();
      const result = await stripe?.redirectToCheckout({ sessionId });

      if (result?.error) {
        console.error(result.error.message);
      }
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      <div className="max-w-md mx-auto p-6 border rounded-lg">
        <h2 className="text-2xl font-bold mb-4">Upgrade to Pro</h2>
        <p className="text-lg mb-6">${amount}/year</p>

        <button
          onClick={handleCheckout}
          disabled={isLoading || isProcessing}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Upgrade Now"}
        </button>
      </div>

      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={confirmAndPay}
        onSecondaryAction={() => setShowModal(false)}
        isPrimaryLoading={isProcessing}
      />
    </>
  );
}
```

---

## Example 2: Chapter Submission Review

Trigger when the user is about to submit their chapter work to a coach.

```typescript
// components/programme/ChapterSubmission.tsx
"use client";

import { useState } from "react";
import { useDecisionMoment } from "@/hooks/useDecisionMoment";
import { DecisionMomentModal } from "@/components/dashboard/DecisionMomentModal";

interface Props {
  chapterNumber: number;
  chapterName: string;
  workspaceId: string;
}

export function ChapterSubmission({
  chapterNumber,
  chapterName,
  workspaceId,
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { trigger, isLoading, data } = useDecisionMoment();

  async function handleSubmitClick() {
    // Trigger decision moment
    const reminder = await trigger("chapter-submit", {
      chapterName,
      chapterNumber,
    });

    if (reminder) {
      setShowModal(true);
    }
  }

  async function confirmSubmit() {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/programme/chapters/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          chapterNumber,
        }),
      });

      if (response.ok) {
        // Show success message
        alert("Submitted! Your coach will review your work.");
        setShowModal(false);
      } else {
        alert("Failed to submit. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">{chapterName}</h1>

        <div className="prose dark:prose-invert mb-8">
          {/* Chapter content here */}
        </div>

        <button
          onClick={handleSubmitClick}
          disabled={isLoading || isSubmitting}
          className="bg-cyan-600 text-white px-8 py-3 rounded-lg font-semibold"
        >
          {isLoading ? "Loading..." : "Submit for Review"}
        </button>
      </div>

      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={confirmSubmit}
        onSecondaryAction={() => setShowModal(false)}
        isPrimaryLoading={isSubmitting}
      />
    </>
  );
}
```

---

## Example 3: Milestone Celebration Flow

Trigger when a user hits a major milestone (e.g., completing a chapter, reaching a goal).

```typescript
// components/programme/MilestoneCard.tsx
"use client";

import { useState, useEffect } from "react";
import { useDecisionMoment } from "@/hooks/useDecisionMoment";
import { DecisionMomentModal } from "@/components/dashboard/DecisionMomentModal";

interface Milestone {
  id: string;
  title: string;
  description: string;
  icon: string;
  progress: number; // 0-100
}

export function MilestoneCard({ milestone }: { milestone: Milestone }) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { trigger, data } = useDecisionMoment();
  const isComplete = milestone.progress === 100;

  // Auto-trigger decision moment when milestone is newly completed
  useEffect(() => {
    if (isComplete && !showCelebration) {
      const triggerCelebration = async () => {
        const reminder = await trigger("milestone", {
          description: milestone.title,
          milestoneType: milestone.id,
          progressPercent: milestone.progress,
        });

        if (reminder) {
          setShowModal(true);
          setShowCelebration(true);
        }
      };

      triggerCelebration();
    }
  }, [isComplete, milestone, trigger, showCelebration]);

  if (!isComplete) {
    return (
      <div className="p-6 border border-slate-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">{milestone.title}</h3>
        <p className="text-sm text-slate-600 mb-4">{milestone.description}</p>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${milestone.progress}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {milestone.progress}% complete
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-start gap-4">
          <span className="text-4xl">{milestone.icon}</span>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
              🎉 {milestone.title} - Complete!
            </h3>
            <p className="text-sm text-green-700 dark:text-green-200 mt-1">
              {milestone.description}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 text-sm font-medium text-green-600 hover:text-green-700"
            >
              View your achievement
            </button>
          </div>
        </div>
      </div>

      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={() => {
          setShowModal(false);
          // Could trigger next action here (e.g., "unlock next chapter")
        }}
        onSecondaryAction={() => setShowModal(false)}
      />
    </>
  );
}
```

---

## Example 4: Level-Up / Capability Unlock

Trigger when a user is about to unlock a new feature or level.

```typescript
// components/learning/LevelUpModal.tsx
"use client";

import { useState } from "react";
import { useDecisionMoment } from "@/hooks/useDecisionMoment";
import { DecisionMomentModal } from "@/components/dashboard/DecisionMomentModal";

interface Lesson {
  id: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  unlockMessage: string;
}

export function LevelUpDialog({ lesson }: { lesson: Lesson }) {
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { trigger, isLoading, data } = useDecisionMoment();

  async function handleUnlock() {
    // Trigger decision moment before unlocking
    const reminder = await trigger("level-up", {
      lessonTitle: lesson.title,
      difficulty: lesson.difficulty,
    });

    if (reminder) {
      setShowModal(true);
    }
  }

  async function confirmUnlock() {
    setIsUnlocking(true);
    try {
      const response = await fetch("/api/learning/unlock-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id }),
      });

      if (response.ok) {
        // Navigate to lesson
        window.location.href = `/programme/lesson/${lesson.id}`;
      }
    } finally {
      setIsUnlocking(false);
    }
  }

  return (
    <>
      <div className="max-w-md mx-auto p-6 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-2">
          New Level Unlocked!
        </h2>

        <div className="mb-4 p-4 bg-white dark:bg-slate-800 rounded">
          <h3 className="font-semibold text-lg mb-1">{lesson.title}</h3>
          <span className="inline-block px-3 py-1 bg-amber-100 dark:bg-amber-900/50 text-amber-900 dark:text-amber-100 rounded text-xs font-medium">
            {lesson.difficulty}
          </span>
        </div>

        <p className="text-sm text-amber-800 dark:text-amber-200 mb-6">
          {lesson.unlockMessage}
        </p>

        <button
          onClick={handleUnlock}
          disabled={isLoading || isUnlocking}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 rounded-lg disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Loading..." : "Start Learning"}
        </button>
      </div>

      <DecisionMomentModal
        isOpen={showModal}
        reminder={data}
        onPrimaryAction={confirmUnlock}
        onSecondaryAction={() => setShowModal(false)}
        isPrimaryLoading={isUnlocking}
      />
    </>
  );
}
```

---

## Example 5: Programmatic Trigger (No UI Button)

Auto-trigger decision moments when certain conditions are met.

```typescript
// lib/business/auto-milestone-check.ts
import { triggerDecisionMoment } from "@/lib/dashboard/decision-moment";

/**
 * Check if a milestone should be triggered based on business metrics
 * Called periodically to auto-surface decision moments
 */
export async function checkAndTriggerMilestones(workspaceId: string) {
  // Example: User completed their first lead capture
  const leadCount = await getLeadCount(workspaceId);

  if (leadCount === 1) {
    const result = await triggerDecisionMoment("milestone", {
      description: "First Lead Captured!",
      milestoneType: "first-lead",
      progressPercent: 10,
    });

    if (result.ok && result.reminder) {
      // Store milestone notification in DB
      await createNotification(workspaceId, {
        type: "milestone",
        reminder: result.reminder,
      });
    }
  }

  // Example: User reached 10 leads milestone
  if (leadCount === 10) {
    await triggerDecisionMoment("milestone", {
      description: "10 Leads Captured - Double Digit Momentum!",
      milestoneType: "ten-leads",
      progressPercent: 20,
    });
  }

  // Example: Chapter progress at 75%
  const chapterProgress = await getChapterProgress(workspaceId, 2);

  if (chapterProgress === 75) {
    await triggerDecisionMoment("milestone", {
      description: "Chapter 2 Almost Done - Keep Going!",
      chapterName: "Chapter 2: Implement",
      progressPercent: 75,
    });
  }
}
```

---

## Example 6: Analytics & Tracking

Track decision moment engagement in your analytics.

```typescript
// lib/analytics/decision-moments.ts
import { triggerDecisionMoment } from "@/lib/dashboard/decision-moment";

interface DecisionMomentEvent {
  actionType: string;
  showed: boolean;
  primaryClicked: boolean;
  secondaryClicked: boolean;
  timestamp: Date;
  userId: string;
}

const events: DecisionMomentEvent[] = [];

export async function trackDecisionMoment(
  userId: string,
  actionType: string,
  context: unknown
) {
  const reminder = await triggerDecisionMoment(
    actionType as any,
    context as any
  );

  // Track that we showed the decision moment
  events.push({
    actionType,
    showed: !!reminder,
    primaryClicked: false,
    secondaryClicked: false,
    timestamp: new Date(),
    userId,
  });

  return reminder;
}

export function trackPrimaryAction(actionType: string, userId: string) {
  const event = events.find(
    (e) => e.actionType === actionType && e.userId === userId
  );
  if (event) {
    event.primaryClicked = true;
    // Send to analytics service
    sendToAnalytics(event);
  }
}

export function getEngagementMetrics() {
  const totalShown = events.length;
  const primaryClicks = events.filter((e) => e.primaryClicked).length;
  const secondaryClicks = events.filter((e) => e.secondaryClicked).length;

  return {
    totalShown,
    conversionRate: (primaryClicks / totalShown) * 100,
    pauseRate: (secondaryClicks / totalShown) * 100,
  };
}
```

---

## Example 7: Conditional Decision Moments

Only show decision moments for first-time actions or based on user preferences.

```typescript
// lib/dashboard/decision-moment-strategy.ts
import { triggerDecisionMoment } from "./decision-moment";

interface UserPreferences {
  showDecisionMoments: boolean;
  decisionMomentFrequency: "always" | "first-time-only" | "never";
}

export async function triggerIfNeeded(
  userId: string,
  actionType: string,
  context: unknown,
  preferences: UserPreferences
) {
  // User has disabled decision moments
  if (!preferences.showDecisionMoments) {
    return null;
  }

  // Only show for first-time actions
  if (preferences.decisionMomentFrequency === "first-time-only") {
    const hasSeenBefore = await hasUserSeenAction(userId, actionType);
    if (hasSeenBefore) {
      return null;
    }

    // Record that user saw this action
    await recordActionSeen(userId, actionType);
  }

  // Proceed with decision moment
  return await triggerDecisionMoment(actionType as any, context as any);
}

async function hasUserSeenAction(userId: string, actionType: string) {
  // Query DB for user action history
  return false; // Placeholder
}

async function recordActionSeen(userId: string, actionType: string) {
  // Insert into user action history table
}
```

---

## Example 8: Mobile-Optimized Decision Moment

Adapt the decision moment flow for mobile devices.

```typescript
// components/dashboard/DecisionMomentModal.mobile.tsx
"use client";

import { DecisionMomentReminder } from "@/lib/dashboard/decision-moment";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useState } from "react";

interface Props {
  isOpen: boolean;
  reminder: DecisionMomentReminder | null;
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
}

export function DecisionMomentModalMobile({
  isOpen,
  reminder,
  onPrimaryAction,
  onSecondaryAction,
}: Props) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen || !reminder) return null;

  const { modal, why, creed } = reminder;

  // On mobile, consider a bottom-sheet style instead of centered modal
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onSecondaryAction}
        />

        {/* Bottom Sheet */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Handle bar */}
          <div className="flex justify-center pt-2 pb-4">
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
          </div>

          <div className="px-4 pb-8">
            {/* Color accent */}
            <div
              className="h-1 w-16 rounded-full mb-6 mx-auto"
              style={{ backgroundColor: modal.color }}
            />

            {/* Title */}
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
              {modal.title}
            </h2>

            {/* Subtitle */}
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center mb-6">
              {modal.subtitle}
            </p>

            {/* Why & Creed (Collapsible on mobile) */}
            {(why || creed) && (
              <div
                className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 mb-6 cursor-pointer"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Your Why & Creed
                  </span>
                  <span className="text-lg">{isExpanded ? "−" : "+"}</span>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-3">
                    {why && (
                      <p className="text-slate-900 dark:text-white text-sm">
                        <span className="font-semibold text-slate-600 dark:text-slate-400 block text-xs mb-1">
                          Why
                        </span>
                        {why}
                      </p>
                    )}
                    {creed && (
                      <p className="text-slate-900 dark:text-white text-sm">
                        <span className="font-semibold text-slate-600 dark:text-slate-400 block text-xs mb-1">
                          Creed
                        </span>
                        {creed}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Buttons */}
            <div className="space-y-3">
              <button
                onClick={onPrimaryAction}
                style={{ backgroundColor: modal.color }}
                className="w-full text-white font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                {modal.primaryCta}
              </button>

              <button
                onClick={onSecondaryAction}
                className="w-full text-slate-700 dark:text-slate-300 font-semibold py-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                {modal.secondaryCta}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Desktop version (full modal)
  return <DesktopDecisionMomentModal {...{ isOpen, reminder, onPrimaryAction, onSecondaryAction }} />;
}
```

---

These examples demonstrate how to integrate decision moments across different flows in ONEVYRT. Adapt them to your specific use cases!
