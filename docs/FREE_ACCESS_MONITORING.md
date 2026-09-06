# Free-Access Mode: Monitoring & Alerting Setup

**Document Version:** 1.0  
**Last Updated:** 2026-09-03  
**Audience:** Ops, SRE, Engineering  
**Status:** Production-Ready

## Table of Contents

1. [Metrics Overview](#metrics-overview)
2. [Instrumentation Setup](#instrumentation-setup)
3. [Prometheus Configuration](#prometheus-configuration)
4. [Grafana Dashboard](#grafana-dashboard)
5. [Alerting Rules](#alerting-rules)
6. [Usage Telemetry](#usage-telemetry)
7. [Dashboards & Queries](#dashboards--queries)

---

## Metrics Overview

### Key Metrics to Instrument

| Metric Name | Type | Purpose | SLA |
|------------|------|---------|-----|
| `free_access_cache_hits` | Counter | Track cache effectiveness | > 90% hit rate |
| `free_access_cache_misses` | Counter | Track DB queries | < 10% |
| `free_access_middleware_duration_ms` | Histogram | Measure latency | P95 < 50ms |
| `free_access_db_query_duration_ms` | Histogram | DB performance | P95 < 30ms |
| `free_access_middleware_failures` | Counter | Error rate | < 0.1% |
| `free_access_active_count` | Gauge | Workspaces with active free-access | — |
| `free_access_expiry_days_remaining` | Gauge | Time until expiry (per workspace) | — |
| `free_access_invalid_timestamp_errors` | Counter | Input validation failures | < 1/day |

### Metric Naming Convention

All metrics follow Prometheus naming:
- Prefix: `free_access_`
- Units in suffix: `_duration_ms`, `_bytes`, `_total`
- Labels: `workspace_id`, `error_type`, `endpoint`, `cache_status`

Example:
```
free_access_cache_hits_total{workspace_id="abc123", status="hit"} 1523
```

---

## Instrumentation Setup

### Step 1: Add Monitoring Library

```typescript
// apps/web/lib/free-access-monitoring.ts

import { Counter, Histogram, Gauge, register } from 'prom-client';

// Counters
export const cacheHitsCounter = new Counter({
  name: 'free_access_cache_hits_total',
  help: 'Total cache hits for free-access lookups',
  labelNames: ['workspace_id'],
});

export const cacheMissesCounter = new Counter({
  name: 'free_access_cache_misses_total',
  help: 'Total cache misses (DB queries)',
  labelNames: ['workspace_id'],
});

export const middlewareFailuresCounter = new Counter({
  name: 'free_access_middleware_failures_total',
  help: 'Total middleware failures',
  labelNames: ['error_type', 'endpoint'],
});

export const invalidTimestampCounter = new Counter({
  name: 'free_access_invalid_timestamp_errors_total',
  help: 'Invalid ISO 8601 timestamp attempts',
  labelNames: ['reason'],
});

// Histograms
export const middlewareDurationHistogram = new Histogram({
  name: 'free_access_middleware_duration_ms',
  help: 'Middleware execution time (milliseconds)',
  labelNames: ['cache_status', 'workspace_id'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

export const dbQueryDurationHistogram = new Histogram({
  name: 'free_access_db_query_duration_ms',
  help: 'Database query time (milliseconds)',
  labelNames: ['query_type', 'workspace_id'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

// Gauges
export const activeWorkspacesGauge = new Gauge({
  name: 'free_access_active_workspaces',
  help: 'Number of workspaces with active free-access',
});

export const expiryDaysRemainingGauge = new Gauge({
  name: 'free_access_expiry_days_remaining',
  help: 'Days until free-access expiry (per workspace)',
  labelNames: ['workspace_id'],
});

// Export metrics endpoint
export function metricsEndpoint() {
  return register.metrics();
}
```

### Step 2: Integrate Into Middleware

```typescript
// apps/web/lib/free-access-mode.ts

import {
  cacheHitsCounter,
  cacheMissesCounter,
  middlewareDurationHistogram,
  dbQueryDurationHistogram,
  middlewareFailuresCounter,
} from './free-access-monitoring';

export async function attachFreeAccessContext(
  workspace: Workspace,
): Promise<FreeAccessContext> {
  const startTime = Date.now();
  
  try {
    // Check cache
    const cached = freeAccessCache.get(workspace.id);
    if (cached && !isExpired(cached)) {
      cacheHitsCounter.inc({ workspace_id: workspace.id });
      
      const duration = Date.now() - startTime;
      middlewareDurationHistogram
        .labels('hit', workspace.id)
        .observe(duration);
      
      return {
        workspaceId: workspace.id,
        isFreeAccess: cached.until !== null && new Date(cached.until) > new Date(),
        expiresAt: cached.until || undefined,
      };
    }

    // Cache miss: query database
    cacheMissesCounter.inc({ workspace_id: workspace.id });
    
    const dbStart = Date.now();
    const freeAccessUntil = await queryFreeAccessStatus(workspace.id);
    const dbDuration = Date.now() - dbStart;
    
    dbQueryDurationHistogram
      .labels('status_check', workspace.id)
      .observe(dbDuration);

    // Update cache
    const cacheEntry: FreeAccessCacheEntry = {
      until: freeAccessUntil || null,
      checkedAt: Date.now(),
    };
    freeAccessCache.set(workspace.id, cacheEntry);

    const totalDuration = Date.now() - startTime;
    middlewareDurationHistogram
      .labels('miss', workspace.id)
      .observe(totalDuration);

    return {
      workspaceId: workspace.id,
      isFreeAccess: freeAccessUntil !== null && new Date(freeAccessUntil) > new Date(),
      expiresAt: freeAccessUntil || undefined,
    };
  } catch (error) {
    middlewareFailuresCounter.inc({
      error_type: error instanceof DatabaseError ? 'database' : 'unknown',
      endpoint: 'free-access-middleware',
    });

    // Fail-open: return safe default
    return {
      workspaceId: workspace.id,
      isFreeAccess: false,
    };
  }
}
```

### Step 3: Add Metrics Endpoint

```typescript
// app/api/metrics/route.ts

import { metricsEndpoint } from '@/lib/free-access-monitoring';

export async function GET() {
  return new Response(metricsEndpoint(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
```

**Verification:**
```bash
curl http://localhost:3000/api/metrics | grep free_access_
# Should output lines like:
# free_access_cache_hits_total{workspace_id="abc123"} 145
```

---

## Prometheus Configuration

### Step 1: Add Scrape Job

Update `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'onevyrt-web'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s  # Slower for low-volume metrics
    
  - job_name: 'free-access-monitoring'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/api/metrics'
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'free_access_.*'
        action: 'keep'
```

### Step 2: Deploy Prometheus

```bash
# Using Docker Compose
version: '3'
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'

volumes:
  prometheus-data:
```

**Start:**
```bash
docker-compose up -d prometheus
# Access: http://localhost:9090
```

### Step 3: Verify Data Collection

```
In Prometheus UI (http://localhost:9090):
1. Go to "Metrics" tab
2. Type: free_access_cache_hits_total
3. Should see values (e.g., 1523)
4. If empty: Check /api/metrics endpoint is reachable
```

---

## Grafana Dashboard

### Step 1: Deploy Grafana

```bash
# Using Docker Compose
services:
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  grafana-data:
```

**Start:**
```bash
docker-compose up -d grafana
# Access: http://localhost:3001 (admin/admin)
```

### Step 2: Add Prometheus Datasource

1. Go to **Connections > Data sources**
2. Click **Add data source**
3. Select **Prometheus**
4. Set URL: `http://prometheus:9090`
5. Click **Save & test**

### Step 3: Create Dashboard

**Import the JSON below or create manually:**

```json
{
  "dashboard": {
    "title": "Free-Access Mode Monitoring",
    "panels": [
      {
        "title": "Cache Hit Rate",
        "targets": [
          {
            "expr": "rate(free_access_cache_hits_total[5m]) / (rate(free_access_cache_hits_total[5m]) + rate(free_access_cache_misses_total[5m]))"
          }
        ],
        "type": "stat",
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "value": 0, "color": "red" },
            { "value": 0.85, "color": "orange" },
            { "value": 0.95, "color": "green" }
          ]
        }
      },
      {
        "title": "Middleware Latency (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(free_access_middleware_duration_ms_bucket[5m]))"
          }
        ],
        "type": "graph",
        "yaxes": [
          { "label": "milliseconds" }
        ]
      },
      {
        "title": "Database Query Time (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(free_access_db_query_duration_ms_bucket[5m]))"
          }
        ],
        "type": "graph",
        "yaxes": [
          { "label": "milliseconds" }
        ]
      },
      {
        "title": "Active Free-Access Workspaces",
        "targets": [
          {
            "expr": "free_access_active_workspaces"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(free_access_middleware_failures_total[5m])"
          }
        ],
        "type": "graph",
        "alert": {
          "alertName": "HighFreeAccessErrorRate",
          "conditions": [
            {
              "operator": { "type": "gt" },
              "query": { "params": ["0.001"] },
              "type": "query"
            }
          ]
        }
      },
      {
        "title": "Invalid Timestamp Attempts",
        "targets": [
          {
            "expr": "rate(free_access_invalid_timestamp_errors_total[1h])"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

### Dashboard Panels Explained

| Panel | Shows | Alert If |
|-------|-------|----------|
| Cache Hit Rate | % of requests served from cache | < 85% |
| Middleware Latency | Time to attach free-access context | P95 > 100ms |
| DB Query Time | Database query performance | P95 > 50ms |
| Active Workspaces | Count with active free-access | N/A (informational) |
| Error Rate | Middleware failures per second | > 0.1% |
| Invalid Timestamps | Failed input validation attempts | > 5/day |

---

## Alerting Rules

### Step 1: Define Alert Rules

Create `prometheus-rules.yml`:

```yaml
groups:
  - name: free_access_alerts
    interval: 30s
    rules:
      # Alert 1: Low cache hit rate
      - alert: FreeAccessLowCacheHitRate
        expr: |
          (
            rate(free_access_cache_hits_total[5m]) / 
            (rate(free_access_cache_hits_total[5m]) + rate(free_access_cache_misses_total[5m]))
          ) < 0.85
        for: 10m
        labels:
          severity: warning
          component: free-access
        annotations:
          summary: "Free-Access cache hit rate low ({{ $value | humanizePercentage }})"
          description: "Cache hit rate is {{ $value | humanizePercentage }}, expected > 85%"
          dashboard: "http://grafana:3001/d/free-access-monitoring"

      # Alert 2: High middleware latency
      - alert: FreeAccessHighLatency
        expr: |
          histogram_quantile(0.95, rate(free_access_middleware_duration_ms_bucket[5m])) > 100
        for: 5m
        labels:
          severity: warning
          component: free-access
        annotations:
          summary: "Free-Access middleware P95 latency high"
          description: "P95 latency is {{ $value }}ms, expected < 50ms"
          runbook: "https://docs.onevyrt.com/runbooks/free-access-latency"

      # Alert 3: High error rate
      - alert: FreeAccessHighErrorRate
        expr: |
          (rate(free_access_middleware_failures_total[5m]) > 0.001) or
          (free_access_middleware_failures_total - free_access_middleware_failures_total offset 5m > 10)
        for: 5m
        labels:
          severity: critical
          component: free-access
        annotations:
          summary: "Free-Access middleware error rate critical"
          description: "Error rate is {{ $value | humanizePercentage }}"
          runbook: "https://docs.onevyrt.com/runbooks/free-access-errors"
          action: "Page on-call engineer"

      # Alert 4: Database query slow
      - alert: FreeAccessDatabaseSlow
        expr: |
          histogram_quantile(0.95, rate(free_access_db_query_duration_ms_bucket[5m])) > 50
        for: 10m
        labels:
          severity: warning
          component: free-access
        annotations:
          summary: "Free-Access database queries slow"
          description: "P95 query time is {{ $value }}ms"
          runbook: "https://docs.onevyrt.com/runbooks/free-access-db-slow"

      # Alert 5: Invalid input attempts spike
      - alert: FreeAccessInvalidInputSpike
        expr: |
          rate(free_access_invalid_timestamp_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
          component: free-access
        annotations:
          summary: "Spike in invalid input attempts"
          description: "Invalid inputs per second: {{ $value }}"
          reason: "Could indicate malicious activity or client bug"

      # Alert 6: Cache hit rate by workspace (anomaly detection)
      - alert: FreeAccessWorkspaceCacheAnomaly
        expr: |
          (
            rate(free_access_cache_hits_total{workspace_id!=""}[5m]) / 
            (rate(free_access_cache_hits_total{workspace_id!=""}[5m]) + rate(free_access_cache_misses_total{workspace_id!=""}[5m]))
          ) < 0.7
        for: 15m
        labels:
          severity: warning
          component: free-access
        annotations:
          summary: "Workspace {{ $labels.workspace_id }} has low cache hit rate"
          description: "Hit rate: {{ $value | humanizePercentage }}"

      # Alert 7: Free-access expiry approaching (24 hours)
      - alert: FreeAccessExpiringSOON
        expr: |
          (free_access_expiry_days_remaining > 0) and (free_access_expiry_days_remaining < 1)
        for: 1h
        labels:
          severity: info
          component: free-access
        annotations:
          summary: "Free-Access expires in < 24 hours for workspace {{ $labels.workspace_id }}"
          description: "Days remaining: {{ $value }}"
          action: "Renew if needed"
```

### Step 2: Load Rules Into Prometheus

Update `prometheus.yml`:

```yaml
rule_files:
  - '/etc/prometheus/prometheus-rules.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093
```

### Step 3: Configure AlertManager

Create `alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

route:
  receiver: 'slack-notifications'
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h

receivers:
  - name: 'slack-notifications'
    slack_configs:
      - channel: '#incidents'
        title: 'Free-Access Alert: {{ .GroupLabels.alertname }}'
        text: |
          {{ range .Alerts }}
          {{ .Annotations.summary }}
          {{ .Annotations.description }}
          {{ end }}
        send_resolved: true

  - name: 'pagerduty-critical'
    pagerduty_configs:
      - service_key: 'YOUR_PAGERDUTY_KEY'
```

---

## Usage Telemetry

### Track Feature Usage

```typescript
// apps/web/lib/free-access-telemetry.ts

import { Counter } from 'prom-client';

// Feature usage counters
export const featureAccessCounter = new Counter({
  name: 'free_access_feature_access_total',
  help: 'Cumulative feature accesses in free-access mode',
  labelNames: ['workspace_id', 'feature', 'free_access_mode'],
});

export const submissionAutoApprovalCounter = new Counter({
  name: 'free_access_auto_approval_total',
  help: 'Submissions auto-approved due to free-access',
  labelNames: ['workspace_id', 'submission_type'],
});

export const notificationSuppressedCounter = new Counter({
  name: 'free_access_notifications_suppressed_total',
  help: 'Notifications suppressed in free-access mode',
  labelNames: ['workspace_id', 'notification_type'],
});

export function trackFeatureAccess(
  workspaceId: string,
  feature: string,
  isFreeAccess: boolean,
) {
  featureAccessCounter.inc({
    workspace_id: workspaceId,
    feature,
    free_access_mode: isFreeAccess ? 'yes' : 'no',
  });
}

export function trackAutoApproval(
  workspaceId: string,
  submissionType: string,
) {
  submissionAutoApprovalCounter.inc({
    workspace_id: workspaceId,
    submission_type: submissionType,
  });
}

export function trackNotificationSuppressed(
  workspaceId: string,
  notificationType: string,
) {
  notificationSuppressedCounter.inc({
    workspace_id: workspaceId,
    notification_type: notificationType,
  });
}
```

### Usage Dashboard Queries

```sql
-- Grafana dashboard for usage insights

-- 1. Most-used features in free-access mode
SELECT
  feature,
  COUNT(*) as usage_count
FROM free_access_feature_access
WHERE free_access_mode = true
GROUP BY feature
ORDER BY usage_count DESC
LIMIT 10;

-- 2. Total auto-approvals per workspace
SELECT
  workspace_id,
  COUNT(*) as approval_count
FROM free_access_auto_approval
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY workspace_id
ORDER BY approval_count DESC;

-- 3. Notifications suppressed (cost savings)
SELECT
  notification_type,
  COUNT(*) as suppressed_count,
  COUNT(*) * 0.01 as estimated_cost_savings_usd
FROM free_access_notifications_suppressed
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY notification_type;
```

---

## Dashboards & Queries

### Dashboard 1: System Health

**Queries:**

```
# Cache performance
rate(free_access_cache_hits_total[5m]) / (rate(free_access_cache_hits_total[5m]) + rate(free_access_cache_misses_total[5m]))

# Error rate
rate(free_access_middleware_failures_total[5m])

# Latency trend
histogram_quantile(0.95, rate(free_access_middleware_duration_ms_bucket[5m]))
```

### Dashboard 2: Usage Analytics

**Queries:**

```
# Active workspaces with free-access
free_access_active_workspaces

# Features accessed in free-access mode
topk(10, sum(rate(free_access_feature_access_total{free_access_mode="yes"}[1h])) by (feature))

# Auto-approvals per hour
rate(free_access_auto_approval_total[1h])
```

### Dashboard 3: Capacity Planning

**Queries:**

```
# Cache size growth
increase(free_access_cache_hits_total[24h]) / 86400  # per-second average

# Database load
rate(free_access_db_query_duration_ms_sum[5m]) / rate(free_access_db_query_duration_ms_count[5m])

# Container memory usage
container_memory_usage_bytes{pod="web-*"}
```

---

## Alert Response Playbooks

### Alert: Low Cache Hit Rate

**Detection:** `free_access_cache_hit_rate < 0.85`

**Investigation:**
1. Check if TTL was recently changed
2. Verify cache isn't being cleared too often
3. Look for unusual spike in unique workspaces

**Response:**
- If TTL too short: increase to 15 minutes
- If memory pressure: reduce cache size limit
- If legitimately more workspaces: scale resources

---

### Alert: High Error Rate

**Detection:** `free_access_middleware_failures_total > 0.001`

**Investigation:**
1. Check error logs: `kubectl logs -l app=web | grep free-access-middleware`
2. Identify error type: database, validation, network
3. Determine if affecting all or specific workspaces

**Response:**
- Database errors: check DB connection pool
- Validation errors: review recent input
- Network errors: check infrastructure

---

### Alert: High Latency

**Detection:** `P95 latency > 100ms`

**Investigation:**
1. Check cache hit rate (should be high)
2. Check DB query times
3. Look for resource contention

**Response:**
- Low cache hit rate: debug cache invalidation
- DB slow: analyze query plan, add index
- Resource contention: scale containers

---

## Setup Checklist

```
□ Step 1: Add metrics instrumentation
□ Step 2: Deploy Prometheus
□ Step 3: Deploy Grafana
□ Step 4: Add Prometheus data source to Grafana
□ Step 5: Create/import dashboard
□ Step 6: Define alert rules in prometheus-rules.yml
□ Step 7: Deploy AlertManager
□ Step 8: Test alert notification (Slack/PagerDuty)
□ Step 9: Add usage telemetry instrumentation
□ Step 10: Verify metrics endpoint: curl http://localhost:3000/api/metrics

VERIFICATION:
□ Metrics endpoint returns data
□ Prometheus scrapes successfully (localhost:9090)
□ Grafana shows data (localhost:3001)
□ Alerts fire when triggered
□ Notifications reach Slack/PagerDuty
```

---

## Performance Baselines

Expected values for healthy system:

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Cache hit rate | > 95% | 85-95% | < 85% |
| P95 latency | < 30ms | 30-100ms | > 100ms |
| Error rate | < 0.01% | 0.01-0.1% | > 0.1% |
| DB query P95 | < 20ms | 20-50ms | > 50ms |
| Active workspaces | < 10k | 10k-50k | > 50k |

---

## Related Documents

- [FREE_ACCESS_ARCHITECTURE.md](./FREE_ACCESS_ARCHITECTURE.md) — System design
- [FREE_ACCESS_TROUBLESHOOTING.md](./FREE_ACCESS_TROUBLESHOOTING.md) — Troubleshooting guide
- [FREE_ACCESS_INCIDENT_RESPONSE.md](./FREE_ACCESS_INCIDENT_RESPONSE.md) — Incident playbook

---

**End of Monitoring Guide**
