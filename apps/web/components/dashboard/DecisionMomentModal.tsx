/**
 * DecisionMomentModal Component
 *
 * Displays a decision-moment reminder modal with the user's Why & Creed
 * before they take a major action (payment, milestone, level-up, chapter-submit).
 *
 * Usage:
 *   <DecisionMomentModal
 *     isOpen={showModal}
 *     reminder={reminder}
 *     onPrimaryAction={handleContinue}
 *     onSecondaryAction={handleCancel}
 *   />
 */

import { useState } from "react";
import { DecisionMomentReminder } from "@/lib/dashboard/decision-moment";

interface DecisionMomentModalProps {
  isOpen: boolean;
  reminder: DecisionMomentReminder | null;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  isPrimaryLoading?: boolean;
  isSecondaryLoading?: boolean;
}

export function DecisionMomentModal({
  isOpen,
  reminder,
  onPrimaryAction,
  onSecondaryAction,
  isPrimaryLoading = false,
  isSecondaryLoading = false,
}: DecisionMomentModalProps) {
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  if (!isOpen || !reminder) return null;

  const { modal, why, creed } = reminder;
  const hasWhyCreed = why.trim().length > 0 || creed.trim().length > 0;

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsAnimatingOut(false);
      onSecondaryAction?.();
    }, 200);
  };

  const handlePrimary = () => {
    setIsAnimatingOut(true);
    setTimeout(() => {
      setIsAnimatingOut(false);
      onPrimaryAction?.();
    }, 200);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-200 ${
          isAnimatingOut ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${
          isAnimatingOut ? "opacity-0" : "opacity-100"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-moment-title"
      >
        <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-lg shadow-xl">
          {/* Header with color accent */}
          <div
            className="h-1 w-full"
            style={{ backgroundColor: modal.color }}
            aria-hidden="true"
          />

          <div className="p-8">
            {/* Icon & Title */}
            <div className="mb-6 text-center">
              <div
                className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: `${modal.color}20` }}
              >
                <span
                  className="text-2xl"
                  style={{ color: modal.color }}
                  role="img"
                  aria-hidden="true"
                >
                  ✨
                </span>
              </div>

              <h2
                id="decision-moment-title"
                className="text-2xl font-bold text-slate-900 dark:text-white mb-2"
              >
                {modal.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-300">
                {modal.subtitle}
              </p>
            </div>

            {/* Why & Creed Display */}
            {hasWhyCreed && (
              <div className="mb-8 space-y-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
                {why.trim().length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                      Your Why
                    </p>
                    <p className="text-lg text-slate-900 dark:text-white font-medium leading-relaxed">
                      {why}
                    </p>
                  </div>
                )}

                {creed.trim().length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                      Your Creed
                    </p>
                    <p className="text-lg text-slate-900 dark:text-white font-medium leading-relaxed">
                      {creed}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* No Why/Creed State */}
            {!hasWhyCreed && (
              <div className="mb-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  You haven't set your Why & Creed yet. Once you do, they'll appear
                  here to inspire you before every major decision.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleClose}
                disabled={isSecondaryLoading || isPrimaryLoading}
                className="px-6 py-2.5 rounded-lg font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSecondaryLoading ? "Loading..." : modal.secondaryCta}
              </button>

              <button
                onClick={handlePrimary}
                disabled={isPrimaryLoading || isSecondaryLoading}
                style={{ backgroundColor: modal.color }}
                className="px-6 py-2.5 rounded-lg font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isPrimaryLoading ? "Loading..." : modal.primaryCta}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
