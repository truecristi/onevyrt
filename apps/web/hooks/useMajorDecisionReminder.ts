import { useState, useCallback, useRef } from "react";

export interface DecisionMetadata {
  context: string; // e.g., "payment", "level-up", "milestone"
  id: string; // Unique identifier for this decision
  timestamp?: number;
}

/**
 * useMajorDecisionReminder
 *
 * Custom hook to manage the state and callbacks for MajorDecisionReminder.
 * Handles:
 * - Modal open/close state
 * - Approval/reflection callbacks
 * - Optional debouncing to prevent showing the reminder too frequently
 * - Tracking which decisions have been shown in this session
 *
 * Usage:
 * ```tsx
 * const reminder = useMajorDecisionReminder({
 *   debounceMs: 3000, // Don't show more than once per 3 seconds
 *   sessionOnly: true, // Only track within this session
 * });
 *
 * const handlePayment = async () => {
 *   if (reminder.shouldShow("payment:$497")) {
 *     reminder.open("payment:$497");
 *   } else {
 *     await processPayment();
 *   }
 * };
 *
 * const handleApprove = async () => {
 *   await processPayment();
 *   reminder.close();
 * };
 *
 * return (
 *   <>
 *     <MajorDecisionReminder
 *       isOpen={reminder.isOpen}
 *       onApprove={handleApprove}
 *       onReflect={reminder.close}
 *       whyAndCreedData={whyCreedData}
 *     />
 *   </>
 * );
 * ```
 */

interface UseMajorDecisionReminderOptions {
  /** Debounce time in milliseconds to avoid showing reminder too frequently */
  debounceMs?: number;
  /** Only track decisions within this session (clear on page reload) */
  sessionOnly?: boolean;
  /** Callback when user approves a decision */
  onApprove?: (metadata: DecisionMetadata) => void;
  /** Callback when user reflects/pauses */
  onReflect?: (metadata: DecisionMetadata) => void;
}

export function useMajorDecisionReminder(
  options: UseMajorDecisionReminderOptions = {}
) {
  const {
    debounceMs = 0,
    sessionOnly = true,
    onApprove,
    onReflect,
  } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const currentDecisionRef = useRef<DecisionMetadata | null>(null);
  const lastShowTimeRef = useRef<number>(0);
  const shownDecisionsRef = useRef<Set<string>>(new Set());

  // Initialize shown decisions from localStorage if not session-only
  const initializeShownDecisions = useCallback(() => {
    if (sessionOnly) return;

    try {
      const stored = localStorage.getItem(
        "majorDecisionReminder:shownDecisions"
      );
      if (stored) {
        const parsed = JSON.parse(stored);
        shownDecisionsRef.current = new Set(parsed);
      }
    } catch (err) {
      console.error("Failed to load shown decisions:", err);
    }
  }, [sessionOnly]);

  // Save shown decisions to localStorage
  const persistShownDecisions = useCallback(() => {
    if (sessionOnly) return;

    try {
      localStorage.setItem(
        "majorDecisionReminder:shownDecisions",
        JSON.stringify(Array.from(shownDecisionsRef.current))
      );
    } catch (err) {
      console.error("Failed to save shown decisions:", err);
    }
  }, [sessionOnly]);

  const shouldShow = useCallback(
    (decisionId: string): boolean => {
      const now = Date.now();

      // Check debounce
      if (now - lastShowTimeRef.current < debounceMs) {
        return false;
      }

      // Check if already shown
      if (shownDecisionsRef.current.has(decisionId)) {
        return false;
      }

      return true;
    },
    [debounceMs]
  );

  const open = useCallback(
    (decisionId: string, context: string = "decision") => {
      if (!shouldShow(decisionId)) {
        return false;
      }

      currentDecisionRef.current = {
        context,
        id: decisionId,
        timestamp: Date.now(),
      };

      lastShowTimeRef.current = Date.now();
      shownDecisionsRef.current.add(decisionId);
      persistShownDecisions();

      setIsOpen(true);
      return true;
    },
    [shouldShow, persistShownDecisions]
  );

  const close = useCallback(() => {
    setIsOpen(false);
    currentDecisionRef.current = null;
  }, []);

  const handleApprove = useCallback(async () => {
    if (!currentDecisionRef.current) return;

    const metadata = currentDecisionRef.current;

    try {
      setIsLoading(true);
      onApprove?.(metadata);
    } finally {
      setIsLoading(false);
      close();
    }
  }, [onApprove, close]);

  const handleReflect = useCallback(() => {
    if (currentDecisionRef.current) {
      onReflect?.(currentDecisionRef.current);
    }
    close();
  }, [onReflect, close]);

  // Initialize on mount
  useState(() => {
    initializeShownDecisions();
  });

  return {
    isOpen,
    isLoading,
    open,
    close,
    handleApprove,
    handleReflect,
    shouldShow,
    resetShownDecisions: () => {
      shownDecisionsRef.current.clear();
      persistShownDecisions();
    },
    getShownDecisions: () => Array.from(shownDecisionsRef.current),
    getCurrentDecision: () => currentDecisionRef.current,
  };
}
