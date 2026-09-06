"use client";

import { useState } from "react";
import {
  ChevronRightIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";

export interface ReflectionCheckpointData {
  id: string;
  workspaceId: string;
  previousWhy: string;
  previousCreed: string;
  currentWhy: string;
  currentCreed: string;
  whyEvolution: string;
  creedEvolution: string;
  keyInsights: string;
  createdAt: string;
}

interface ReflectionCheckpointProps {
  workspaceId: string;
  currentWhy: string;
  currentCreed: string;
  onComplete?: (data: ReflectionCheckpointData) => void;
  onCancel?: () => void;
}

type FormStep = "intro" | "why-evolution" | "creed-evolution" | "insights" | "review" | "complete";

/**
 * 90DayReflectionCheckpoint
 *
 * Multi-step form for quarterly reflection on purpose evolution.
 * Captures how the user's "Why" and "Creed" have evolved over 90 days.
 *
 * Features:
 * - 5-step guided form with progress tracking
 * - Before/after comparison views
 * - Reflective questions to deepen insight
 * - Dark mode support
 * - Animated transitions between steps
 * - Summary & review before submission
 */
export function NinetyDayReflectionCheckpoint({
  workspaceId,
  currentWhy,
  currentCreed,
  onComplete,
  onCancel,
}: ReflectionCheckpointProps) {
  const [step, setStep] = useState<FormStep>("intro");
  const [whyEvolution, setWhyEvolution] = useState("");
  const [creedEvolution, setCreedEvolution] = useState("");
  const [keyInsights, setKeyInsights] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps: FormStep[] = [
    "intro",
    "why-evolution",
    "creed-evolution",
    "insights",
    "review",
    "complete",
  ];
  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]!);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]!);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/workspace/${workspaceId}/reflection-checkpoint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            whyEvolution,
            creedEvolution,
            keyInsights,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStep("complete");
        onComplete?.(data);
      } else {
        console.error("Failed to submit reflection:", response.status);
      }
    } catch (error) {
      console.error("Failed to submit reflection:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case "intro":
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                🎯 90-Day Reflection
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Every 90 days is a milestone to pause and reflect on how your
                purpose has evolved.
              </p>
            </div>

            <div className="space-y-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                During this reflection, you'll explore:
              </h3>
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    1.
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong>Why Evolution</strong> — How has your purpose
                    deepened or shifted?
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    2.
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong>Creed Evolution</strong> — What's new about your
                    commitment?
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    3.
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    <strong>Key Insights</strong> — What have you learned about
                    yourself?
                  </span>
                </li>
              </ul>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 italic">
              This reflection creates a permanent archive of your purpose
              evolution. Your progress is the point.
            </p>
          </div>
        );

      case "why-evolution":
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Your Why: Then & Now
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Reflect on how your core purpose has evolved.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Before */}
              <div className="space-y-3">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    90 Days Ago
                  </h3>
                  <p className="text-slate-900 dark:text-white leading-relaxed min-h-24">
                    {currentWhy || "(No Why set yet)"}
                  </p>
                </div>
              </div>

              {/* After */}
              <div className="space-y-3">
                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2">
                    Evolution Reflection
                  </h3>
                  <textarea
                    value={whyEvolution}
                    onChange={(e) => setWhyEvolution(e.target.value)}
                    placeholder="How has your Why evolved? What's different now? Did your purpose deepen, shift, or solidify?"
                    className="w-full min-h-24 p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">
                💡 Reflection prompts:
              </h4>
              <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <li>• Did your impact vision grow?</li>
                <li>• What struggles taught you something new?</li>
                <li>• How have your values clarified?</li>
              </ul>
            </div>
          </div>
        );

      case "creed-evolution":
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Your Creed: Then & Now
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Reflect on how your commitment and values have evolved.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Before */}
              <div className="space-y-3">
                <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                    90 Days Ago
                  </h3>
                  <p className="text-slate-900 dark:text-white leading-relaxed min-h-24">
                    {currentCreed || "(No Creed set yet)"}
                  </p>
                </div>
              </div>

              {/* Evolution */}
              <div className="space-y-3">
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <h3 className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
                    Evolution Reflection
                  </h3>
                  <textarea
                    value={creedEvolution}
                    onChange={(e) => setCreedEvolution(e.target.value)}
                    placeholder="What's new about your creed? Have your values shifted? Are you more committed, or have your commitments changed?"
                    className="w-full min-h-24 p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <h4 className="font-semibold text-amber-900 dark:text-amber-200 mb-2 text-sm">
                💡 Reflection prompts:
              </h4>
              <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1">
                <li>• What values proved most important?</li>
                <li>• What commitments did you keep? Break?</li>
                <li>• How have you grown in character?</li>
              </ul>
            </div>
          </div>
        );

      case "insights":
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Key Insights
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                What have you learned about yourself, your business, and your
                journey?
              </p>
            </div>

            <div className="space-y-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-6 border border-emerald-200 dark:border-emerald-800">
              <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Your Insights
              </h3>
              <textarea
                value={keyInsights}
                onChange={(e) => setKeyInsights(e.target.value)}
                placeholder="What are the 2-3 biggest breakthroughs or learnings from the last 90 days? What do you know now that you didn't know before?"
                className="w-full min-h-32 p-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h4 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 text-sm">
                🧠 Think about:
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                <li>• What changed your perspective?</li>
                <li>• What patterns do you see?</li>
                <li>• What's your next frontier?</li>
              </ul>
            </div>
          </div>
        );

      case "review":
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Review Your Reflection
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Take a moment to review what you've captured.
              </p>
            </div>

            {/* Why Evolution */}
            <div className="space-y-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/40 rounded-lg p-5 border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                Why Evolution
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                {whyEvolution || "(No response)"}
              </p>
            </div>

            {/* Creed Evolution */}
            <div className="space-y-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg p-5 border border-purple-200 dark:border-purple-800">
              <h3 className="font-semibold text-purple-900 dark:text-purple-200">
                Creed Evolution
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                {creedEvolution || "(No response)"}
              </p>
            </div>

            {/* Key Insights */}
            <div className="space-y-3 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/40 rounded-lg p-5 border border-emerald-200 dark:border-emerald-800">
              <h3 className="font-semibold text-emerald-900 dark:text-emerald-200">
                Key Insights
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm">
                {keyInsights || "(No response)"}
              </p>
            </div>

            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-4 text-sm text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              <p>
                ✓ Your reflection will be saved and archived. You'll be
                prompted again in 90 days to capture your continued evolution.
              </p>
            </div>
          </div>
        );

      case "complete":
        return (
          <div className="space-y-6 text-center animate-fadeIn">
            <div className="flex justify-center">
              <CheckCircleIcon className="w-16 h-16 text-emerald-500" />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white">
                Reflection Complete!
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Your 90-day checkpoint has been saved.
              </p>
            </div>

            <div className="space-y-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-6 border border-emerald-200 dark:border-emerald-800">
              <p className="text-emerald-900 dark:text-emerald-200 font-semibold">
                You're building momentum.
              </p>
              <p className="text-emerald-800 dark:text-emerald-300 text-sm">
                Every quarter, pause, reflect, and measure your progress. This
                archive is yours—a permanent record of your evolution as a
                leader and builder.
              </p>
            </div>

            <button
              onClick={() => onCancel?.()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all font-medium shadow-md"
            >
              Return to Dashboard
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Progress Bar */}
      {step !== "complete" && (
        <div className="mb-8 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Step {currentStepIndex + 1} of {steps.length - 1}
            </span>
            <span className="text-slate-600 dark:text-slate-400">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-lg border border-slate-200 dark:border-slate-800">
        {renderStep()}
      </div>

      {/* Navigation */}
      {step !== "complete" && (
        <div className="mt-8 flex justify-between items-center gap-4">
          <button
            onClick={handlePrevious}
            disabled={currentStepIndex === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back
          </button>

          {step === "review" ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md"
            >
              <CheckCircleIcon className="w-4 h-4" />
              {isSubmitting ? "Saving..." : "Save Reflection"}
            </button>
          ) : (
            <button
              onClick={handleNext}
              disabled={
                (step === "why-evolution" && !whyEvolution.trim()) ||
                (step === "creed-evolution" && !creedEvolution.trim()) ||
                (step === "insights" && !keyInsights.trim())
              }
              className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md"
            >
              Next
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onCancel?.()}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors font-medium"
          >
            Close
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
