# Free-Access Mode: Robust Error Handling Implementation Guide

## Quick Start

### 1. Core Error Handling (lib/free-access-errors.ts)

Provides:
- Custom error classes with severity levels
- Error classification and categorization
- Automatic retry logic with exponential backoff
- Error logging and monitoring hooks
- Graceful degradation strategies

```typescript
import {
  FreeAccessError,
  ValidationError,
  wrapError,
  withRetry,
} from '@/lib/free-access-errors';

// Create typed errors
throw new ValidationError('Invalid input', { field: 'workspaceId' });

// Wrap unknown errors
const wrapped = wrapError(someError, ErrorCategory.DATABASE, { context });

// Retry with backoff
const result = await withRetry(
  () => someAsyncOperation(),
  'operationName',
  DEFAULT_RETRY_CONFIG,
);
```

### 2. API Handler Utilities (lib/free-access-api.ts)

Provides:
- Type-safe form validation
- Request/response envelope
- Auth helpers (requireAuth, requireAdmin)
- Resource existence checking

```typescript
import {
  handleApiRequest,
  FormValidator,
  requireAdmin,
} from '@/lib/free-access-api';

export async function POST(request: Request) {
  return handleApiRequest(
    request,
    async (req, body) => {
      // Your handler logic
    },
    {
      requireAdmin: true,
      validateInput: (body) => {
        const v = new FormValidator();
        v.required('id', body.id).isoDate('date', body.date);
        v.throwIfInvalid();
      },
    },
  );
}
```

### 3. User-Friendly Error UI (components/free-access/ErrorDisplay.tsx)

Provides:
- ErrorDisplay component with recovery suggestions
- ErrorToast for temporary notifications
- ErrorBoundary for React error catching
- Severity-based styling and icons

```tsx
import { ErrorDisplay, ErrorToast, ErrorBoundary } from '@/components/free-access/ErrorDisplay';

// Main display
<ErrorDisplay
  error={error}
  onDismiss={() => setError(null)}
  onRetry={retryFn}
  isRetrying={isLoading}
/>

// Temporary toast
<ErrorToast error={error} onDismiss={() => setError(null)} />

// Catch React errors
<ErrorBoundary onError={handleError}>
  <MyComponent />
</ErrorBoundary>
```

## Implementation Checklist

### Phase 1: Foundation (Core Error System)

- [x] `lib/free-access-errors.ts` - Error classes and retry logic
- [x] `lib/free-access-api.ts` - API handler utilities
- [x] `components/free-access/ErrorDisplay.tsx` - UI components
- [ ] Setup monitoring hooks in your backend
- [ ] Configure error logging service (Sentry, Rollbar, etc.)

```typescript
// In your app initialization:
import { setErrorMonitoringHooks } from '@/lib/free-access-errors';

setErrorMonitoringHooks({
  onError: async (entry) => {
    // Send to Sentry, Rollbar, etc.
    await captureError(entry.error);
  },
});
```

### Phase 2: API Routes Migration

- [x] Example: `app/api/admin/free-access/enable-improved/route.ts`
- [ ] Migrate existing routes:
  - `app/api/admin/free-access/enable/route.ts`
  - `app/api/admin/free-access/disable/route.ts`
  - `app/api/admin/free-access/bulk/route.ts`
  - `app/api/admin/free-access/status/route.ts`

```typescript
// Before: Manual error handling
export async function POST(req: Request) {
  try {
    // ...manual validation
    if (!body.workspaceId) {
      return Response.json({ error: 'Missing field' }, { status: 400 });
    }
    // ...
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Unknown error' }, { status: 500 });
  }
}

// After: Using new system
export async function POST(request: Request) {
  return handleApiRequest(
    request,
    async (req, body) => {
      const validator = new FormValidator();
      validator.required('workspaceId', body.workspaceId);
      validator.throwIfInvalid();

      // Handler logic
      return { success: true };
    },
    { requireAdmin: true, logging: true },
  );
}
```

### Phase 3: Frontend UI Migration

- [x] `components/admin/FreeAccessModeAdminUI-Improved.tsx`
- [ ] Update existing component to use ErrorDisplay
- [ ] Add error logging in event handlers
- [ ] Add retry logic to mutation functions

```tsx
// Before
const [error, setError] = useState<string | null>(null);

try {
  await onToggleFreeAccess(id, enabled);
} catch (err) {
  setError(err instanceof Error ? err.message : 'Unknown error');
}

// After
const [error, setError] = useState<FreeAccessError | null>(null);

try {
  await withRetry(
    () => onToggleFreeAccess(id, enabled),
    'toggleFreeAccess',
  );
} catch (err) {
  setError(wrapError(err));
}
```

### Phase 4: Monitoring Setup

- [ ] Configure Sentry integration
- [ ] Set up error dashboards
- [ ] Create alerting rules
- [ ] Document runbook for operators

## File Structure

```
apps/web/
├── lib/
│   ├── free-access-errors.ts         # Error classes & retry logic
│   ├── free-access-api.ts            # API handler utilities
│   └── free-access-mode.ts           # Core free-access logic
├── components/
│   └── free-access/
│       └── ErrorDisplay.tsx          # UI components
├── app/api/admin/free-access/
│   ├── enable-improved/route.ts      # Example improved route
│   ├── enable/route.ts               # (legacy)
│   ├── disable/route.ts              # (legacy)
│   └── ...
└── components/admin/
    ├── FreeAccessModeAdminUI.tsx     # (legacy)
    └── FreeAccessModeAdminUI-Improved.tsx  # Enhanced version
docs/
├── FREE_ACCESS_ERROR_HANDLING.md     # Error handling guide
├── FREE_ACCESS_IMPLEMENTATION_GUIDE.md  # This file
└── ...
```

## Common Patterns

### Pattern 1: Safe API Call with Retry

```typescript
async function enableFreeAccessSafely(id: string, expiresAt: string) {
  try {
    const result = await withRetry(
      () => fetch('/api/admin/free-access/enable', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: id, expiresAt }),
      }),
      'enableFreeAccess',
      { maxAttempts: 3 },
    );

    if (!result.ok) {
      throw new FreeAccessError('API request failed', {
        statusCode: result.status,
      });
    }

    return await result.json();
  } catch (error) {
    const err = wrapError(error);
    await logError(err, { workspaceId: id });
    throw err;
  }
}
```

### Pattern 2: Form Submission with Validation

```tsx
async function handleSubmit(formData: FormData) {
  const validator = new FormValidator();
  validator
    .required('email', formData.email)
    .email('email', formData.email)
    .required('workspaceId', formData.workspaceId)
    .minLength('workspaceId', formData.workspaceId, 1);

  try {
    validator.throwIfInvalid();

    const response = await fetch('/api/admin/action', {
      method: 'POST',
      body: JSON.stringify(formData),
    });

    const data = await response.json();

    if (!data.success) {
      throw new FreeAccessError(data.error.message, {
        category: data.error.category,
        retryable: data.error.retryable,
      });
    }

    return data.data;
  } catch (error) {
    const err = wrapError(error);
    setError(err);
  }
}
```

### Pattern 3: Graceful Degradation

```typescript
async function getFreeAccessStatus(workspaceId: string) {
  try {
    return await checkFreeAccessMode(workspaceId);
  } catch (error) {
    const err = wrapError(error);

    // Fall back to cached value if network/database error
    if (
      err.category === ErrorCategory.DATABASE ||
      err.category === ErrorCategory.NETWORK
    ) {
      return getCachedStatus(workspaceId) ?? false;
    }

    throw err;
  }
}
```

### Pattern 4: React Component with Error Handling

```tsx
function MyComponent() {
  const [error, setError] = useState<FreeAccessError | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await withRetry(
        () => someAsyncOperation(),
        'myOperation',
      );
      // Success handling
    } catch (err) {
      if (err instanceof FreeAccessError) {
        setError(err);
      } else {
        setError(wrapError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <ErrorDisplay
        error={error}
        onDismiss={() => setError(null)}
        onRetry={handleAction}
        isRetrying={loading}
      />
      <button onClick={handleAction} disabled={loading}>
        {loading ? 'Loading...' : 'Click me'}
      </button>
    </div>
  );
}
```

## Testing

### Unit Tests for Errors

```typescript
import { describe, it, expect } from '@jest/globals';
import { ValidationError, withRetry, calculateBackoffDelay } from '@/lib/free-access-errors';

describe('free-access-errors', () => {
  it('creates ValidationError with correct properties', () => {
    const error = new ValidationError('Test error', { field: 'email' });

    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.severity).toBe(ErrorSeverity.LOW);
    expect(error.retryable).toBe(false);
    expect(error.statusCode).toBe(400);
  });

  it('calculates exponential backoff correctly', () => {
    const delay1 = calculateBackoffDelay(1);
    const delay2 = calculateBackoffDelay(2);
    const delay3 = calculateBackoffDelay(3);

    expect(delay2).toBeGreaterThan(delay1);
    expect(delay3).toBeGreaterThan(delay2);
  });

  it('retries on transient errors', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) throw new Error('Transient error');
      return 'success';
    };

    const result = await withRetry(operation, 'test');
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

### Integration Tests for API Routes

```typescript
describe('POST /api/admin/free-access/enable', () => {
  it('validates required fields', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/free-access/enable', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: 'test-123' }),
      }),
    );

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.category).toBe('validation');
  });

  it('succeeds with valid input', async () => {
    const response = await POST(
      new Request('http://localhost/api/admin/free-access/enable', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'test-123',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      }),
    );

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.workspaceId).toBe('test-123');
  });
});
```

## Migration Roadmap

### Week 1: Foundation
- [ ] Add error system files (errors.ts, api.ts, ErrorDisplay.tsx)
- [ ] Set up monitoring hooks
- [ ] Create example API route (enable-improved)
- [ ] Write documentation

### Week 2: API Routes
- [ ] Migrate all admin free-access routes
- [ ] Add comprehensive tests
- [ ] Update API documentation
- [ ] Staging deployment

### Week 3: Frontend
- [ ] Update admin UI component
- [ ] Add retry logic to API calls
- [ ] Test error recovery flows
- [ ] Staging testing

### Week 4: Monitoring & Polish
- [ ] Enable error monitoring
- [ ] Create dashboards
- [ ] Write runbooks
- [ ] Production deployment

## Troubleshooting

### Problem: Retry loop not working

**Solution:**
```typescript
// Make sure error is marked as retryable
throw new DatabaseError('Connection timeout', 'query', { retryable: true });

// Check retry config
const result = await withRetry(op, 'name', {
  maxAttempts: 5,
  initialDelayMs: 100,
});
```

### Problem: Error message not showing in UI

**Solution:**
```tsx
// Use userMessage for display, not message
<div>{error.userMessage}</div> // ✓ Good

// Avoid
<div>{error.message}</div> // ✗ Shows technical message
```

### Problem: Form validation not working

**Solution:**
```typescript
// Call throwIfInvalid() after validating all fields
validator.required('field1', data.field1);
validator.required('field2', data.field2);
validator.throwIfInvalid(); // ✓ After all checks

// Avoid
validator.required('field1', data.field1);
validator.throwIfInvalid(); // ✗ Throws on first error
validator.required('field2', data.field2);
```

## Performance Considerations

### Caching

- Free-access checks are cached for 5 minutes
- Clear cache after mutations: `clearFreeAccessCache(workspaceId)`
- Configure TTL as needed

### Database Queries

- Use indexed queries for free-access status
- Batch bulk operations
- Consider read replicas for frequent checks

### Retry Tuning

```typescript
// For fast operations (< 100ms)
{ maxAttempts: 3, initialDelayMs: 50, maxDelayMs: 1000 }

// For slow operations (> 1s)
{ maxAttempts: 5, initialDelayMs: 500, maxDelayMs: 10000 }

// For critical operations
{ maxAttempts: 10, initialDelayMs: 100, maxDelayMs: 30000 }
```

## See Also

- [Free-Access Error Handling Reference](./FREE_ACCESS_ERROR_HANDLING.md)
- [API Routes Documentation](../API.md)
- [Monitoring Setup Guide](../MONITORING.md)
