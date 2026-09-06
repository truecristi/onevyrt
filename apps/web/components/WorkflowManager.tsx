"use client";

import { useState, useEffect } from "react";
import type { Workflow, WorkflowExecution } from "../lib/workflows";
import WorkflowBuilder from "./WorkflowBuilder";

interface WorkflowManagerProps {
  workspaceId: string;
}

export default function WorkflowManager({ workspaceId }: WorkflowManagerProps) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/workflows?ws=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to load workflows");
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const loadExecutions = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/executions?ws=${workspaceId}`);
      if (!res.ok) throw new Error("Failed to load executions");
      const data = await res.json();
      setExecutions(data.executions || []);
    } catch (err) {
      console.error("Failed to load executions:", err);
    }
  };

  const handleSaveWorkflow = async (workflowData: Partial<Workflow>) => {
    try {
      const url = selectedWorkflow
        ? `/api/workflows/${selectedWorkflow.id}?ws=${workspaceId}`
        : `/api/workflows?ws=${workspaceId}`;

      const method = selectedWorkflow ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(workflowData),
      });

      if (!res.ok) throw new Error("Failed to save workflow");
      await loadWorkflows();
      setIsBuilding(false);
      setSelectedWorkflow(null);
    } catch (err) {
      throw new Error(String(err));
    }
  };

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    try {
      const res = await fetch(`/api/workflows/${workflowId}?ws=${workspaceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete workflow");
      await loadWorkflows();
      setSelectedWorkflow(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleExecuteWorkflow = async (workflowId: string) => {
    try {
      const res = await fetch(`/api/workflows/${workflowId}/execute?ws=${workspaceId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ triggerData: {} }),
      });

      if (!res.ok) throw new Error("Failed to execute workflow");
      await loadExecutions(workflowId);
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) return <div className="text-center py-8 text-gray-600">Loading workflows...</div>;

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

      {isBuilding ? (
        <div className="border rounded-lg p-6 bg-white">
          <h2 className="text-xl font-semibold mb-6">
            {selectedWorkflow ? "Edit Workflow" : "Create New Workflow"}
          </h2>
          <WorkflowBuilder
            workflow={selectedWorkflow || undefined}
            workspaceId={workspaceId}
            onSave={handleSaveWorkflow}
            onCancel={() => {
              setIsBuilding(false);
              setSelectedWorkflow(null);
            }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Workflows</h2>
            <button
              onClick={() => {
                setIsBuilding(true);
                setSelectedWorkflow(null);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              + Create Workflow
            </button>
          </div>

          {workflows.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded border border-gray-200">
              <p className="text-gray-600">No workflows yet. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {workflows.map((workflow) => (
                <div key={workflow.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => {
                        setSelectedWorkflow(workflow);
                        loadExecutions(workflow.id);
                      }}
                    >
                      <h3 className="font-semibold text-gray-900">{workflow.name}</h3>
                      {workflow.description && <p className="text-sm text-gray-600 mt-1">{workflow.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span>Trigger: {workflow.triggerType.replace(/_/g, " ")}</span>
                        <span>Actions: {workflow.actions.length}</span>
                        <span>Conditions: {workflow.conditions.length}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          workflow.enabled ? "bg-green-500" : "bg-gray-300"
                        }`}
                      />
                      <button
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setIsBuilding(true);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleExecuteWorkflow(workflow.id)}
                        className="text-sm text-green-600 hover:text-green-700 font-medium"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => handleDeleteWorkflow(workflow.id)}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {selectedWorkflow?.id === workflow.id && executions.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs font-medium text-gray-700 mb-2">Recent Executions:</p>
                      <div className="space-y-1">
                        {executions.slice(0, 3).map((execution) => (
                          <div key={execution.id} className="text-xs text-gray-600">
                            <span className={execution.status === "success" ? "text-green-600" : "text-red-600"}>
                              {execution.status}
                            </span>
                            {" — "}
                            {new Date(execution.createdAt).toLocaleString()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
