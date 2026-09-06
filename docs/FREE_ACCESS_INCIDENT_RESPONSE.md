# Free-Access Mode: Incident Response Playbook

**Document Version:** 1.0  
**Last Updated:** 2026-09-03  
**Audience:** On-Call Engineers, SRE, Incident Commander  
**Status:** Production-Ready

---

## Incident Response Framework

### Roles & Responsibilities

| Role | Responsibilities | Escalation |
|------|------------------|-----------|
| **First Responder** | Triage, create incident, initial diagnostics | Incident Commander |
| **Incident Commander** | Coordinate response, communicate updates | VP Engineering |
| **Engineer** | Execute diagnostics, implement fixes | IC |
| **Oncall SRE** | Infrastructure changes, deployment | IC |

### Incident Severity Levels

| Level | Definition | Response Time | Escalation |
|-------|-----------|----------------|-----------|
| **P1 - Critical** | Service unavailable, data loss risk, all users affected | 5 minutes | Immediate |
| **P2 - High** | Feature broken for subset of users, no data loss | 15 minutes | Within 1 hour |
| **P3 - Medium** | Degraded performance, workaround available | 1 hour | Next business day |
| **P4 - Low** | Minor issue, no user impact | As scheduled | Backlog |

### Incident Lifecycle

```
DETECTION (alert fires)
    ↓
TRIAGE (determine severity, assign IC)
    ↓
MITIGATION (apply quick fix or workaround)
    ↓
ROOT CAUSE ANALYSIS (investigate)
    ↓
PERMANENT FIX (deploy solution)
    ↓
POST-MORTEM (document learnings)
```

---

## Incident Response Playbooks

### Playbook 1: Free-Access Not Activating (P2)

**Alert:** `FreeAccessModeActivationFailure` OR user report

**Severity:** P2 (feature doesn't work for specific workspace)

**Detection:**
```
Admin enables free-access via API
User still sees payment prompt
Status check shows isFreeAccess: false
```

**Timeline:**
- T+0: Alert fires / user reports issue
- T+5: First responder triages (is this P1 or P2?)
- T+15: Root cause identified
- T+30: Mitigation deployed

**Step 1: Immediate Triage** (First Responder, ~2 min)

```bash
# Is this affecting multiple workspaces or just one?
curl https://onevyrt.com/api/admin/free-access/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workspaceId": "reported_workspace_id"}' | jq .

# If isFreeAccess: true → Not actually broken
# → Check if user has stale browser cache
# → Severity: P4 (user support)

# If isFreeAccess: false → Actually broken
# → Continue to Step 2
# → Severity: P2
```

**Step 2: Identify Root Cause** (Engineer, ~10 min)

```bash
# Root Cause #1: Database write failed
psql $DATABASE_URL -c "
  SELECT id, plan_metadata->>'free_access_until'
  FROM workspaces WHERE id = 'workspace_id';"

# If NULL or past date → DB update failed
# → Retry enable API call
# → Check for DB errors in logs

# Root Cause #2: Cache not invalidated
kubectl logs -l app=web --tail=100 | grep -i "free-access-invalidate"

# If no log → cache invalidation not called
# → Restart containers: kubectl rollout restart deployment/web

# Root Cause #3: Middleware exception
kubectl logs -l app=web --tail=100 | grep -i "error"

# If error found → middleware crashing
# → Check stack trace, may need hotfix
```

**Step 3: Mitigation** (Engineer, ~15 min)

**Option A: Retry Enable** (if DB write failed)
```bash
# Re-enable free-access with future date
curl -X POST https://onevyrt.com/api/admin/free-access/enable \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "workspaceId": "workspace_id",
    "expiresAt": "'$(date -u -d "+30 days" +%Y-%m-%dT%H:%M:%SZ)'"
  }'

# Verify
curl https://onevyrt.com/api/admin/free-access/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workspaceId": "workspace_id"}'
# Should show: isFreeAccess: true

# Time to fix: ~2 minutes
```

**Option B: Restart Containers** (if cache stale)
```bash
# Rolling restart to clear cache
kubectl rollout restart deployment/web

# Verify all pods restarted
kubectl get pods -l app=web -w

# Time to fix: ~3 minutes
```

**Option C: Hotfix Middleware** (if crash)
```bash
# If middleware crash, need code fix
# 1. Identify error in logs
# 2. Fix in lib/free-access-mode.ts
# 3. Test locally
# 4. Commit & push
# 5. Wait for CI (2-3 min)
# 6. Deploy: kubectl rollout restart deployment/web
# 7. Verify

# Time to fix: ~15-20 minutes
```

**Step 4: Verification** (Engineer, ~3 min)

```bash
# User flow test
curl https://onevyrt.com/api/projects/list \
  -H "Cookie: auth_session=..." \
  -H "User-Agent: testing"

# Should include free-access features
# Should NOT show payment prompt
# Should auto-approve submissions
```

**Step 5: Post-Incident** (IC, ~30 min)

```
1. Update incident ticket
   - Root cause
   - Timeline (when detected, when fixed)
   - Time to recovery (TTR)
   
2. Communication
   - Notify affected users
   - Update status page
   
3. Schedule post-mortem (within 24 hours)
```

**Automation Opportunity:**
```typescript
// Auto-check: if enable fails, retry 3x
export async function enableFreeAccessWithRetry(
  workspaceId: string,
  expiresAt: string,
): Promise<void> {
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await enableFreeAccess(workspaceId, expiresAt);
      invalidateFreeAccessCache(workspaceId);
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

---

### Playbook 2: High Error Rate (P1)

**Alert:** `FreeAccessHighErrorRate` (> 0.1% failures)

**Severity:** P1 (blocking users)

**Detection:**
```
Multiple 500 errors on /api/* endpoints
Monitoring shows: free_access_middleware_failures > threshold
Users report: "Something went wrong" errors
```

**Timeline:**
- T+0: Alert fires
- T+3: Page on-call
- T+5: IC convened
- T+10: Root cause identified
- T+20: Mitigation applied

**Step 1: Emergency Triage** (First Responder, ~2 min)

```bash
# Check alert details
# Is this affecting:
# - All users? (P1)
# - Specific workspaces? (P2)
# - Specific endpoints? (P2)

# Check error logs
kubectl logs -l app=web --tail=200 | tail -100

# Count errors in last 5 minutes
kubectl logs -l app=web --since=5m | grep -i error | wc -l

# Expected: < 10 errors
# If > 100 errors: P1, declare incident immediately
```

**Step 2: Identify Failure Mode** (Engineer, ~5 min)

```bash
# Error Type #1: Database connection lost
kubectl logs -l app=web | grep "connection refused"
# OR
psql $DATABASE_URL -c "SELECT 1;" 
# If fails: database is down

# Error Type #2: Cache corruption
kubectl logs -l app=web | grep "Cannot read property"
# OR
# Check middleware returns valid context

# Error Type #3: Recent deployment
git log --oneline -5
# If recent commit to free-access code: likely cause

# Error Type #4: Resource exhaustion
kubectl top nodes
kubectl top pods -l app=web
# Memory/CPU near limits?
```

**Step 3: Immediate Action** (IC, ~2 min)

**If Database Down:**
```bash
# Attempt database recovery
fly postgres restart onevyrt-db

# Verify recovery
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workspaces;"

# If still down: Failover (see Infrastructure Playbook)
```

**If Cache Corruption:**
```bash
# Rolling restart clears cache
kubectl rollout restart deployment/web

# Monitor error rate
while true; do
  rate=$(curl -s http://localhost:9090/api/query?query='free_access_middleware_failures_total' | jq .data.result[0].value[1])
  echo "Error rate: $rate"; sleep 5
done

# Should drop back to < 0.01%
```

**If Recent Bad Deployment:**
```bash
# Rollback immediately
git log --oneline -1
# If breaks free-access: revert commit
git revert -n HEAD
git push origin main

# Automated rollback via CI (if configured)
# OR manual: kubectl set image deployment/web web=$OLD_IMAGE
```

**If Resource Exhaustion:**
```bash
# Scale up
kubectl scale deployment web --replicas=6

# Monitor CPU/memory
kubectl top pods -l app=web -w

# Should return to normal levels
```

**Step 4: Verification** (Engineer, ~5 min)

```bash
# Monitor error rate (should drop)
rate(free_access_middleware_failures_total[1m])

# Test functionality
curl https://onevyrt.com/api/projects/list \
  -H "Cookie: auth_session=..." 
# Should return 200

# Check P95 latency
histogram_quantile(0.95, rate(free_access_middleware_duration_ms_bucket[1m]))
# Should be < 50ms

# Once confirmed: Declare incident resolved
```

**Step 5: Post-Incident** (IC)

```
1. Declare incident resolved (announce in Slack #incidents)
2. Continue investigation (if root cause unclear)
3. Schedule urgent post-mortem (same day)
4. Implement preventive measures
   - Add monitoring alert
   - Add CI test
   - Add integration test
```

---

### Playbook 3: Cache Degradation (P2)

**Alert:** `FreeAccessLowCacheHitRate` (< 85%)

**Severity:** P2 (performance degraded, no outage)

**Detection:**
```
Cache hit rate drops from 94% to 72%
Database query latency increases
Users report slow load times (anecdotal)
```

**Timeline:**
- T+0: Alert fires (non-urgent)
- T+30: First responder triages
- T+60: Fix applied

**Step 1: Investigate Cache Hit Rate Drop** (Engineer, ~10 min)

```bash
# Query Prometheus for hit rate trend
# In Grafana dashboard: "Cache Hit Rate" panel
# Look at 24-hour graph

# Possible causes:
# 1. Cache TTL expired (normal)
# 2. Cache max size exceeded (entries evicted)
# 3. Cache invalidated repeatedly
# 4. New workspaces added (cache cold)
# 5. Memory pressure (cache cleared)

# Check cache stats
curl http://localhost:3000/debug/cache-stats | jq .

# Expected:
# {
#   "size": 2000,
#   "memory_mb": 16,
#   "ttl_ms": 300000,
#   "hit_rate": 0.94
# }
```

**Step 2: Apply Fix** (Engineer, ~5 min)

**If Cache TTL Too Short:**
```typescript
// Increase TTL from 5 to 15 minutes
const FREE_ACCESS_CACHE_TTL_MS = 15 * 60 * 1000;  // 15 minutes

// Redeploy
git commit -am "Increase free-access cache TTL to 15 minutes"
git push origin main
# CI runs, deployment automatic
```

**If Cache Max Size Exceeded:**
```typescript
// Increase LRU cache size
const CACHE_MAX_SIZE = 50000;  // was 10000

// Redeploy
git commit -am "Increase free-access LRU cache to 50k entries"
git push origin main
```

**If Memory Pressure:**
```bash
# Check container resources
kubectl describe pod web-deployment-xyz | grep -A5 "memory"

# Increase memory limit (if needed)
kubectl set resources deployment web --limits=memory=1Gi --requests=memory=512Mi

# Monitor
kubectl top pods -l app=web -w
```

**If Normal Cache Cold (new workspaces):**
```bash
# No action needed; cache will warm up
# Monitor cache hit rate over 1 hour
# Should return to > 90%
```

**Step 3: Verify Fix** (Engineer, ~5 min)

```bash
# Monitor cache hit rate
rate(free_access_cache_hits_total[5m]) / (rate(free_access_cache_hits_total[5m]) + rate(free_access_cache_misses_total[5m]))

# Should return to > 90% within 10 minutes
```

---

### Playbook 4: Database Connection Pool Exhausted (P2)

**Alert:** `FreeAccessDatabaseSlow` OR `PgConnectionPoolExhausted`

**Severity:** P2 (slow queries, not outage)

**Detection:**
```
Database query latency spike (P95 > 100ms)
Connection pool at capacity
Queries wait in queue
```

**Timeline:**
- T+0: Alert fires
- T+5: First responder checks
- T+15: Fix applied

**Step 1: Diagnose Connection Pool** (Engineer, ~5 min)

```bash
# Check current connections
psql $DATABASE_URL -c "
  SELECT
    datname,
    usename,
    count(*) as conn_count
  FROM pg_stat_activity
  GROUP BY datname, usename;"

# Expected: < 20 total connections
# If > 25 (pool size): pool exhausted

# Check idle connections
psql $DATABASE_URL -c "
  SELECT
    pid,
    usename,
    state,
    query_start
  FROM pg_stat_activity
  WHERE state = 'idle'
  ORDER BY query_start;"

# Idle connections should be 0 (or brief)
```

**Step 2: Apply Fix** (Engineer/SRE, ~10 min)

**Option A: Kill Idle Connections**
```bash
# Kill all idle connections from app
psql $DATABASE_URL -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'onevyrt' AND state = 'idle';"

# Verify
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'onevyrt';"

# Should drop significantly
```

**Option B: Restart Connection Pool**
```bash
# Restart all app containers (clears connections)
kubectl rollout restart deployment/web

# Monitor connections
watch -n 2 'psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = \"onevyrt\";"'

# Should stabilize at lower count
```

**Option C: Increase Pool Size** (if legitimately more connections needed)
```bash
# Update .env
DATABASE_POOL_SIZE=40  # was 25

# Restart containers to pick up change
kubectl rollout restart deployment/web

# Verify pool increased
# Monitor for next 30 minutes
```

**Step 3: Verify Fix** (Engineer, ~5 min)

```bash
# Check query latency
histogram_quantile(0.95, rate(free_access_db_query_duration_ms_bucket[5m]))

# Should return to < 30ms

# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'onevyrt';"

# Should be < pool_size
```

---

### Playbook 5: Cascade Failure (Database + Cache Both Down) (P1)

**Alert:** Multiple critical alerts fire simultaneously

**Severity:** P1 (service unavailable)

**Detection:**
```
Database unavailable
Cache hit rate 0%
All free-access checks fail
Users see 500 errors
```

**Timeline:**
- T+0: Cascading alerts fire
- T+2: Page on-call immediately
- T+5: IC declared
- T+10: Failover implemented

**Step 1: Declare Incident (IC, ~1 min)**

```bash
# Create incident ticket
# Set severity: P1
# Page on-call engineer, DBA, SRE

# Announce in #incidents Slack channel
# "@incidents Free-Access service degradation detected"

# Start Incident Bridge
# Zoom: https://zoom.us/j/...
```

**Step 2: Quick Diagnostics (Parallel, ~3 min)**

**Engineer:**
```bash
# Check application status
kubectl get pods -l app=web
# Should all be Running

# Check middleware error rate
rate(free_access_middleware_failures_total[1m])
# Should be near 100%
```

**DBA:**
```bash
# Check database status
pg_isready -h fly-postgres-prod.internal -p 5432

# Check replication status
psql $DATABASE_URL -c "SELECT * FROM pg_stat_replication;"

# Check transaction log
pg_controldata /data/postgresql | grep checkpoint
```

**SRE:**
```bash
# Check infrastructure
kubectl get nodes
kubectl get pvc

# Check resource usage
kubectl top nodes
kubectl top pods

# Check network
kubectl describe svc onevyrt-db
```

**Step 3: Isolate Failure** (5 min)

**Is Database Down?**
```bash
psql $DATABASE_URL -c "SELECT 1;" 2>&1

# If "connection refused": Database is down
# → Go to: Database Recovery (below)

# If timeout: Network problem
# → Check connectivity: nc -zv fly-postgres-prod.internal 5432
```

**Is Cache Corrupted?**
```bash
# Check cache stats
curl http://localhost:3000/debug/cache-stats

# If cache empty or all entries invalid
# → Restart containers: kubectl rollout restart deployment/web
```

**Step 4: Recovery** (IC, ~10-20 min)

**Database Recovery Procedure:**
```bash
# 1. Check database status
fly status -a onevyrt-db

# 2. If crashed: restart database
fly postgres restart onevyrt-db

# 3. Wait for recovery (usually 2-3 min)
# 4. Verify replication healthy
psql $DATABASE_URL -c "SELECT state FROM pg_stat_replication;" 

# 5. Test query
psql $DATABASE_URL -c "SELECT COUNT(*) FROM workspaces;"

# 6. Clear app cache
kubectl rollout restart deployment/web

# 7. Monitor error rate
watch -n 2 'curl -s http://prometheus:9090/api/query?query="rate(free_access_middleware_failures_total[1m])"'
```

**Step 5: Verification & Communication** (IC)

```bash
# When error rate returns to normal
# Monitor for 5 minutes to confirm stable

# Update incident status
# "@channel Incident resolved. Investigating root cause."

# Continue investigation post-incident
```

---

## Incident Communication Template

### Initial Alert

```
INCIDENT: Free-Access Service Degradation
Severity: P2 (or P1)
Detected: 2026-09-03 10:15 UTC
Affected: [X] workspaces, [Y] users
Status: INVESTIGATING

Symptoms:
- [Describe user impact]

Next update: T+15 minutes
```

### Update

```
Status: IDENTIFIED
Root Cause: [Brief description]
Time to Fix: [Estimated]

Actions:
- [Action 1]
- [Action 2]

Next update: T+30 minutes
```

### Resolution

```
Status: RESOLVED
Duration: [Time from detection to fix]
Root Cause: [Full description]
User Impact: [Summary of affected users]

Post-mortem scheduled: [Date/time]
```

---

## Post-Incident Checklist

```
Within 24 hours:
□ Schedule post-mortem meeting
□ Document timeline in incident ticket
□ Calculate MTTR (Mean Time to Recovery)
□ Identify root cause

Within 1 week:
□ Complete post-mortem writeup
□ Identify preventive measures
  - Monitoring improvements?
  - Code changes?
  - Runbook updates?
□ Create tickets for action items
□ Share learnings with team

Action items:
□ Add/improve monitoring alert
□ Add integration test case
□ Update this playbook
□ Brief team on findings
```

---

## Common Patterns & Anti-Patterns

### ✅ Do's

```
✓ Communicate early (even if investigating)
✓ Have someone document during incident
✓ Declare resolved only when verified
✓ Schedule post-mortem same day
✓ Make runbook changes immediately
✓ Test fixes locally before deploying
✓ Verify with customer after fix
```

### ❌ Don'ts

```
✗ Stay silent while investigating
✗ Deploy untested hotfixes
✗ Skip post-mortem for "obvious" issues
✗ Forget to invalidate cache
✗ Restart all containers at once (no rolling restart)
✗ Make multiple changes simultaneously
✗ Assume monitoring is working (verify)
```

---

## Escalation Paths

### Database Issues

```
Symptom: psql connection fails
    ↓
First Responder: Can you reach database?
    ├─ YES → Connection pool issue
    │        → Engineer: restart app containers
    │
    └─ NO → Database down
             → Page DBA immediately
             → SRE: prepare failover
```

### Code Exceptions

```
Symptom: 500 errors in logs
    ↓
First Responder: What's the error?
    ├─ NullPointerException → likely code bug
    │  → Engineer: Check recent commits
    │  → Revert or hotfix
    │
    └─ Other → Investigate based on error
```

### Resource Issues

```
Symptom: Latency spike, containers OOMKilled
    ↓
SRE: Check resource usage
    ├─ Memory high → Increase memory limit
    ├─ CPU high → Scale replicas
    └─ Disk high → Cleanup logs, increase storage
```

---

## Related Documents

- [FREE_ACCESS_ARCHITECTURE.md](./FREE_ACCESS_ARCHITECTURE.md) — System design
- [FREE_ACCESS_TROUBLESHOOTING.md](./FREE_ACCESS_TROUBLESHOOTING.md) — Diagnostic guide
- [FREE_ACCESS_MONITORING.md](./FREE_ACCESS_MONITORING.md) — Metrics setup

---

## Appendix: Contact List

```
On-Call Engineer: $SLACK_ON_CALL_ALIAS
Platform Lead: @platform-lead
DBA: @dba-oncall
SRE: @sre-oncall
VP Engineering: @vp-engineering
```

---

**End of Incident Response Playbook**
