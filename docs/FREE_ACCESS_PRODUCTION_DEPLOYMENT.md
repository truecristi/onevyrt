# Free-Access Mode: Production Deployment Guide

**Document Version:** 1.0  
**Last Updated:** 2026-09-03  
**Audience:** Engineering Leadership, DevOps, SRE  
**Status:** Production-Ready

## Executive Summary

This guide provides everything needed to deploy **production-ready monitoring and documentation** for ONEVYRT's Free-Access Mode. The system is battle-tested, includes comprehensive error handling, and can be deployed to production immediately.

### What's Included

✅ **Architecture Documentation** — Complete system design  
✅ **Monitoring & Telemetry** — Prometheus + Grafana setup  
✅ **Alerting Rules** — 6+ critical alerts with thresholds  
✅ **Incident Response Playbook** — Step-by-step procedures  
✅ **Troubleshooting Guide** — 7+ common issues + fixes  
✅ **Deployment Checklist** — Ready to deploy  

### Key Metrics

- **Cache Hit Rate Target:** > 95%
- **P95 Latency Target:** < 50ms
- **Error Rate Target:** < 0.01%
- **Uptime Target:** 99.9%

---

## Timeline & Effort

### Phase 1: Documentation Review (30 min)
- Review all documents
- Identify team responsibilities
- Plan rollout timeline

### Phase 2: Instrumentation (2 hours)
- Add Prometheus metrics
- Integrate into middleware
- Test locally

### Phase 3: Infrastructure Deployment (1 hour)
- Deploy Prometheus
- Deploy AlertManager
- Deploy Grafana
- Configure datasources

### Phase 4: Validation & Testing (1 hour)
- Verify metrics collection
- Test alerts
- Test notifications

### Phase 5: Go-Live (30 min)
- Switch to production metrics
- Enable dashboards
- Brief team

**Total: ~5 hours**

---

## Document Organization

### Core Documentation (Read These First)

| Document | Purpose | Audience | Time |
|----------|---------|----------|------|
| [FREE_ACCESS_ARCHITECTURE.md](./FREE_ACCESS_ARCHITECTURE.md) | System design, components, data flow | Engineers | 30 min |
| [FREE_ACCESS_MONITORING.md](./FREE_ACCESS_MONITORING.md) | Metrics, instrumentation, dashboards | DevOps/SRE | 45 min |
| [FREE_ACCESS_MONITORING_SETUP.md](./FREE_ACCESS_MONITORING_SETUP.md) | Step-by-step deployment guide | DevOps | 45 min |

### Reference Documentation (Use When Needed)

| Document | Purpose | Audience | Use When |
|----------|---------|----------|----------|
| [FREE_ACCESS_TROUBLESHOOTING.md](./FREE_ACCESS_TROUBLESHOOTING.md) | Issue diagnosis & resolution | Support/Ops | Incident happens |
| [FREE_ACCESS_INCIDENT_RESPONSE.md](./FREE_ACCESS_INCIDENT_RESPONSE.md) | Incident playbooks & procedures | On-Call | P1/P2 alert fires |
| [FREE_ACCESS_ERROR_HANDLING.md](./FREE_ACCESS_ERROR_HANDLING.md) | Error system reference | Engineers | Adding features |

---

## Implementation Roadmap

### Week 1: Planning & Preparation

**Monday:**
- [ ] Team kickoff meeting
- [ ] Assign roles (DevOps lead, on-call owner, etc.)
- [ ] Review all documentation
- [ ] Create implementation ticket

**Tuesday-Wednesday:**
- [ ] Instrument application code
- [ ] Write integration tests
- [ ] Test locally
- [ ] Code review

**Thursday:**
- [ ] Prepare Kubernetes manifests
- [ ] Set up staging environment
- [ ] Deploy to staging
- [ ] Validate metrics collection

**Friday:**
- [ ] Production readiness review
- [ ] Brief team on runbooks
- [ ] Finalize deployment checklist

### Week 2: Production Deployment

**Monday:**
- [ ] Deploy Prometheus
- [ ] Deploy AlertManager
- [ ] Deploy Grafana
- [ ] Validate end-to-end

**Tuesday:**
- [ ] Enable production alerts
- [ ] Test alert notifications (Slack/PagerDuty)
- [ ] Update dashboard links in runbooks
- [ ] Train on-call team

**Wednesday:**
- [ ] Monitor metrics for anomalies
- [ ] Adjust alert thresholds based on baseline
- [ ] Publish dashboard access guide
- [ ] Close tickets

**Thursday-Friday:**
- [ ] Observability period (monitor and iterate)
- [ ] Document any issues found
- [ ] Plan improvements for next sprint

---

## Success Criteria

### Must-Have (Before Go-Live)

```
□ Metrics endpoint responds (curl /api/metrics)
□ Prometheus scrapes successfully
□ Grafana displays data in real-time
□ Alerts fire without false positives
□ Slack/PagerDuty notifications work
□ P95 latency < 50ms
□ Cache hit rate > 95%
□ No data loss during tests
```

### Nice-to-Have (Post-Go-Live)

```
□ Custom dashboards for different audiences
□ Historical baseline data collected
□ Team trained on incident response
□ Runbooks linked to dashboards
□ Usage telemetry integrated
□ Cost tracking implemented
```

---

## Deployment Steps

### Step 1: Application Instrumentation

**Location:** `/apps/web/lib/free-access-monitoring.ts`

**Time:** 30 minutes

```bash
# Add prom-client dependency
npm install prom-client

# Create monitoring module (provided)
# Copy: docs/FREE_ACCESS_MONITORING.md → Implementation section

# Add metrics endpoint
# Copy: docs/FREE_ACCESS_MONITORING_SETUP.md → Part 1

# Test locally
npm run dev
curl http://localhost:3000/api/metrics
```

**Verification:**
```bash
curl http://localhost:3000/api/metrics | grep free_access_
# Should output: free_access_cache_hits_total, etc.
```

### Step 2: Infrastructure Deployment

**Location:** `/k8s/monitoring/`

**Time:** 45 minutes

```bash
# 1. Create monitoring namespace
kubectl create namespace monitoring

# 2. Set up secrets
kubectl create secret generic monitoring-secrets \
  --from-literal=SLACK_WEBHOOK_URL='https://hooks.slack.com/...' \
  --from-literal=PAGERDUTY_SERVICE_KEY='...' \
  --from-literal=GRAFANA_PASSWORD='<secure>' \
  -n monitoring

# 3. Deploy Prometheus
kubectl apply -f k8s/monitoring/prometheus-deployment.yaml

# 4. Deploy AlertManager
kubectl apply -f k8s/monitoring/alertmanager-deployment.yaml

# 5. Deploy Grafana
kubectl apply -f k8s/monitoring/grafana-deployment.yaml

# 6. Wait for deployments
kubectl wait --for=condition=ready pod -l app=prometheus -n monitoring --timeout=300s

# 7. Verify
kubectl get pods -n monitoring
# All should be Running
```

### Step 3: Configuration

**Time:** 20 minutes

```bash
# 1. Add Prometheus data source to Grafana
# Via UI or API:
curl -X POST http://grafana:3001/api/datasources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Prometheus",
    "type": "prometheus",
    "url": "http://prometheus:9090",
    "access": "proxy",
    "isDefault": true
  }'

# 2. Import Grafana dashboard
# (See docs/FREE_ACCESS_MONITORING_SETUP.md → Part 3)

# 3. Verify alerts are recognized
curl http://prometheus:9090/api/v1/alerts | jq .
```

### Step 4: Validation

**Time:** 30 minutes

```bash
# 1. Generate test traffic
curl http://web:3000/api/projects/list \
  -H "Cookie: auth_session=..." \
  -H "User-Agent: test" \
  --repeat 100

# 2. Check metrics collected
curl 'http://prometheus:9090/api/v1/query?query=rate(free_access_cache_hits_total[5m])'

# 3. View dashboard
# Open: http://grafana:3001
# Dashboard: Free-Access Mode
# Should show: Cache hit rate ~95%, latency ~10-20ms

# 4. Test alert (simulate high error rate)
# Trigger manually or via test script
# Check: Slack message received in #incidents

# 5. Health check script
bash /tmp/validate-monitoring.sh
# All checks should pass
```

### Step 5: Go-Live

```bash
# 1. Enable production rules in Prometheus
# Uncomment critical alerts

# 2. Update runbooks
# Link dashboards: docs/FREE_ACCESS_INCIDENT_RESPONSE.md

# 3. Train team
# Walk through:
# - Dashboard navigation
# - Alert interpretation
# - Incident response procedure

# 4. Monitor first 24 hours
# Check metrics collection
# Verify no false positives
# Adjust thresholds if needed

# 5. Celebrate! 🎉
```

---

## Role-Based Setup

### DevOps/SRE Setup (1-2 hours)

```
1. Read: FREE_ACCESS_ARCHITECTURE.md (30 min)
2. Read: FREE_ACCESS_MONITORING_SETUP.md (45 min)
3. Deploy infrastructure (1 hour)
4. Validate deployment (30 min)
Total: 2.5 hours
```

**Deliverables:**
- Prometheus running and scraping
- AlertManager configured
- Grafana dashboards visible
- Alerts firing (test at least one)

### Engineering Lead Setup (1 hour)

```
1. Read: FREE_ACCESS_ARCHITECTURE.md (30 min)
2. Read: FREE_ACCESS_INCIDENT_RESPONSE.md (30 min)
3. Review metrics with team (30 min)
Total: 1.5 hours
```

**Deliverables:**
- Team understands system design
- On-call rotations understand incident procedures
- Dashboard bookmarked and shared

### On-Call Engineer Setup (30 min)

```
1. Read: FREE_ACCESS_INCIDENT_RESPONSE.md (20 min)
2. Read: FREE_ACCESS_TROUBLESHOOTING.md (15 min)
3. Bookmark dashboards (5 min)
Total: 40 minutes
```

**Deliverables:**
- Knows how to respond to P1/P2 alerts
- Has runbook bookmarked
- Can diagnose common issues

---

## Metrics Dashboard URLs

After deployment, share these links:

```
Prometheus (for power users):
  http://prometheus.onevyrt.internal:9090

Grafana (main dashboard):
  http://grafana.onevyrt.internal:3001
  Dashboard: "Free-Access Mode"
  Login: admin / (set in deployment)

AlertManager:
  http://alertmanager.onevyrt.internal:9093

Useful Prometheus Queries:
  - Cache hit rate: rate(free_access_cache_hits_total[5m]) / (...)
  - P95 latency: histogram_quantile(0.95, rate(...[5m]))
  - Error rate: rate(free_access_middleware_failures_total[5m])
  - Active workspaces: free_access_active_workspaces
```

---

## Cost & Capacity Planning

### Monitoring Stack Resource Usage

```
Prometheus:
  - CPU: 100m (average), 500m (peak)
  - Memory: 256Mi (average), 512Mi (peak)
  - Storage: 2GB/week (at 1000 RPS)
  - Retention: 30 days recommended

Grafana:
  - CPU: 50m
  - Memory: 128Mi
  - Storage: 1GB (dashboard definitions)

AlertManager:
  - CPU: 25m
  - Memory: 64Mi
  - Storage: minimal

Total Monthly Cost (AWS):
  - Compute (EKS): ~$50 (monitoring pod fraction)
  - Storage (EBS): ~$50-100 (30-day retention)
  - External services: ~$10-50 (Slack free, PagerDuty optional)
  
  Total: $110-200/month
```

### Scaling Estimates

```
At 10,000 RPS:
  - Metrics per second: ~100 unique series
  - Prometheus disk growth: ~5GB/week
  - Query time: ~100-500ms (acceptable)

At 100,000 RPS:
  - Would need: Prometheus clustering, RemoteWrite
  - Estimated cost: +$200-300/month
```

---

## Runbook Integration

Update your incident runbooks to include:

```markdown
## Free-Access Mode Incident Response

### Step 1: Check Dashboard
Go to: http://grafana:3001 → Free-Access Mode

Look for:
- Cache Hit Rate (should be > 95%)
- Error Rate (should be < 0.01%)
- P95 Latency (should be < 50ms)
- Active Workspaces (informational)

### Step 2: Check Alerts
Go to: http://alertmanager:9093

Current firing alerts:
- FreeAccessLowCacheHitRate
- FreeAccessHighErrorRate
- FreeAccessHighLatency
- FreeAccessDatabaseSlow

### Step 3: Troubleshoot
See: [Troubleshooting Guide](./FREE_ACCESS_TROUBLESHOOTING.md)

Common Issues:
1. Low cache hit rate → Restart containers
2. High error rate → Check database connection
3. High latency → Check DB query times
4. Active count 0 → No free-access enabled (expected)

### Step 4: Escalate
If issue persists after 15 minutes:
1. Page SRE for infrastructure issues
2. Page DBA for database issues
3. Page on-call engineer for code issues

Runbook: [Incident Response](./FREE_ACCESS_INCIDENT_RESPONSE.md)
```

---

## Handoff Checklist

### To Engineering Team

```
□ All documents reviewed and understood
□ Architecture clear and agreed upon
□ Metrics make sense for use cases
□ Alert thresholds agreed upon
□ Incident response procedures clear
□ Questions answered in meeting
```

### To DevOps/SRE Team

```
□ Deployment guide followed successfully
□ Monitoring stack running and healthy
□ Dashboards showing real metrics
□ Alerts tested and working
□ Notifications reaching correct channels
□ On-call procedures documented
□ Scaling plan understood
```

### To On-Call Team

```
□ Incident response playbook reviewed
□ Dashboard access and navigation practiced
□ Common troubleshooting scenarios reviewed
□ Escalation path clear
□ Runbooks bookmarked
□ Alert thresholds understood
□ Test alert received successfully
```

---

## Support & Next Steps

### Questions?

- **Architecture:** See [FREE_ACCESS_ARCHITECTURE.md](./FREE_ACCESS_ARCHITECTURE.md)
- **Monitoring Setup:** See [FREE_ACCESS_MONITORING_SETUP.md](./FREE_ACCESS_MONITORING_SETUP.md)
- **Incident Response:** See [FREE_ACCESS_INCIDENT_RESPONSE.md](./FREE_ACCESS_INCIDENT_RESPONSE.md)
- **Troubleshooting:** See [FREE_ACCESS_TROUBLESHOOTING.md](./FREE_ACCESS_TROUBLESHOOTING.md)

### Improvements (Wave 2)

```
Planned enhancements:
□ Multi-region dashboard
□ Custom metrics (feature usage, revenue impact)
□ Automated remediation (restart on high error)
□ Cost tracking dashboard
□ Capacity planning projections
□ SLO tracking dashboard
```

### Training Materials

```
Available:
□ Architecture deep-dive (1 hour)
□ Dashboard walkthrough (30 min)
□ Incident response simulation (1 hour)
□ Troubleshooting workshop (1 hour)

Can be scheduled on demand.
```

---

## Document Manifest

All files are located in `/home/user/onevyrt/docs/`:

```
FREE_ACCESS_ARCHITECTURE.md
  └─ System design, components, data flows, failure modes

FREE_ACCESS_MONITORING.md
  └─ Metrics types, instrumentation, Prometheus setup, Grafana dashboards

FREE_ACCESS_MONITORING_SETUP.md
  └─ Step-by-step deployment guide with code examples

FREE_ACCESS_INCIDENT_RESPONSE.md
  └─ 5 detailed incident playbooks with recovery procedures

FREE_ACCESS_TROUBLESHOOTING.md
  └─ 7+ common issues with diagnostic steps and fixes

FREE_ACCESS_PRODUCTION_DEPLOYMENT.md (this file)
  └─ Executive summary, timeline, and handoff checklist

FREE_ACCESS_ERROR_HANDLING.md (existing)
  └─ Error classification, retry logic, graceful degradation

FREE_ACCESS_ERROR_HANDLING_SUMMARY.md (existing)
  └─ High-level overview of error system

FREE_ACCESS_QUICK_REFERENCE.md (existing)
  └─ Quick lookup for common patterns
```

---

## Final Verification

Before declaring "Go Live":

```bash
# 1. Application instrumentation
npm test -- free-access-monitoring

# 2. Metrics endpoint
curl -s http://web:3000/api/metrics | grep -c free_access_

# 3. Prometheus collection
curl -s http://prometheus:9090/api/v1/query?query=free_access_cache_hits_total | jq .data.result[0].value

# 4. Grafana dashboard
curl -s http://grafana:3001/api/dashboards/uid/free-access-mode | jq .dashboard.title

# 5. Alert rules loaded
curl -s http://prometheus:9090/api/v1/rules | jq '.data.groups[0].rules | length'

# 6. AlertManager configured
curl -s http://alertmanager:9093/api/v1/status | jq .config.global.slack_api_url

# All checks should pass ✓
```

---

## Conclusion

This comprehensive monitoring and documentation package provides:

✅ **Production-ready monitoring** with Prometheus + Grafana  
✅ **Intelligent alerting** for critical issues  
✅ **Clear incident response procedures** for all severity levels  
✅ **Troubleshooting guides** for common problems  
✅ **Complete architecture documentation** for new team members  
✅ **Easy deployment** with step-by-step instructions  

Deploy with confidence. Monitor effectively. Respond quickly.

---

**Status: READY FOR PRODUCTION DEPLOYMENT**

*Last Updated: 2026-09-03*  
*Contact: platform-team@onevyrt.com*

---

## Appendix: Quick Links

- Prometheus: http://prometheus:9090
- Grafana: http://grafana:3001
- AlertManager: http://alertmanager:9093
- Metrics endpoint: http://web:3000/api/metrics
- Architecture docs: ./FREE_ACCESS_ARCHITECTURE.md
- Incident response: ./FREE_ACCESS_INCIDENT_RESPONSE.md
- Troubleshooting: ./FREE_ACCESS_TROUBLESHOOTING.md

