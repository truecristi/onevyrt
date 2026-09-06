"use client";

import type { Node } from "@xyflow/react";
import type { RFNodeData } from "../lib/funnel-map";
import { FIELDS_BY_KIND, KIND_COLOR, fromEngine, toEngineValue } from "../lib/studio-ui";

export function ModelCentre({ nodes, patch }: { nodes: Node[]; patch: (id: string, c: Partial<RFNodeData>) => void }) {
  if (nodes.length === 0) return <div style={{ padding: 24, color: "var(--dim)" }}>Add nodes on the canvas (PLAN mode) to see the whole model here.</div>;
  return (
    <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
      <div style={{ fontSize: 13, color: "var(--dim)", marginBottom: 16 }}>Every assumption behind the graph, in one editable place.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {nodes.map((n) => {
          const d = n.data as RFNodeData;
          const fields = FIELDS_BY_KIND[d.kind] ?? [];
          const color = KIND_COLOR[d.kind] ?? "#64748b";
          return (
            <div key={n.id} style={{ background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                <span style={{ fontWeight: 500, fontSize: 13 }}>{d.label}</span>
                <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--dim)", border: `1px solid ${color}`, borderRadius: 4, padding: "1px 6px" }}>{d.kind}</span>
              </div>
              {fields.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--dim)" }}>No editable assumptions.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
                  {fields.map((f) => (
                    <label key={f.key} style={{ display: "block" }}>
                      <span data-term={f.key} style={{ fontSize: 11, color: "var(--muted)" }}>{f.label}</span>
                      <input type="number" value={fromEngine(f.unit, (d[f.key] as number) ?? 0)} step={f.unit === "money" ? 1 : f.unit === "rate" ? 1 : 10}
                        onChange={(e) => patch(n.id, { [f.key]: toEngineValue(f.unit, parseFloat(e.target.value) || 0) } as Partial<RFNodeData>)}
                        style={{ width: "100%", marginTop: 3, background: "var(--bg)", border: "1px solid var(--border3)", borderRadius: 6, color: "var(--text)", padding: "5px 8px", fontSize: 13 }} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
