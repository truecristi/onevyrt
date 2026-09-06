'use client';

import React, { useState, useCallback } from 'react';
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  QuestionMarkCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/solid';
import { FreeAccessError, ErrorSeverity, ErrorCategory } from '@/lib/free-access-errors';

interface ErrorDisplayProps {
  error: FreeAccessError | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
  showDetails?: boolean;
  compact?: boolean;
  autoCloseMs?: number;
}

/**
 * Error severity to icon mapping
 */
const SEVERITY_ICONS: Record<ErrorSeverity, React.ReactNode> = {
  [ErrorSeverity.LOW]: (
    <InformationCircleIcon className="w-5 h-5 text-blue-600" aria-hidden="true" />
  ),
  [ErrorSeverity.MEDIUM]: (
    <ExclamationTriangleIcon className="w-5 h-5 text-amber-600" aria-hidden="true" />
  ),
  [ErrorSeverity.HIGH]: (
    <ExclamationCircleIcon className="w-5 h-5 text-red-600" aria-hidden="true" />
  ),
  [ErrorSeverity.CRITICAL]: (
    <ExclamationCircleIcon className="w-5 h-5 text-red-700" aria-hidden="true" />
  ),
};

/**
 * Error severity to color mapping
 */
const SEVERITY_COLORS: Record<ErrorSeverity, string> = {
  [ErrorSeverity.LOW]: 'bg-blue-50 border-blue-200 text-blue-900',
  [ErrorSeverity.MEDIUM]: 'bg-amber-50 border-amber-200 text-amber-900',
  [ErrorSeverity.HIGH]: 'bg-red-50 border-red-200 text-red-900',
  [ErrorSeverity.CRITICAL]: 'bg-red-100 border-red-300 text-red-950',
};

/**
 * Recovery suggestions by error category
 */
const RECOVERY_SUGGESTIONS: Record<ErrorCategory, string[]> = {
  [ErrorCategory.VALIDATION]: [
    'Check that all required fields are filled in correctly',
    'Verify input formats (e.g., ISO 8601 for timestamps)',
    'Try removing special characters if applicable',
  ],
  [ErrorCategory.AUTHENTICATION]: [
    'Verify your admin credentials',
    'Check that your session has not expired',
    'Try logging out and logging back in',
  ],
  [ErrorCategory.NOT_FOUND]: [
    'Verify the resource ID is correct',
    'Check that the resource has not been deleted',
    'Refresh the page to see the latest data',
  ],
  [ErrorCategory.DATABASE]: [
    'Check your internet connection',
    'Wait a few moments and try again',
    'Contact support if the problem persists',
  ],
  [ErrorCategory.TIMEOUT]: [
    'Try again in a moment',
    'Check your internet connection speed',
    'Try with fewer items if doing bulk operations',
  ],
  [ErrorCategory.RATE_LIMIT]: [
    'Wait the specified time before trying again',
    'Retry operations one at a time instead of in bulk',
    'Contact support if rate limits seem incorrect',
  ],
  [ErrorCategory.NETWORK]: [
    'Check your internet connection',
    'Try again in a moment',
    'If using a VPN, try disabling it temporarily',
  ],
  [ErrorCategory.UNKNOWN]: [
    'Try refreshing the page',
    'Clear your browser cache and try again',
    'Contact support with the error details below',
  ],
};

/**
 * User-friendly error display component
 */
export function ErrorDisplay({
  error,
  onDismiss,
  onRetry,
  isRetrying = false,
  showDetails = false,
  compact = false,
  autoCloseMs,
}: ErrorDisplayProps) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(showDetails);
  const [isVisible, setIsVisible] = useState(true);

  // Auto-close after specified time
  React.useEffect(() => {
    if (!autoCloseMs || !error || !isVisible) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [error, isVisible, autoCloseMs, onDismiss]);

  // Declared before the early return below — hooks must run in the same
  // order every render, and this one doesn't depend on `error` anyway.
  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  if (!error || !isVisible) {
    return null;
  }

  const suggestions = RECOVERY_SUGGESTIONS[error.category];
  const icon = SEVERITY_ICONS[error.severity];
  const colors = SEVERITY_COLORS[error.severity];

  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 rounded-lg border p-3 ${colors}`}
        role="alert"
        aria-live="polite"
      >
        {icon}
        <div className="flex-1">
          <p className="font-medium">{error.userMessage}</p>
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:opacity-75 transition-opacity"
            aria-label="Dismiss error"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 space-y-4 ${colors}`}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Something went wrong</h3>
          <p className="text-sm mt-1">{error.userMessage}</p>
        </div>
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:opacity-75 transition-opacity"
            aria-label="Dismiss error"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Recovery suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <QuestionMarkCircleIcon className="w-4 h-4 flex-shrink-0" />
            What you can try:
          </p>
          <ul className="text-sm space-y-1 ml-6">
            {suggestions.map((suggestion, idx) => (
              <li key={idx} className="list-disc opacity-90">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {onRetry && error.retryable && (
          <button
            onClick={onRetry}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all
              bg-white/50 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Retry operation"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Try again'}
          </button>
        )}

        <button
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          className="text-sm font-medium underline opacity-75 hover:opacity-100 transition-opacity"
          aria-expanded={isDetailsExpanded}
        >
          {isDetailsExpanded ? 'Hide' : 'Show'} details
        </button>
      </div>

      {/* Detailed error info */}
      {isDetailsExpanded && (
        <div className="space-y-2 pt-2 border-t border-current border-opacity-20">
          <details className="text-xs space-y-2">
            <summary className="font-mono cursor-pointer opacity-75 hover:opacity-100">
              Error Details
            </summary>
            <pre className="bg-black/10 p-2 rounded overflow-auto max-h-48 font-mono text-xs">
              {JSON.stringify(error.toJSON(), null, 2)}
            </pre>
          </details>

          <div className="text-xs opacity-75 space-y-1">
            <p>
              <strong>Category:</strong> {error.category}
            </p>
            <p>
              <strong>Status Code:</strong> {error.statusCode}
            </p>
            <p>
              <strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}
            </p>
            <p>
              <strong>Time:</strong> {error.timestamp.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Support info */}
      {error.severity === ErrorSeverity.CRITICAL && (
        <div className="text-sm opacity-90 border-t border-current border-opacity-20 pt-3">
          <p className="font-medium mb-1">Need help?</p>
          <p>
            This is a critical error. Please contact support with the details above if the problem
            persists.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Error toast for temporary notifications
 */
export function ErrorToast({
  error,
  onDismiss,
  duration = 5000,
}: {
  error: FreeAccessError;
  onDismiss?: () => void;
  duration?: number;
}) {
  const [isVisible, setIsVisible] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!isVisible) return null;

  const colors = SEVERITY_COLORS[error.severity];
  const icon = SEVERITY_ICONS[error.severity];

  return (
    <div
      className={`fixed bottom-4 right-4 rounded-lg border p-4 shadow-lg max-w-sm ${colors}`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {icon}
        <div className="flex-1">
          <p className="font-medium text-sm">{error.userMessage}</p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="flex-shrink-0 p-1 hover:opacity-75 transition-opacity"
          aria-label="Dismiss"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Error boundary component
 */
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: FreeAccessError | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const freeAccessError =
      error instanceof FreeAccessError
        ? error
        : new FreeAccessError(error.message, {
            context: { originalError: error.toString() },
          });

    return { hasError: true, error: freeAccessError };
  }

  override componentDidCatch(error: Error) {
    this.props.onError?.(error);
    console.error('[ErrorBoundary] Caught error:', error);
  }

  override render() {
    if (this.state.hasError && this.state.error) {
      return (
        this.props.fallback || (
          <div className="p-4">
            <ErrorDisplay error={this.state.error} compact={false} />
          </div>
        )
      );
    }

    return this.props.children;
  }
}
