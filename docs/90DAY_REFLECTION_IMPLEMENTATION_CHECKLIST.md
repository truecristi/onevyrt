# 90-Day Reflection Checkpoint — Implementation Checklist

Complete step-by-step checklist to integrate and verify the feature is working.

---

## Pre-Implementation (5 minutes)

- [ ] Read `docs/90DAY_REFLECTION_QUICK_START.md`
- [ ] Review all 10 files created (see `docs/90DAY_REFLECTION_FILES_SUMMARY.md`)
- [ ] Ensure your local environment has Node.js + PostgreSQL running
- [ ] Have database credentials available

---

## Step 1: Copy Files (2 minutes)

All files are ready to copy to your project. Structure:

```
apps/web/
├── components/
│   └── dashboard/
│       ├── 90DayReflectionCheckpoint.tsx         ← Component
│       └── useReflectionCheckpoint.ts             ← Hook
├── app/
│   └── api/
│       └── workspace/
│           └── [id]/
│               └── reflection-checkpoint/
│                   └── route.ts                   ← API routes
├── lib/
│   ├── dashboard/
│   │   └── reflection-checkpoint.ts               ← Utilities
│   └── jobs/
│       └── reflection-reminder-job.ts             ← Scheduled job
└── migrations/
    └── 1788550800000_add-90day-reflections-table.js ← Schema

docs/
├── 90DAY_REFLECTION_CHECKPOINT.md                ← Full reference
├── 90DAY_REFLECTION_QUICK_START.md               ← Setup guide
├── 90DAY_REFLECTION_INTEGRATION_EXAMPLE.md       ← Code examples
├── 90DAY_REFLECTION_FILES_SUMMARY.md             ← This inventory
└── 90DAY_REFLECTION_IMPLEMENTATION_CHECKLIST.md  ← This checklist
```

- [ ] Copy all 10 files to correct locations

---

## Step 2: Database Migration (3 minutes)

### Run Migration

```bash
cd apps/web
npm run migrate up
```

### Verify Table Created

```bash
psql -d onevyrt_db -c "SELECT * FROM information_schema.tables WHERE table_name = 'workspace_90day_reflections';"
```

Expected output: One row with `workspace_90day_reflections` table.

- [ ] Migration executed successfully
- [ ] Table exists in database
- [ ] Indices created (`idx_90day_reflections_workspace_created`, `idx_90day_reflections_user`)

**Verification SQL:**
```sql
-- Check table structure
\d workspace_90day_reflections

-- Check indices
SELECT indexname FROM pg_indexes WHERE tablename = 'workspace_90day_reflections';
```

---

## Step 3: Register Scheduled Job (2 minutes)

### Edit `lib/jobs.ts`

Add this import at the top:

```typescript
import { runReflectionReminderJob } from "@/lib/jobs/reflection-reminder-job";
```

Add this to the `jobs` array:

```typescript
{
  key: "reflection-reminder",
  name: "Reflection Checkpoint Reminders",
  description: "Send 90-day reflection reminders to workspace owners",
  run: runReflectionReminderJob,
  schedule: "daily",
},
```

### Verify Registration

```bash
grep -n "reflection-reminder" lib/jobs.ts
```

Expected: Line number(s) showing the job is registered.

- [ ] Import added to `lib/jobs.ts`
- [ ] Job object added to jobs array
- [ ] Syntax is correct (no TypeScript errors)

---

## Step 4: Update Dashboard (5 minutes)

### Option A: Modal on Command Center (Recommended)

Edit `app/command-center/page.tsx`:

1. **Add imports:**
```typescript
import { NinetyDayReflectionCheckpoint } from "@/components/dashboard/90DayReflectionCheckpoint";
import { useReflectionCheckpoint } from "@/components/dashboard/useReflectionCheckpoint";
```

2. **Add state in component:**
```typescript
const [showReflectionModal, setShowReflectionModal] = useState(false);
const { isDue } = useReflectionCheckpoint(workspaceId);
```

3. **Add effect to show modal when due:**
```typescript
useEffect(() => {
  if (isDue) {
    setShowReflectionModal(true);
  }
}, [isDue]);
```

4. **Add modal JSX before closing return:**
```typescript
{showReflectionModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl shadow-2xl">
      <NinetyDayReflectionCheckpoint
        workspaceId={workspaceId}
        currentWhy={whyCreedData?.why || ""}
        currentCreed={whyCreedData?.creed || ""}
        onComplete={() => setShowReflectionModal(false)}
        onCancel={() => setShowReflectionModal(false)}
      />
    </div>
  </div>
)}
```

### Option B: Separate Route

1. Create `app/account/reflection-checkpoint/page.tsx` (see integration example)
2. Link to it from dashboard or notifications
3. Update canonical routes if needed

### Option C: Modal Wrapper Component

Create wrapper (see integration example for full code):

```typescript
// components/ReflectionCheckpointModal.tsx
export function ReflectionCheckpointModal({ isOpen, ... }) { ... }
```

Then use: `<ReflectionCheckpointModal isOpen={isDue} {...props} />`

- [ ] Component imports added to dashboard
- [ ] Hook imported and called
- [ ] Modal state added
- [ ] Modal JSX added to template
- [ ] No TypeScript errors

---

## Step 5: Test (10 minutes)

### 5a. Quick Manual Test

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Login to your account**

3. **Set Why & Creed (if not already set):**
   - Navigate to dashboard
   - Click "Set Your Why & Creed"
   - Fill in and save

4. **Mock 90-day reflection in database:**
   ```sql
   -- Find your workspace ID
   SELECT id FROM workspaces LIMIT 1;
   
   -- Create a reflection from 90+ days ago
   INSERT INTO workspace_90day_reflections (
     id, workspace_id, user_id, previous_why, previous_creed,
     why_evolution, creed_evolution, key_insights, created_at
   ) VALUES (
     gen_random_uuid(),
     'YOUR_WORKSPACE_ID',
     'YOUR_USER_ID',
     'Old why',
     'Old creed',
     'Test why evolution',
     'Test creed evolution',
     'Test insights',
     NOW() - INTERVAL '90 days'
   );
   ```

5. **Reload dashboard:**
   - Modal should appear automatically
   - Shows "90-Day Reflection" header

6. **Fill reflection form:**
   - Intro → Next
   - Why Evolution (required) → Next
   - Creed Evolution (required) → Next
   - Key Insights (required) → Next
   - Review (shows all fields) → Save
   - Complete screen shows success

7. **Verify saved:**
   ```sql
   SELECT * FROM workspace_90day_reflections
   WHERE workspace_id = 'YOUR_WORKSPACE_ID'
   ORDER BY created_at DESC
   LIMIT 1;
   ```

- [ ] Modal appears when reflection is due
- [ ] All form steps work
- [ ] Form validation prevents incomplete submissions
- [ ] Data saves to database
- [ ] Complete screen shows after save
- [ ] No console errors (F12 → Console)

### 5b. Test Hook Directly

```typescript
// In browser console (if component exports hook)
import { useReflectionCheckpoint } from "@/components/dashboard/useReflectionCheckpoint";
const result = useReflectionCheckpoint("WORKSPACE_ID");
console.log(result);
```

Expected output:
```typescript
{
  isDue: true,          // or false
  isLoading: false,
  nextReminderAt: "2025-12-03T...",
  error: null
}
```

- [ ] Hook returns correct state
- [ ] isDue reflects actual status
- [ ] nextReminderAt is 90 days from latest reflection

### 5c. Test API Endpoints

**Check if due:**
```bash
curl -H "Cookie: <your-auth-cookie>" \
  http://localhost:3000/api/workspace/WORKSPACE_ID/reflection-checkpoint
```

Expected response:
```json
{
  "latest": { ... },
  "history": [ ... ],
  "nextReminderAt": "..."
}
```

**Save reflection:**
```bash
curl -X POST http://localhost:3000/api/workspace/WORKSPACE_ID/reflection-checkpoint \
  -H "Cookie: <your-auth-cookie>" \
  -H "Content-Type: application/json" \
  -d '{
    "whyEvolution": "Test evolution",
    "creedEvolution": "Test creed",
    "keyInsights": "Test insights"
  }'
```

Expected: 200 OK with saved checkpoint data

- [ ] GET endpoint returns data
- [ ] POST endpoint saves data
- [ ] API validates auth (401 without cookie)
- [ ] API validates workspace (404 for wrong workspace)

### 5d. Test Scheduled Job

**Run job manually:**
```bash
curl -X POST http://localhost:3000/api/cron/tick
```

**Check job ran:**
```sql
SELECT * FROM job_runs WHERE job_key = 'reflection-reminder'
ORDER BY last_run_at DESC
LIMIT 1;
```

Expected: Last run date = today

**Check notifications sent:**
```sql
SELECT * FROM notifications
WHERE type LIKE 'reflection%'
ORDER BY created_at DESC
LIMIT 5;
```

- [ ] Job runs without errors
- [ ] job_runs table updates
- [ ] Notifications created (if workspace is due)
- [ ] Notifications have correct type + message

---

## Step 6: Deploy (5 minutes)

### Staging Deployment

```bash
# Commit changes
git add .
git commit -m "feat: add 90-day reflection checkpoint

- Multi-step guided form for quarterly purpose reflection
- Auto-reminders every 90 days
- Before/after comparison views
- Dark mode + mobile responsive
- Scheduled job integration"

# Push to staging branch
git push origin HEAD:staging
```

- [ ] Changes committed
- [ ] Pushed to staging
- [ ] CI/CD pipeline passes
- [ ] Staging deployment completes

### Verify on Staging

1. Visit staging environment
2. Login with test account
3. Set Why & Creed
4. Mock 90-day reflection (see test step 5a)
5. Reload dashboard → modal appears
6. Complete reflection flow
7. Verify data saved to staging database

- [ ] Reflection modal appears on staging
- [ ] All features work on staging
- [ ] Data persists correctly

### Production Deployment

```bash
# Merge to main
git checkout main
git pull origin main
git merge staging
git push origin main
```

- [ ] Changes merged to main
- [ ] Pushed to production
- [ ] CI/CD pipeline passes
- [ ] Production deployment completes

### Monitor Production

**First 24 hours:**

```sql
-- Check job ran
SELECT * FROM job_runs WHERE job_key = 'reflection-reminder'
ORDER BY last_run_at DESC LIMIT 1;

-- Check for errors
SELECT * FROM job_logs WHERE job_key = 'reflection-reminder'
ORDER BY created_at DESC LIMIT 10;

-- Check notifications sent
SELECT COUNT(*), type FROM notifications
WHERE type LIKE 'reflection%'
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY type;

-- Check reflections submitted
SELECT COUNT(*) FROM workspace_90day_reflections
WHERE created_at > NOW() - INTERVAL '1 day';
```

- [ ] Job ran successfully
- [ ] No errors in logs
- [ ] Notifications sent to users
- [ ] Reflections being submitted

---

## Step 7: Documentation & Training (Optional)

### Update Internal Wiki
- [ ] Add feature to product roadmap
- [ ] Link to this checklist
- [ ] Add to onboarding docs

### Email Stakeholders
- [ ] Announce feature launch
- [ ] Include link to user guide
- [ ] Provide support contact info

---

## Verification Checklist

### Code Quality
- [ ] No TypeScript errors: `npm run type-check`
- [ ] No linting errors: `npm run lint`
- [ ] Component builds: `npm run build`
- [ ] Tests pass: `npm run test` (if applicable)

### Database
- [ ] Table exists with correct schema
- [ ] Indices created correctly
- [ ] No unique constraint violations
- [ ] Foreign keys working

### Functionality
- [ ] Modal appears when due
- [ ] Form validation works
- [ ] All steps render correctly
- [ ] Save/submission works
- [ ] Data persists to database
- [ ] Before/after comparison shows correctly

### Integration
- [ ] Hook returns correct state
- [ ] API endpoints respond
- [ ] Job registers and runs
- [ ] Notifications send

### User Experience
- [ ] Dark mode works
- [ ] Mobile responsive (375px, 768px, 1024px)
- [ ] Animations smooth
- [ ] Loading states visible
- [ ] Error messages clear
- [ ] Accessibility compliant (keyboard nav, ARIA labels)

### Performance
- [ ] Page loads < 3 seconds
- [ ] Form submit < 2 seconds
- [ ] No N+1 queries
- [ ] API response times < 500ms

---

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Modal doesn't appear | Check: `isDue` hook, job registered, reflection 90+ days old |
| Migration fails | Check: PostgreSQL running, credentials correct, migration number unique |
| Job doesn't run | Check: Job registered in `lib/jobs.ts`, `/api/cron/tick` called daily |
| API returns 404 | Check: Workspace ID correct, user has access, table exists |
| Notifications don't send | Check: Job ran, workspace owners exist, notification system working |
| Dark mode broken | Check: Tailwind CSS dark mode enabled, classes use `dark:` prefix |
| Mobile layout broken | Check: No hardcoded widths, use responsive classes (`md:`, `lg:`) |

---

## Rollback Plan

If anything goes wrong:

### Quick Rollback (Minutes)
```bash
# Revert code changes
git revert HEAD
git push origin main

# Disable job (comment out in lib/jobs.ts)
# Users won't be reminded, but existing data is preserved
```

### Full Rollback (Hours)
```bash
# Remove feature
git reset --hard origin/main~1
git push -f origin main

# Drop table (if needed)
DROP TABLE workspace_90day_reflections;

# Re-deploy without feature
```

---

## Success Criteria

✅ **Feature is ready for production when:**

1. ✅ All files copied to project
2. ✅ Database migration runs without errors
3. ✅ Job registered in `lib/jobs.ts`
4. ✅ Component integrated into dashboard
5. ✅ All manual tests pass (5 sections)
6. ✅ Staging deployment successful
7. ✅ Production deployment successful
8. ✅ Monitoring shows expected behavior
9. ✅ No critical bugs reported
10. ✅ Users receiving reminders (after 90 days)

---

## Maintenance Tasks

### Daily
- [ ] Monitor job runs: Check `job_runs` table
- [ ] Check for errors: Review application logs
- [ ] Verify notifications: Check `notifications` table

### Weekly
- [ ] Review database growth: `SELECT COUNT(*) FROM workspace_90day_reflections;`
- [ ] Check for stale data: Users with old reflections
- [ ] Monitor performance: API response times

### Monthly
- [ ] Archive old reflections (if > 10M rows): Run `archiveOldReflections()` utility
- [ ] Review feature metrics: Total reflections, active users
- [ ] Update documentation if needed

### Quarterly
- [ ] Review feature usage
- [ ] Gather user feedback
- [ ] Plan Phase 2 enhancements

---

## Next Phase Enhancements

After successful launch, consider:

- [ ] PDF export of reflection archive
- [ ] Share reflections with coach
- [ ] Side-by-side comparison of 2+ checkpoints
- [ ] AI-powered insights ("Here's what your reflections reveal...")
- [ ] Reflection calendar view
- [ ] Email digest of quarterly progress
- [ ] Integration with Transformation Report

---

## Sign-Off

- [ ] **Developer:** Implemented & tested _________________ Date: _______
- [ ] **QA:** Verified all features _________________ Date: _______
- [ ] **Product:** Approved for launch _________________ Date: _______
- [ ] **Deployed:** Production live _________________ Date: _______

---

## Questions?

Refer to documentation:
- Setup issues → `90DAY_REFLECTION_QUICK_START.md`
- Feature details → `90DAY_REFLECTION_CHECKPOINT.md`
- Code examples → `90DAY_REFLECTION_INTEGRATION_EXAMPLE.md`
- File inventory → `90DAY_REFLECTION_FILES_SUMMARY.md`

**All steps completed? Feature is ready for production! 🚀**
