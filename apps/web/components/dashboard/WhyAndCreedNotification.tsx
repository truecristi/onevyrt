'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/navigation';
import { CANONICAL_ROUTES } from '@/lib/navigation/canonical-routes';

interface WhyAndCreedData {
  why: string;
  creed: string;
}

const NOTIFICATION_SESSION_KEY = 'why-creed-notification-shown';
const NOTIFICATION_DELAY_MS = 8000; // Show after 8 seconds

export function WhyAndCreedNotification() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [data, setData] = useState<WhyAndCreedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if notification was already shown this session
    const wasShown = sessionStorage.getItem(NOTIFICATION_SESSION_KEY);
    if (wasShown) {
      setIsLoading(false);
      return;
    }

    // Fetch why/creed data
    const fetchData = async () => {
      try {
        const response = await fetch('/api/command-center/why-creed', {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch why/creed');
        const result = await response.json();

        // Only show if both why and creed exist
        if (result.why && result.creed) {
          setData(result);

          // Delay showing the notification
          const timer = setTimeout(() => {
            setIsVisible(true);
            sessionStorage.setItem(NOTIFICATION_SESSION_KEY, 'true');
          }, NOTIFICATION_DELAY_MS);

          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error('Failed to fetch why/creed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleTellMeMore = () => {
    handleDismiss();
    router.push(CANONICAL_ROUTES.home);
    // Scroll to why/creed section after navigation
    setTimeout(() => {
      const element = document.getElementById('why-creed-section');
      element?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  if (isLoading || !data || !isVisible) {
    return null;
  }

  return (
    <>
      {/* Backdrop overlay (optional, subtle) */}
      {isVisible && (
        <div
          className="fixed inset-0 z-40 pointer-events-none"
          aria-hidden="true"
        />
      )}

      {/* Toast notification */}
      <div
        className={`
          fixed bottom-4 right-4 z-50 max-w-sm w-full mx-4
          transform transition-all duration-500 ease-out
          ${
            isVisible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0 pointer-events-none'
          }
        `}
        role="alert"
        aria-live="polite"
        aria-atomic="true"
      >
        {/* Card container with gradient border effect */}
        <div
          className={`
            relative overflow-hidden rounded-lg p-4 shadow-lg
            border border-transparent
            bg-white dark:bg-slate-900
            backdrop-blur-sm
          `}
          style={{
            backgroundImage:
              'linear-gradient(white, white), linear-gradient(135deg, #2563eb, #a855f7, #ec4899)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
          }}
        >
          {/* Animated background gradient (subtle) */}
          <div
            className={`
              absolute inset-0 -z-10 opacity-0 dark:opacity-5
              bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10
              animate-pulse
            `}
            aria-hidden="true"
          />

          {/* Content container */}
          <div className="relative z-10 space-y-3">
            {/* Header with badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #a855f7)',
                  }}
                  aria-hidden="true"
                />
                <span
                  className={`
                    text-xs font-semibold tracking-wide
                    bg-gradient-to-r from-blue-600 to-purple-600
                    dark:from-blue-400 dark:to-purple-400
                    bg-clip-text text-transparent
                  `}
                >
                  REMEMBER YOUR WHY
                </span>
              </div>

              {/* Close button */}
              <button
                onClick={handleDismiss}
                className={`
                  flex-shrink-0 p-1 rounded-md transition-colors
                  text-slate-400 hover:text-slate-600
                  dark:text-slate-500 dark:hover:text-slate-300
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  dark:focus:ring-blue-400
                `}
                aria-label="Dismiss notification"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Why text (quoted style) */}
            <div className="pl-3 border-l-2 border-blue-400 dark:border-blue-500">
              <p
                className={`
                  text-sm leading-relaxed font-medium
                  text-slate-900 dark:text-slate-100
                `}
              >
                "{data.why}"
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleTellMeMore}
                className={`
                  flex-1 inline-flex items-center justify-center gap-1.5
                  px-3 py-2 text-sm font-medium rounded-md
                  transition-all duration-200
                  bg-gradient-to-r from-blue-600 to-purple-600
                  dark:from-blue-500 dark:to-purple-500
                  text-white hover:shadow-md hover:scale-105
                  focus:outline-none focus:ring-2 focus:ring-offset-2
                  dark:focus:ring-offset-slate-900
                  focus:ring-blue-500 dark:focus:ring-blue-400
                  active:scale-95
                `}
              >
                <span>Tell me more</span>
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleDismiss}
                className={`
                  px-3 py-2 text-sm font-medium rounded-md
                  transition-colors duration-200
                  text-slate-600 dark:text-slate-400
                  hover:bg-slate-100 dark:hover:bg-slate-800
                  focus:outline-none focus:ring-2 focus:ring-offset-2
                  dark:focus:ring-offset-slate-900
                  focus:ring-slate-300 dark:focus:ring-slate-700
                  active:scale-95
                `}
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Subtle animated shimmer effect on top border */}
          <div
            className={`
              absolute top-0 left-0 right-0 h-px
              bg-gradient-to-r from-transparent via-white to-transparent
              opacity-0 dark:opacity-20
              animate-pulse
            `}
            aria-hidden="true"
          />
        </div>
      </div>
    </>
  );
}
