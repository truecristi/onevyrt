'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircleIcon,
  FireIcon,
  SparklesIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/solid';
interface WhyCreedData {
  why: string;
  creed: string;
  updatedAt: string;
}

// Small native Date helpers (no date-fns dependency in this app).
function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function formatMonthDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); // e.g. "Mar 15"
}

function daysBetween(dateLeft: Date, dateRight: Date): number {
  return Math.floor((dateLeft.getTime() - dateRight.getTime()) / (1000 * 60 * 60 * 24));
}

function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

interface MotivationWidgetState {
  whyCreedData: WhyCreedData | null;
  streak: number;
  lastReflectionDate: Date | null;
  nextCheckpointDate: Date | null;
  isLoading: boolean;
  error: string | null;
}

const STORAGE_KEY = 'onevyrt_reflection_checkins';
const CHECKPOINT_INTERVAL = 7; // days

// Motivational messages based on streak
const getMotivationalMessage = (streak: number): string => {
  if (streak === 0) return 'Time to reconnect with your why.';
  if (streak === 1) return "You're back on track!";
  if (streak < 7) return `${streak}-day streak! Keep the momentum going.`;
  if (streak < 14) return `${streak} days strong! You're unstoppable.`;
  if (streak < 30) return `${streak}-day streak! Mastery in motion.`;
  return `${streak} days! You're a reflection champion!`;
};

// Streak color based on count
const getStreakColor = (streak: number): string => {
  if (streak === 0) return 'text-slate-500';
  if (streak < 3) return 'text-orange-500';
  if (streak < 7) return 'text-amber-500';
  if (streak < 14) return 'text-green-500';
  return 'text-emerald-600';
};

// Fire icon color based on streak
const getFireColor = (streak: number): string => {
  if (streak === 0) return 'text-slate-400';
  if (streak < 3) return 'text-orange-400';
  if (streak < 7) return 'text-amber-400';
  if (streak < 14) return 'text-green-400';
  return 'text-emerald-500';
};

export default function MotivationWidget() {
  const [state, setState] = useState<MotivationWidgetState>({
    whyCreedData: null,
    streak: 0,
    lastReflectionDate: null,
    nextCheckpointDate: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchWhyCreed = async () => {
      try {
        const response = await fetch('/api/command-center/why-creed', {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch why/creed data');
        }

        const data = await response.json();

        if (data && data.why && data.creed) {
          const updatedAt = new Date(data.updatedAt || data.created_at);
          const lastReflectionDate = new Date(updatedAt);

          // Load reflection check-ins from localStorage
          const checkinsJson = localStorage.getItem(STORAGE_KEY);
          const checkins: string[] = checkinsJson ? JSON.parse(checkinsJson) : [];

          // Get today's date in YYYY-MM-DD format
          const today = formatISODate(new Date());

          // Calculate streak: count consecutive days with check-ins
          let streak = 0;

          // Add today to checkins if it's there
          if (!checkins.includes(today)) {
            checkins.push(today);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(checkins));
          }

          // Sort check-ins in reverse chronological order
          const sortedCheckins = checkins
            .map(d => new Date(d))
            .sort((a, b) => b.getTime() - a.getTime());

          // Count consecutive days from today
          for (let i = 0; i < sortedCheckins.length; i++) {
            const checkInDate = new Date(sortedCheckins[i]!);
            const expectedDate = new Date(today);
            expectedDate.setDate(expectedDate.getDate() - i);

            const checkInDateStr = formatISODate(checkInDate);
            const expectedDateStr = formatISODate(expectedDate);

            if (checkInDateStr === expectedDateStr) {
              streak++;
            } else {
              break;
            }
          }

          const nextCheckpointDate = addDaysToDate(lastReflectionDate, CHECKPOINT_INTERVAL);

          setState({
            whyCreedData: {
              why: data.why,
              creed: data.creed,
              updatedAt: data.updatedAt || data.created_at,
            },
            streak,
            lastReflectionDate,
            nextCheckpointDate,
            isLoading: false,
            error: null,
          });
        } else {
          // No why/creed data yet
          setState(prev => ({
            ...prev,
            isLoading: false,
          }));
        }
      } catch (err) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'An error occurred',
        }));
      }
    };

    fetchWhyCreed();
  }, []);

  if (state.isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  if (!state.whyCreedData) {
    return (
      <div className="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-6 shadow-sm dark:border-blue-900 dark:from-blue-950 dark:to-cyan-950">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
              <SparklesIcon className="h-5 w-5" />
              Connect with Your Why
            </h3>
            <p className="mt-2 text-sm text-blue-700 dark:text-blue-200">
              Define your purpose and business creed to unlock daily motivation tracking.
            </p>
          </div>
          <button
            type="button"
            className="ml-4 inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            onClick={() => {
              // Scroll to why/creed section or open modal
              const element = document.querySelector('[data-why-creed-section]');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Add Why & Creed
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const streakColor = getStreakColor(state.streak);
  const fireColor = getFireColor(state.streak);
  const motivationalMessage = getMotivationalMessage(state.streak);

  const lastReflectionFormatted = state.lastReflectionDate
    ? formatMonthDay(state.lastReflectionDate)
    : 'Never';

  const nextCheckpointFormatted = state.nextCheckpointDate
    ? formatMonthDay(state.nextCheckpointDate)
    : 'Soon';

  const daysUntilCheckpoint = state.nextCheckpointDate
    ? Math.max(0, daysBetween(state.nextCheckpointDate, new Date()))
    : 0;

  return (
    <div
      className="group rounded-lg border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-700 dark:from-slate-900 dark:to-slate-800"
      data-motivation-widget
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Daily Reflection Streak
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Stay connected to your purpose
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              const element = document.querySelector('[data-why-creed-section]');
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            View Why & Creed
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Streak Display */}
        <div className="grid grid-cols-3 gap-4">
          {/* Current Streak */}
          <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-750">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Current Streak
                </p>
                <p className={`mt-1 text-2xl font-bold ${streakColor}`}>
                  {state.streak}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">days</p>
              </div>
              <FireIcon className={`h-8 w-8 ${fireColor}`} />
            </div>
          </div>

          {/* Last Reflection */}
          <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-750">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Last Reflection
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {lastReflectionFormatted}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {state.lastReflectionDate && (
                <>
                  {state.streak === 0
                    ? daysBetween(new Date(), state.lastReflectionDate) + ' days ago'
                    : 'Today'}
                </>
              )}
            </p>
          </div>

          {/* Next Checkpoint */}
          <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-600 dark:bg-slate-750">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Next Checkpoint
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
              {nextCheckpointFormatted}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {daysUntilCheckpoint === 0
                ? 'Today'
                : `in ${daysUntilCheckpoint} days`}
            </p>
          </div>
        </div>

        {/* Motivational Message */}
        <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950">
          <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {motivationalMessage}
          </p>
        </div>

        {/* Preview of Why & Creed */}
        {state.whyCreedData && (
          <div className="space-y-3 rounded-md bg-white p-4 dark:bg-slate-750">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Your Why
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">
                {state.whyCreedData.why}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Your Creed
              </p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-700 dark:text-slate-200">
                {state.whyCreedData.creed}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
