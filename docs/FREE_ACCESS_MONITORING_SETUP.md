# Free-Access Mode: Complete Monitoring & Telemetry Setup

**Document Version:** 1.0  
**Last Updated:** 2026-09-03  
**Audience:** DevOps, SRE, Engineering  
**Status:** Production-Ready

## Quick Start

**Time to Deploy:** ~30 minutes  
**Prerequisites:** Kubernetes cluster, Docker, access to GitHub Actions

### Fast Path (5 Steps)

```bash
# 1. Clone monitoring repo
git clone https://github.com/onevyrt/monitoring-stack.git
cd monitoring-stack

# 2. Update configuration
cp .env.example .env
# Edit .env with your values:
# - PROMETHEUS_RETENTION_DAYS=30
# - GRAFANA_ADMIN_PASSWORD=<secure>
# - SLACK_WEBHOOK_URL=https://hooks.slack.com/...
# - PAGERDUTY_SERVICE_KEY=<your_key>

# 3. Deploy stack
kubectl apply -f k8s/
# Wait for pods to be ready
kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring

# 4. Verify data collection
curl http://localhost:9090/api/query?query=free_access_cache_hits_total
# Should return metrics

# 5. Access dashboards
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3001 (admin/admin → change password!)
# AlertManager: http://localhost:9093

echo "✓ Monitoring stack deployed successfully"
```

---

## Detailed Setup

### Part 1: Instrumentation (10 minutes)

#### 1A. Add Metrics Library to App

```bash
# In apps/web directory
npm install prom-client
```

#### 1B. Create Monitoring Module

**File:** `/apps/web/lib/free-access-monitoring.ts`

```typescript
import { Counter, Histogram, Gauge, register } from 'prom-client';

// Create metrics
export const cacheHitsCounter = new Counter({
  name: 'free_access_cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['workspace_id'],
});

export const cacheMissesCounter = new Counter({
  name: 'free_access_cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['workspace_id'],
});

export const middlewareDurationHistogram = new Histogram({
  name: 'free_access_middleware_duration_ms',
  help: 'Middleware execution time',
  labelNames: ['cache_status', 'workspace_id'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

export const dbQueryDurationHistogram = new Histogram({
  name: 'free_access_db_query_duration_ms',
  help: 'Database query time',
  labelNames: ['query_type'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
});

export const middlewareFailuresCounter = new Counter({
  name: 'free_access_middleware_failures_total',
  help: 'Total middleware failures',
  labelNames: ['error_type', 'endpoint'],
});

export const activeWorkspacesGauge = new Gauge({
  name: 'free_access_active_workspaces',
  help: 'Number of active free-access workspaces',
});

// Export metrics endpoint
export function metricsEndpoint() {
  return register.metrics();
}

// Utility: Record middleware execution
export function recordMiddlewareMetrics(
  duration: number,
  cacheStatus: 'hit' | 'miss',
  workspaceId: string,
) {
  middlewareDurationHistogram
    .labels(cacheStatus, workspaceId)
    .observe(duration);
}

export function recordDbQueryMetrics(
  duration: number,
  queryType: string,
) {
  dbQueryDurationHistogram
    .labels(queryType)
    .observe(duration);
}
```

#### 1C. Integrate Monitoring Into Middleware

**File:** `/apps/web/lib/free-access-mode.ts`

```typescript
import {
  recordMiddlewareMetrics,
  recordDbQueryMetrics,
  cacheHitsCounter,
  cacheMissesCounter,
  middlewareFailuresCounter,
  activeWorkspacesGauge,
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
      recordMiddlewareMetrics(duration, 'hit', workspace.id);

      return {
        workspaceId: workspace.id,
        isFreeAccess:
          cached.until !== null && new Date(cached.until) > new Date(),
        expiresAt: cached.until || undefined,
      };
    }

    // Cache miss: query database
    cacheMissesCounter.inc({ workspace_id: workspace.id });

    const dbStart = Date.now();
    const freeAccessUntil = await queryFreeAccessStatus(workspace.id);
    const dbDuration = Date.now() - dbStart;

    recordDbQueryMetrics(dbDuration, 'status_check');

    // Update cache
    const cacheEntry: FreeAccessCacheEntry = {
      until: freeAccessUntil || null,
      checkedAt: Date.now(),
    };
    freeAccessCache.set(workspace.id, cacheEntry);

    const totalDuration = Date.now() - startTime;
    recordMiddlewareMetrics(totalDuration, 'miss', workspace.id);

    // Update gauge
    const activeCount = Array.from(freeAccessCache.values()).filter(
      (e) => e.until && new Date(e.until) > new Date(),
    ).length;
    activeWorkspacesGauge.set(activeCount);

    return {
      workspaceId: workspace.id,
      isFreeAccess:
        freeAccessUntil !== null && new Date(freeAccessUntil) > new Date(),
      expiresAt: freeAccessUntil || undefined,
    };
  } catch (error) {
    middlewareFailuresCounter.inc({
      error_type: error instanceof DatabaseError ? 'database' : 'unknown',
      endpoint: 'free-access-middleware',
    });

    return {
      workspaceId: workspace.id,
      isFreeAccess: false,
    };
  }
}
```

#### 1D. Add Metrics Endpoint

**File:** `/apps/web/app/api/metrics/route.ts`

```typescript
import { metricsEndpoint } from '@/lib/free-access-monitoring';
import { currentUser } from '@/lib/auth';

// Restrict metrics endpoint to internal/admin
export async function GET(request: Request) {
  // Security: require admin or internal service
  const user = await currentUser(request.headers.get('cookie'));
  const authHeader = request.headers.get('authorization');

  if (!user?.isAdmin && authHeader !== `Bearer ${process.env.METRICS_TOKEN}`) {
    return new Response('Forbidden', { status: 403 });
  }

  return new Response(metricsEndpoint(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
```

#### 1E. Test Instrumentation

```bash
# Start app locally
npm run dev

# Trigger some free-access requests
curl http://localhost:3000/api/projects/list \
  -H "Cookie: auth_session=..."

# Check metrics
curl http://localhost:3000/api/metrics | grep free_access_

# Should output:
# free_access_cache_hits_total{workspace_id="abc123"} 1
# free_access_middleware_duration_ms_bucket{...} 42
```

---

### Part 2: Prometheus Deployment (5 minutes)

#### 2A. Create Prometheus Configuration

**File:** `/deploy/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 30s        # Scrape every 30 seconds
  evaluation_interval: 30s    # Evaluate rules every 30 seconds
  external_labels:
    cluster: 'production'
    environment: 'prod'

# Alert configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Load rules
rule_files:
  - '/etc/prometheus/prometheus-rules.yml'

scrape_configs:
  # Kubernetes metrics
  - job_name: 'kubernetes-apiservers'
    kubernetes_sd_configs:
      - role: endpoints
    scheme: https
    tls_config:
      ca_file: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
    bearer_token_file: /var/run/secrets/kubernetes.io/serviceaccount/token
    relabel_configs:
      - source_labels: [__meta_kubernetes_namespace, __meta_kubernetes_service_name, __meta_kubernetes_endpoint_port_name]
        action: keep
        regex: default;kubernetes;https

  # Scrape Free-Access metrics
  - job_name: 'onevyrt-web'
    static_configs:
      - targets: ['web:3000']
    metrics_path: '/api/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s
    bearer_token: '${METRICS_TOKEN}'
    # Only keep free_access_* metrics
    metric_relabel_configs:
      - source_labels: [__name__]
        regex: 'free_access_.*'
        action: 'keep'

  # Node exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

#### 2B. Create Alert Rules

**File:** `/deploy/prometheus/prometheus-rules.yml`

```yaml
groups:
  - name: free_access_alerts
    interval: 30s
    rules:
      - alert: FreeAccessLowCacheHitRate
        expr: |
          (rate(free_access_cache_hits_total[5m]) / 
           (rate(free_access_cache_hits_total[5m]) + rate(free_access_cache_misses_total[5m]))) < 0.85
        for: 10m
        labels:
          severity: warning
          component: free-access
        annotations:
          summary: "Free-Access cache hit rate low: {{ $value | humanizePercentage }}"
          dashboard: "http://grafana:3001/d/free-access"

      - alert: FreeAccessHighErrorRate
        expr: rate(free_access_middleware_failures_total[5m]) > 0.001
        for: 5m
        labels:
          severity: critical
          component: free-access
        annotations:
          summary: "Free-Access error rate critical: {{ $value | humanizePercentage }}"
          action: "Page on-call engineer"

      - alert: FreeAccessHighLatency
        expr: histogram_quantile(0.95, rate(free_access_middleware_duration_ms_bucket[5m])) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Free-Access P95 latency high: {{ $value }}ms"

      - alert: FreeAccessDatabaseSlow
        expr: histogram_quantile(0.95, rate(free_access_db_query_duration_ms_bucket[5m])) > 50
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Free-Access database queries slow: {{ $value }}ms"
```

#### 2C. Deploy Prometheus

**File:** `/k8s/monitoring/prometheus-deployment.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    # Contents of prometheus.yml (above)
  prometheus-rules.yml: |
    # Contents of prometheus-rules.yml (above)

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prometheus
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
        - name: prometheus
          image: prom/prometheus:latest
          ports:
            - containerPort: 9090
          args:
            - '--config.file=/etc/prometheus/prometheus.yml'
            - '--storage.tsdb.path=/prometheus'
            - '--storage.tsdb.retention.time=30d'
          volumeMounts:
            - name: config
              mountPath: /etc/prometheus
            - name: data
              mountPath: /prometheus
      volumes:
        - name: config
          configMap:
            name: prometheus-config
        - name: data
          emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: prometheus
  namespace: monitoring
spec:
  selector:
    app: prometheus
  ports:
    - port: 9090
      targetPort: 9090
  type: ClusterIP
```

#### 2D. Deploy

```bash
kubectl create namespace monitoring
kubectl apply -f k8s/monitoring/

# Wait for Prometheus
kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=300s

# Verify
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &
curl http://localhost:9090/api/v1/query?query=free_access_cache_hits_total
```

---

### Part 3: Grafana Dashboards (8 minutes)

#### 3A. Deploy Grafana

**File:** `/k8s/monitoring/grafana-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:latest
          ports:
            - containerPort: 3000
          env:
            - name: GF_SECURITY_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: grafana-secret
                  key: admin-password
            - name: GF_INSTALL_PLUGINS
              value: 'grafana-piechart-panel'
          volumeMounts:
            - name: data
              mountPath: /var/lib/grafana
      volumes:
        - name: data
          emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: grafana
  namespace: monitoring
spec:
  selector:
    app: grafana
  ports:
    - port: 3000
      targetPort: 3000
  type: LoadBalancer
```

#### 3B: Add Prometheus Datasource

Login to Grafana (admin/password):

```
1. Click "Configuration" (gear icon)
2. Click "Data Sources"
3. Click "Add data source"
4. Select "Prometheus"
5. URL: http://prometheus:9090
6. Click "Save & Test"
```

#### 3C: Import Dashboard

**File:** `/deploy/grafana/dashboard-free-access.json`

```json
{
  "dashboard": {
    "title": "Free-Access Mode",
    "uid": "free-access-mode",
    "tags": ["free-access", "monitoring"],
    "panels": [
      {
        "title": "Cache Hit Rate (%)",
        "targets": [
          {
            "expr": "(rate(free_access_cache_hits_total[5m]) / (rate(free_access_cache_hits_total[5m]) + rate(free_access_cache_misses_total[5m]))) * 100"
          }
        ],
        "type": "stat",
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "value": null, "color": "green" },
            { "value": 85, "color": "yellow" },
            { "value": 70, "color": "red" }
          ]
        }
      },
      {
        "title": "Middleware Latency - P50/P95/P99 (ms)",
        "targets": [
          {
            "legendFormat": "P50",
            "expr": "histogram_quantile(0.5, rate(free_access_middleware_duration_ms_bucket[5m]))"
          },
          {
            "legendFormat": "P95",
            "expr": "histogram_quantile(0.95, rate(free_access_middleware_duration_ms_bucket[5m]))"
          },
          {
            "legendFormat": "P99",
            "expr": "histogram_quantile(0.99, rate(free_access_middleware_duration_ms_bucket[5m]))"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate (errors/sec)",
        "targets": [
          {
            "expr": "rate(free_access_middleware_failures_total[5m])"
          }
        ],
        "type": "graph",
        "alert": {
          "name": "HighErrorRate",
          "message": "Error rate exceeded threshold"
        }
      },
      {
        "title": "Active Free-Access Workspaces",
        "targets": [
          {
            "expr": "free_access_active_workspaces"
          }
        ],
        "type": "stat"
      }
    ]
  }
}
```

**Import:**
```
1. In Grafana, click "+" (create)
2. Click "Import"
3. Upload JSON file or paste JSON
4. Click "Import"
```

---

### Part 4: AlertManager Setup (5 minutes)

#### 4A. Configure AlertManager

**File:** `/deploy/alertmanager/alertmanager.yml`

```yaml
global:
  resolve_timeout: 5m
  slack_api_url: '${SLACK_WEBHOOK_URL}'

route:
  receiver: 'default'
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 4h
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'
      repeat_interval: 1h

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#incidents'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'
        send_resolved: true

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ .GroupLabels.alertname }}'
```

#### 4B. Deploy AlertManager

**File:** `/k8s/monitoring/alertmanager-deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertmanager
  namespace: monitoring
spec:
  replicas: 1
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
        - name: alertmanager
          image: prom/alertmanager:latest
          ports:
            - containerPort: 9093
          args:
            - '--config.file=/etc/alertmanager/alertmanager.yml'
            - '--storage.path=/alertmanager'
          volumeMounts:
            - name: config
              mountPath: /etc/alertmanager
            - name: data
              mountPath: /alertmanager
      volumes:
        - name: config
          configMap:
            name: alertmanager-config
        - name: data
          emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: alertmanager
  namespace: monitoring
spec:
  selector:
    app: alertmanager
  ports:
    - port: 9093
      targetPort: 9093
```

#### 4C. Deploy

```bash
kubectl create secret generic alertmanager-env \
  --from-literal=SLACK_WEBHOOK_URL='...' \
  --from-literal=PAGERDUTY_SERVICE_KEY='...' \
  -n monitoring

# Inject into config
envsubst < deploy/alertmanager/alertmanager.yml > /tmp/alertmanager.yml
kubectl create configmap alertmanager-config --from-file=/tmp/alertmanager.yml -n monitoring

kubectl apply -f k8s/monitoring/alertmanager-deployment.yaml
```

---

### Part 5: Testing & Validation (5 minutes)

#### 5A. Test Prometheus Scraping

```bash
# Port forward
kubectl port-forward -n monitoring svc/prometheus 9090:9090 &

# In browser or curl
curl 'http://localhost:9090/api/v1/query?query=free_access_cache_hits_total'

# Should return data like:
# {
#   "status": "success",
#   "data": {
#     "resultType": "vector",
#     "result": [
#       {
#         "metric": {
#           "__name__": "free_access_cache_hits_total",
#           "workspace_id": "abc123"
#         },
#         "value": [1693737600, "1523"]
#       }
#     ]
#   }
# }
```

#### 5B. Test Grafana

```bash
kubectl port-forward -n monitoring svc/grafana 3001:3000 &

# Open: http://localhost:3001
# Login: admin / password
# Navigate to Free-Access Mode dashboard
# Should see: cache hit rate, latency, errors, active workspaces
```

#### 5C. Test Alerts

Manually trigger low cache hit rate:

```bash
# Directly query Prometheus to check alert status
curl 'http://localhost:9090/api/v1/alerts'

# Should show: state: "pending" or "firing"
```

#### 5D. Full Health Check

```bash
# Script to validate setup
cat << 'EOF' > /tmp/validate-monitoring.sh
#!/bin/bash

echo "Validating monitoring setup..."

# Check Prometheus
echo "1. Checking Prometheus..."
if curl -s http://prometheus:9090/api/v1/query?query=free_access_cache_hits_total | grep -q '"status":"success"'; then
  echo "   ✓ Prometheus metrics available"
else
  echo "   ✗ Prometheus metrics NOT available"
  exit 1
fi

# Check Grafana
echo "2. Checking Grafana..."
if curl -s http://grafana:3000/api/datasources | grep -q "prometheus"; then
  echo "   ✓ Grafana datasource configured"
else
  echo "   ✗ Grafana datasource NOT configured"
  exit 1
fi

# Check AlertManager
echo "3. Checking AlertManager..."
if curl -s http://alertmanager:9093/api/v1/alerts | jq . > /dev/null 2>&1; then
  echo "   ✓ AlertManager responding"
else
  echo "   ✗ AlertManager NOT responding"
  exit 1
fi

echo ""
echo "✓ All monitoring components healthy"
echo ""
echo "Access points:"
echo "  Prometheus: http://prometheus:9090"
echo "  Grafana:    http://grafana:3001"
echo "  AlertMgr:   http://alertmanager:9093"
EOF

chmod +x /tmp/validate-monitoring.sh
/tmp/validate-monitoring.sh
```

---

## Production Deployment Checklist

```
Pre-Deployment:
□ All monitoring code reviewed and merged
□ Instrumentation tested locally
□ Prometheus config validated
□ Dashboard JSON imported
□ AlertManager config set
□ Slack/PagerDuty webhooks working
□ Kubernetes secrets created
□ Capacity planned (storage for 30 days retention)

Deployment:
□ Create monitoring namespace
□ Deploy Prometheus
□ Deploy AlertManager
□ Deploy Grafana
□ Configure datasources
□ Import dashboards
□ Test alerts
□ Test Slack notifications

Post-Deployment:
□ Monitor metrics collection for 1 hour
□ Verify alert firing (test at least one)
□ Document dashboard links
□ Share access with team
□ Add dashboards to runbooks
□ Schedule training/demo

Ongoing:
□ Review metrics retention monthly
□ Adjust alert thresholds based on baseline
□ Add new metrics as needed
□ Update documentation
```

---

## Cost Estimation

```
Monthly costs (AWS/GCP estimates):

Prometheus (tsdb storage):
  - 30-day retention: ~50 GB
  - EBS/Persistent disk: $50-100/month

Grafana Cloud (alternative):
  - Metrics ingestion: ~$20-50/month
  - Dashboards: included

AlertManager:
  - Slack: Free
  - PagerDuty: $9.95+/user/month (optional)

Total: $50-200/month for full observability
```

---

## Next Steps

1. **Baseline Metrics:** Collect baseline data for 1 week
2. **Alert Tuning:** Adjust alert thresholds based on actual data
3. **Runbook Updates:** Link dashboard to incident response playbooks
4. **Team Training:** Show team how to use dashboards
5. **Continuous Improvement:** Monitor effectiveness, iterate

---

## Related Documents

- [FREE_ACCESS_MONITORING.md](./FREE_ACCESS_MONITORING.md) — Detailed metrics guide
- [FREE_ACCESS_INCIDENT_RESPONSE.md](./FREE_ACCESS_INCIDENT_RESPONSE.md) — Incident playbook
- [FREE_ACCESS_TROUBLESHOOTING.md](./FREE_ACCESS_TROUBLESHOOTING.md) — Troubleshooting guide

---

**End of Complete Monitoring Setup**
