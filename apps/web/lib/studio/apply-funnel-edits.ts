/**
 * Apply parsed Copilot edit ops (see parse-funnel-edits) to the canvas's
 * nodes/edges. Pure — takes the current arrays and the ops, returns new arrays
 * — so the risky "mutate the funnel from AI output" step is fully unit-tested,
 * and the React wiring just swaps the result in (which the existing undo
 * history captures automatically). New nodes are laid out to the right of the
 * current graph so they never land on top of existing blocks.
 */
import type { Node, Edge } from "@xyflow/react";
import type { RFNodeData } from "../funnel-map";
import type { EditOp } from "./parse-funnel-edits";

const NEW_COL_GAP = 220;
const NEW_ROW_GAP = 140;
const MAX_STACK = 560;

export interface ApplyResult { nodes: Node[]; edges: Edge[]; applied: number; }

export function applyFunnelEdits(ops: EditOp[], nodes: Node[], edges: Edge[]): ApplyResult {
  let outN: Node[] = nodes.map((n) => ({ ...n }));
  let outE: Edge[] = edges.map((e) => ({ ...e }));

  // Lay new nodes out to the right of everything that exists, stacking downward.
  let colX = outN.reduce((m, n) => Math.max(m, n.position?.x ?? 0), 0) + NEW_COL_GAP;
  let rowY = 0;
  let applied = 0;

  for (const op of ops) {
    switch (op.op) {
      case "add_node": {
        if (outN.some((n) => n.id === op.id)) break; // never duplicate an id
        outN.push({
          id: op.id,
          type: "gb",
          position: { x: colX, y: rowY },
          data: { kind: op.kind, label: op.label } as unknown as RFNodeData,
        });
        rowY += NEW_ROW_GAP;
        if (rowY > MAX_STACK) { rowY = 0; colX += NEW_COL_GAP; }
        applied++;
        break;
      }
      case "update_node": {
        const i = outN.findIndex((n) => n.id === op.id);
        if (i === -1) break;
        outN[i] = { ...outN[i]!, data: { ...(outN[i]!.data as RFNodeData), label: op.label } };
        applied++;
        break;
      }
      case "delete_node": {
        const before = outN.length;
        outN = outN.filter((n) => n.id !== op.id);
        if (outN.length !== before) {
          outE = outE.filter((e) => e.source !== op.id && e.target !== op.id);
          applied++;
        }
        break;
      }
      case "add_edge": {
        if (!outN.some((n) => n.id === op.source) || !outN.some((n) => n.id === op.target)) break;
        if (!outE.some((e) => e.source === op.source && e.target === op.target)) {
          outE.push({ id: `e-${op.source}-${op.target}`, source: op.source, target: op.target });
          applied++;
        }
        break;
      }
      case "delete_edge": {
        const before = outE.length;
        outE = outE.filter((e) => !(e.source === op.source && e.target === op.target));
        if (outE.length !== before) applied++;
        break;
      }
    }
  }

  return { nodes: outN, edges: outE, applied };
}
