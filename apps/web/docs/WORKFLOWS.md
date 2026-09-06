# Workflow Automation & Batch Operations

ONEVYRT now includes a comprehensive workflow automation engine and batch operations system for automating business logic and managing bulk operations efficiently.

## Overview

### Workflows

Workflows are automation rules that trigger on specific events and execute a series of actions. They consist of:

- **Trigger**: What initiates the workflow (e.g., chapter submission, schedule)
- **Conditions**: Optional filters that must be satisfied for the workflow to proceed
- **Actions**: What happens when the workflow executes (e.g., send email, auto-approve)

### Batch Operations

Batch operations allow performing the same action on multiple items simultaneously:

- Bulk user invitations
- Bulk approvals/rejections
- Bulk progress resets
- Bulk project archival

## Workflow API Reference

### List Workflows

```bash
GET /api/workflows?ws={workspaceId}
```

Response:
```json
{
  "workflows": [
    {
      "id": "abc123",
      "workspaceId": "ws-1",
      "name": "Auto-approve chapter submissions",
      "description": "Automatically approve submissions that meet criteria",
      "enabled": true,
      "triggerType": "chapter_submitted",
      "triggerConfig": { "chapterId": "chapter-1" },
      "conditions": [
        {
          "field": "submissionScore",
          "operator": "gt",
          "value": 80
        }
      ],
      "actions": [
        {
          "type": "send_notification",
          "config": {
            "title": "Submission Approved",
            "body": "Your submission has been approved!"
          }
        }
      ],
      "createdByUserId": "user-1",
      "createdAt": "2026-09-02T10:00:00Z",
      "updatedAt": "2026-09-02T10:00:00Z"
    }
  ]
}
```

### Create Workflow

```bash
POST /api/workflows?ws={workspaceId}
Content-Type: application/json

{
  "name": "Auto-approve chapter submissions",
  "description": "Automatically approve submissions that meet criteria",
  "triggerType": "chapter_submitted",
  "triggerConfig": { "chapterId": "chapter-1" },
  "conditions": [
    {
      "field": "submissionScore",
      "operator": "gt",
      "value": 80
    }
  ],
  "actions": [
    {
      "type": "send_notification",
      "config": {
        "title": "Submission Approved",
        "body": "Your submission has been approved!",
        "userIds": ["user-1", "user-2"]
      }
    },
    {
      "type": "auto_approve",
      "config": {
        "targetType": "chapter",
        "targetId": "chapter-1"
      }
    }
  ]
}
```

Response: `201 Created` with workflow object

### Get Workflow

```bash
GET /api/workflows/{workflowId}?ws={workspaceId}
```

### Update Workflow

```bash
PATCH /api/workflows/{workflowId}?ws={workspaceId}
Content-Type: application/json

{
  "name": "Updated workflow name",
  "enabled": false,
  "actions": [...]
}
```

### Delete Workflow

```bash
DELETE /api/workflows/{workflowId}?ws={workspaceId}
```

### Execute Workflow Manually

```bash
POST /api/workflows/{workflowId}/execute?ws={workspaceId}
Content-Type: application/json

{
  "triggerData": {
    "chapterId": "chapter-1",
    "userId": "user-1",
    "submissionScore": 85
  }
}
```

Response:
```json
{
  "execution": {
    "id": "exec-123",
    "workflowId": "workflow-1",
    "workspaceId": "ws-1",
    "status": "success",
    "actionResults": [
      {
        "actionIndex": 0,
        "status": "success",
        "result": { "sent": 2 }
      }
    ],
    "executedAt": "2026-09-02T10:05:00Z"
  }
}
```

### List Workflow Executions

```bash
GET /api/workflows/{workflowId}/executions?ws={workspaceId}&limit=50
```

Response:
```json
{
  "executions": [
    {
      "id": "exec-123",
      "workflowId": "workflow-1",
      "workspaceId": "ws-1",
      "status": "success",
      "actionResults": [...],
      "createdAt": "2026-09-02T10:05:00Z"
    }
  ]
}
```

## Trigger Types

### `chapter_submitted`
Triggered when a learner submits a chapter for review.

**Trigger Data Available:**
- `chapterId`: The chapter being submitted
- `userId`: The learner's user ID
- `workspaceId`: The workspace ID
- `submittedAt`: Timestamp of submission

### `lesson_submitted`
Triggered when a learner submits a lesson.

**Trigger Data Available:**
- `lessonId`: The lesson being submitted
- `userId`: The learner's user ID
- `workspaceId`: The workspace ID

### `submission_reviewed`
Triggered when a coach reviews a submission.

**Trigger Data Available:**
- `submissionId`: The submission reviewed
- `coachId`: The coach's user ID
- `decision`: "approved" or "rejected"

### `schedule`
Triggered on a schedule (daily, weekly, hourly).

**Configuration:**
```json
{
  "schedule": "daily" // or "weekly", "hourly", or cron expression
}
```

### `manual`
Triggered only when explicitly called via the execute endpoint.

## Action Types

### `send_email`
Sends an email to specified recipients.

**Configuration:**
```json
{
  "type": "send_email",
  "config": {
    "subject": "Your submission has been reviewed",
    "template": "Your submission for {{chapter}} has been reviewed.",
    "recipients": ["user@example.com"]
  }
}
```

### `send_notification`
Creates an in-app notification for users.

**Configuration:**
```json
{
  "type": "send_notification",
  "config": {
    "title": "Submission Approved",
    "body": "Your submission has been approved!",
    "userIds": ["user-1", "user-2"],
    "type": "workflow"
  }
}
```

### `auto_approve`
Automatically approves a submission if conditions are met.

**Configuration:**
```json
{
  "type": "auto_approve",
  "config": {
    "targetType": "chapter", // or "lesson"
    "targetId": "chapter-1"
  }
}
```

### `auto_archive`
Automatically archives old projects.

**Configuration:**
```json
{
  "type": "auto_archive",
  "config": {
    "projectIds": ["project-1", "project-2"],
    "reason": "Archived by workflow"
  }
}
```

## Conditions

Conditions are optional filters. If no conditions are specified, the workflow executes on every trigger.

**Condition Structure:**
```json
{
  "field": "fieldName",
  "operator": "eq|ne|gt|lt|in|contains",
  "value": "value"
}
```

**Operators:**
- `eq`: Equal to
- `ne`: Not equal to
- `gt`: Greater than (numeric)
- `lt`: Less than (numeric)
- `in`: Value is in array
- `contains`: String contains substring

**Example:**
```json
{
  "conditions": [
    {
      "field": "submissionScore",
      "operator": "gt",
      "value": 80
    },
    {
      "field": "chapterId",
      "operator": "eq",
      "value": "chapter-1"
    }
  ]
}
```

## Batch Operations API

### Create Batch Operation

```bash
POST /api/batch-operations?ws={workspaceId}
Content-Type: application/json

{
  "operationType": "bulk_invite",
  "operationData": {
    "items": ["user1@example.com", "user2@example.com"]
  }
}
```

### List Batch Operations

```bash
GET /api/batch-operations?ws={workspaceId}
```

Response:
```json
{
  "operations": [
    {
      "id": "op-123",
      "workspaceId": "ws-1",
      "operationType": "bulk_invite",
      "status": "success",
      "totalItems": 2,
      "processedItems": 2,
      "failedItems": 0,
      "results": [
        {
          "item": "user1@example.com",
          "status": "success"
        }
      ],
      "createdAt": "2026-09-02T10:00:00Z",
      "completedAt": "2026-09-02T10:02:00Z"
    }
  ]
}
```

### Get Batch Operation

```bash
GET /api/batch-operations/{operationId}?ws={workspaceId}
```

### Update Batch Operation

```bash
PATCH /api/batch-operations/{operationId}?ws={workspaceId}
Content-Type: application/json

{
  "status": "processing",
  "processedItems": 1,
  "failedItems": 0
}
```

## Batch Operation Types

### `bulk_invite`
Invite multiple users to the workspace.

**Operation Data:**
```json
{
  "items": ["email1@example.com", "email2@example.com"]
}
```

### `bulk_approval`
Approve multiple submissions.

**Operation Data:**
```json
{
  "submissionIds": ["sub-1", "sub-2"],
  "reason": "Meets all requirements"
}
```

### `bulk_reset`
Reset learner progress.

**Operation Data:**
```json
{
  "workspaceIds": ["ws-1", "ws-2"],
  "resetStage": "chapter-1"
}
```

## UI Components

### WorkflowManager

Main component for viewing and managing workflows:

```tsx
import WorkflowManager from "@/components/WorkflowManager";

export default function WorkflowsPage() {
  return <WorkflowManager workspaceId={workspaceId} />;
}
```

### WorkflowBuilder

Visual workflow builder component:

```tsx
import WorkflowBuilder from "@/components/WorkflowBuilder";

export default function CreateWorkflow() {
  return (
    <WorkflowBuilder
      workspaceId={workspaceId}
      onSave={async (workflow) => {
        // Save workflow
      }}
      onCancel={() => {
        // Handle cancel
      }}
    />
  );
}
```

### BatchOperationsPanel

Component for managing batch operations:

```tsx
import BatchOperationsPanel from "@/components/BatchOperationsPanel";

export default function BatchOpsPage() {
  return <BatchOperationsPanel workspaceId={workspaceId} />;
}
```

## Database Schema

### workflows
- `id`: Unique identifier
- `workspace_id`: Workspace owning the workflow
- `name`: Workflow name
- `description`: Optional description
- `enabled`: Whether the workflow is active
- `trigger_type`: Type of trigger
- `trigger_config`: JSONB configuration for trigger
- `conditions`: JSONB array of conditions
- `actions`: JSONB array of actions
- `created_by_user_id`: Creator's user ID
- `created_at`, `updated_at`: Timestamps

### workflow_executions
- `id`: Unique identifier
- `workflow_id`: Associated workflow
- `workspace_id`: Workspace ID
- `triggered_at`: When the workflow was triggered
- `trigger_data`: JSONB data that triggered the workflow
- `status`: pending|processing|success|failed
- `error_message`: Error details if failed
- `action_results`: JSONB array of action results
- `executed_at`: When execution completed
- `created_at`: Timestamp

### batch_operations
- `id`: Unique identifier
- `workspace_id`: Workspace ID
- `operation_type`: Type of batch operation
- `status`: pending|processing|success|failed
- `total_items`: Number of items to process
- `processed_items`: Items processed so far
- `failed_items`: Failed items count
- `operation_data`: JSONB configuration
- `results`: JSONB array of individual item results
- `error_message`: Overall error message
- `started_at`, `completed_at`: Timestamps
- `created_by_user_id`: Creator's user ID
- `created_at`: Timestamp

## Permissions

- **Owners/Managers**: Can create, edit, delete, and execute workflows
- **Editors**: Can view and execute workflows
- **Viewers**: Can only view workflows (cannot execute or modify)

## Scheduled Workflows

Workflows with `triggerType: "schedule"` are automatically executed by the job scheduler. The job runs once per hour and executes all due scheduled workflows.

**Supported Schedules:**
- `daily` or `0 0 * * *` - Daily at midnight UTC
- `weekly` or `0 0 * * 1` - Weekly on Monday at midnight UTC
- `hourly` - Every hour

## Best Practices

1. **Start with Manual Triggers**: Test workflows manually before enabling schedule-based execution
2. **Use Meaningful Names**: Give workflows descriptive names for easy identification
3. **Test Conditions**: Verify your conditions work as expected before going live
4. **Monitor Executions**: Review workflow execution history to ensure they're working correctly
5. **Limit Actions**: Keep the number of actions reasonable to avoid performance issues
6. **Use Notifications**: Prefer notifications over emails for non-critical updates
7. **Document Workflows**: Add descriptions to help other team members understand each workflow's purpose

## Examples

### Example 1: Auto-Approve High-Scoring Submissions

```json
{
  "name": "Auto-approve 90%+ submissions",
  "triggerType": "chapter_submitted",
  "conditions": [
    {
      "field": "submissionScore",
      "operator": "gt",
      "value": 90
    }
  ],
  "actions": [
    {
      "type": "auto_approve",
      "config": {
        "targetType": "chapter",
        "targetId": "chapter-1"
      }
    },
    {
      "type": "send_notification",
      "config": {
        "title": "Submission Auto-Approved",
        "body": "Your submission scored 90%+ and was automatically approved!",
        "userIds": ["trigger_userId"]
      }
    }
  ]
}
```

### Example 2: Weekly Stale Learner Nudge

```json
{
  "name": "Weekly stale learner reminder",
  "triggerType": "schedule",
  "triggerConfig": {
    "schedule": "weekly"
  },
  "actions": [
    {
      "type": "send_email",
      "config": {
        "subject": "Time to progress in your Growth Program",
        "template": "Hi there! It's been a week since you last worked on your growth program. Let's get back to it!",
        "recipients": ["learner@example.com"]
      }
    }
  ]
}
```

### Example 3: Bulk Invite Users

```json
{
  "operationType": "bulk_invite",
  "operationData": {
    "items": [
      "alice@company.com",
      "bob@company.com",
      "charlie@company.com"
    ]
  }
}
```

## Troubleshooting

### Workflow not executing
1. Check if the workflow is enabled (`enabled: true`)
2. Verify the trigger type matches what you expect
3. Check workflow execution history for error messages
4. Review condition logic - ensure conditions match your trigger data

### Actions not completing
1. Check action configuration for required fields
2. Review action results in execution history
3. Verify email addresses are valid (for email actions)
4. Ensure user IDs exist for notification actions

### Batch operation stuck
1. Check if operation status is "processing"
2. Look for error_message field
3. Consider manually updating the operation or retrying

## Future Enhancements

Planned features for future releases:
- Workflow templates and presets
- Advanced cron expression support
- Workflow composition (chaining workflows)
- Webhook triggers
- Conditional branching in actions
- Workflow versioning and rollback
- Real-time execution monitoring dashboard
- Workflow metrics and analytics
