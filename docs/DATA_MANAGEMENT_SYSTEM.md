# Data Management System

## Overview

The Data Management System provides comprehensive tools for handling data throughout its lifecycle in ONEVYRT:

1. **Export Management** — Multiple formats (JSON, CSV, PDF), selective export, scheduled exports
2. **Import Management** — Bulk import users, funnels, learners from CSV/JSON
3. **Backup & Restore** — Automated daily backups, point-in-time recovery, backup verification
4. **Retention Policies** — Configure soft-delete windows, automatic hard-delete, compliance reporting

## Architecture

### Database Tables

All tables are defined in `migrations/1790000000000_data-management-system.js`:

#### `export_history`
Tracks all exports (manual or scheduled) with format, type, and status.

- `id` (uuid) — Unique export ID
- `workspace_id` (text) — Workspace scope
- `user_id` (text) — User who initiated export
- `format` (text) — 'json', 'csv', or 'pdf'
- `export_type` (text) — 'full' or 'selective'
- `selected_categories` (jsonb) — Categories included (for selective export)
- `file_size_bytes` (bigint) — Export file size
- `file_url` (text) — CDN/S3 URL for download
- `status` (text) — 'pending', 'processing', 'completed', 'failed'
- `created_at` (timestamptz) — Creation time
- `expires_at` (timestamptz) — When file can be deleted (default 30 days)

**Indexes:**
- `export_history_workspace_date_idx` — For workspace export history queries
- `export_history_user_date_idx` — For user-scoped export history
- `export_history_status_idx` — For pending/processing export tracking

#### `scheduled_exports`
Recurring export configurations.

- `id` (uuid) — Configuration ID
- `workspace_id` (text) — Workspace scope
- `created_by_user_id` (text) — Creator
- `name` (text) — Human-readable name
- `format` (text) — 'json', 'csv', or 'pdf'
- `selected_categories` (jsonb) — Categories to export
- `frequency` (text) — 'daily', 'weekly', or 'monthly'
- `schedule_day_or_weekday` (integer) — Day of month (1-28) or weekday (0-6)
- `schedule_hour` (integer) — UTC hour (0-23)
- `recipient_email` (text) — Email to send export to
- `enabled` (boolean) — Is this schedule active?
- `last_run_at` (timestamptz) — Last execution time
- `next_run_at` (timestamptz) — Next scheduled run
- `created_at` (timestamptz) — Creation time
- `deleted_at` (timestamptz) — Soft-delete timestamp

**Indexes:**
- `scheduled_exports_active_idx` — For querying active schedules
- `scheduled_exports_next_run_idx` — For cron job to find due exports

#### `import_history`
Tracks all import operations.

- `id` (uuid) — Import ID
- `workspace_id` (text) — Workspace scope
- `user_id` (text) — User who initiated import
- `import_type` (text) — 'users', 'funnels', or 'learners'
- `file_name` (text) — Original filename
- `file_size_bytes` (bigint) — File size
- `status` (text) — 'pending', 'processing', 'completed', 'failed'
- `total_rows` (integer) — Total rows in file
- `successfully_imported` (integer) — Rows successfully imported
- `skipped_rows` (integer) — Rows skipped (duplicates, etc.)
- `failed_rows` (integer) — Rows with errors
- `error_details` (jsonb) — Array of error details per row
- `mapping_config` (jsonb) — Column mapping configuration
- `created_at` (timestamptz) — Creation time
- `completed_at` (timestamptz) — Completion time

#### `backup_records`
Backup metadata for point-in-time recovery.

- `id` (uuid) — Backup ID
- `workspace_id` (text) — Workspace scope
- `backup_type` (text) — 'automated' or 'manual'
- `backup_timestamp` (timestamptz) — Point-in-time the backup represents
- `storage_location` (text) — S3 path or storage backend reference
- `storage_size_bytes` (bigint) — Backup size
- `status` (text) — 'pending', 'processing', 'completed', 'failed'
- `includes_media` (boolean) — Whether media files are included
- `checksum` (text) — SHA256 for integrity verification
- `retention_until` (timestamptz) — When this backup can be deleted
- `created_at` (timestamptz) — Creation time
- `error_message` (text) — Error details if failed

#### `data_retention_policies`
Configured retention rules per data type.

- `id` (uuid) — Policy ID
- `workspace_id` (text) — Workspace scope
- `data_type` (text) — e.g., 'leads', 'projects', 'activity_logs'
- `soft_delete_days` (integer) — Days before hard-delete is allowed
- `hard_delete_days` (integer) — Days until automatic hard-delete
- `auto_delete_enabled` (boolean) — Whether to automatically hard-delete
- `compliance_note` (text) — e.g., "GDPR compliance"
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

#### `compliance_reports`
Daily snapshots of data retention status per data type.

- `id` (uuid) — Report ID
- `workspace_id` (text) — Workspace scope
- `report_date` (date) — Date of report
- `data_type` (text) — Data type being reported
- `records_kept` (bigint) — Live records
- `records_soft_deleted` (bigint) — Soft-deleted records
- `records_hard_deleted` (bigint) — Records hard-deleted on this date
- `total_storage_bytes` (bigint) — Storage used by this data type
- `compliance_status` (text) — 'compliant', 'at_risk', 'non_compliant'
- `notes` (text) — Additional notes
- `created_at` (timestamptz)

### Libraries

#### `lib/data-management/exports.ts`
Export history and scheduled export management.

**Key Functions:**
- `logExport()` — Record a completed export
- `logExportFailure()` — Record an export that failed
- `getExportHistory()` — Paginated export history
- `createScheduledExport()` — Create recurring export
- `getScheduledExports()` — List scheduled exports
- `getDueScheduledExports()` — Exports ready to run (for cron)
- `markScheduledExportRun()` — Update next run time
- `updateScheduledExport()` — Modify export configuration
- `deleteScheduledExport()` — Soft-delete export config
- `cleanupExpiredExports()` — Remove expired export files

#### `lib/data-management/imports.ts`
Import validation, tracking, and statistics.

**Key Functions:**
- `createImportRecord()` — Start tracking an import
- `updateImportProgress()` — Update import status and counts
- `getImportHistory()` — Paginated import history
- `getImportRecord()` — Get a specific import
- `validateCSVStructure()` — Check headers
- `validateImportRow()` — Validate individual rows
- `parseCSV()` — Parse CSV content
- `getImportStats()` — Success/failure statistics

#### `lib/data-management/backups.ts`
Backup creation, verification, and point-in-time recovery.

**Key Functions:**
- `createBackupRecord()` — Start a new backup
- `markBackupCompleted()` — Backup finished successfully
- `markBackupFailed()` — Backup failed
- `getBackups()` — Paginated backup list
- `getLatestBackup()` — Most recent backup
- `getBackupStats()` — Total storage, counts, dates
- `findBackupForPointInTime()` — Locate backup for recovery
- `deleteExpiredBackups()` — Clean old backups
- `verifyBackupIntegrity()` — Verify checksums
- `calculateChecksum()` — SHA256 for data
- `getBackupRetentionPolicy()` — Configured retention
- `getBackupsToRetain()` — Backups to keep based on policy

#### `lib/data-management/retention.ts`
Retention policies and compliance reporting.

**Key Functions:**
- `getOrCreateRetentionPolicy()` — Get or initialize policy
- `getRetentionPolicy()` — Fetch specific policy
- `createRetentionPolicy()` — Create new policy
- `updateRetentionPolicy()` — Modify policy settings
- `getRetentionPolicies()` — List all policies for workspace
- `getAutoDeletePolicies()` — Policies with auto-delete enabled
- `createComplianceReport()` — Generate daily compliance snapshot
- `getComplianceReports()` — Compliance history
- `getLatestComplianceReport()` — Most recent report
- `getWorkspaceComplianceStatus()` — Overall compliance status
- `shouldSoftDelete()` — Check if record should be soft-deleted
- `shouldHardDelete()` — Check if record should be hard-deleted

**Default Policies:**
```typescript
leads: { soft_delete_days: 7, hard_delete_days: 30 }
bookings: { soft_delete_days: 7, hard_delete_days: 30 }
projects: { soft_delete_days: 14, hard_delete_days: 60 }
activity_logs: { soft_delete_days: 0, hard_delete_days: 90 }
events: { soft_delete_days: 0, hard_delete_days: 365 }
sessions: { soft_delete_days: 0, hard_delete_days: 180 }
otp_verifications: { soft_delete_days: 0, hard_delete_days: 7 }
```

#### `lib/data-management/jobs.ts`
Cron job handlers for background data management tasks.

**Jobs:**
- `processScheduledExports()` — Run due scheduled exports (1-hour interval)
- `cleanupExpiredData()` — Remove expired exports/backups (daily)
- `enforceDataRetention()` — Hard-delete expired soft-deleted records (daily)

## API Routes

### Exports

#### `GET /api/account/data-management/exports`
Get export history for a workspace.

**Query Parameters:**
- `workspaceId` (required) — Workspace ID
- `limit` (optional, default 50, max 100) — Pagination limit
- `offset` (optional, default 0) — Pagination offset

**Response:**
```json
{
  "records": [
    {
      "id": "uuid",
      "workspace_id": "workspace-id",
      "user_id": "user-id",
      "format": "json",
      "export_type": "full",
      "selected_categories": [],
      "file_size_bytes": 1024000,
      "file_url": "https://cdn.example.com/exports/...",
      "status": "completed",
      "created_at": "2026-09-02T10:00:00Z",
      "expires_at": "2026-10-02T10:00:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

#### `POST /api/account/data-management/exports`
Initiate a new export.

**Request Body:**
```json
{
  "workspaceId": "workspace-id",
  "format": "json",
  "exportType": "selective",
  "selectedCategories": ["projects", "enrollment", "activity"]
}
```

**Response (202 Accepted):**
```json
{
  "id": "export-uuid",
  "status": "processing",
  "message": "Export initiated. You will receive a notification when ready."
}
```

**Rate Limit:** 5 exports per hour per user

### Scheduled Exports

#### `GET /api/account/data-management/scheduled-exports`
List scheduled exports for a workspace.

**Query Parameters:**
- `workspaceId` (required)

**Response:**
```json
{
  "records": [
    {
      "id": "uuid",
      "workspace_id": "workspace-id",
      "created_by_user_id": "user-id",
      "name": "Weekly Full Export",
      "format": "json",
      "selected_categories": ["projects", "enrollment"],
      "frequency": "weekly",
      "schedule_day_or_weekday": 0,
      "schedule_hour": 9,
      "recipient_email": "owner@example.com",
      "enabled": true,
      "last_run_at": "2026-08-26T09:00:00Z",
      "next_run_at": "2026-09-02T09:00:00Z",
      "created_at": "2026-08-15T14:22:00Z"
    }
  ]
}
```

#### `POST /api/account/data-management/scheduled-exports`
Create a new scheduled export. Owner/manager only.

**Request Body:**
```json
{
  "workspaceId": "workspace-id",
  "name": "Weekly Full Export",
  "format": "json",
  "selectedCategories": ["projects", "enrollment"],
  "frequency": "weekly",
  "scheduleDayOrWeekday": 0,
  "scheduleHour": 9,
  "recipientEmail": "owner@example.com"
}
```

### Imports

#### `GET /api/account/data-management/imports`
Get import history.

**Query Parameters:**
- `workspaceId` (required)
- `limit` (optional, default 50)
- `offset` (optional, default 0)

**Response:**
```json
{
  "records": [
    {
      "id": "uuid",
      "workspace_id": "workspace-id",
      "user_id": "user-id",
      "import_type": "learners",
      "file_name": "learners.csv",
      "file_size_bytes": 51200,
      "status": "completed",
      "total_rows": 150,
      "successfully_imported": 148,
      "skipped_rows": 1,
      "failed_rows": 1,
      "error_details": [
        {
          "row_number": 42,
          "field": "email",
          "error_message": "Invalid email format"
        }
      ],
      "created_at": "2026-09-02T08:15:00Z",
      "completed_at": "2026-09-02T08:16:30Z"
    }
  ],
  "total": 23,
  "limit": 50,
  "offset": 0
}
```

#### `POST /api/account/data-management/imports`
Initiate a new import. Owner/manager only.

**Request Body (multipart/form-data):**
- `workspaceId` (text) — Workspace ID
- `importType` (text) — 'users', 'funnels', or 'learners'
- `file` (binary) — CSV file

**Response (202 Accepted):**
```json
{
  "id": "import-uuid",
  "status": "processing",
  "message": "Import initiated. Processing your data...",
  "totalRows": 150
}
```

**Rate Limit:** 10 imports per hour per user

### Backups

#### `GET /api/account/data-management/backups`
Get backup records and statistics.

**Query Parameters:**
- `workspaceId` (required)
- `includeStats` (optional, default false)
- `limit` (optional, default 50)
- `offset` (optional, default 0)

**Response:**
```json
{
  "records": [
    {
      "id": "uuid",
      "workspace_id": "workspace-id",
      "backup_type": "automated",
      "backup_timestamp": "2026-09-02T00:00:00Z",
      "storage_location": "s3://onevyrt-backups/workspace-id/1726819200000",
      "storage_size_bytes": 52428800,
      "status": "completed",
      "includes_media": true,
      "checksum": "sha256hash...",
      "retention_until": "2026-12-01T00:00:00Z",
      "created_at": "2026-09-02T00:15:00Z"
    }
  ],
  "total": 92,
  "limit": 50,
  "offset": 0,
  "stats": {
    "total_backups": 92,
    "successful_backups": 91,
    "failed_backups": 1,
    "total_storage_bytes": 4824465408,
    "latest_backup_at": "2026-09-02T00:00:00Z",
    "oldest_backup_at": "2026-06-04T00:00:00Z"
  },
  "latest": { /* backup record */ }
}
```

#### `POST /api/account/data-management/backups`
Trigger a manual backup. Owner only.

**Request Body:**
```json
{
  "workspaceId": "workspace-id",
  "includeMedia": true
}
```

**Response (202 Accepted):**
```json
{
  "id": "backup-uuid",
  "status": "processing",
  "message": "Backup initiated. This may take several minutes.",
  "estimatedCompletionTime": "2026-09-02T00:10:00Z"
}
```

### Retention Policies

#### `GET /api/account/data-management/retention-policies`
Get retention policies and compliance status.

**Query Parameters:**
- `workspaceId` (required)
- `includeComplianceStatus` (optional, default false)
- `includeReports` (optional, default false)

**Response:**
```json
{
  "policies": [
    {
      "id": "uuid",
      "workspace_id": "workspace-id",
      "data_type": "leads",
      "soft_delete_days": 7,
      "hard_delete_days": 30,
      "auto_delete_enabled": true,
      "compliance_note": "Standard retention",
      "created_at": "2026-08-15T00:00:00Z",
      "updated_at": "2026-08-15T00:00:00Z"
    }
  ],
  "compliance": {
    "overall_status": "compliant",
    "compliant_types": 7,
    "at_risk_types": 0,
    "non_compliant_types": 0,
    "total_soft_deleted": 234,
    "total_hard_deleted": 1023,
    "policies_with_auto_delete": 7
  },
  "recentReports": [
    {
      "id": "uuid",
      "workspace_id": "workspace-id",
      "report_date": "2026-09-01",
      "data_type": "leads",
      "records_kept": 5432,
      "records_soft_deleted": 12,
      "records_hard_deleted": 8,
      "total_storage_bytes": 2097152,
      "compliance_status": "compliant",
      "created_at": "2026-09-02T00:30:00Z"
    }
  ]
}
```

#### `POST /api/account/data-management/retention-policies`
Create or update a retention policy. Owner only.

**Request Body:**
```json
{
  "workspaceId": "workspace-id",
  "dataType": "leads",
  "softDeleteDays": 7,
  "hardDeleteDays": 30,
  "autoDeleteEnabled": true,
  "complianceNote": "GDPR Article 17"
}
```

**To Update Existing:**
```json
{
  "workspaceId": "workspace-id",
  "policyId": "policy-uuid",
  "softDeleteDays": 10,
  "autoDeleteEnabled": false
}
```

## Cron Jobs

### Scheduled Exports (Hourly)
Processes due scheduled exports, marks them as run, and calculates next run time.

```
12:00 AM — Monday daily
9:00 AM UTC — Weekly exports
1st of month at 6:00 AM UTC — Monthly exports
```

### Cleanup Expired Data (Daily)
Removes export files and backup records that exceeded their retention period.

### Enforce Data Retention (Daily)
Identifies soft-deleted records that have exceeded the hard-delete window and removes them permanently. Also generates daily compliance reports per data type.

## Usage Examples

### Manual Export
```javascript
// Client
const response = await fetch('/api/account/data-management/exports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspaceId: 'ws-123',
    format: 'json',
    exportType: 'selective',
    selectedCategories: ['projects', 'enrollment']
  })
});
const { id, status } = await response.json();
// Poll or listen for completion notification
```

### Create Scheduled Export
```javascript
await fetch('/api/account/data-management/scheduled-exports', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspaceId: 'ws-123',
    name: 'Weekly Backup Email',
    format: 'json',
    selectedCategories: ['projects', 'enrollment', 'activity'],
    frequency: 'weekly',
    scheduleDayOrWeekday: 0, // Monday
    scheduleHour: 9,
    recipientEmail: 'owner@example.com'
  })
});
```

### Import Learners
```javascript
const formData = new FormData();
formData.append('workspaceId', 'ws-123');
formData.append('importType', 'learners');
formData.append('file', csvFile);

const response = await fetch('/api/account/data-management/imports', {
  method: 'POST',
  body: formData
});
const { id, totalRows } = await response.json();
```

### Configure Retention
```javascript
await fetch('/api/account/data-management/retention-policies', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workspaceId: 'ws-123',
    dataType: 'leads',
    softDeleteDays: 14,
    hardDeleteDays: 60,
    autoDeleteEnabled: true,
    complianceNote: 'GDPR compliance - 2-month retention'
  })
});
```

## Security Considerations

1. **Access Control** — All data management endpoints require authentication and workspace membership
2. **Rate Limiting** — Exports (5/hour) and imports (10/hour) per user to prevent abuse
3. **Owner-Only Operations** — Backup triggers and retention policy changes require owner role
4. **Data Isolation** — All queries filtered by workspace_id
5. **Soft-Delete Safety** — Deleted data recoverable for configured retention period
6. **Checksum Verification** — Backups include SHA256 checksums for integrity

## Performance Considerations

1. **Pagination** — Export/import/backup history paginated (max 100 per request)
2. **Indexes** — Optimized indexes on workspace_id, status, timestamp columns
3. **Async Processing** — Exports and imports processed asynchronously
4. **Batch Retention Enforcement** — Retention jobs batch-process workspaces to minimize database load
5. **Export File Cleanup** — Automatic cleanup prevents unbounded storage growth

## Future Enhancements

1. **Streaming Exports** — For very large workspaces (>100MB exports)
2. **Incremental Backups** — Track changes since last backup
3. **Encryption at Rest** — Encrypt backup storage
4. **Custom Retention Schedules** — Per-workspace retention policies
5. **Advanced Compliance Reports** — GDPR/HIPAA/SOC2 audit trails
6. **Restore UI** — Point-in-time recovery dashboard
7. **Export Templates** — Pre-configured export formats for common use cases
