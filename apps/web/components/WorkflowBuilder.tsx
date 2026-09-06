"use client";

import { useState } from "react";
import type { Workflow, TriggerType, Condition, WorkflowAction } from "../lib/workflows";

interface WorkflowBuilderProps {
  workflow?: Workflow;
  workspaceId: string;
  onSave: (workflow: Partial<Workflow>) => Promise<void>;
  onCancel: () => void;
}

const TRIGGER_TYPES: TriggerType[] = ["chapter_submitted", "lesson_submitted", "submission_reviewed", "schedule", "manual"];
const ACTION_TYPES = ["send_email", "send_notification", "auto_approve", "auto_archive"];
const CONDITION_OPERATORS = ["eq", "ne", "gt", "lt", "in", "contains"];

export default function WorkflowBuilder({ workflow, workspaceId: _workspaceId, onSave, onCancel }: WorkflowBuilderProps) {
  const [name, setName] = useState(workflow?.name || "");
  const [description, setDescription] = useState(workflow?.description || "");
  const [triggerType, setTriggerType] = useState<TriggerType>(workflow?.triggerType || "manual");
  const [triggerConfig, setTriggerConfig] = useState(workflow?.triggerConfig || {});
  const [conditions, setConditions] = useState<Condition[]>(workflow?.conditions || []);
  const [actions, setActions] = useState<WorkflowAction[]>(workflow?.actions || []);
  const [enabled, setEnabled] = useState(workflow?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleAddCondition = () => {
    setConditions([...conditions, { field: "", operator: "eq", value: "" }]);
  };

  const handleUpdateCondition = (index: number, updates: Partial<Condition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index]!, ...updates };
    setConditions(updated);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleAddAction = () => {
    setActions([...actions, { type: "send_email", config: {} }]);
  };

  const handleUpdateAction = (index: number, updates: Partial<WorkflowAction>) => {
    const updated = [...actions];
    updated[index] = { ...updated[index]!, ...updates };
    setActions(updated);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Workflow name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        name,
        description,
        triggerType,
        triggerConfig,
        conditions,
        actions,
        enabled,
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {error && <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">{error}</div>}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Workflow Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            placeholder="e.g., Auto-approve chapter submissions"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            rows={2}
            placeholder="Optional description of what this workflow does"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
            Enable this workflow
          </label>
        </div>
      </div>

      {/* Trigger Section */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-4">Trigger</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Trigger Type</label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            >
              {TRIGGER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {triggerType === "schedule" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Schedule (cron expression)</label>
              <input
                type="text"
                value={(triggerConfig.schedule as string) || ""}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, schedule: e.target.value })}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                placeholder="e.g., 0 0 * * * (daily at midnight)"
              />
            </div>
          )}

          {triggerType === "chapter_submitted" && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Chapter ID (optional)</label>
              <input
                type="text"
                value={(triggerConfig.chapterId as string) || ""}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, chapterId: e.target.value })}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
                placeholder="Leave empty to trigger on any chapter"
              />
            </div>
          )}
        </div>
      </div>

      {/* Conditions Section */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Conditions</h3>
          <button
            onClick={handleAddCondition}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Condition
          </button>
        </div>

        {conditions.length === 0 && <p className="text-sm text-gray-500">No conditions (workflow runs if trigger occurs)</p>}

        <div className="space-y-3">
          {conditions.map((condition, index) => (
            <div key={index} className="flex gap-2 items-end bg-white p-3 rounded border border-gray-200">
              <input
                type="text"
                value={condition.field}
                onChange={(e) => handleUpdateCondition(index, { field: e.target.value })}
                placeholder="Field name"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <select
                value={condition.operator}
                onChange={(e) => handleUpdateCondition(index, { operator: e.target.value as any })}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {CONDITION_OPERATORS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={String(condition.value)}
                onChange={(e) => handleUpdateCondition(index, { value: e.target.value })}
                placeholder="Value"
                className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                onClick={() => handleRemoveCondition(index)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions Section */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Actions</h3>
          <button
            onClick={handleAddAction}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + Add Action
          </button>
        </div>

        {actions.length === 0 && <p className="text-sm text-gray-500">No actions (define what happens when workflow triggers)</p>}

        <div className="space-y-4">
          {actions.map((action, index) => (
            <div key={index} className="bg-white p-3 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <select
                  value={action.type}
                  onChange={(e) => handleUpdateAction(index, { type: e.target.value as any })}
                  className="rounded border border-gray-300 px-2 py-1 text-sm"
                >
                  {ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={action.enabled !== false}
                    onChange={(e) => handleUpdateAction(index, { enabled: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-600">Enabled</span>
                  <button
                    onClick={() => handleRemoveAction(index)}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {action.type === "send_email" && (
                <div className="space-y-2 text-sm">
                  <input
                    type="text"
                    value={(action.config.subject as string) || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, subject: e.target.value } })}
                    placeholder="Email subject"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                  <textarea
                    value={(action.config.template as string) || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, template: e.target.value } })}
                    placeholder="Email body template"
                    rows={3}
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                  <input
                    type="text"
                    value={(action.config.recipients as string[] | undefined)?.join(", ") || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, recipients: e.target.value.split(",").map((s) => s.trim()) } })}
                    placeholder="Recipient emails (comma-separated)"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>
              )}

              {action.type === "send_notification" && (
                <div className="space-y-2 text-sm">
                  <input
                    type="text"
                    value={(action.config.title as string) || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, title: e.target.value } })}
                    placeholder="Notification title"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                  <input
                    type="text"
                    value={(action.config.body as string) || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, body: e.target.value } })}
                    placeholder="Notification body"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                  <input
                    type="text"
                    value={(action.config.userIds as string[] | undefined)?.join(", ") || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, userIds: e.target.value.split(",").map((s) => s.trim()) } })}
                    placeholder="User IDs (comma-separated)"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>
              )}

              {action.type === "auto_approve" && (
                <div className="space-y-2 text-sm">
                  <input
                    type="text"
                    value={(action.config.targetType as string) || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, targetType: e.target.value } })}
                    placeholder="Target type (lesson, chapter)"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                  <input
                    type="text"
                    value={(action.config.targetId as string) || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, targetId: e.target.value } })}
                    placeholder="Target ID"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>
              )}

              {action.type === "auto_archive" && (
                <div className="space-y-2 text-sm">
                  <input
                    type="text"
                    value={(action.config.projectIds as string[] | undefined)?.join(", ") || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, projectIds: e.target.value.split(",").map((s) => s.trim()) } })}
                    placeholder="Project IDs (comma-separated)"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                  <input
                    type="text"
                    value={(action.config.reason as string) || ""}
                    onChange={(e) => handleUpdateAction(index, { config: { ...action.config, reason: e.target.value } })}
                    placeholder="Reason for archival"
                    className="block w-full rounded border border-gray-300 px-2 py-1"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? "Saving..." : "Save Workflow"}
        </button>
      </div>
    </div>
  );
}
