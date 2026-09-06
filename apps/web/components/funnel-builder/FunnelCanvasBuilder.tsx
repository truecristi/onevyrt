/**
 * Interactive Funnel Canvas Builder — drag-and-drop step editor showing funnel
 * stages with traffic, conversion rates, revenue, and performance color-coding.
 */
"use client";

import { useState } from "react";
import { Button } from "../ui/Button";

export interface Step {
  id: string;
  type: "optin" | "sales" | "checkout" | "upsell" | "confirmation" | "webinar" | "demo";
  name: string;
  traffic: number;
  conversionRate: number;
  revenue?: number;
  order: number;
}

interface FunnelCanvasBuilderProps {
  steps?: Step[];
  onChange?: (steps: Step[]) => void;
  onSave?: (steps: Step[]) => void;
  editable?: boolean;
}

const STEP_TYPES: Record<Step["type"], { label: string; icon: string; color: string }> = {
  optin: { label: "Opt-in", icon: "📝", color: "#3b82f6" },
  sales: { label: "Sales Page", icon: "💼", color: "#8b5cf6" },
  checkout: { label: "Checkout", icon: "💳", color: "#ec4899" },
  upsell: { label: "Upsell", icon: "🚀", color: "#f59e0b" },
  confirmation: { label: "Thank You", icon: "✓", color: "#10b981" },
  webinar: { label: "Webinar", icon: "🎥", color: "#06b6d4" },
  demo: { label: "Demo", icon: "🎬", color: "#a78bfa" },
};

function getPerformanceColor(conversionRate: number): string {
  if (conversionRate >= 50) return "var(--ds-brand)"; // Excellent
  if (conversionRate >= 30) return "#10b981"; // Good
  if (conversionRate >= 15) return "#f59e0b"; // Okay
  return "#ef4444"; // Needs work
}

function getPerformanceLabel(conversionRate: number): string {
  if (conversionRate >= 50) return "Excellent";
  if (conversionRate >= 30) return "Good";
  if (conversionRate >= 15) return "Okay";
  return "Needs Work";
}

export function FunnelCanvasBuilder({
  steps: initialSteps,
  onChange,
  onSave,
  editable = true,
}: FunnelCanvasBuilderProps) {
  const defaultSteps: Step[] = [
    {
      id: "1",
      type: "optin",
      name: "Opt-in Page",
      traffic: 1000,
      conversionRate: 65,
      order: 0,
    },
    {
      id: "2",
      type: "sales",
      name: "Sales Page",
      traffic: 650,
      conversionRate: 42,
      revenue: 2730,
      order: 1,
    },
    {
      id: "3",
      type: "checkout",
      name: "Checkout",
      traffic: 273,
      conversionRate: 100,
      revenue: 1365,
      order: 2,
    },
    {
      id: "4",
      type: "upsell",
      name: "Upsell",
      traffic: 273,
      conversionRate: 31,
      revenue: 407,
      order: 3,
    },
  ];

  const [steps, setSteps] = useState<Step[]>(initialSteps || defaultSteps);
  const [draggedStep, setDraggedStep] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<string | null>(null);

  const handleDragStart = (id: string) => {
    if (editable) setDraggedStep(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedStep || draggedStep === targetId || !editable) return;

    const draggedIdx = steps.findIndex((s) => s.id === draggedStep);
    const targetIdx = steps.findIndex((s) => s.id === targetId);

    const newSteps = [...steps];
    [newSteps[draggedIdx], newSteps[targetIdx]] = [
      newSteps[targetIdx]!,
      newSteps[draggedIdx]!,
    ];

    newSteps.forEach((step, i) => {
      step.order = i;
    });

    setSteps(newSteps);
    setDraggedStep(null);
    onChange?.(newSteps);
  };

  const updateStep = (id: string, updates: Partial<Step>) => {
    const newSteps = steps.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    );
    setSteps(newSteps);
    onChange?.(newSteps);
  };

  const deleteStep = (id: string) => {
    const newSteps = steps.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i }));
    setSteps(newSteps);
    onChange?.(newSteps);
  };

  const addStep = () => {
    const newId = (Math.max(...steps.map((s) => parseInt(s.id))) + 1).toString();
    const newStep: Step = {
      id: newId,
      type: "sales",
      name: "New Step",
      traffic: steps[steps.length - 1]?.traffic || 1000,
      conversionRate: 50,
      order: steps.length,
    };
    const newSteps = [...steps, newStep];
    setSteps(newSteps);
    onChange?.(newSteps);
  };

  const totalRevenue = steps.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const overallConversion = steps.length > 0
    ? ((steps[steps.length - 1]!.traffic / steps[0]!.traffic) * 100).toFixed(1)
    : "0";

  const bottleneck = steps.reduce((min, s) => {
    const dropoff = ((s.traffic / steps[0]!.traffic) * 100);
    return !min || dropoff < ((min.traffic / steps[0]!.traffic) * 100) ? s : min;
  });

  return (
    <div className="funnel-canvas-builder">
      <style>{`
        .funnel-canvas-builder {
          padding: 40px 20px;
          background: var(--ds-bg-app);
        }

        .builder-header {
          max-width: 1200px;
          margin: 0 auto 40px;
        }

        .builder-title {
          font-size: 24px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0 0 8px 0;
        }

        .builder-subtitle {
          font-size: 13px;
          color: var(--ds-text-tertiary);
          margin: 0;
        }

        .builder-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .builder-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 40px;
        }

        .stat-card {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          padding: 20px;
          text-align: center;
        }

        .stat-label {
          font-size: 11px;
          color: var(--ds-text-tertiary);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin-bottom: 4px;
        }

        .stat-subtext {
          font-size: 12px;
          color: var(--ds-text-secondary);
        }

        .bottleneck-warning {
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 6px;
          padding: 12px 16px;
          font-size: 12px;
          color: #78350f;
          margin-bottom: 24px;
          line-height: 1.6;
        }

        .bottleneck-warning strong {
          color: #7c2d12;
          font-weight: 600;
        }

        .canvas-area {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          padding: 40px;
          margin-bottom: 24px;
        }

        .steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .step-card {
          background: var(--ds-bg-subtle);
          border: 2px solid transparent;
          border-radius: 8px;
          padding: 20px;
          cursor: grab;
          transition: all 0.3s ease;
          position: relative;
        }

        .step-card.dragging {
          opacity: 0.5;
          cursor: grabbing;
        }

        .step-card:hover {
          border-color: var(--ds-border-default);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .step-card.editing {
          border-color: var(--ds-brand);
          background: var(--ds-brand-soft);
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .step-icon {
          font-size: 24px;
        }

        .step-info {
          flex: 1;
        }

        .step-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--ds-text-primary);
          margin: 0;
        }

        .step-type {
          font-size: 11px;
          color: var(--ds-text-tertiary);
          margin-top: 2px;
        }

        .step-actions {
          display: flex;
          gap: 8px;
        }

        .step-action-btn {
          width: 28px;
          height: 28px;
          border: 1px solid var(--ds-border-default);
          background: var(--ds-surface);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .step-action-btn:hover {
          background: var(--ds-bg-app);
          border-color: var(--ds-border-strong);
        }

        .step-metrics {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--ds-border-subtle);
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }

        .metric-label {
          color: var(--ds-text-tertiary);
        }

        .metric-value {
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .performance-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .step-traffic-bar {
          height: 8px;
          background: var(--ds-border-subtle);
          border-radius: 4px;
          margin-top: 8px;
          overflow: hidden;
        }

        .step-traffic-fill {
          height: 100%;
          background: var(--ds-brand);
          transition: width 0.3s ease;
        }

        .step-edit-form {
          background: var(--ds-surface);
          border: 1px solid var(--ds-border-subtle);
          border-radius: 8px;
          padding: 20px;
          margin-top: 12px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 12px;
          font-weight: 600;
          color: var(--ds-text-primary);
        }

        .form-group input,
        .form-group select {
          padding: 8px 12px;
          border: 1px solid var(--ds-border-default);
          border-radius: 4px;
          font-size: 12px;
          background: var(--ds-surface-subtle);
          color: var(--ds-text-primary);
        }

        .form-actions {
          grid-column: 1 / -1;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }

        .builder-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
        }

        .step-order-indicator {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 24px;
          height: 24px;
          background: var(--ds-brand);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .steps-grid {
            grid-template-columns: 1fr;
          }

          .step-edit-form {
            grid-template-columns: 1fr;
          }

          .builder-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="builder-header">
        <h3 className="builder-title">Funnel Canvas Builder</h3>
        <p className="builder-subtitle">
          Design your funnel: drag steps to reorder, click to edit metrics
        </p>
      </div>

      <div className="builder-container">
        {/* Stats */}
        <div className="builder-stats">
          <div className="stat-card">
            <div className="stat-label">Total Steps</div>
            <div className="stat-value">{steps.length}</div>
            <div className="stat-subtext">{steps.length} stages</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overall Conversion</div>
            <div className="stat-value">{overallConversion}%</div>
            <div className="stat-subtext">
              {steps[0]?.traffic.toLocaleString()} → {steps[steps.length - 1]?.traffic.toLocaleString()}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Revenue</div>
            <div className="stat-value">
              ${(totalRevenue / 1000).toFixed(0)}K
            </div>
            <div className="stat-subtext">
              ${(totalRevenue / steps[steps.length - 1]!.traffic).toFixed(0)}/customer
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Biggest Bottleneck</div>
            <div className="stat-value">
              {(
                ((bottleneck.traffic / steps[0]!.traffic) * 100).toFixed(0)
              )}%
            </div>
            <div className="stat-subtext">{bottleneck.name}</div>
          </div>
        </div>

        {/* Bottleneck Warning */}
        <div className="bottleneck-warning">
          <strong>⚠️ Focus Area:</strong> Your "{bottleneck.name}" stage is your biggest
          constraint. Improving conversion here will have the largest impact on overall
          funnel performance.
        </div>

        {/* Canvas */}
        <div className="canvas-area">
          <div className="steps-grid">
            {steps.map((step, index) => {
              const performanceColor = getPerformanceColor(step.conversionRate);
              const performanceLabel = getPerformanceLabel(step.conversionRate);
              const stepTypeInfo = STEP_TYPES[step.type] || STEP_TYPES.sales;
              const trafficPercent = (step.traffic / steps[0]!.traffic) * 100;

              return (
                <div
                  key={step.id}
                  className={`step-card ${draggedStep === step.id ? "dragging" : ""} ${
                    editingStep === step.id ? "editing" : ""
                  }`}
                  draggable={editable}
                  onDragStart={() => handleDragStart(step.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(step.id)}
                >
                  <div className="step-order-indicator">{index + 1}</div>

                  <div className="step-header">
                    <div className="step-icon">{stepTypeInfo.icon}</div>
                    <div className="step-info">
                      <p className="step-name">{step.name}</p>
                      <p className="step-type">{stepTypeInfo.label}</p>
                    </div>
                    {editable && (
                      <div className="step-actions">
                        <button
                          className="step-action-btn"
                          onClick={() =>
                            setEditingStep(
                              editingStep === step.id ? null : step.id
                            )
                          }
                        >
                          ✏️
                        </button>
                        {steps.length > 1 && (
                          <button
                            className="step-action-btn"
                            onClick={() => deleteStep(step.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="step-metrics">
                    <div className="metric-row">
                      <span className="metric-label">Visitors:</span>
                      <span className="metric-value">
                        {step.traffic.toLocaleString()}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Traffic:</span>
                      <span className="metric-value">{trafficPercent.toFixed(0)}%</span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-label">Conversion:</span>
                      <span
                        className="metric-value"
                        style={{ color: performanceColor }}
                      >
                        {step.conversionRate}%
                      </span>
                    </div>
                    {step.revenue && (
                      <div className="metric-row">
                        <span className="metric-label">Revenue:</span>
                        <span className="metric-value">
                          ${step.revenue.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div
                    className="performance-badge"
                    style={{ background: performanceColor }}
                  >
                    {performanceLabel}
                  </div>

                  <div className="step-traffic-bar">
                    <div
                      className="step-traffic-fill"
                      style={{ width: `${trafficPercent}%` }}
                    />
                  </div>

                  {editingStep === step.id && editable && (
                    <div className="step-edit-form">
                      <div className="form-group">
                        <label>Step Name</label>
                        <input
                          type="text"
                          value={step.name}
                          onChange={(e) =>
                            updateStep(step.id, { name: e.target.value })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Type</label>
                        <select
                          value={step.type}
                          onChange={(e) =>
                            updateStep(step.id, {
                              type: e.target.value as Step["type"],
                            })
                          }
                        >
                          {Object.entries(STEP_TYPES).map(([key, val]) => (
                            <option key={key} value={key}>
                              {val.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Visitors</label>
                        <input
                          type="number"
                          value={step.traffic}
                          onChange={(e) =>
                            updateStep(step.id, {
                              traffic: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Conversion Rate (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={step.conversionRate}
                          onChange={(e) =>
                            updateStep(step.id, {
                              conversionRate: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="form-group">
                        <label>Revenue ($)</label>
                        <input
                          type="number"
                          value={step.revenue || 0}
                          onChange={(e) =>
                            updateStep(step.id, {
                              revenue: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="form-actions">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingStep(null)}
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {editable && (
            <Button variant="secondary" onClick={addStep} style={{ width: "100%" }}>
              + Add Step
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="builder-actions">
          <Button variant="secondary">Export as CSV</Button>
          <Button
            variant="primary"
            onClick={() => {
              onSave?.(steps);
              alert("Funnel saved!");
            }}
          >
            Save Funnel
          </Button>
        </div>
      </div>
    </div>
  );
}
