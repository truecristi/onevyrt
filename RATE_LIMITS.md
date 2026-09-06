# Rate Limits Documentation

This document defines all rate limits applied across ONEVYRT's API routes. Limits are implemented using `lib/rate-limit.ts` with both Postgres (shared across instances) and in-memory (fallback) backends.

## Rate Limiting Strategy

- **Authentication**: Per-workspace or per-user identity (never per-IP for authenticated routes)
- **Window**: Fixed 60-second windows unless otherwise noted
- **Behavior**: Returns `429 Too Many Requests` with `Retry-After` header when exceeded
- **Headers**: Standard rate-limit response headers included (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)

---

## Programme Routes

### Chapter Submissions & Reviews

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/programme/chapters/[stageId]/submit` | POST | 20/min | `chapter:submit:{wsId}` | Learner chapter output submissions |
| `/api/programme/chapters/[stageId]/review` | POST | 20/min | `chapter:review:{wsId}` | Coach chapter approval/rejection |

### Lesson Submissions & Reviews

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/programme/lessons/[lessonId]/submit` | POST | 40/min | `lesson:submit:{wsId}` | Learner lesson assignment submissions |
| `/api/programme/lessons/[lessonId]/review` | POST | 50/min | `lesson:review:{wsId}` | Coach lesson feedback & decisions |
| `/api/programme/lessons/[lessonId]/start` | POST | 60/min | `lesson:start:{wsId}` | Mark lesson as in_progress |

### Chapter 4 (IMPROVE & SCALE)

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/programme/chapter/4/submit` | POST | 20/min | `chapter4:submit:{wsId}` | Growth & Improvement Plan saves |

### Coaching & Messages

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/coach/reach-out` | POST | 20/min | `coach:reachout:{userId}` | Coach-to-learner messages (triggers email) |
| `/api/programme/coach-notes` | POST | 30/min | `coach:notes:{userId}` | Coach-only private notes about clients |

---

## Project Routes

### Project CRUD

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/projects` | POST | 30/min | `project:save:{wsId}` | Create/save projects (includes autosave) |
| `/api/projects/[id]` | DELETE | 20/min | `project:delete:{wsId}` | Soft-delete or permanent purge projects |

### Project Collaboration

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/projects/[id]/comments` | POST | 30/min | `project:comment:{wsId}` | Add comments on projects |

---

## Community Routes

### Publishing & Engagement

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/community/comments` | POST | 30/min | `community:comment:post:{wsId}` | Post comments on shared templates/creatives |
| `/api/community/reactions` | POST | 30/min | `community:reaction:post:{wsId}` | Toggle "helpful" endorsements |

---

## Account Routes

### Data & Settings

| Route | Method | Limit | Key | Purpose |
|-------|--------|-------|-----|---------|
| `/api/account/export` | GET | 5/hour | `data-export:{userId}` | GDPR data export (heavy operation) |

---

## Rationale by Category

### Heavy Operations (20/min)
- Chapter submissions/reviews (unlock curriculum progression)
- Chapter 4 saves (structured Growth Plan)
- Project deletion (irreversible)
- Coach reach-out (triggers email, coordination action)

### Moderate Operations (30-50/min)
- Lesson submissions/reviews (more granular, time-shifted)
- Project saves (hits autosave every ~1.5s, 30 is 2 saves/sec headroom)
- Comments (collaborative, dialogue-paced)
- Coach notes (working memory, coach-scoped)

### Lightweight Operations (60/min)
- Lesson start (state transition only)

### Heavy I/O (5/hour)
- Account data export (reads all user data across workspaces)

---

## Testing Rate Limits

### Manual Testing

```bash
# Make rapid requests to a rate-limited endpoint
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/programme/lessons/abc123/submit \
    -H "Cookie: session=..." \
    -H "Content-Type: application/json" \
    -d '{"evidence":"test"}'
  echo "Request $i sent"
done

# Expect: requests 1-40 return 200, requests 41+ return 429
# Verify Retry-After header in 429 response
```

### Automated Testing

Use `apps/web/e2e/rate-limit.spec.ts` (when available) to verify:
1. Different workspaces have independent limits
2. Different users have independent limits
3. Window resets after 60 seconds
4. Retry-After header is accurate

---

## Configuration

### Environment Variables

- `RATE_LIMIT_DISABLED=1` — Disable all limits (test/CI only, never production)
- `TRUSTED_PROXY_COUNT=1` — IP address counting for public endpoints (default: 1)

### Database

Rate limit state is stored in the `rate_limits` table (auto-created by migrations). The table is opportunistically cleaned up during normal traffic (~1.5% of requests) to prevent unbounded growth.

---

## Limits Over Time (if scaled)

When ONEVYRT serves more concurrent users:

1. **In-memory fallback loses shared state** — If a load balancer sends request `N` to container A and request `N+1` to container B, each sees its own budget. Use Postgres backend (configured via `DATABASE_URL`) for true shared limits across instances.

2. **High-frequency autosave traffic** — The project save limit (30/min per workspace) allows ~0.5 saves per second. If a team of 10 editors all autosave simultaneously, this becomes the bottleneck. Consider increasing to 60 or making it per-user instead of per-workspace if editor count grows.

3. **API integrations** — Webhook consumers or third-party integrations may need higher limits. Consider allowlisting specific API keys for higher thresholds (not yet implemented).

---

## Known Gaps (Future Work)

- [ ] CSRF token protection (Wave 2)
- [ ] Per-IP rate limiting for public funnel/checkout endpoints (Wave 2)
- [ ] API key-based rate limiting tiers (Wave 3)
- [ ] Real-time rate limit metrics dashboard (Wave 4)
- [ ] Adaptive limits based on server load (Wave 5)
