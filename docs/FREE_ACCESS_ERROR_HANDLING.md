# Free-Access Mode: Error Handling & Recovery Guide

## Overview

This document describes the robust error handling system for free-access mode operations. The system provides:

- **Comprehensive error classification** with severity levels
- **User-friendly error messages** with recovery suggestions
- **Automatic retry logic** with exponential backoff
- **Graceful degradation** strategies
- **Error monitoring** and logging hooks
- **Request tracking** and tracing

## Architecture

### Error Classification System

All errors in free-access mode are instances of `FreeAccessError` with the following properties:

#### Severity Levels

| Severity | Meaning | HTTP Status | User Action |
|----------|---------|------------|-------------|
| **LOW** | Input validation error | 400 | User corrects input |
| **MEDIUM** | Operational/retriable error | 500, 504, 429 | System retries automatically |
| **HIGH** | System/network failure | 503 | Wait and retry manually |
| **CRITICAL** | Data integrity risk | 500+ | Contact support immediately |

#### Error Categories

| Category | Cause | Retryable | Recovery |
|----------|-------|-----------|----------|
| `validation` | Input validation failed | No | Check input format |
| `authentication` | Auth/permission issue | No | Verify credentials |
| `not_found` | Resource doesn't exist | No | Verify resource ID |
| `database` | Database operation failed | Yes | Automatic retry with backoff |
| `timeout` | Operation timed out | Yes | Automatic retry |
| `rate_limit` | Rate limit exceeded | Yes | Wait and retry |
| `network` | Connection error | Yes | Automatic retry |
| `unknown` | Unknown error | Yes | Retry or contact support |

## Error Response Format

All error responses follow a consistent envelope structure:

```json
{
  "success": false,
  "error": {
    "message": "Internal error message",
    "category": "database",
    "retryable": true,
    "userMessage": "A database error occurred. Please try again in a moment."
  },
  "timestamp": "2026-09-03T12:00:00Z",
  "requestId": "1234567890-abc123def"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for errors |
| `error.message` | string | Technical error message (log purposes) |
| `error.category` | string | Error classification for routing |
| `error.retryable` | boolean | Whether automatic retry is safe |
| `error.userMessage` | string | User-friendly message shown in UI |
| `timestamp` | ISO 8601 | When error occurred |
| `requestId` | string | Unique request identifier for tracing |

## Retry Logic

### Automatic Retry Configuration

The system implements exponential backoff with jitter:

```typescript
interface RetryConfig {
  maxAttempts: number;       // Max number of attempts (default: 3)
  initialDelayMs: number;    // First delay in ms (default: 100)
  maxDelayMs: number;        // Cap on delay (default: 5000)
  backoffMultiplier: number; // Exponential growth factor (default: 2)
  jitterFactor: number;      // Jitter as % of delay (default: 0.1)
}
```

### Delay Calculation

For each retry attempt, delay is calculated as:

```
delay = min(initialDelayMs * (backoffMultiplier ^ attempt), maxDelayMs)
jitter = delay * jitterFactor * random(-0.5, 0.5)
finalDelay = max(0, delay + jitter)
```

### Example Retry Timeline

For default config with 3 attempts:

| Attempt | Base Delay | With Jitter | Total Time |
|---------|-----------|------------|-----------|
| 1 | 100ms | 90-110ms | 90-110ms |
| 2 | 200ms | 180-220ms | 270-330ms |
| 3 | 400ms | 360-440ms | 630-770ms |

### Non-Retryable Errors

The following errors will NOT trigger automatic retries:

- `validation` errors (user input issue)
- `authentication` errors (permission denied)
- `not_found` errors (resource doesn't exist)

## Error UI Components

### ErrorDisplay Component

Main error display for important notifications:

```tsx
import { ErrorDisplay } from '@/components/free-access/ErrorDisplay';
import { FreeAccessError } from '@/lib/free-access-errors';

export function MyComponent() {
  const [error, setError] = useState<FreeAccessError | null>(null);

  return (
    <ErrorDisplay
      error={error}
      onDismiss={() => setError(null)}
      onRetry={() => retryOperation()}
      isRetrying={isLoading}
      showDetails={true}
      compact={false}
      autoCloseMs={5000}
    />
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `error` | FreeAccessError \| null | - | Error to display or null to hide |
| `onDismiss` | function | - | Called when user dismisses error |
| `onRetry` | function | - | Called when user clicks "Try Again" |
| `isRetrying` | boolean | false | Show loading state during retry |
| `showDetails` | boolean | false | Show/hide detailed error info |
| `compact` | boolean | false | Use compact layout |
| `autoCloseMs` | number | - | Auto-close after ms (optional) |

### ErrorToast Component

For temporary notifications:

```tsx
import { ErrorToast } from '@/components/free-access/ErrorDisplay';

return (
  <ErrorToast
    error={error}
    onDismiss={() => setError(null)}
    duration={5000}
  />
);
```

### ErrorBoundary Component

Catch React errors:

```tsx
import { ErrorBoundary } from '@/components/free-access/ErrorDisplay';

<ErrorBoundary onError={(error) => console.log(error)}>
  <MyComponent />
</ErrorBoundary>
```

## API Error Handling

### Using the Enhanced Handler

```typescript
import { handleApiRequest, FormValidator } from '@/lib/free-access-api';

export async function POST(request: Request) {
  return handleApiRequest(
    request,
    async (req, body) => {
      // Your handler logic
      return { success: true };
    },
    {
      requireAuth: true,
      requireAdmin: true,
      validateInput: (body) => {
        const validator = new FormValidator();
        validator.required('workspaceId', body.workspaceId);
        validator.isoDate('expiresAt', body.expiresAt);
        validator.throwIfInvalid();
      },
      retryConfig: {
        maxAttempts: 5,
        initialDelayMs: 100,
      },
      logging: true,
    },
  );
}
```

### Form Validator

Type-safe input validation:

```typescript
const validator = new FormValidator();

validator
  .required('name', body.name)
  .minLength('name', body.name, 1)
  .maxLength('name', body.name, 100)
  .email('email', body.email)
  .isoDate('createdAt', body.createdAt)
  .futureDate('expiresAt', body.expiresAt)
  .pattern('slug', body.slug, /^[a-z0-9-]+$/)
  .throwIfInvalid();
```

### Helper Functions

#### `requireAuth(request, validateUser)`

Verify user authentication:

```typescript
const user = await requireAuth(request, currentUser);
console.log(user.role); // e.g., 'admin'
```

Throws `AuthenticationError` if not authenticated.

#### `requireAdmin(request, validateUser)`

Verify admin access:

```typescript
await requireAdmin(request, currentUser);
// Throws AuthenticationError if not admin
```

#### `requireResourceExists(id, getter, type)`

Verify resource exists:

```typescript
const workspace = await requireResourceExists(
  id,
  getWorkspace,
  'Workspace'
);
```

Throws `NotFoundError` if not found.

## Error Monitoring & Logging

### Setting Up Monitoring Hooks

```typescript
import { setErrorMonitoringHooks } from '@/lib/free-access-errors';

setErrorMonitoringHooks({
  onError: async (entry) => {
    // Send to error tracking service (e.g., Sentry)
    await captureException(entry.error, { tags: entry.context });
  },

  onRetry: async (entry) => {
    // Track retry attempts
    console.log(
      `Retrying ${entry.context.endpoint} at ${entry.nextRetryAt}`
    );
  },

  onSuccess: async (entry) => {
    // Track successful retries
    console.log(`Operation succeeded after ${entry.attempt} attempts`);
  },
});
```

### Error Log Entry Structure

```typescript
interface ErrorLogEntry {
  id: string;                    // Unique error ID
  error: FreeAccessError;        // The error object
  context: {
    userId?: string;
    workspaceId?: string;
    endpoint?: string;
    method?: string;
    userAgent?: string;
  };
  attempt?: number;              // Retry attempt number
  nextRetryAt?: Date;            // When next retry will occur
}
```

## Graceful Degradation

### Strategy-Based Fallbacks

When certain errors occur, the system can gracefully degrade:

```typescript
import { applyDegradation } from '@/lib/free-access-errors';

try {
  return await fetchFreeAccessStatus(workspaceId);
} catch (error) {
  // Fall back to cached status if database/network error
  return applyDegradation(error, cachedStatus, [
    {
      name: 'cache-fallback',
      condition: (err) =>
        err.category === ErrorCategory.DATABASE ||
        err.category === ErrorCategory.NETWORK,
      handler: (fallback) => fallback,
    },
  ]);
}
```

### Custom Degradation Strategies

Define custom strategies for your use case:

```typescript
const customStrategies = [
  {
    name: 'use-default-config',
    condition: (err) => err.severity === ErrorSeverity.HIGH,
    handler: (fallback) => ({
      ...fallback,
      freeAccessUntil: null,
    }),
  },
];
```

## Best Practices

### 1. Always Use Type-Safe Validators

```typescript
// Good
const validator = new FormValidator();
validator.required('id', body.id).isoDate('date', body.date);
validator.throwIfInvalid();

// Avoid
if (!body.id) throw new Error('Missing id');
```

### 2. Provide Context in Errors

```typescript
// Good
throw new ValidationError('Workspace not found', {
  workspaceId: id,
  endpoint: '/api/admin/free-access/enable',
  userId: user.id,
});

// Avoid
throw new ValidationError('Not found');
```

### 3. Use withRetry for Remote Operations

```typescript
// Good
const result = await withRetry(
  () => enableFreeAccessMode(id, expiresAt),
  'enableFreeAccessMode',
);

// Avoid
const result = await enableFreeAccessMode(id, expiresAt);
```

### 4. Display User-Friendly Messages

```typescript
// Good - shown to user
error.userMessage
// -> "A database error occurred. Please try again in a moment."

// Avoid showing to user
error.message
// -> "ECONNREFUSED: Connection refused at 127.0.0.1:5432"
```

### 5. Handle Retryable Errors in UI

```tsx
const [error, setError] = useState<FreeAccessError | null>(null);

<ErrorDisplay
  error={error}
  onRetry={() => {
    if (error?.retryable) {
      retryOperation();
    }
  }}
  isRetrying={isLoading}
/>
```

## Troubleshooting

### Issue: "Too many retry attempts"

**Cause:** Retryable error after max attempts exceeded

**Solution:** 
- Check network connectivity
- Verify database is running
- Increase `maxAttempts` in retry config if temporarily overloaded
- Contact support if persistent

### Issue: "Workspace not found"

**Cause:** Resource doesn't exist or was deleted

**Solution:**
- Verify the workspace ID is correct
- Check that the workspace exists in the database
- Refresh the page to see latest data

### Issue: "Rate limit exceeded"

**Cause:** Too many requests in short time

**Solution:**
- Wait the specified time from response header
- Reduce request frequency
- Use bulk endpoints instead of repeated single requests

### Issue: "Invalid expiresAt"

**Cause:** Date format issue

**Solution:**
- Use ISO 8601 format: `2026-10-03T12:00:00Z`
- Ensure date is in the future
- Check timezone (must be valid with your server's timezone)

## Monitoring Dashboard Setup

### Key Metrics to Track

1. **Error Rate:** Errors per request by category
2. **Retry Success Rate:** % of errors that succeed on retry
3. **Mean Time to Recovery:** Avg time to recover from errors
4. **Error Distribution:** Breakdown by category and severity
5. **Request Tracing:** Track request flow using requestId

### Recommended Integrations

- **Error Tracking:** Sentry, Rollbar, or similar
- **Monitoring:** Datadog, New Relic, or similar
- **Logging:** ELK Stack, Loki, or similar
- **Alerting:** PagerDuty, Opsgenie for critical errors

## See Also

- [Free-Access Mode Overview](./FREE_ACCESS_MODE.md)
- [API Routes Reference](../API.md)
- [Deployment Guide](../DEPLOYMENT.md)
