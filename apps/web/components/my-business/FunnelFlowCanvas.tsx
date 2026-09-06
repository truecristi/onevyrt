"use client";
/**
 * FunnelFlowCanvas — Editable drag-and-drop funnel builder
 * with stage customization and auto-calculation of conversions.
 */
import { useState, useCallback } from "react";
import { FunnelStage, generateFunnelMetrics } from "@/lib/funnel/calculations";

interface EditableStage extends FunnelStage {
  conversionRate: number;
}

interface FunnelFlowCanvasProps {
  initialStages?: EditableStage[];
  onSave?: (stages: EditableStage[]) => void;
  readOnly?: boolean;
}

export function FunnelFlowCanvas({
  initialStages = [
    { id: "1", name: "Awareness", visitors: 10000, conversions: 500, conversionRate: 5 },
    { id: "2", name: "Interest", visitors: 500, conversions: 100, conversionRate: 20 },
    { id: "3", name: "Consideration", visitors: 100, conversions: 30, conversionRate: 30 },
    { id: "4", name: "Decision", visitors: 30, conversions: 15, conversionRate: 50 },
    { id: "5", name: "Action", visitors: 15, conversions: 15, conversionRate: 100 },
  ],
  onSave,
  readOnly = false,
}: FunnelFlowCanvasProps) {
  const [stages, setStages] = useState<EditableStage[]>(initialStages);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [trafficInput, setTrafficInput] = useState(stages[0]?.visitors || 10000);

  const metrics = generateFunnelMetrics(stages);

  // Update stage property
  const updateStage = useCallback((id: string, field: keyof EditableStage, value: any) => {
    setStages(prev =>
      prev.map(stage => {
        if (stage.id === id) {
          const updated = { ...stage, [field]: value };

          // Auto-calculate conversions if conversion rate changes
          if (field === "conversionRate") {
            updated.conversions = Math.round((updated.visitors * value) / 100);
          }

          // Auto-calculate conversion rate if conversions change
          if (field === "conversions") {
            updated.conversionRate = (value / updated.visitors) * 100;
          }

          return updated;
        }
        return stage;
      })
    );
  }, []);

  // Add new stage
  const addStage = useCallback(() => {
    if (readOnly) return;
    const newId = Math.max(...stages.map(s => parseInt(s.id)), 0) + 1;
    const lastStage = stages[stages.length - 1]!;
    const newStage: EditableStage = {
      id: String(newId),
      name: `Stage ${newId}`,
      visitors: Math.round((lastStage.conversions || 0) / 2),
      conversions: Math.round((lastStage.conversions || 0) / 4),
      conversionRate: 50,
    };
    setStages([...stages, newStage]);
  }, [stages, readOnly]);

  // Remove stage
  const removeStage = useCallback(
    (id: string) => {
      if (readOnly || stages.length <= 2) return;
      setStages(stages.filter(s => s.id !== id));
    },
    [stages, readOnly]
  );

  // Reorder stages (drag and drop)
  const handleDragStart = (id: string) => {
    if (readOnly) return;
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId || readOnly) return;

    const draggedIndex = stages.findIndex(s => s.id === draggedId);
    const targetIndex = stages.findIndex(s => s.id === targetId);

    const newStages = [...stages];
    [newStages[draggedIndex], newStages[targetIndex]] = [
      newStages[targetIndex]!,
      newStages[draggedIndex]!,
    ];

    setStages(newStages);
    setDraggedId(null);
  };

  // Update initial traffic
  const updateInitialTraffic = useCallback((value: number) => {
    setTrafficInput(value);
    const ratio = value / stages[0]!.visitors;
    setStages(prev =>
      prev.map(stage => ({
        ...stage,
        visitors: Math.round(stage.visitors * ratio),
        conversions: Math.round((stage.conversions || 0) * ratio),
      }))
    );
  }, [stages]);

  // Handle save
  const handleSave = () => {
    if (onSave) {
      onSave(stages);
    }
  };

  return (
    <div className="funnel-canvas w-full">
      {/* Header */}
      <div className="mb-8">
        <h3 className="text-2xl font-semibold text-gray-900 mb-4" style={{ color: "var(--ds-text-primary)" }}>
          Funnel Builder
        </h3>

        {/* Traffic input */}
        <div className="bg-white border border-gray-200 rounded-lg p-4" style={{
          backgroundColor: "var(--ds-surface)",
          borderColor: "var(--ds-border-subtle)",
        }}>
          <label className="block text-sm font-medium text-gray-700 mb-2" style={{ color: "var(--ds-text-secondary)" }}>
            Expected Monthly Visitors
          </label>
          <input
            type="number"
            value={trafficInput}
            onChange={(e) => updateInitialTraffic(Number(e.target.value))}
            disabled={readOnly}
            className="w-full px-4 py-2 border rounded-lg font-semibold text-lg"
            style={{
              borderColor: "var(--ds-border-default)",
              backgroundColor: readOnly ? "var(--ds-surface-subtle)" : "white",
            }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3 mb-8">
        {stages.map((stage, index) => (
          <div
            key={stage.id}
            draggable={!readOnly}
            onDragStart={() => handleDragStart(stage.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(stage.id)}
            className="group relative"
            style={{
              opacity: draggedId === stage.id ? 0.5 : 1,
              transition: "opacity 0.2s ease",
            }}
          >
            <div
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all"
              style={{
                backgroundColor: "var(--ds-surface)",
                borderColor: draggedId === stage.id ? "var(--ds-brand)" : "var(--ds-border-subtle)",
              }}
            >
              {/* Stage header */}
              <div className="flex items-start gap-4 mb-4">
                {!readOnly && (
                  <div className="text-gray-400 cursor-grab active:cursor-grabbing mt-1 flex-shrink-0">
                    ⋮⋮
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {editingId === stage.id ? (
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => updateStage(stage.id, "name", e.target.value)}
                      onBlur={() => setEditingId(null)}
                      autoFocus
                      className="w-full px-2 py-1 border rounded font-semibold text-lg"
                      style={{ borderColor: "var(--ds-border-default)" }}
                    />
                  ) : (
                    <h4
                      className="text-lg font-semibold text-gray-900 cursor-pointer hover:text-blue-600"
                      onClick={() => !readOnly && setEditingId(stage.id)}
                      style={{ color: "var(--ds-text-primary)" }}
                    >
                      {stage.name}
                    </h4>
                  )}
                </div>

                {/* Conversion rate badge */}
                <div
                  className="px-3 py-1 rounded-full text-sm font-medium flex-shrink-0"
                  style={{
                    backgroundColor: stage.conversionRate >= 10 ? "#ecf8fa" : stage.conversionRate >= 5 ? "#dcfce7" : stage.conversionRate >= 2 ? "#fef3c7" : "#fee2e2",
                    color: stage.conversionRate >= 10 ? "#0891b2" : stage.conversionRate >= 5 ? "#16a34a" : stage.conversionRate >= 2 ? "#d97706" : "#dc2626",
                  }}
                >
                  {stage.conversionRate.toFixed(1)}%
                </div>

                {/* Delete button */}
                {!readOnly && stages.length > 2 && (
                  <button
                    onClick={() => removeStage(stage.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors p-1 flex-shrink-0"
                    title="Delete stage"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Stage inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Visitors */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Visitors
                  </label>
                  <input
                    type="number"
                    value={stage.visitors}
                    onChange={(e) => updateStage(stage.id, "visitors", Number(e.target.value))}
                    disabled={readOnly || index === 0}
                    className="w-full px-3 py-2 border rounded-md text-sm font-semibold"
                    style={{
                      borderColor: "var(--ds-border-default)",
                      backgroundColor: index === 0 ? "var(--ds-surface-subtle)" : "white",
                    }}
                  />
                </div>

                {/* Conversions */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Conversions
                  </label>
                  <input
                    type="number"
                    value={stage.conversions || 0}
                    onChange={(e) => updateStage(stage.id, "conversions", Number(e.target.value))}
                    disabled={readOnly}
                    className="w-full px-3 py-2 border rounded-md text-sm font-semibold"
                    style={{ borderColor: "var(--ds-border-default)" }}
                  />
                </div>

                {/* Conversion Rate */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Conv. Rate (%)
                  </label>
                  <input
                    type="number"
                    value={stage.conversionRate}
                    onChange={(e) => updateStage(stage.id, "conversionRate", Number(e.target.value))}
                    disabled={readOnly}
                    step="0.1"
                    className="w-full px-3 py-2 border rounded-md text-sm font-semibold"
                    style={{ borderColor: "var(--ds-border-default)" }}
                  />
                </div>
              </div>

              {/* Drop-off from previous stage */}
              {index > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">↓ Drop-off from previous:</span>{" "}
                    {stages[index - 1]!.visitors - stage.visitors} visitors
                    ({(((stages[index - 1]!.visitors - stage.visitors) / stages[index - 1]!.visitors) * 100).toFixed(1)}%)
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add stage button */}
      {!readOnly && (
        <button
          onClick={addStage}
          className="w-full px-4 py-3 border-2 border-dashed rounded-lg text-sm font-medium transition-colors"
          style={{
            borderColor: "var(--ds-border-subtle)",
            color: "var(--ds-text-secondary)",
          }}
        >
          + Add Stage
        </button>
      )}

      {/* Summary metrics */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border" style={{
          backgroundColor: "var(--ds-surface-subtle)",
          borderColor: "var(--ds-border-subtle)",
        }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Total Visitors</p>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.totalVisitors.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-lg border" style={{
          backgroundColor: "var(--ds-surface-subtle)",
          borderColor: "var(--ds-border-subtle)",
        }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Total Conversions</p>
          <p className="text-2xl font-bold text-gray-900">
            {metrics.totalConversions.toLocaleString()}
          </p>
        </div>

        <div className="p-4 rounded-lg border" style={{
          backgroundColor: "var(--ds-surface-subtle)",
          borderColor: "var(--ds-border-subtle)",
        }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Overall Conv.</p>
          <p className="text-2xl font-bold text-blue-600">
            {metrics.overallConversionRate.toFixed(2)}%
          </p>
        </div>

        <div className="p-4 rounded-lg border" style={{
          backgroundColor: "var(--ds-surface-subtle)",
          borderColor: "var(--ds-border-subtle)",
        }}>
          <p className="text-xs font-medium text-gray-600 mb-1">Bottleneck</p>
          <p className="text-lg font-bold text-amber-600">
            {metrics.bottleneck.stageName}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {metrics.bottleneck.rate.toFixed(1)}% conv.
          </p>
        </div>
      </div>

      {/* Save button */}
      {!readOnly && (
        <div className="mt-8 flex gap-3">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Save Funnel
          </button>
        </div>
      )}

      <style jsx>{`
        .funnel-canvas {
          width: 100%;
        }

        input[disabled] {
          cursor: not-allowed;
        }

        input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
          border-color: #2563eb;
        }

        @media (max-width: 768px) {
          :global(.funnel-canvas) {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
