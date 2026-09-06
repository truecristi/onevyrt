/**
 * ONEVYRT Interactive Funnel Builder — Drag-and-drop funnel stage editor.
 *
 * Features:
 * - Drag-and-drop stage editor with real-time visualization
 * - Add/remove/reorder funnel stages with smooth animations
 * - Stage preview updates as user edits (name, audience, target conversion)
 * - Visual feedback: drag indicators, drop zones highlighted
 * - Stage deletion with undo capability
 * - Export funnel configuration as JSON
 * - Professional builder UX (inspired by ClickFunnels)
 *
 * Usage:
 *   <InteractiveFunnelBuilder
 *     onSave={(funnel) => console.log(funnel)}
 *     initialStages={existingStages}
 *   />
 */

import { useState, useRef, useCallback } from "react";
import { getChapterColor } from "@/lib/colors/chapter-tokens";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export interface FunnelStage {
  id: string;
  name: string;
  audience?: number; // estimated audience size
  conversionTarget?: number; // target conversion percentage
  description?: string;
  color?: string;
  order: number;
}

export interface InteractiveFunnelBuilderProps {
  /** Initial funnel stages */
  initialStages?: FunnelStage[];

  /** Callback when funnel is saved */
  onSave?: (stages: FunnelStage[]) => void;

  /** Callback on funnel change */
  onChange?: (stages: FunnelStage[]) => void;

  /** Allow adding/removing stages */
  editable?: boolean;

  /** CSS className */
  className?: string;
}

const STAGE_TEMPLATES = [
  { icon: "🎯", name: "Awareness", description: "Attract your audience" },
  { icon: "🔗", name: "Interest", description: "Build engagement" },
  { icon: "📊", name: "Consideration", description: "Present value" },
  { icon: "💳", name: "Conversion", description: "Close the sale" },
  { icon: "🔄", name: "Retention", description: "Keep customers" },
];

export function InteractiveFunnelBuilder({
  initialStages = [],
  onSave,
  onChange,
  editable = true,
  className = "",
}: InteractiveFunnelBuilderProps) {
  const [stages, setStages] = useState<FunnelStage[]>(initialStages.length > 0 ? initialStages : []);
  const [draggedStage, setDraggedStage] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [history, setHistory] = useState<FunnelStage[][]>([initialStages]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add stage
  const addStage = useCallback(
    (template?: (typeof STAGE_TEMPLATES)[0]) => {
      const newStage: FunnelStage = {
        id: `stage-${Date.now()}`,
        name: template?.name || `Stage ${stages.length + 1}`,
        audience: 1000,
        conversionTarget: 20,
        description: template?.description,
        order: stages.length,
        color: getChapterColor("implement"),
      };

      const newStages = [...stages, newStage];
      setStages(newStages);
      onChange?.(newStages);
      setHistory([...history, newStages]);
    },
    [stages, onChange, history]
  );

  // Remove stage
  const removeStage = useCallback(
    (id: string) => {
      const newStages = stages.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }));
      setStages(newStages);
      onChange?.(newStages);
      setHistory([...history, newStages]);
    },
    [stages, onChange, history]
  );

  // Update stage
  const updateStage = useCallback(
    (id: string, updates: Partial<FunnelStage>) => {
      const newStages = stages.map((s) => (s.id === id ? { ...s, ...updates } : s));
      setStages(newStages);
      onChange?.(newStages);
    },
    [stages, onChange]
  );

  // Reorder stages
  const reorderStages = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      const newStages = [...stages];
      const [movedStage] = newStages.splice(fromIndex, 1);
      newStages.splice(toIndex, 0, movedStage!);

      const reordered = newStages.map((s, i) => ({ ...s, order: i }));
      setStages(reordered);
      onChange?.(reordered);
      setHistory([...history, reordered]);
    },
    [stages, onChange, history]
  );

  // Undo
  const undo = useCallback(() => {
    if (history.length <= 1) return;

    const newHistory = history.slice(0, -1);
    const previousStages = newHistory[newHistory.length - 1]!;
    setStages(previousStages);
    setHistory(newHistory);
    onChange?.(previousStages);
  }, [history, onChange]);

  // Export as JSON
  const exportJSON = () => {
    const json = JSON.stringify(stages, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "funnel-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={["space-y-6", className].filter(Boolean).join(" ")}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-ds-text-primary">
          Funnel Builder
        </h2>

        {editable && (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => addStage()}
            >
              + Add Stage
            </Button>
            {history.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={undo}
              >
                ↶ Undo
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={exportJSON}
            >
              ⬇ Export JSON
            </Button>
          </>
        )}
      </div>

      {/* Stage Templates */}
      {stages.length === 0 && editable && (
        <div className="bg-ds-bg-subtle rounded-lg p-6">
          <p className="text-sm text-ds-text-secondary mb-4">
            Choose a template or add a custom stage:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {STAGE_TEMPLATES.map((template) => (
              <button
                key={template.name}
                onClick={() => addStage(template)}
                className="p-3 rounded-lg bg-ds-surface border border-ds-border-subtle hover:border-ds-border-strong transition-all"
              >
                <div className="text-2xl mb-2">{template.icon}</div>
                <p className="text-xs font-medium">{template.name}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Funnel Visualization */}
      <div ref={containerRef} className="space-y-6">
        {/* Funnel Stages */}
        <div className="flex flex-col items-center gap-4">
          {stages.map((stage, index) => (
            <FunnelStageNode
              key={stage.id}
              stage={stage}
              index={index}
              totalStages={stages.length}
              isEditing={editingStage === stage.id}
              isDragged={draggedStage === stage.id}
              onEdit={() => setEditingStage(editingStage === stage.id ? null : stage.id)}
              onUpdate={(updates) => updateStage(stage.id, updates)}
              onDelete={() => removeStage(stage.id)}
              onDragStart={() => setDraggedStage(stage.id)}
              onDragEnd={() => setDraggedStage(null)}
              onDrop={(toIndex) => {
                reorderStages(index, toIndex);
                setDraggedStage(null);
              }}
              editable={editable}
            />
          ))}
        </div>

        {/* Metrics Summary */}
        {stages.length > 0 && (
          <FunnelMetricsSummary stages={stages} />
        )}
      </div>

      {/* Save Button */}
      {editable && (
        <div className="flex gap-3">
          <Button
            variant="primary"
            onClick={() => onSave?.(stages)}
            disabled={stages.length === 0}
          >
            Save Funnel
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Funnel Stage Node
 */
interface FunnelStageNodeProps {
  stage: FunnelStage;
  index: number;
  totalStages: number;
  isEditing: boolean;
  isDragged: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<FunnelStage>) => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: (toIndex: number) => void;
  editable: boolean;
}

function FunnelStageNode({
  stage,
  index,
  totalStages,
  isEditing,
  isDragged,
  onEdit,
  onUpdate,
  onDelete,
  onDragStart,
  onDragEnd,
  onDrop,
  editable,
}: FunnelStageNodeProps) {
  const width = 100 - (80 / (totalStages || 1)) * index;

  return (
    <div
      className="w-full flex flex-col items-center animate-slideUp"
      draggable={editable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(index)}
      style={{
        opacity: isDragged ? 0.5 : 1,
        cursor: editable ? "move" : "default",
      }}
    >
      {/* Connection line to next stage */}
      {index < totalStages - 1 && (
        <div
          className="w-1 h-8"
          style={{
            backgroundColor: stage.color || "#16a34a",
            opacity: 0.3,
          }}
        />
      )}

      {/* Stage card */}
      <Card
        className={[
          "transition-all duration-300 border-2",
          isDragged ? "shadow-lg ring-2" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          width: `${width}%`,
          minWidth: "150px",
          borderColor: stage.color,
          boxShadow: isDragged
            ? `0 20px 48px -12px rgba(${parseInt((stage.color || "#16a34a").slice(1, 3), 16)}, ${parseInt((stage.color || "#16a34a").slice(3, 5), 16)}, ${parseInt((stage.color || "#16a34a").slice(5, 7), 16)}, 0.3)`
            : undefined,
        }}
      >
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              {isEditing ? (
                <input
                  autoFocus
                  type="text"
                  value={stage.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  onBlur={onEdit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onEdit();
                  }}
                  className="w-full font-semibold bg-ds-bg-subtle rounded px-2 py-1"
                />
              ) : (
                <h3
                  onClick={editable ? onEdit : undefined}
                  className={`font-semibold text-sm ${editable ? "cursor-pointer hover:text-blue-600" : ""}`}
                  style={{ color: stage.color }}
                >
                  {stage.name}
                </h3>
              )}
            </div>

            {editable && (
              <button
                onClick={onDelete}
                className="text-red-500 hover:text-red-700 text-lg"
                title="Delete stage"
              >
                ✕
              </button>
            )}
          </div>

          {/* Metrics inputs */}
          <div className="space-y-2 text-sm">
            <div>
              <label className="text-xs text-ds-text-tertiary">Audience</label>
              <input
                type="number"
                value={stage.audience || 0}
                onChange={(e) =>
                  onUpdate({ audience: parseInt(e.target.value) || 0 })
                }
                className="w-full px-2 py-1 rounded border border-ds-border-subtle text-xs"
                disabled={!editable}
              />
            </div>

            <div>
              <label className="text-xs text-ds-text-tertiary">
                Target Conversion %
              </label>
              <input
                type="number"
                value={stage.conversionTarget || 0}
                onChange={(e) =>
                  onUpdate({ conversionTarget: parseInt(e.target.value) || 0 })
                }
                className="w-full px-2 py-1 rounded border border-ds-border-subtle text-xs"
                disabled={!editable}
              />
            </div>
          </div>

          {/* Conversion output */}
          {stage.audience && stage.conversionTarget && (
            <div
              className="p-2 rounded text-xs font-medium"
              style={{
                backgroundColor: `${stage.color}20`,
                color: stage.color,
              }}
            >
              💡 Estimated output: {Math.round((stage.audience * stage.conversionTarget) / 100)} leads
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Funnel Metrics Summary
 */
function FunnelMetricsSummary({ stages }: { stages: FunnelStage[] }) {
  const totalAudience = stages.reduce((sum, s) => sum + (s.audience || 0), 0);
  const totalLeads = stages.reduce(
    (sum, s) => sum + Math.round(((s.audience || 0) * (s.conversionTarget || 0)) / 100),
    0
  );
  const overallConversion = totalAudience > 0 ? ((totalLeads / totalAudience) * 100).toFixed(1) : 0;

  return (
    <Card className="p-6 bg-ds-bg-subtle">
      <h3 className="font-semibold mb-4">Funnel Summary</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-ds-text-tertiary">Total Audience</p>
          <p className="text-2xl font-bold text-ds-text-primary">
            {totalAudience.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-ds-text-tertiary">Estimated Leads</p>
          <p className="text-2xl font-bold text-green-600">
            {totalLeads.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-ds-text-tertiary">Overall Conversion</p>
          <p className="text-2xl font-bold text-blue-600">{overallConversion}%</p>
        </div>
      </div>
    </Card>
  );
}
