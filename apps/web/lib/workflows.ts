/**
 * Workflow automation engine — triggers, conditions, actions.
 */
import { randomBytes } from "node:crypto";
import { pgPool } from "./db";
import { createNotification } from "./notifications";
import { sendMail } from "./mailer";

export type TriggerType = "chapter_submitted" | "lesson_submitted" | "submission_reviewed" | "schedule" | "manual";
export type ActionType = "send_email" | "send_notification" | "auto_approve" | "auto_archive";
export type OperationType = "bulk_invite" | "bulk_approval" | "bulk_reset";

export interface Condition {
  field: string; // e.g. "chapter_id", "submission_count"
  operator: "eq" | "ne" | "gt" | "lt" | "in" | "contains";
  value: string | number | boolean | string[];
}

export interface WorkflowAction {
  type: ActionType;
  config: Record<string, unknown>;
  enabled?: boolean;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  enabled: boolean;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  conditions: Condition[];
  actions: WorkflowAction[];
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workspaceId: string;
  triggeredAt: string;
  triggerData?: Record<string, unknown>;
  status: "pending" | "processing" | "success" | "failed";
  errorMessage?: string;
  actionResults: Array<{ actionIndex: number; status: string; result?: unknown }>;
  executedAt?: string;
  createdAt: string;
}

export interface BatchOperation {
  id: string;
  workspaceId: string;
  operationType: OperationType;
  status: "pending" | "processing" | "success" | "failed";
  totalItems: number;
  processedItems: number;
  failedItems: number;
  operationData: Record<string, unknown>;
  results: Array<{ item: string; status: string; result?: unknown }>;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdByUserId: string;
  createdAt: string;
}

function rowToWorkflow(row: {
  id: string; workspace_id: string; name: string; description: string | null;
  enabled: boolean; trigger_type: string; trigger_config: unknown; conditions: unknown;
  actions: unknown; created_by_user_id: string; created_at: Date; updated_at: Date;
}): Workflow {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description ?? undefined,
    enabled: row.enabled,
    triggerType: row.trigger_type as TriggerType,
    triggerConfig: (row.trigger_config ?? {}) as Record<string, unknown>,
    conditions: (row.conditions ?? []) as Condition[],
    actions: (row.actions ?? []) as WorkflowAction[],
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rowToWorkflowExecution(row: {
  id: string; workflow_id: string; workspace_id: string; triggered_at: Date;
  trigger_data: unknown; status: string; error_message: string | null;
  action_results: unknown; executed_at: Date | null; created_at: Date;
}): WorkflowExecution {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workspaceId: row.workspace_id,
    triggeredAt: row.triggered_at.toISOString(),
    triggerData: (row.trigger_data ?? {}) as Record<string, unknown>,
    status: row.status as "pending" | "processing" | "success" | "failed",
    errorMessage: row.error_message ?? undefined,
    actionResults: (row.action_results ?? []) as Array<{ actionIndex: number; status: string; result?: unknown }>,
    executedAt: row.executed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

function rowToBatchOperation(row: {
  id: string; workspace_id: string; operation_type: string; status: string;
  total_items: number; processed_items: number; failed_items: number;
  operation_data: unknown; results: unknown; error_message: string | null;
  started_at: Date | null; completed_at: Date | null;
  created_by_user_id: string; created_at: Date;
}): BatchOperation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    operationType: row.operation_type as OperationType,
    status: row.status as "pending" | "processing" | "success" | "failed",
    totalItems: row.total_items,
    processedItems: row.processed_items,
    failedItems: row.failed_items,
    operationData: (row.operation_data ?? {}) as Record<string, unknown>,
    results: (row.results ?? []) as Array<{ item: string; status: string; result?: unknown }>,
    errorMessage: row.error_message ?? undefined,
    startedAt: row.started_at?.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at.toISOString(),
  };
}

/**
 * Create a new workflow for a workspace.
 */
export async function createWorkflow(input: {
  workspaceId: string;
  name: string;
  description?: string;
  triggerType: TriggerType;
  triggerConfig: Record<string, unknown>;
  conditions: Condition[];
  actions: WorkflowAction[];
  createdByUserId: string;
}): Promise<Workflow> {
  const id = randomBytes(8).toString("hex");
  const res = await pgPool().query<Parameters<typeof rowToWorkflow>[0]>(
    `INSERT INTO workflows (id, workspace_id, name, description, trigger_type, trigger_config, conditions, actions, created_by_user_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
     RETURNING id, workspace_id, name, description, enabled, trigger_type, trigger_config, conditions, actions, created_by_user_id, created_at, updated_at`,
    [id, input.workspaceId, input.name, input.description ?? null, input.triggerType, input.triggerConfig, input.conditions, input.actions, input.createdByUserId],
  );
  return rowToWorkflow(res.rows[0]!);
}

/**
 * List workflows for a workspace.
 */
export async function listWorkflows(workspaceId: string): Promise<Workflow[]> {
  const res = await pgPool().query<Parameters<typeof rowToWorkflow>[0]>(
    `SELECT id, workspace_id, name, description, enabled, trigger_type, trigger_config, conditions, actions, created_by_user_id, created_at, updated_at
     FROM workflows WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId],
  );
  return res.rows.map(rowToWorkflow);
}

/**
 * Get a single workflow by ID.
 */
export async function getWorkflow(workflowId: string, workspaceId: string): Promise<Workflow | null> {
  const res = await pgPool().query<Parameters<typeof rowToWorkflow>[0]>(
    `SELECT id, workspace_id, name, description, enabled, trigger_type, trigger_config, conditions, actions, created_by_user_id, created_at, updated_at
     FROM workflows WHERE id = $1 AND workspace_id = $2`,
    [workflowId, workspaceId],
  );
  return res.rows[0] ? rowToWorkflow(res.rows[0]) : null;
}

/**
 * Update a workflow.
 */
export async function updateWorkflow(workflowId: string, workspaceId: string, updates: Partial<Workflow>): Promise<Workflow | null> {
  const setClauses = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (updates.name !== undefined) { setClauses.push(`name = $${paramCount++}`); values.push(updates.name); }
  if (updates.description !== undefined) { setClauses.push(`description = $${paramCount++}`); values.push(updates.description ?? null); }
  if (updates.enabled !== undefined) { setClauses.push(`enabled = $${paramCount++}`); values.push(updates.enabled); }
  if (updates.triggerType !== undefined) { setClauses.push(`trigger_type = $${paramCount++}`); values.push(updates.triggerType); }
  if (updates.triggerConfig !== undefined) { setClauses.push(`trigger_config = $${paramCount++}`); values.push(updates.triggerConfig); }
  if (updates.conditions !== undefined) { setClauses.push(`conditions = $${paramCount++}`); values.push(updates.conditions); }
  if (updates.actions !== undefined) { setClauses.push(`actions = $${paramCount++}`); values.push(updates.actions); }

  setClauses.push(`updated_at = now()`);
  values.push(workflowId, workspaceId);

  if (setClauses.length <= 1) return getWorkflow(workflowId, workspaceId);

  const res = await pgPool().query<Parameters<typeof rowToWorkflow>[0]>(
    `UPDATE workflows SET ${setClauses.join(", ")} WHERE id = $${paramCount++} AND workspace_id = $${paramCount++}
     RETURNING id, workspace_id, name, description, enabled, trigger_type, trigger_config, conditions, actions, created_by_user_id, created_at, updated_at`,
    values,
  );
  return res.rows[0] ? rowToWorkflow(res.rows[0]) : null;
}

/**
 * Delete a workflow.
 */
export async function deleteWorkflow(workflowId: string, workspaceId: string): Promise<boolean> {
  const res = await pgPool().query("DELETE FROM workflows WHERE id = $1 AND workspace_id = $2", [workflowId, workspaceId]);
  return (res.rowCount ?? 0) > 0;
}

/**
 * Create a workflow execution (record when a workflow is triggered).
 */
export async function createWorkflowExecution(input: {
  workflowId: string;
  workspaceId: string;
  triggerData?: Record<string, unknown>;
}): Promise<WorkflowExecution> {
  const id = randomBytes(8).toString("hex");
  const res = await pgPool().query<Parameters<typeof rowToWorkflowExecution>[0]>(
    `INSERT INTO workflow_executions (id, workflow_id, workspace_id, triggered_at, trigger_data, status, created_at)
     VALUES ($1, $2, $3, now(), $4, 'pending', now())
     RETURNING id, workflow_id, workspace_id, triggered_at, trigger_data, status, error_message, action_results, executed_at, created_at`,
    [id, input.workflowId, input.workspaceId, input.triggerData ?? null],
  );
  return rowToWorkflowExecution(res.rows[0]!);
}

/**
 * Update workflow execution status and results.
 */
export async function updateWorkflowExecution(executionId: string, updates: {
  status?: "pending" | "processing" | "success" | "failed";
  errorMessage?: string | null;
  actionResults?: Array<{ actionIndex: number; status: string; result?: unknown }>;
  executedAt?: string;
}): Promise<WorkflowExecution | null> {
  const setClauses = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (updates.status !== undefined) { setClauses.push(`status = $${paramCount++}`); values.push(updates.status); }
  if (updates.errorMessage !== undefined) { setClauses.push(`error_message = $${paramCount++}`); values.push(updates.errorMessage ?? null); }
  if (updates.actionResults !== undefined) { setClauses.push(`action_results = $${paramCount++}`); values.push(updates.actionResults); }
  if (updates.executedAt !== undefined) { setClauses.push(`executed_at = $${paramCount++}`); values.push(new Date(updates.executedAt)); }

  if (setClauses.length === 0) return null;

  values.push(executionId);
  const res = await pgPool().query<Parameters<typeof rowToWorkflowExecution>[0]>(
    `UPDATE workflow_executions SET ${setClauses.join(", ")} WHERE id = $${paramCount++}
     RETURNING id, workflow_id, workspace_id, triggered_at, trigger_data, status, error_message, action_results, executed_at, created_at`,
    values,
  );
  return res.rows[0] ? rowToWorkflowExecution(res.rows[0]) : null;
}

/**
 * List workflow executions for a workflow.
 */
export async function listWorkflowExecutions(workflowId: string, limit = 50): Promise<WorkflowExecution[]> {
  const res = await pgPool().query<Parameters<typeof rowToWorkflowExecution>[0]>(
    `SELECT id, workflow_id, workspace_id, triggered_at, trigger_data, status, error_message, action_results, executed_at, created_at
     FROM workflow_executions WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [workflowId, limit],
  );
  return res.rows.map(rowToWorkflowExecution);
}

/**
 * Evaluate workflow conditions against trigger data.
 */
export function evaluateConditions(conditions: Condition[], triggerData: Record<string, unknown>): boolean {
  if (conditions.length === 0) return true;

  for (const condition of conditions) {
    const fieldValue = triggerData[condition.field];
    if (!evaluateCondition(condition, fieldValue)) return false;
  }
  return true;
}

function evaluateCondition(condition: Condition, value: unknown): boolean {
  const { operator, value: expected } = condition;

  switch (operator) {
    case "eq":
      return value === expected;
    case "ne":
      return value !== expected;
    case "gt":
      return typeof value === "number" && typeof expected === "number" && value > expected;
    case "lt":
      return typeof value === "number" && typeof expected === "number" && value < expected;
    case "in":
      return Array.isArray(expected) && expected.includes(value as string);
    case "contains":
      return typeof value === "string" && typeof expected === "string" && value.includes(expected);
    default:
      return false;
  }
}

/**
 * Execute workflow actions.
 */
export async function executeActions(
  actions: WorkflowAction[],
  triggerData: Record<string, unknown>,
  workspaceId: string,
): Promise<Array<{ actionIndex: number; status: string; result?: unknown }>> {
  const results = [];

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    if (action.enabled === false) {
      results.push({ actionIndex: i, status: "skipped" });
      continue;
    }

    try {
      let result;
      switch (action.type) {
        case "send_email":
          result = await executeEmailAction(action.config, triggerData, workspaceId);
          break;
        case "send_notification":
          result = await executeNotificationAction(action.config, triggerData, workspaceId);
          break;
        case "auto_approve":
          result = await executeAutoApproveAction(action.config, triggerData, workspaceId);
          break;
        case "auto_archive":
          result = await executeAutoArchiveAction(action.config, triggerData, workspaceId);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }
      results.push({ actionIndex: i, status: "success", result });
    } catch (error) {
      results.push({ actionIndex: i, status: "failed", result: String(error) });
    }
  }

  return results;
}

async function executeEmailAction(config: Record<string, unknown>, _triggerData: Record<string, unknown>, _workspaceId: string): Promise<unknown> {
  const { recipients, subject, template } = config;
  if (!Array.isArray(recipients) || !subject || !template) {
    throw new Error("Invalid email action config");
  }

  // In production, would use template engine to render email body
  const body = String(template);
  for (const email of recipients) {
    await sendMail({ to: String(email), subject: String(subject), text: body }).catch(() => {
      // Best-effort email send
    });
  }

  return { sent: recipients.length };
}

async function executeNotificationAction(config: Record<string, unknown>, _triggerData: Record<string, unknown>, workspaceId: string): Promise<unknown> {
  const { userIds, title, body, type } = config;
  if (!Array.isArray(userIds) || !title || !body) {
    throw new Error("Invalid notification action config");
  }

  let created = 0;
  for (const userId of userIds) {
    const notification = await createNotification({
      userId: String(userId),
      workspaceId,
      type: String(type ?? "workflow"),
      title: String(title),
      body: String(body),
    });
    if (notification) created++;
  }

  return { created };
}

async function executeAutoApproveAction(config: Record<string, unknown>, _triggerData: Record<string, unknown>, _workspaceId: string): Promise<unknown> {
  const { targetType, targetId } = config;
  if (!targetType || !targetId) {
    throw new Error("Invalid auto-approve action config");
  }

  // Would integrate with actual approval logic
  return { approved: true, targetId };
}

async function executeAutoArchiveAction(config: Record<string, unknown>, _triggerData: Record<string, unknown>, _workspaceId: string): Promise<unknown> {
  const { projectIds, reason } = config;
  if (!Array.isArray(projectIds)) {
    throw new Error("Invalid auto-archive action config");
  }

  // Would integrate with project archival logic
  return { archived: projectIds.length, reason };
}

/**
 * Create a batch operation.
 */
export async function createBatchOperation(input: {
  workspaceId: string;
  operationType: OperationType;
  operationData: Record<string, unknown>;
  createdByUserId: string;
}): Promise<BatchOperation> {
  const id = randomBytes(8).toString("hex");
  const totalItems = Array.isArray(input.operationData.items) ? input.operationData.items.length : 0;

  const res = await pgPool().query<Parameters<typeof rowToBatchOperation>[0]>(
    `INSERT INTO batch_operations (id, workspace_id, operation_type, operation_data, total_items, created_by_user_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     RETURNING id, workspace_id, operation_type, status, total_items, processed_items, failed_items, operation_data, results, error_message, started_at, completed_at, created_by_user_id, created_at`,
    [id, input.workspaceId, input.operationType, input.operationData, totalItems, input.createdByUserId],
  );
  return rowToBatchOperation(res.rows[0]!);
}

/**
 * List batch operations for a workspace.
 */
export async function listBatchOperations(workspaceId: string): Promise<BatchOperation[]> {
  const res = await pgPool().query<Parameters<typeof rowToBatchOperation>[0]>(
    `SELECT id, workspace_id, operation_type, status, total_items, processed_items, failed_items, operation_data, results, error_message, started_at, completed_at, created_by_user_id, created_at
     FROM batch_operations WHERE workspace_id = $1 ORDER BY created_at DESC`,
    [workspaceId],
  );
  return res.rows.map(rowToBatchOperation);
}

/**
 * Get a single batch operation.
 */
export async function getBatchOperation(operationId: string, workspaceId: string): Promise<BatchOperation | null> {
  const res = await pgPool().query<Parameters<typeof rowToBatchOperation>[0]>(
    `SELECT id, workspace_id, operation_type, status, total_items, processed_items, failed_items, operation_data, results, error_message, started_at, completed_at, created_by_user_id, created_at
     FROM batch_operations WHERE id = $1 AND workspace_id = $2`,
    [operationId, workspaceId],
  );
  return res.rows[0] ? rowToBatchOperation(res.rows[0]) : null;
}

/**
 * Update batch operation progress.
 */
export async function updateBatchOperation(operationId: string, updates: {
  status?: "pending" | "processing" | "success" | "failed";
  processedItems?: number;
  failedItems?: number;
  errorMessage?: string | null;
  results?: Array<{ item: string; status: string; result?: unknown }>;
  startedAt?: string;
  completedAt?: string;
}): Promise<BatchOperation | null> {
  const setClauses = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (updates.status !== undefined) { setClauses.push(`status = $${paramCount++}`); values.push(updates.status); }
  if (updates.processedItems !== undefined) { setClauses.push(`processed_items = $${paramCount++}`); values.push(updates.processedItems); }
  if (updates.failedItems !== undefined) { setClauses.push(`failed_items = $${paramCount++}`); values.push(updates.failedItems); }
  if (updates.errorMessage !== undefined) { setClauses.push(`error_message = $${paramCount++}`); values.push(updates.errorMessage ?? null); }
  if (updates.results !== undefined) { setClauses.push(`results = $${paramCount++}`); values.push(updates.results); }
  if (updates.startedAt !== undefined) { setClauses.push(`started_at = $${paramCount++}`); values.push(new Date(updates.startedAt)); }
  if (updates.completedAt !== undefined) { setClauses.push(`completed_at = $${paramCount++}`); values.push(new Date(updates.completedAt)); }

  if (setClauses.length === 0) return null;

  values.push(operationId);
  const res = await pgPool().query<Parameters<typeof rowToBatchOperation>[0]>(
    `UPDATE batch_operations SET ${setClauses.join(", ")} WHERE id = $${paramCount++}
     RETURNING id, workspace_id, operation_type, status, total_items, processed_items, failed_items, operation_data, results, error_message, started_at, completed_at, created_by_user_id, created_at`,
    values,
  );
  return res.rows[0] ? rowToBatchOperation(res.rows[0]) : null;
}
