# Free-Access Mode: Troubleshooting Guide

**Document Version:** 1.0  
**Last Updated:** 2026-09-03  
**Audience:** Ops, Support, Engineering  
**Status:** Production-Ready

## Quick Diagnostic Checklist

```
ISSUE REPORTED: [User can't access features in free-access mode]

□ Step 1: Verify free-access is active
  Command: curl https://onevyrt.com/api/admin/free-access/status -H "Authorization: Bearer $TOKEN" -d '{"workspaceId": "..."}'
  Expected: { "success": true, "isFreeAccess": true, "expiresAt": "..." }

□ Step 2: Check expiry date
  If expiresAt < now(): free-access has expired

□ Step 3: Clear browser cache & retry
  If error persists: continue to section below

□ Step 4: Check server logs for errors
  Pattern: "free_access_middleware_failures" or "DatabaseError"

□ Step 5: If database error, check DB connection
  Verify: PostgreSQL running, connection pool healthy

DIAGNOSIS COMPLETE → See relevant section below
```

---

## Common Issues & Solutions

### Issue 1: Free-Access Not Activating

**Symptoms:**
- Admin enables free-access via API
- User still sees payment prompt / approval gates
- Status check shows `isFreeAccess: false`

**Root Causes:**

| Cause | Check | Fix |
|-------|-------|-----|
| Expiry timestamp in past | `expiresAt < Date.now()` | Re-enable with future date |
| Cache not invalidated | Server logs: "cache invalidation failed" | Restart container |
| Database write failed | Check `workspaces.plan_metadata` field | Verify DB connection |
| User still has old session | Browser cached auth token | Clear cookies, re-login |

**Diagnostic Steps:**

```bash
# 1. Verify database has the entry
psql $DATABASE_URL -c "
  SELECT id, plan_metadata->>'free_access_until' AS expires_at
  FROM workspaces
  WHERE id = 'workspace_id_here';"

# Expected output:
# id           | expires_at
# -----------+---------------------------------
# abc123     | 2026-09-30T23:59:59Z

# 2. If field is NULL or past date: Database update failed
#    Re-run enable API call:
curl -X POST https://onevyrt.com/api/admin/free-access/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace_id_here",
    "expiresAt": "2026-12-31T23:59:59Z"
  }'

# 3. Check cache invalidation
#    Look for log entries: "free-access-invalidate" or similar
#    If missing: restart containers to clear stale cache

# 4. Verify user's workspace assignment
psql $DATABASE_URL -c "
  SELECT u.id, u.email, ws.id, ws.name
  FROM users u
  JOIN workspaces_users wu ON u.id = wu.user_id
  JOIN workspaces ws ON wu.workspace_id = ws.id
  WHERE u.email = 'user@example.com';"
```

**Solution Flowchart:**

```
Does database show free_access_until?
├─ YES → Is it in the future?
│       ├─ YES → Cache stale (restart containers)
│       └─ NO  → Re-enable with future date
└─ NO  → Database update failed
         └─ Check: DB connection, auth, workspace ownership
```

---

### Issue 2: Free-Access Expires Prematurely

**Symptoms:**
- Free-access active in morning
- User locked out by afternoon
- Status shows `isFreeAccess: false` despite expiry date in future

**Root Causes:**

| Cause | Indicator | Fix |
|-------|-----------|-----|
| System time drift | Server clock wrong | Sync NTP |
| Timezone mismatch | Timestamp parsing error | Use UTC consistently |
| Cache corruption | Stale expiry cached | Invalidate cache |
| Race condition | Concurrent enable/disable | Retry after 5 seconds |

**Diagnostic Steps:**

```bash
# 1. Check server time
date -u  # Should show UTC

# 2. Verify timestamp in database
psql $DATABASE_URL -c "
  SELECT 
    id,
    plan_metadata->>'free_access_until' AS expires_at,
    EXTRACT(EPOCH FROM (plan_metadata->>'free_access_until')::TIMESTAMPTZ - NOW()) / 86400 AS days_remaining
  FROM workspaces
  WHERE id = 'workspace_id_here';"

# Expected: days_remaining > 0

# 3. Check NTP sync
timedatectl status
# Should show: "System clock synchronized: yes"

# 4. Force cache invalidation
# (via monitoring dashboard or direct DB query)
```

**Solution:**

```bash
# If server clock is wrong:
systemctl restart systemd-timesyncd

# If timezone mismatch: verify ISO 8601 format
# Correct: 2026-09-30T23:59:59Z
# Wrong:   2026-09-30T23:59:59 (missing Z)
# Wrong:   2026-09-30 (missing time)
```

---

### Issue 3: Cache Invalidation Not Working

**Symptoms:**
- Admin enables free-access
- User's subsequent requests still blocked
- Checking DB confirms entry is there

**Root Causes:**

| Cause | Log Pattern | Fix |
|-------|-------------|-----|
| Invalidation function not called | No "free-access-invalidate" message | Update code |
| Cache already expired (unlikely) | Cache TTL < middleware delay | Increase TTL |
| Multiple container instances | Invalidation only on one replica | Use Redis broadcast |
| Handler didn't call invalidate | Check API route handler | Verify `invalidateFreeAccessCache()` call |

**Diagnostic Steps:**

```bash
# 1. Check for invalidation logs
kubectl logs -l app=web --tail=100 | grep -i "free-access-invalidate"

# Expected: "Successfully invalidated cache for workspace_id"
# If missing: invalidation wasn't triggered

# 2. Verify cache implementation
cat apps/web/lib/free-access-mode.ts | grep "invalidateFreeAccessCache"

# Should show: function defined and exported

# 3. Check if called from enable endpoint
cat apps/web/app/api/admin/free-access/enable/route.ts | grep "invalidate"

# Should show: await invalidateFreeAccessCache(workspaceId);

# 4. If using multiple containers: check cross-replica sync
#    Currently NOT synced (single-instance only)
#    Workaround: Restart all containers
kubectl rollout restart deployment/web
```

**Solution:**

```typescript
// Verify invalidation is called in route handler:
export async function POST(request: Request) {
  const result = await updateWorkspaceFreeAccess(workspaceId, expiresAt);
  invalidateFreeAccessCache(workspaceId);  // ← Must be here
  return Response.json(result);
}

// For multi-instance: implement Redis broadcast
async function invalidateFreeAccessCacheGlobally(workspaceId: string) {
  // Local invalidation
  freeAccessCache.delete(workspaceId);
  
  // Broadcast to other replicas via Redis/message queue
  await redis.publish("free-access-cache-invalid", workspaceId);
}
```

---

### Issue 4: Database Errors / Timeouts

**Symptoms:**
- Server logs show `DatabaseError: connection timeout`
- Users see 500 errors or intermittent access
- Some requests succeed, others fail

**Root Causes:**

| Cause | Metric | Fix |
|-------|--------|-----|
| DB connection pool exhausted | Active connections = pool size | Increase pool size |
| Slow query | Query time > 100ms | Add index |
| DB unavailable | Ping fails | Check DB status |
| Query lock | Waiting for lock > 1s | Kill blocking query |

**Diagnostic Steps:**

```bash
# 1. Check database connectivity
nc -zv fly-postgres-prod.internal 5432

# Expected: Connection successful

# 2. Check connection pool status
# (via Prisma dashboard or direct SQL)
psql $DATABASE_URL -c "SELECT datname, numbackends FROM pg_stat_database;"

# Expected: numbackends < pool_size (25 default)

# 3. Find slow queries
psql $DATABASE_URL -c "
  SELECT 
    query,
    calls,
    total_time,
    mean_time
  FROM pg_stat_statements
  WHERE query LIKE '%plan_metadata%'
  ORDER BY mean_time DESC;"

# Expected: mean_time < 10ms

# 4. Check for locks
psql $DATABASE_URL -c "
  SELECT 
    pid,
    usename,
    query,
    state
  FROM pg_stat_activity
  WHERE wait_event_type = 'Lock';"

# If results: locks blocking queries (kill if necessary)

# 5. Check DB size and health
psql $DATABASE_URL -c "SELECT pg_database_size('onevyrt');"
```

**Solution:**

```bash
# If connection pool exhausted:
# In .env or settings:
DATABASE_POOL_SIZE=50  # Increase from default

# If slow query (missing index):
psql $DATABASE_URL -c "
  CREATE INDEX idx_workspace_free_access 
  ON workspaces USING BTREE 
  ((plan_metadata->>'free_access_until'));"

# If DB unavailable: restart
fly postgres restart onevyrt-db

# If locks: kill blocking query
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query LIKE '%free-access%';"

# Verify queries now succeed
time psql $DATABASE_URL -c "
  SELECT COUNT(*) FROM workspaces WHERE plan_metadata->>'free_access_until' IS NOT NULL;"
```

---

### Issue 5: Middleware Exceptions / Crashes

**Symptoms:**
- Request returns 500 error
- Error log: `Cannot read property 'isFreeAccess' of undefined`
- Affects multiple users

**Root Causes:**

| Cause | Error Message | Fix |
|-------|---------------|-----|
| Context not attached | `request.context undefined` | Check middleware order |
| Null response from DB | `Cannot read property 'until'` | Handle nulls |
| Malformed timestamp | `Invalid date` | Validate ISO 8601 |
| Cache returns wrong type | `entry is not an object` | Verify cache type |

**Diagnostic Steps:**

```bash
# 1. Check middleware execution order
cat app/middleware.ts

# Verify: middleware runs BEFORE route handlers
# Order: Auth → Free-Access → Handler

# 2. Check error logs
kubectl logs -l app=web | grep -A5 "Cannot read property"

# Should show: stack trace + line number

# 3. Reproduce error locally
curl -v https://onevyrt.com/api/projects/list \
  -H "Cookie: auth_session=..." \
  -H "User-Agent: testing"

# If 500: check server logs

# 4. Validate type assertions
#    Check: TypeScript noImplicitAny enabled?
tsc --noImplicitAny --noEmit
```

**Solution:**

```typescript
// Add proper type safety:
// Before:
const context = request.context;  // ← Could be undefined
const isFree = context.isFreeAccess;  // ← Crash if undefined

// After:
const context = request.context as FreeAccessContext;
if (!context) {
  return Response.json({ error: "Context missing" }, { status: 500 });
}

const isFree = context.isFreeAccess;  // ← Safe

// For cache responses:
const entry = cache.get(workspaceId);
if (!entry || typeof entry !== 'object') {
  // Handle invalid cache, re-query DB
  cache.delete(workspaceId);
}

// For timestamp validation:
export function isValidIso8601(timestamp: string): boolean {
  try {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
  } catch {
    return false;  // ← Prevents exception
  }
}
```

---

### Issue 6: Memory Leak / High Container Memory

**Symptoms:**
- Container memory usage grows over days
- OOMKilled errors
- Service becomes slow

**Root Causes:**

| Cause | Indicator | Fix |
|-------|-----------|-----|
| Cache grows unbounded | Cache size > 100MB | Implement LRU eviction |
| Error objects not freed | Error logs accumulate | Add TTL to error logs |
| Connection pool leak | Active connections grow | Verify pool cleanup |

**Diagnostic Steps:**

```bash
# 1. Check current container memory
kubectl top pod web-deployment-xyz

# Expected: < 300MB for normal usage

# 2. Check cache size
# (Add monitoring; see FREE_ACCESS_MONITORING.md)
curl http://localhost:3000/debug/cache-stats

# Expected output:
# {
#   "size": 1500,  // entries
#   "memory_mb": 12,
#   "ttl_ms": 300000
# }

# 3. Check Node.js heap
node --max_old_space_size=512 app.js
# (default is auto; check if needs tuning)

# 4. Profile memory usage
# Using clinic.js or similar
clinic doctor -- npm start
```

**Solution:**

```typescript
// Implement LRU cache eviction:
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize = 10000;

  set(key: K, value: V) {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  get(key: K): V | undefined {
    return this.cache.get(key);
  }
}

// Add memory monitoring
setInterval(() => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  if (used > 400) {
    console.warn(`High memory usage: ${used}MB`);
    // Trigger cache cleanup
    freeAccessCache.clear();
  }
}, 60000);  // Every 60 seconds
```

---

### Issue 7: Race Conditions / Concurrent Updates

**Symptoms:**
- Enable free-access via API
- Simultaneously, user loads page
- Result: inconsistent state (some requests see enabled, others see disabled)

**Root Causes:**

| Cause | Timing | Fix |
|-------|--------|-----|
| Cache stale during update | Request hits cache before invalidation | Invalidate first |
| DB write uncommitted | Query runs before commit | Use transactions |
| Multiple enable calls | Race between two admins | Idempotent operation |

**Diagnostic Steps:**

```bash
# 1. Check request ordering in logs
# Look for: enable call → status call (should show success)

# 2. Verify transaction isolation
psql $DATABASE_URL -c "SHOW transaction_isolation;"

# Expected: read committed (default OK for this workload)

# 3. Check for concurrent updates
# Enable with verbose logging
RUST_LOG=debug npm start
```

**Solution:**

```typescript
// Make updates idempotent:
export async function enableFreeAccessIdempotent(
  workspaceId: string,
  expiresAt: string,
): Promise<void> {
  // Update only if different
  const current = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan_metadata: true },
  });

  const currentExpiry = current?.plan_metadata?.free_access_until;
  
  if (currentExpiry === expiresAt) {
    // Already set; no change needed
    return;
  }

  // Update with transaction
  await db.workspace.update({
    where: { id: workspaceId },
    data: {
      plan_metadata: {
        ...current?.plan_metadata,
        free_access_until: expiresAt,
      },
    },
  });

  // Invalidate cache AFTER commit
  invalidateFreeAccessCache(workspaceId);
}

// Always invalidate cache after DB write:
try {
  await dbWrite();
  invalidateFreeAccessCache(workspaceId);  // ← Critical
} catch (e) {
  // Error handling
  throw e;
}
```

---

## Performance Troubleshooting

### Issue: High Latency / Slow Requests

**Symptoms:**
- User requests slow (P95 > 200ms)
- Dashboard shows query times > 100ms
- CPU usage high but memory OK

**Diagnostic:**

```bash
# 1. Check cache hit rate
# (via monitoring dashboard)
# Expected: > 90%

# 2. Check DB query time
EXPLAIN ANALYZE
SELECT * FROM workspaces 
WHERE id = 'workspace_id';

# Expected plan: Index scan (< 5ms)

# 3. Profile middleware
# Add timing in logs:
const start = Date.now();
const context = await attachFreeAccessContext(workspace);
console.log(`Middleware took ${Date.now() - start}ms`);

# 4. Check upstream dependencies
# Is database responding slowly?
# Is network latency high?
```

**Solutions:**

| Issue | Fix |
|-------|-----|
| Low cache hit rate | Increase TTL or cache size |
| Slow DB query | Add index on plan_metadata |
| High latency | Add read replica for free-access checks |
| CPU spike | Profile code, look for N+1 queries |

---

## Monitoring Checklist

```
Run these checks daily:

□ Free-access cache hit rate > 90%
□ P95 latency < 50ms
□ No "free_access_middleware_failures"
□ No database connection errors
□ No expired free-access still active (should be 0)
□ Container memory < 300MB
□ Active DB connections < 20

Weekly:
□ Audit trail: all enable/disable actions logged
□ Performance trends: no degradation
□ Error rate < 0.1%
```

---

## Escalation Path

If you've gone through diagnostics and issue persists:

### Level 1: Support
- Can access monitoring dashboard
- Can reproduce issue locally
- Can check logs

**Actions:**
- Gather logs (last 1 hour)
- Check Dashboard metrics
- If still unclear → escalate

### Level 2: Engineering
- Can access database directly
- Can restart containers
- Can deploy hotfixes

**Actions:**
- Analyze performance traces
- Check transaction logs
- Query database directly
- Restart if needed

### Level 3: Infrastructure
- Can scale resources
- Can modify database
- Can change deployment config

**Actions:**
- Scale container replicas
- Increase connection pool
- Modify database parameters
- Change caching strategy

---

## Useful Commands Reference

```bash
# Check free-access status
curl https://onevyrt.com/api/admin/free-access/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"workspaceId": "workspace_id"}'

# Enable free-access (7 days)
curl -X POST https://onevyrt.com/api/admin/free-access/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "workspaceId": "workspace_id",
    "expiresAt": "'$(date -u -d "+7 days" +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Query database
psql $DATABASE_URL -c "
  SELECT id, name, plan_metadata->>'free_access_until'
  FROM workspaces WHERE plan_metadata->>'free_access_until' IS NOT NULL;"

# View recent logs
kubectl logs -l app=web --tail=100 -f

# Restart containers
kubectl rollout restart deployment/web

# Check database connections
psql $DATABASE_URL -c "SELECT datname, numbackends FROM pg_stat_database;"
```

---

## Related Documents

- [FREE_ACCESS_ARCHITECTURE.md](./FREE_ACCESS_ARCHITECTURE.md) — System design
- [FREE_ACCESS_MONITORING.md](./FREE_ACCESS_MONITORING.md) — Metrics & dashboards
- [FREE_ACCESS_INCIDENT_RESPONSE.md](./FREE_ACCESS_INCIDENT_RESPONSE.md) — Incident playbook

---

**End of Troubleshooting Guide**
