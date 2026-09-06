/**
 * useDecisionMoment Hook
 *
 * React hook for triggering decision-moment reminders
 * Usage:
 *   const { trigger, isLoading, data } = useDecisionMoment();
 *   await trigger('payment', { amount: 497 });
 */

import { useState, useCallback } from "react";
import {
  triggerDecisionMoment,
  type ActionType,
  type DecisionMomentContext,
  type DecisionMomentReminder,
} from "@/lib/dashboard/decision-moment";

interface UseDecisionMomentReturn {
  trigger: (
    actionType: ActionType,
    context?: DecisionMomentContext
  ) => Promise<DecisionMomentReminder | null>;
  isLoading: boolean;
  error: string | null;
  data: DecisionMomentReminder | null;
}

export function useDecisionMoment(): UseDecisionMomentReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DecisionMomentReminder | null>(null);

  const trigger = useCallback(
    async (actionType: ActionType, context?: DecisionMomentContext) => {
      setIsLoading(true);
      setError(null);

      const result = await triggerDecisionMoment(actionType, context);

      if (!result.ok || !result.reminder) {
        const errorMessage = result.error || "Failed to trigger decision moment";
        setError(errorMessage);
        setIsLoading(false);
        return null;
      }

      setData(result.reminder);
      setIsLoading(false);
      return result.reminder;
    },
    []
  );

  return { trigger, isLoading, error, data };
}
