# Member Progress Dashboard

**Superadmin tool for checking on workspace members** — Track their chapter progress, engagement, and spot who's ready to become coaches.

## Features

✅ **Member List with Progress Tracking**
- Current chapter (DEFINE → IMPLEMENT → CONTROL → IMPROVE → FINISH)
- Progress percentage (0-100%)
- Role badge (Learner, Coach, Owner)
- Activity status (Active, Inactive >7d, Completed)

✅ **Smart Filtering & Sorting**
- Sort by: Progress, Last Activity, Name
- Filter by: All Roles, Learners Only, Coaches Only
- Filter by: All Status, Active, Inactive, Completed

✅ **Quick Actions**
- View member details (linked)
- Promote to Coach (one-click for completed learners)
- See engagement status at a glance

✅ **Dashboard Stats**
- Total members in workspace
- Average progress %
- Completed members
- Current coaches
- Inactive/stuck members

---

## Usage

### Import & Render

```tsx
import { MemberProgressDashboard } from "@/components/admin/MemberProgressDashboard";

export default function AdminPage() {
  const members = await fetchWorkspaceMembers(workspaceId);
  
  return (
    <MemberProgressDashboard
      members={members}
      workspaceId={workspaceId}
      onMemberClick={(member) => {
        // Navigate to detail page or show modal
        console.log("Member clicked:", member);
      }}
      onPromoteToCoach={async (memberId) => {
        // Call API to promote user to "manager" role
        await promoteToCoach(workspaceId, memberId);
      }}
    />
  );
}
```

### Data Structure

Each member object should have:

```typescript
interface Member {
  id: string;                        // User ID
  name: string;                      // Display name
  email: string;                     // Email address
  role: "owner" | "manager" | "editor" | "viewer";
  joinedAt: Date | string;
  enrollmentData?: {
    currentChapter: 0 | 1 | 2 | 3 | 4 | 5;  // Programme stage
    chapterName: string;                     // e.g., "DEFINE (Business Psychology)"
    progressPercent: number;                 // 0-100%
    completedChapters: number;               // How many chapters finished
    lastActivityAt?: Date | string;          // Last access timestamp
    isStuck?: boolean;                       // Inactive >7 days
  };
}
```

---

## API Endpoint

The dashboard is designed to work with:

**GET** `/api/admin/workspaces/[workspaceId]/members`

### Query Parameters

- `sortBy` — "progress" | "activity" | "name" (default: "progress")
- `role` — "all" | "learner" | "coach" (default: "all")
- `status` — "all" | "active" | "stuck" | "completed" (default: "all")

### Response

```json
{
  "members": [
    {
      "id": "user_123",
      "name": "Jane Smith",
      "email": "jane@example.com",
      "role": "editor",
      "joinedAt": "2026-09-01T00:00:00Z",
      "enrollmentData": {
        "currentChapter": 2,
        "chapterName": "IMPLEMENT (Working System)",
        "progressPercent": 45,
        "completedChapters": 1,
        "lastActivityAt": "2026-09-03T14:22:00Z",
        "isStuck": false
      }
    }
  ],
  "stats": {
    "total": 12,
    "avgProgress": 35,
    "completed": 2,
    "coaches": 1
  }
}
```

---

## Chapters & Progress Calculation

| Chapter | Code | Name | Progress Start |
|---------|------|------|-----------------|
| 0 | — | Starting Programme | 0% |
| 1 | DEFINE | Business Psychology Blueprint | 12% |
| 2 | IMPLEMENT | Working Business System | 37% |
| 3 | CONTROL | Numbers & Control Dashboard | 62% |
| 4 | IMPROVE | Growth & Improvement Plan | 87% |
| 5 | FINISH | Transformation Report | 100% |

**Note:** Progress % reflects completion within and across chapters. A learner in Chapter 2 might be 45% through (having completed Ch1, halfway through Ch2).

---

## Role Mapping

| Role | Can See | Can Review | Can Promote |
|------|---------|-----------|-----------|
| **viewer** | Lessons only | ❌ | ❌ |
| **editor** | Full programme | ❌ | ❌ |
| **manager** | Full programme | ✅ (Coach) | Limited |
| **owner** | Full programme | ✅ (Coach) | ✅ |

**Manager role = Coach** (can review submissions, send messages, manage learners)

---

## Status Indicators

- **✓ Completed** (cyan badge) — Finished all 5 chapters, ready to become coach
- **→ Active** (blue badge) — Currently progressing, active in last 7 days
- **⚠ Inactive** (red badge) — No activity for >7 days (stuck detection)

---

## Promote to Coach Workflow

1. Learner completes FINISH chapter (currentChapter === 5, progressPercent === 100)
2. "→ Coach" button appears in Actions
3. Click button → calls `onPromoteToCoach(memberId)`
4. Backend promotes user from "editor" to "manager" role
5. User appears in coach dashboard, can review submissions
6. Role badge updates to "Coach"

---

## Customization

### Add More Filters

Edit `MemberProgressDashboard.tsx` to add filters:

```tsx
const [filterTeam, setFilterTeam] = useState<string>("all");

// In useMemo:
if (filterTeam !== "all") {
  filtered = filtered.filter((m) => m.team === filterTeam);
}
```

### Custom Actions

Add more quick actions in `MemberRow`:

```tsx
<button onClick={() => sendMessage(member.id)}>
  📧 Message
</button>

<button onClick={() => exportProgress(member.id)}>
  📥 Export
</button>
```

### Column Additions

Add columns in the table header & rows:

```tsx
<th className="px-4 py-3">Custom Column</th>
// ... in MemberRow:
<td className="px-4 py-3">Custom Data</td>
```

---

## Performance Notes

- Component uses `useMemo` for filtering/sorting (no re-sort on every render)
- Pagination not implemented yet (suitable for <500 members)
- For 1000+ members, consider:
  - Virtual scrolling (react-window)
  - Server-side filtering
  - Lazy-load enrollment data

---

## Integration Points

### 1. From Workspace Dashboard

Link to members dashboard:

```tsx
<a href={`/admin/workspaces/${workspace.id}/members`}>
  👥 {memberCount} Members
</a>
```

### 2. From Member Detail Page

Link back from individual member view:

```tsx
<a href={`/admin/workspaces/${workspaceId}/members`}>
  ← Back to Members
</a>
```

### 3. Notifications on Stuck Detection

Set up a cron job to notify on stuck members:

```typescript
// lib/jobs/notify-stuck-members.ts
export async function notifyStuckMembers() {
  const members = await db.query(`
    SELECT * FROM ... WHERE last_activity_at < NOW() - INTERVAL '7 days'
  `);
  
  members.forEach(m => {
    createNotification({
      workspaceId: m.workspace_id,
      title: `${m.name} has been inactive for 7+ days`,
      url: `/admin/workspaces/${m.workspace_id}/members`,
    });
  });
}
```

---

## Troubleshooting

### No members showing?
- Verify user has "owner" or "manager" role in workspace
- Check `workspaces_users` table for member records
- Enrollment data might be null if user hasn't started programme

### Progress stuck at 0%?
- Member hasn't accessed any lessons yet
- Check `enrollments` table for empty `chapters` array

### Stuck detection not working?
- Ensure `last_activity_at` is updated on lesson access
- Check that last_activity_at is stored as timestamp (not string)

### Promote button not showing?
- Member must have `currentChapter === 5` and `progressPercent === 100`
- Member must not already be "manager" or "owner"

---

## Future Enhancements

- [ ] Member detail modal (full submission history, coach notes)
- [ ] Bulk actions (export all, message all inactive, etc.)
- [ ] Email notification on stuck detection
- [ ] Progress charts (average per chapter, completion timeline)
- [ ] Export members to CSV
- [ ] Member search by name/email
- [ ] Cohort assignment from this view
- [ ] Performance timeline (when members complete each chapter)

---

## Files

- **Component:** `MemberProgressDashboard.tsx`
- **API Route:** `app/api/admin/workspaces/[id]/members/route.ts`
- **Page:** `app/admin/workspaces/[workspaceId]/members/page.tsx`
- **Docs:** This file

---

**Questions?** Refer to `/CLAUDE.md` or open an issue.
