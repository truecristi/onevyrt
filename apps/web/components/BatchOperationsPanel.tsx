"use client";

import { useState, useEffect } from "react";
import type { BatchOperation } from "../lib/workflows";

interface BatchOperationsPanelProps {
  workspaceId: string;
}

type OperationType = "bulk_invite" | "bulk_approval" | "bulk_reset";

export default function BatchOperationsPanel({ workspaceId }: BatchOperationsPanelProps) {
  const [operations, setOperations] = useState<BatchOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [operationType, setOperationType] = useState<OperationType>("bulk_invite");
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/batch-operations?ws=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to load operations");
      const data = await res.json();
      setOperations(data.operations || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOperation = async () => {
    if (!formData.items || (Array.isArray(formData.items) && formData.items.length === 0)) {
      setError("Please specify items for this operation");
      return;
    }

    try {
      const res = await fetch(`/api/batch-operations?ws=${workspaceId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ operationType, operationData: formData }),
      });

      if (!res.ok) throw new Error("Failed to create operation");
      await loadOperations();
      setIsCreating(false);
      setFormData({});
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-600">Loading operations...</div>;

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-600 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Batch Operations</h2>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {isCreating ? "Cancel" : "+ New Operation"}
        </button>
      </div>

      {isCreating && (
        <div className="border rounded-lg p-6 bg-white space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Operation Type</label>
            <select
              value={operationType}
              onChange={(e) => {
                setOperationType(e.target.value as OperationType);
                setFormData({});
              }}
              className="block w-full rounded border border-gray-300 px-3 py-2"
            >
              <option value="bulk_invite">Bulk Invite Users</option>
              <option value="bulk_approval">Bulk Approve Submissions</option>
              <option value="bulk_reset">Bulk Reset Progress</option>
            </select>
          </div>

          {operationType === "bulk_invite" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Addresses (one per line)</label>
              <textarea
                value={(formData.items as string[] | undefined)?.join("\n") || ""}
                onChange={(e) => setFormData({ ...formData, items: e.target.value.split("\n").filter((s) => s.trim()) })}
                rows={6}
                className="block w-full rounded border border-gray-300 px-3 py-2"
                placeholder="user1@example.com&#10;user2@example.com"
              />
            </div>
          )}

          {operationType === "bulk_approval" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Submission IDs (one per line)</label>
                <textarea
                  value={(formData.submissionIds as string[] | undefined)?.join("\n") || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      submissionIds: e.target.value.split("\n").filter((s) => s.trim()),
                    })
                  }
                  rows={4}
                  className="block w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="submission-1&#10;submission-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Approval Reason</label>
                <input
                  type="text"
                  value={(formData.reason as string) || ""}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="block w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="e.g., Meets all requirements"
                />
              </div>
            </div>
          )}

          {operationType === "bulk_reset" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Workspace IDs (one per line)</label>
                <textarea
                  value={(formData.workspaceIds as string[] | undefined)?.join("\n") || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      workspaceIds: e.target.value.split("\n").filter((s) => s.trim()),
                    })
                  }
                  rows={4}
                  className="block w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="workspace-1&#10;workspace-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reset To Stage (optional)</label>
                <input
                  type="text"
                  value={(formData.resetStage as string) || ""}
                  onChange={(e) => setFormData({ ...formData, resetStage: e.target.value })}
                  className="block w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="e.g., chapter-1"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleCreateOperation}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Create Operation
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {operations.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded border border-gray-200">
            <p className="text-gray-600">No batch operations yet.</p>
          </div>
        ) : (
          operations.map((op) => (
            <div key={op.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{op.operationType.replace(/_/g, " ")}</h3>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <span>Total: {op.totalItems}</span>
                    <span>Processed: {op.processedItems}</span>
                    <span>Failed: {op.failedItems}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Created: {new Date(op.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      op.status === "success"
                        ? "bg-green-100 text-green-800"
                        : op.status === "failed"
                          ? "bg-red-100 text-red-800"
                          : op.status === "processing"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {op.status}
                  </span>
                </div>
              </div>
              {op.errorMessage && (
                <p className="text-sm text-red-600 mt-2">Error: {op.errorMessage}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
