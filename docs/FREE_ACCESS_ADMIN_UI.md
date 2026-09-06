# Free Access Mode Admin UI

## Overview

The **FreeAccessModeAdminUI** is a comprehensive admin dashboard component for managing free-access mode across workspaces. It provides:

- Single workspace toggle with confirmation modal
- Bulk enable functionality for multiple workspaces
- Audit log viewing with timestamp and admin email
- Visual status indicators (Unlocked/Locked badges)
- Loading states and error handling
- Responsive, accessible interface built with Tailwind CSS

## Component Structure

### File Locations

```
components/admin/
└── FreeAccessModeAdminUI.tsx       # Main component

app/admin/
└── free-access/
    └── page.tsx                    # Admin page integrating the component

app/api/admin/
├── free-access/
│   ├── route.ts                    # PATCH single workspace
│   └── bulk/
│       └── route.ts                # PATCH multiple workspaces
├── workspaces/
│   └── route.ts                    # GET all workspaces
└── audit-log/
    └── route.ts                    # GET audit log entries

docs/
└── FREE_ACCESS_ADMIN_UI.md         # This file
```

## Features

### 1. Toggle Switch
- **Single Click:** Click "Enable" or "Disable" button to toggle free-access mode
- **Confirmation Modal:** Shows workspace name and impact description
- **Loading States:** Button displays "Enabling..." or "Disabling..." during operation
- **Status Badge:** Green "Unlocked" or gray "Locked" badge shows current state

### 2. Confirmation Modal
Two types of modals prevent accidental changes:

#### Single Workspace Toggle
- Displays workspace name
- Shows action description (Unlock All Lessons / Lock All Lessons)
- Explains the impact on users
- Requires explicit confirmation

#### Bulk Enable
- Shows count of selected workspaces
- Warns that all users will get full access
- Requires confirmation before batch operation

### 3. Audit Log Display
- **Expandable Log:** Click chevron icon to expand/collapse audit history
- **Recent Entries:** Shows up to 5 most recent entries
- **Entry Details:** Displays action (enabled/disabled), admin email, timestamp
- **Color Coded:** Green badge for "enabled", orange for "disabled"
- **Overflow Handling:** Shows "+N more entries" for workspaces with many changes

### 4. Bulk Selection
- **Checkbox Selection:** Select individual workspaces
- **Select All Toggle:** Quickly select/deselect all workspaces
- **Bulk Toolbar:** Shows count of selected workspaces and bulk action button
- **Visual Feedback:** Selected rows are highlighted in blue

### 5. Status Indicators
```
Unlocked (Free-Access Enabled):
- Green dot indicator
- Green badge "Unlocked"
- Green "Disable" button

Locked (Free-Access Disabled):
- Gray dot indicator
- Gray badge "Locked"
- Green "Enable" button
```

## Component Props

```typescript
interface FreeAccessModeAdminUIProps {
  workspaces: Workspace[];
  auditLog: AuditLogEntry[];
  onToggleFreeAccess: (workspaceId: string, enabled: boolean) => Promise<void>;
  onBulkEnable: (workspaceIds: string[]) => Promise<void>;
  loading?: boolean;
}

interface Workspace {
  id: string;
  name: string;
  freeAccessEnabled: boolean;
}

interface AuditLogEntry {
  id: string;
  workspaceId: string;
  action: 'enabled' | 'disabled';
  adminEmail: string;
  timestamp: Date;
}
```

## Usage Example

### Basic Implementation

```typescript
import { useEffect, useState } from 'react';
import FreeAccessModeAdminUI from '@/components/admin/FreeAccessModeAdminUI';

export default function AdminPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [wsRes, logRes] = await Promise.all([
        fetch('/api/admin/workspaces?includeStatus=true'),
        fetch('/api/admin/audit-log?action=free-access'),
      ]);

      const workspacesData = await wsRes.json();
      const auditLogData = await logRes.json();

      setWorkspaces(workspacesData.workspaces);
      setAuditLog(
        auditLogData.auditLog.map((entry: any) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        }))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFreeAccess = async (workspaceId: string, enabled: boolean) => {
    const response = await fetch('/api/admin/free-access', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, enabled }),
    });

    if (!response.ok) throw new Error('Failed to update');

    // Update state and refetch audit log
    setWorkspaces(prev =>
      prev.map(ws =>
        ws.id === workspaceId ? { ...ws, freeAccessEnabled: enabled } : ws
      )
    );

    await fetchData();
  };

  const handleBulkEnable = async (workspaceIds: string[]) => {
    const response = await fetch('/api/admin/free-access/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceIds, enabled: true }),
    });

    if (!response.ok) throw new Error('Failed to bulk enable');

    await fetchData();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <FreeAccessModeAdminUI
        workspaces={workspaces}
        auditLog={auditLog}
        onToggleFreeAccess={handleToggleFreeAccess}
        onBulkEnable={handleBulkEnable}
        loading={isLoading}
      />
    </div>
  );
}
```

## API Endpoints

### GET /api/admin/workspaces

Retrieve all workspaces with free-access status.

**Query Parameters:**
- `includeStatus=true` - Include `freeAccessEnabled` field
- `search=string` - Filter by workspace name (case-insensitive)
- `limit=100` - Number of results (default: 100)
- `offset=0` - Pagination offset (default: 0)

**Response:**
```json
{
  "workspaces": [
    {
      "id": "ws_123",
      "name": "Acme Corp",
      "freeAccessEnabled": true
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

### PATCH /api/admin/free-access

Toggle free-access mode for a single workspace.

**Request Body:**
```json
{
  "workspaceId": "ws_123",
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "workspace": {
    "id": "ws_123",
    "name": "Acme Corp",
    "freeAccessEnabled": true
  },
  "message": "Free access mode enabled for workspace \"Acme Corp\""
}
```

### PATCH /api/admin/free-access/bulk

Enable free-access mode for multiple workspaces.

**Request Body:**
```json
{
  "workspaceIds": ["ws_123", "ws_456", "ws_789"],
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "workspacesUpdated": 3,
  "workspaces": [
    {
      "id": "ws_123",
      "name": "Acme Corp",
      "freeAccessEnabled": true
    }
  ],
  "message": "Free access mode enabled for 3 workspace(s)"
}
```

### GET /api/admin/audit-log

Retrieve audit log entries for free-access changes.

**Query Parameters:**
- `action=free-access` - Filter by action type
- `workspaceId=ws_123` - Filter by workspace
- `userId=user_456` - Filter by admin user
- `limit=100` - Number of results (default: 100)
- `offset=0` - Pagination offset (default: 0)

**Response:**
```json
{
  "auditLog": [
    {
      "id": "audit_123",
      "workspaceId": "ws_123",
      "adminEmail": "admin@example.com",
      "action": "enabled",
      "timestamp": "2026-09-03T15:30:00Z"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

## Integration with Database

### Required Schema Extensions

Add these fields to your existing schema:

**workspace model:**
```prisma
model workspace {
  id                   String      @id @default(cuid())
  name                 String
  ownerId              String
  freeAccessEnabled    Boolean     @default(false) // NEW
  stripCustomerId      String?
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt
  deletedAt            DateTime?
  
  // ... existing relations
  auditLogs            auditLog[]
}

model auditLog {
  id           String   @id @default(cuid())
  workspaceId  String
  workspace    workspace @relation(fields: [workspaceId], references: [id])
  userId       String
  user         user     @relation(fields: [userId], references: [id])
  action       String   // e.g., "free_access_mode", "free_access_mode_bulk"
  metadata     Json?
  createdAt    DateTime @default(now())

  @@index([workspaceId])
  @@index([userId])
  @@index([action])
  @@index([createdAt])
}
```

## Access Control

All endpoints require:
1. **Authentication:** Valid session cookie
2. **Authorization:** User must have `role = 'admin'`

Example middleware:
```typescript
// In each API route handler
const user = await currentUser(req.headers.get('cookie'));
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

const adminCheck = await db.user.findUnique({
  where: { id: user.id },
  select: { role: true },
});

if (adminCheck?.role !== 'admin') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

## Error Handling

The component handles these error scenarios:

| Error | Display | Recovery |
|-------|---------|----------|
| Network failure | Red banner with error message | User can retry action |
| Invalid workspace | Error shown in modal | Modal closes, state unchanged |
| Unauthorized | 401 from API | User redirected to login |
| Forbidden | 403 from API | Error message displayed |
| Validation error | 400 from API | Error message with details |
| Server error | 500 from API | Generic error message |

## Performance Considerations

1. **Lazy Loading:** Audit logs only load when chevron is clicked
2. **Batching:** Bulk operations send single API call for multiple workspaces
3. **Pagination:** List endpoints support limit/offset for large datasets
4. **Indexing:** Database queries use indexed fields (workspaceId, userId, action, createdAt)

## Accessibility Features

- **Semantic HTML:** Proper heading hierarchy, labels, and ARIA roles
- **Keyboard Navigation:** Tab through buttons, checkboxes, and modal controls
- **Focus Management:** Modal traps focus, clickable rows properly focused
- **Color Contrast:** All text meets WCAG AA standards
- **Icons with Text:** Heroicons always paired with descriptive text

## Styling with Tailwind CSS

The component uses these color tokens:

```
Background:    gray-50, white
Text Primary:  gray-900
Text Secondary: gray-600, gray-500
Borders:       gray-200, gray-300
Success:       green-600, green-100
Warning:       amber-600, amber-100
Danger:        red-600, red-100
Info:          blue-600, blue-100
```

## Testing

### Manual Test Checklist

- [ ] Toggle single workspace on/off
- [ ] Confirm modal appears with workspace name
- [ ] Disable confirmation cancels the action
- [ ] Select multiple workspaces
- [ ] Bulk enable works correctly
- [ ] Audit log expands/collapses
- [ ] Recent entries show correct admin email and timestamp
- [ ] Error messages display on API failure
- [ ] Loading states show during async operations
- [ ] Pagination works with many workspaces
- [ ] Search filters workspaces by name
- [ ] Tab navigation works through all controls
- [ ] Responsive on mobile (if needed)

### Unit Test Example

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import FreeAccessModeAdminUI from '@/components/admin/FreeAccessModeAdminUI';

describe('FreeAccessModeAdminUI', () => {
  const mockWorkspaces = [
    { id: 'ws_1', name: 'Workspace 1', freeAccessEnabled: false },
    { id: 'ws_2', name: 'Workspace 2', freeAccessEnabled: true },
  ];

  const mockAuditLog = [];

  it('renders workspaces', () => {
    render(
      <FreeAccessModeAdminUI
        workspaces={mockWorkspaces}
        auditLog={mockAuditLog}
        onToggleFreeAccess={jest.fn()}
        onBulkEnable={jest.fn()}
      />
    );

    expect(screen.getByText('Workspace 1')).toBeInTheDocument();
    expect(screen.getByText('Workspace 2')).toBeInTheDocument();
  });

  it('shows unlock badge for enabled workspaces', () => {
    render(
      <FreeAccessModeAdminUI
        workspaces={mockWorkspaces}
        auditLog={mockAuditLog}
        onToggleFreeAccess={jest.fn()}
        onBulkEnable={jest.fn()}
      />
    );

    const badges = screen.getAllByText('Unlocked');
    expect(badges).toHaveLength(1);
  });

  it('opens confirmation modal on toggle click', () => {
    render(
      <FreeAccessModeAdminUI
        workspaces={mockWorkspaces}
        auditLog={mockAuditLog}
        onToggleFreeAccess={jest.fn()}
        onBulkEnable={jest.fn()}
      />
    );

    const enableButton = screen.getByText('Enable');
    fireEvent.click(enableButton);

    expect(screen.getByText('Unlock All Lessons')).toBeInTheDocument();
  });
});
```

## Future Enhancements

1. **Export Audit Log:** Download audit log as CSV
2. **Date Range Filter:** Filter audit log by date range
3. **Bulk Disable:** Add option to bulk disable free-access
4. **Schedule Changes:** Schedule free-access toggle for future date/time
5. **Impact Preview:** Show number of users affected before toggle
6. **Notification:** Send email to workspace owners when free-access is enabled
7. **Time Limits:** Set expiration date for free-access period
8. **Role-Based Filtering:** Admin can see which users have which roles in each workspace

## Troubleshooting

### Workspaces Not Loading
- Check user has admin role
- Verify API endpoint is accessible
- Check browser console for network errors

### Audit Log Not Updating
- Verify audit log entries are being created in database
- Check `metadata.action` field is set correctly
- Verify user email is stored in `user.email`

### Toggle Not Working
- Check workspace ID is correct
- Verify workspace exists in database
- Check user has permission to update workspace
- Check network request is reaching API endpoint

### Styling Issues
- Ensure Tailwind CSS is properly configured
- Check for CSS conflicts with other components
- Verify Heroicons are installed (`npm install @heroicons/react`)

## Contributing

When modifying this component:
1. Maintain TypeScript types for all props
2. Keep component focused on UI/UX only
3. Move business logic to parent components or API routes
4. Add descriptive comments for complex sections
5. Test on mobile and desktop viewports
6. Ensure accessibility compliance (WCAG AA minimum)
