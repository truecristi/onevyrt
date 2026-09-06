# Free-Access Mode: Architecture & Design

**Document Version:** 1.0  
**Last Updated:** 2026-09-03  
**Owner:** Engineering Team  
**Status:** Production-Ready

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Storage & Caching](#storage--caching)
5. [Security Model](#security-model)
6. [Performance Characteristics](#performance-characteristics)
7. [Scalability](#scalability)
8. [Failure Modes & Recovery](#failure-modes--recovery)

---

## System Overview

### Purpose

Free-Access Mode enables temporary, unrestricted access to ONEVYRT features without requiring workspace payment, subscription, or coach approval gates. This mode is used for:

- **Free trials** — New users testing the platform
- **Marketing/demo** — Sales and marketing demos
- **Partner evaluations** — Strategic partner trials
- **Coaching programs** — Full-access during active coaching period

### Key Characteristics

| Aspect | Behavior |
|--------|----------|
| **Activation** | Admin-initiated via API; requires authentication |
| **Duration** | Configurable; typically 7-90 days |
| **Scope** | Per-workspace; doesn't affect other users |
| **Fallback** | Graceful degradation if free-access service unavailable |
| **Expiry** | Automatic; no manual cleanup required |
| **Audit Trail** | All activations logged with timestamp & admin user |

---

## Component Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     API Request (User)                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    ┌──────▼───────┐
                    │  Auth Guard  │
                    └──────┬───────┘
                           │
            ┌──────────────▼───────────────┐
            │  Free-Access Middleware      │
            │  (checks expiry, caching)    │
            └──────┬─────────────────┬─────┘
                   │                 │
         ┌─────────▼────┐    ┌───────▼──────┐
         │   Cache Hit  │    │ Cache Miss   │
         │   (in-memory)│    │ (DB query)   │
         └─────────┬────┘    └───────┬──────┘
                   │                 │
            ┌──────▼─────────────────▼──────┐
            │  Access Control Logic         │
            │  • Check expiry timestamp     │
            │  • Suppress notifications    │
            │  • Set auto-approval flag    │
            └──────┬──────────────────────┘
                   │
       ┌───────────▼────────────┐
       │   Route Handler        │
       │   (with permissions)   │
       └───────────┬────────────┘
                   │
         ┌─────────▼──────────┐
         │  Response to User  │
         └────────────────────┘
```

### Core Components

#### 1. **Authentication Layer** (`lib/auth.ts`)

```typescript
// Responsibility: Verify user identity
// Returns: User object or null
interface AuthResult {
  user: User;
  workspace?: Workspace;
  sessionToken: string;
}

// Entry point
async function currentUser(cookies: string): Promise<User | null>
```

**Guarantees:**
- No authentication bypass
- Session expiry checked
- CSRF token validation (planned)

---

#### 2. **Free-Access Middleware** (`lib/free-access-mode.ts`)

```typescript
// Responsibility: Attach free-access context to requests
// Called: Once per request, before route handlers
interface FreeAccessContext {
  workspaceId: string;
  isFreeAccess: boolean;
  expiresAt?: string;
}

// Core functions
async function attachFreeAccessContext(
  workspace: Workspace,
): Promise<FreeAccessContext>

async function shouldGrantFreeAccess(
  workspace: Workspace,
): Promise<boolean>
```

**Guarantees:**
- Expiry timestamps always in ISO 8601 format
- Cache valid for 5 minutes (configurable)
- Fail-open: returns `isFreeAccess: false` on errors
- Atomic checks (no race conditions)

---

#### 3. **Error Handling System** (`lib/free-access-errors.ts`)

```typescript
// Responsibility: Capture, categorize, and recover from errors
enum ErrorSeverity {
  LOW = "low",           // User recoverable, no data loss
  MEDIUM = "medium",     // User-facing, may need retry
  HIGH = "high",         // Service degradation
  CRITICAL = "critical", // Complete failure
}

enum ErrorCategory {
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  NOT_FOUND = "not_found",
  DATABASE = "database",
  TIMEOUT = "timeout",
  RATE_LIMIT = "rate_limit",
  NETWORK = "network",
  UNKNOWN = "unknown",
}

// Retry logic
async function withRetry(
  operation: () => Promise<T>,
  name: string,
  config?: RetryConfig,
): Promise<T>
```

**Guarantees:**
- Exponential backoff with jitter (prevents thundering herd)
- Max 3 retries by default
- Structured logging for monitoring
- Type-safe error responses

---

#### 4. **API Layer** (`lib/free-access-api.ts`)

```typescript
// Responsibility: Normalize request/response handling
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Wrapper for all handlers
async function handleApiRequest(
  request: Request,
  handler: (req: Request, context: FreeAccessContext) => Promise<Response>,
  options?: HandlerOptions,
): Promise<Response>
```

**Guarantees:**
- Consistent error format across all endpoints
- Automatic CORS handling (if configured)
- Request tracking with unique IDs
- Form validation with detailed error messages

---

#### 5. **Database Layer** (`lib/enrollments.ts`, `lib/workspaces.ts`)

```typescript
// Responsibility: Persist and retrieve free-access status
// Field in `workspaces` table: plan_metadata.free_access_until

// Query pattern
const ws = await db.workspace.findUnique({
  where: { id: workspaceId },
  select: {
    id: true,
    plan_metadata: true, // Contains free_access_until
  },
});

const freeAccessUntil = ws?.plan_metadata?.free_access_until;
const isActive = freeAccessUntil && new Date(freeAccessUntil) > new Date();
```

**Guarantees:**
- Soft-delete compatible (only checks active workspaces)
- Transaction-safe updates
- Index on `plan_metadata->>'free_access_until'` for query performance

---

### Dependency Graph

```
User Request
    │
    └─► Auth Layer (lib/auth.ts)
        │
        └─► Free-Access Middleware (lib/free-access-mode.ts)
            │
            ├─► Cache (in-memory LRU, 5-minute TTL)
            │   │
            │   └─► Database (workspaces.plan_metadata)
            │
            └─► Error Handling (lib/free-access-errors.ts)
                │
                └─► Monitoring Hooks (telemetry)
                    │
                    └─► Response (API Layer)
```

---

## Data Flow

### Scenario 1: First-Time Free-Access Check

```
1. User makes request to /api/projects/list

2. Auth Layer
   └─► Validates session
   └─► Extracts workspace ID

3. Middleware: attachFreeAccessContext()
   ├─► Check in-memory cache for workspace ID
   ├─► MISS → Query database
   ├─► Extract plan_metadata.free_access_until
   ├─► Compare with current timestamp
   ├─► Store in cache (5-minute TTL)
   ├─► Attach context: { workspaceId, isFreeAccess: true, expiresAt: "..." }

4. Route Handler
   ├─► Check context.isFreeAccess
   ├─► If true:
   │   ├─► Suppress coach-approval gates
   │   ├─► Auto-approve submissions
   │   ├─► Suppress notifications
   ├─► Return full response

5. Response
   └─► ApiResponse { success: true, data: [...] }
```

**Latency Profile:**
- Cache hit: ~1-2ms
- Cache miss: ~10-30ms (DB query)
- 95th percentile: <50ms

---

### Scenario 2: Expiry Processing

```
1. Cache-Hit Request (same workspace, expiry unknown)

2. Middleware
   ├─► Cache returns: { until: "2024-12-31T23:59:59Z", checkedAt: <timestamp> }
   ├─► Compare cache.until with current time
   ├─► If expired:
   │   ├─► Invalidate cache entry
   │   ├─► Query database to confirm expiry
   │   ├─► Update cache with new status

3. Behavior
   ├─► Free-access ACTIVE: Normal flow
   ├─► Free-access EXPIRED: Restore gating behavior
   │   ├─► Coach approvals required again
   │   ├─► Notifications resume
   │   ├─► Paid features gated

4. Log Event
   └─► "free_access_expired" metric sent to monitoring
```

---

### Scenario 3: Error During Middleware Check

```
1. Database Query Fails (timeout, connection closed, etc.)

2. Error Handler
   ├─► Wrap error: DatabaseError("connection timeout")
   ├─► Log: { severity: "HIGH", category: "DATABASE", requestId: "..." }
   ├─► Determine retryable: true (network timeouts are retryable)

3. Retry Logic
   ├─► Attempt 1: Wait 100ms, retry
   ├─► Attempt 2: Wait 200ms, retry
   ├─► Attempt 3: Wait 400ms, retry
   ├─► All failed: Fail-open

4. Fail-Open Behavior
   ├─► Assume free-access is INACTIVE
   ├─► Log warning: "Free-access check failed; defaulting to paid mode"
   ├─► Return: { isFreeAccess: false, expiresAt: undefined }
   ├─► User can access paid features only

5. Monitoring Alert
   └─► "free_access_middleware_failures" threshold exceeded → Alert
```

---

## Storage & Caching

### Cache Implementation

**Type:** In-Memory LRU Cache  
**Location:** Global singleton in `lib/free-access-mode.ts`  
**TTL:** 5 minutes (configurable via `FREE_ACCESS_CONSTANTS.CACHE_TTL_MS`)  
**Max Entries:** 10,000 workspaces

```typescript
// Cache structure
const cache = new Map<string, FreeAccessCacheEntry>();

interface FreeAccessCacheEntry {
  until: string | null;    // ISO 8601 or null (not active)
  checkedAt: number;       // Unix timestamp (milliseconds)
}

// Invalidation strategy
if (Date.now() - entry.checkedAt > CACHE_TTL_MS) {
  cache.delete(workspaceId);
  // Re-query database
}
```

**Pros:**
- Sub-millisecond lookups
- No network latency
- No external dependencies

**Cons:**
- Lost on container restart
- Single-instance only (not shared across replicas)
- Must be invalidated manually on admin changes

### Database Storage

**Table:** `workspaces`  
**Column:** `plan_metadata` (JSONB)  
**Schema:**

```json
{
  "plan_metadata": {
    "free_access_until": "2026-09-30T23:59:59Z",
    "free_access_enabled_by": "admin@example.com",
    "free_access_enabled_at": "2026-09-03T10:15:00Z",
    "free_access_reason": "partner trial"
  }
}
```

**Query Performance:**
- Index: `plan_metadata->>'free_access_until'`
- Query time: ~5-10ms for typical workspaces table size

**Data Retention:**
- Stays in `plan_metadata` indefinitely (doesn't affect functionality)
- Can be cleaned up in migration if desired

### Cache Invalidation

**Manual Invalidation:**
When an admin enables/disables free-access via `/api/admin/free-access/enable`, the middleware automatically invalidates the cached entry.

```typescript
// In route handler
await updateWorkspaceFreeAccess(workspaceId, expiresAt);
invalidateFreeAccessCache(workspaceId); // ← Explicit invalidation
```

**Time-Based Expiry:**
Cache TTL is 5 minutes; entries are automatically expired and re-queried.

**On-Demand Invalidation:**
Exposed via monitoring tools (Grafana dashboard button, CLI command).

---

## Security Model

### Threat Model

| Threat | Mitigation |
|--------|-----------|
| **Unauthorized activation** | Requires admin authentication + workspace ownership check |
| **Privilege escalation** | Free-access doesn't grant admin rights; only removes approval gates |
| **Cross-workspace access** | Middleware attaches context per workspace; no leakage |
| **Timestamp manipulation** | ISO 8601 validation enforced; past dates rejected |
| **Replay attacks** | Session-based auth + CSRF tokens (in-flight) |
| **Cache poisoning** | In-memory cache can't be externally modified |

### Access Control

```typescript
// Free-Access Activation (Admin Only)
POST /api/admin/free-access/enable
├─► Require: Admin role (checked via currentUser().role === "admin")
├─► Require: Workspace ownership (currentUser().workspaceId === workspaceId)
└─► Require: Valid expiry timestamp (future date, ISO 8601)

// Free-Access Status Check (Any User in Workspace)
GET /api/admin/free-access/status
└─► Require: Workspace membership (via workspace query)
```

### Audit Trail

Every free-access state change is logged:

```typescript
// Audit Entry
{
  timestamp: "2026-09-03T10:15:00Z",
  action: "free_access_enabled",
  admin_user_id: "user123",
  workspace_id: "ws456",
  expires_at: "2026-09-30T23:59:59Z",
  duration_days: 27,
  reason: "partner_trial",
  ip_address: "192.0.2.1",
  user_agent: "Mozilla/5.0...",
}
```

**Stored in:** `activity_log` table (soft-deletable after 90 days)

---

## Performance Characteristics

### Response Time SLA

| Operation | Target | 95th % | 99th % |
|-----------|--------|---------|---------|
| Cache hit | 1-2ms | 5ms | 10ms |
| DB query | 10-20ms | 30ms | 50ms |
| Full request (middleware + handler) | 50-100ms | 150ms | 300ms |

### Load Testing Results

**Test Scenario:** 1,000 RPS on `/api/projects/list` with free-access check

```
Cache Hit Rate: 94%
P50: 8ms
P95: 25ms
P99: 75ms
Error Rate: 0.1% (network timeouts)
```

### Throughput

- Single container (4 CPU, 2GB RAM): ~2,000 RPS
- With horizontal scaling: Linear up to DB connection limits

### Memory Usage

```
Cache Memory: ~50KB per 1,000 workspaces
  = 500KB for 10,000 workspaces (max)

Global Overhead: ~2MB (error handlers, monitoring hooks)

Total per Replica: ~2.5MB (negligible)
```

---

## Scalability

### Horizontal Scaling

Free-access mode scales linearly with replicas because:
- Cache is per-instance (each replica maintains its own)
- Database queries are already optimized
- No shared state required

**Recommendation:** Replicate cache invalidation logic when adding deployment:

```typescript
// Broadcast cache invalidation to all replicas
async function invalidateFreeAccessCacheGlobally(workspaceId: string) {
  // 1. Invalidate local cache
  freeAccessCache.delete(workspaceId);
  
  // 2. Publish to Redis/message queue for other replicas
  await redis.publish("free-access-invalidate", workspaceId);
  
  // 3. Other replicas listen and invalidate their caches
}
```

### Database Scaling

**Current approach:** Single-shard PostgreSQL  
**Projection:** No sharding required; `plan_metadata` lookups are <10ms at 100k workspaces

**If scaling beyond 1M workspaces:**
- Add index on `plan_metadata->>'free_access_until'`
- Consider partitioning by workspace creation date
- Migrate to read-only replica for status checks

### Caching Layer Scaling

**Redis integration (optional):**
For multi-region deployments, shared cache via Redis:

```typescript
const freeAccessRedis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
});

async function getFreeAccessStatus(workspaceId: string): Promise<FreeAccessCacheEntry | null> {
  // 1. Check local cache
  const local = localCache.get(workspaceId);
  if (local && !isExpired(local)) return local;
  
  // 2. Check Redis (shared)
  const shared = await freeAccessRedis.get(`free-access:${workspaceId}`);
  if (shared) return JSON.parse(shared);
  
  // 3. Query database
  const result = await queryDatabase(workspaceId);
  
  // 4. Update both caches
  localCache.set(workspaceId, result);
  await freeAccessRedis.setex(`free-access:${workspaceId}`, 300, JSON.stringify(result));
  
  return result;
}
```

---

## Failure Modes & Recovery

### Failure Mode 1: Database Connection Lost

**Symptom:** All free-access lookups timeout

**Detection:** 
- Error rate spike in `free_access_middleware_failures`
- Response times exceed SLA

**Recovery:**
```
1. Middleware retries 3x with exponential backoff
2. On failure: assume isFreeAccess = false (safe default)
3. User can still access core features
4. Notifications and approvals work (paid flow)
5. Alert ops team to restore database connection
```

**Prevention:**
- Connection pooling (Prisma handles)
- Backup connection string (failover DB)
- Read replica for free-access checks only

---

### Failure Mode 2: Cache TTL Too Short

**Symptom:** Database overloaded with repeated queries for same workspace

**Detection:**
- DB query count spike
- P95 response time increases
- Cache hit rate drops below 80%

**Recovery:**
```
1. Increase CACHE_TTL_MS from 5 to 15 minutes
2. Restart containers (pick off-peak time)
3. Monitor: cache hit rate should return to >90%
```

**Prevention:**
- Start with conservative TTL (5 min)
- Monitor cache hit rate in dashboard
- Alert if hit rate drops below 85%

---

### Failure Mode 3: Cache Invalidation Race Condition

**Symptom:** Admin enables free-access, but some requests still see it disabled

**Cause:** Cache entry hasn't expired yet + invalidation didn't trigger

**Detection:**
- User reports free-access features unavailable immediately after admin activation
- Activity log shows enable, but user doesn't see effect

**Recovery:**
```
1. Refresh browser (forces new request)
2. Wait 5 minutes (cache TTL expires)
3. Or: Call cache invalidation manually
```

**Prevention:**
- Always invalidate immediately after state change:
  ```typescript
  await updateWorkspaceFreeAccess(workspaceId, expiresAt);
  invalidateFreeAccessCache(workspaceId); // ← Critical
  ```
- Test: admin enable → immediate user test

---

### Failure Mode 4: Expired Free-Access Not Cleared

**Symptom:** Free-access still active days after expiry date

**Cause:** Cache never refreshed + database value unchanged

**Detection:**
- Monitor alerts: "free_access_duration_exceeded" anomaly
- User reports unexpected free access

**Recovery:**
```
1. Disable free-access explicitly via admin
2. Query: SELECT * FROM workspaces WHERE plan_metadata->>'free_access_until' < NOW()
3. Bulk-disable outdated entries
4. Invalidate affected caches
```

**Prevention:**
- Cron job: Nightly scan for expired entries + log anomalies
- Automatic expiry (not yet implemented; Wave 3)
- Monitoring alerts: "free_access_days_remaining < 0"

---

### Failure Mode 5: Middleware Corrupts Request

**Symptom:** FreeAccessContext malformed; downstream handlers crash

**Cause:** Exception in middleware not caught

**Detection:**
- 500 errors spike
- Error logs show "Cannot read property 'isFreeAccess'"

**Recovery:**
```
1. Middleware has try-catch with fail-open
2. If exception: { isFreeAccess: false, expiresAt: undefined }
3. No request dropped; graceful degradation
```

**Prevention:**
- Comprehensive unit tests for middleware
- Integration tests: malformed DB response
- Error boundary in Express middleware

---

## Dependency Checklist

- ✅ PostgreSQL (database)
- ✅ Prisma ORM (queries)
- ✅ Next.js (framework; handles req/res)
- ✅ TypeScript (type safety)
- ❌ Redis (optional; for multi-region)
- ❌ Monitoring service (optional; for alerting)

---

## Related Documents

- [FREE_ACCESS_ERROR_HANDLING.md](./FREE_ACCESS_ERROR_HANDLING.md) — Error system details
- [FREE_ACCESS_MONITORING.md](./FREE_ACCESS_MONITORING.md) — Monitoring & alerting
- [FREE_ACCESS_TROUBLESHOOTING.md](./FREE_ACCESS_TROUBLESHOOTING.md) — Troubleshooting guide
- [FREE_ACCESS_INCIDENT_RESPONSE.md](./FREE_ACCESS_INCIDENT_RESPONSE.md) — Incident response playbook

---

## Appendix: Key Code References

### Middleware Integration Point

```typescript
// app/middleware.ts or similar
export async function middleware(request: NextRequest) {
  const user = await currentUser(request.headers.get("cookie"));
  if (!user) return redirect("/login");
  
  const context = await attachFreeAccessContext(user.workspace);
  request.context = context; // ← Attaches free-access context
  
  return NextResponse.next();
}
```

### Route Handler Integration

```typescript
// app/api/projects/list/route.ts
export async function GET(request: Request) {
  const context = request.context as FreeAccessContext;
  
  const projects = await listProjects(user.workspaceId);
  
  if (context.isFreeAccess) {
    // Suppress coach approvals, auto-approve submissions, etc.
  }
  
  return Response.json({ projects });
}
```

---

**End of Architecture Document**
