# Free-Access Error Handling: Quick Reference

## TL;DR

Quick snippets for common tasks.

## Error Classes

```typescript
import { ValidationError, AuthenticationError, NotFoundError, DatabaseError } from '@/lib/free-access-errors';

// Throw validation error
throw new ValidationError('Email is invalid', { field: 'email' });

// Throw auth error
throw new AuthenticationError('Admin access required');

// Throw not found error
throw new NotFoundError('Workspace', workspaceId);

// Throw database error (retryable)
throw new DatabaseError('Connection failed', 'query');
```

## Retry Operations

```typescript
import { withRetry } from '@/lib/free-access-errors';

// Basic retry (default config: 3 attempts)
const result = await withRetry(
  () => someAsyncOperation(),
  'operationName',
);

// Custom retry config
const result = await withRetry(
  () => someAsyncOperation(),
  'operationName',
  {
    maxAttempts: 5,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitterFactor: 0.1,
  },
);
```

## Form Validation

```typescript
import { FormValidator } from '@/lib/free-access-api';

const validator = new FormValidator();

// Validate required field
validator.required('email', body.email);

// Validate email format
validator.email('email', body.email);

// Validate ISO date
validator.isoDate('expiresAt', body.expiresAt);

// Validate future date (for expiry)
validator.futureDate('expiresAt', body.expiresAt);

// Validate string length
validator.minLength('name', body.name, 1);
validator.maxLength('name', body.name, 100);

// Validate custom pattern
validator.pattern('slug', body.slug, /^[a-z0-9-]+$/);

// Throw if any validation failed
validator.throwIfInvalid();

// Or check manually
if (!validator.isValid()) {
  const errors = validator.getErrors();
  // Handle errors
}
```

## API Route Handler

```typescript
import { handleApiRequest } from '@/lib/free-access-api';

export async function POST(request: Request) {
  return handleApiRequest(
    request,
    async (req, body) => {
      // Your handler logic here
      return { success: true };
    },
    {
      requireAdmin: true,
      validateInput: (body) => {
        const v = new FormValidator();
        v.required('id', body.id);
        v.throwIfInvalid();
      },
      logging: true,
    },
  );
}
```

## React Components

```tsx
import { ErrorDisplay, ErrorToast, ErrorBoundary } from '@/components/free-access/ErrorDisplay';
import { FreeAccessError } from '@/lib/free-access-errors';

// Display error
const [error, setError] = useState<FreeAccessError | null>(null);

<ErrorDisplay
  error={error}
  onDismiss={() => setError(null)}
  onRetry={handleRetry}
  isRetrying={loading}
/>

// Show temporary toast
<ErrorToast error={error} onDismiss={() => setError(null)} duration={5000} />

// Wrap component to catch errors
<ErrorBoundary onError={(error) => console.error(error)}>
  <MyComponent />
</ErrorBoundary>
```

## Wrap Unknown Errors

```typescript
import { wrapError } from '@/lib/free-access-errors';

try {
  // Some operation
} catch (error) {
  const wrapped = wrapError(error, 'database', { operation: 'query' });
  throw wrapped; // Now it's a FreeAccessError
}
```

## Log Errors

```typescript
import { logError } from '@/lib/free-access-errors';

try {
  // Operation
} catch (error) {
  const err = wrapError(error);
  await logError(err, { workspaceId: 'xyz', userId: 'abc' });
}
```

## Set Up Monitoring

```typescript
import { setErrorMonitoringHooks } from '@/lib/free-access-errors';

// In your app initialization:
setErrorMonitoringHooks({
  onError: async (entry) => {
    // Send to Sentry, Rollbar, etc.
    await sendToErrorTracking(entry);
  },
  onRetry: async (entry) => {
    // Track retry attempts
    console.log(`Retry #${entry.attempt} at ${entry.nextRetryAt}`);
  },
});
```

## Auth Helpers

```typescript
import { requireAuth, requireAdmin, requireResourceExists } from '@/lib/free-access-api';

// Check user is authenticated
const user = await requireAuth(request, validateUser);

// Check user is admin (throws AuthenticationError if not)
await requireAdmin(request, validateUser);

// Check resource exists (throws NotFoundError if not)
const workspace = await requireResourceExists(
  workspaceId,
  getWorkspace,
  'Workspace',
);
```

## Error Response Format

```typescript
// Success (200)
{
  "success": true,
  "data": { /* your data */ },
  "timestamp": "2026-09-03T12:00:00Z",
  "requestId": "1234567890-abc123"
}

// Error (400, 500, etc.)
{
  "success": false,
  "error": {
    "message": "Technical error message",
    "category": "validation",
    "retryable": false,
    "userMessage": "Invalid input: field required"
  },
  "timestamp": "2026-09-03T12:00:00Z",
  "requestId": "1234567890-abc123"
}
```

## Error Categories

| Category | Retryable | Status | Example |
|----------|-----------|--------|---------|
| `validation` | No | 400 | Missing required field |
| `authentication` | No | 403 | Not admin |
| `not_found` | No | 404 | Workspace doesn't exist |
| `database` | Yes | 500 | Connection timeout |
| `timeout` | Yes | 504 | Operation took too long |
| `rate_limit` | Yes | 429 | Too many requests |
| `network` | Yes | 503 | Network error |
| `unknown` | Yes | 500 | Unknown error |

## Severity Levels

| Level | Color | When to Use |
|-------|-------|------------|
| `LOW` | Blue | User input invalid |
| `MEDIUM` | Amber | Temporary issue, will retry |
| `HIGH` | Red | System failure |
| `CRITICAL` | Dark Red | Data integrity risk |

## Common Patterns

### Pattern: Retry API Call
```typescript
try {
  const result = await withRetry(
    () => fetch('/api/endpoint', { method: 'POST', body: JSON.stringify(data) }),
    'apiCall',
  );
} catch (error) {
  const err = wrapError(error);
  setError(err);
}
```

### Pattern: Validate and Update
```typescript
const validator = new FormValidator();
validator.required('id', body.id).isoDate('date', body.date);
validator.throwIfInvalid();

const result = await withRetry(
  () => updateDatabase(body.id, body.date),
  'updateDatabase',
);
```

### Pattern: React Component
```tsx
const [error, setError] = useState<FreeAccessError | null>(null);
const [loading, setLoading] = useState(false);

const handleSubmit = async () => {
  setLoading(true);
  setError(null);
  try {
    const result = await withRetry(() => myOperation(), 'op');
  } catch (err) {
    setError(wrapError(err));
  } finally {
    setLoading(false);
  }
};

return <ErrorDisplay error={error} onRetry={handleSubmit} isRetrying={loading} />;
```

## Troubleshooting

**Error not retrying?**
- Check if error.retryable is true
- Use withRetry() wrapper
- Check error category (validation/auth errors won't retry)

**Message not showing?**
- Use error.userMessage (not error.message)
- Check if error is null

**Validation not working?**
- Call throwIfInvalid() after all validators
- Make sure validator is new FormValidator()

**Component not catching errors?**
- Use ErrorBoundary wrapper
- Make sure error is thrown, not returned

## Full Documentation

- Error Handling Reference: `docs/FREE_ACCESS_ERROR_HANDLING.md`
- Implementation Guide: `docs/FREE_ACCESS_IMPLEMENTATION_GUIDE.md`
- Summary: `docs/FREE_ACCESS_ERROR_HANDLING_SUMMARY.md`

## Support

Questions? Check the docs or open an issue.
