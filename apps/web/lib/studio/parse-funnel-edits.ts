/**
 * Strict parser for an AI-proposed *incremental* funnel edit — the core of the
 * Copilot's "apply this change" action. Turns the model's untrusted JSON into a
 * bounded, validated list of operations, or null if unusable. Pure (no React/AI
 * deps) so it's unit-testable: a malformed or hostile response can never reach
 * the canvas as anything but validated ops.
 *
 * Shape accepted (order-independent — a forward-referenced new node is fine):
 *   { "edits": [
 *     { "op": "add_node", "id": "n9", "kind": "offer", "label": "Order bump" },
 *     { "op": "add_edge", "source": "n1", "target": "n9" },
 *     { "op": "update_node", "id": "n2", "label": "New headline" },
 *     { "op": "delete_edge", "source": "n3", "target": "n4" },
 *     { "op": "delete_node", "id": "n5" }
 *   ] }
 * `ops` is accepted as an alias for `edits`. Ops that reference a node id that
 * neither exists nor is being added in this batch are dropped (the AI
 * hallucinated it), as are malformed ops; the count is reported as `skipped`.
 */
export type EditNodeKind = "traffic" | "step" | "offer" | "split";
export type EditOp =
  | { op: "add_node"; id: string; kind: EditNodeKind; label: string }
  | { op: "update_node"; id: string; label: string }
  | { op: "delete_node"; id: string }
  | { op: "add_edge"; source: string; target: string }
  | { op: "delete_edge"; source: string; target: string };

export interface ParsedEdits { ops: EditOp[]; skipped: number; }

const KINDS = new Set<EditNodeKind>(["traffic", "step", "offer", "split"]);
const MAX_OPS = 40;
const MAX_LABEL = 60;

function str(v: unknown): string { return typeof v === "string" ? v.trim() : ""; }

export function parseFunnelEdits(raw: string, existingIds: Iterable<string> = []): ParsedEdits | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const rawOps = Array.isArray(o.edits) ? o.edits : Array.isArray(o.ops) ? o.ops : null;
  if (!rawOps) return null;

  const capped = rawOps.slice(0, MAX_OPS);
  let skipped = rawOps.length - capped.length;

  // Pre-pass: every id that will exist after the batch (current + added), so an
  // edge listed before its new node still validates.
  const known = new Set<string>();
  for (const id of existingIds) known.add(id);
  for (const item of capped) {
    if (item && typeof item === "object") {
      const it = item as Record<string, unknown>;
      if (str(it.op) === "add_node") { const id = str(it.id); if (id) known.add(id); }
    }
  }

  const ops: EditOp[] = [];
  const seenAdd = new Set<string>();
  for (const item of capped) {
    const op = parseOne(item, known, seenAdd);
    if (op) ops.push(op); else skipped++;
  }
  if (ops.length === 0) return null;
  return { ops, skipped };
}

function parseOne(item: unknown, known: Set<string>, seenAdd: Set<string>): EditOp | null {
  if (!item || typeof item !== "object") return null;
  const it = item as Record<string, unknown>;
  const kind = str(it.op).toLowerCase();
  switch (kind) {
    case "add_node": {
      const id = str(it.id);
      const nodeKind = str(it.kind).toLowerCase() as EditNodeKind;
      const label = str(it.label).slice(0, MAX_LABEL);
      if (!id || seenAdd.has(id) || !KINDS.has(nodeKind) || !label) return null;
      seenAdd.add(id);
      return { op: "add_node", id, kind: nodeKind, label };
    }
    case "update_node": {
      const id = str(it.id);
      const label = str(it.label).slice(0, MAX_LABEL);
      if (!id || !known.has(id) || !label) return null;
      return { op: "update_node", id, label };
    }
    case "delete_node": {
      const id = str(it.id);
      if (!id || !known.has(id)) return null;
      return { op: "delete_node", id };
    }
    case "add_edge":
    case "delete_edge": {
      const source = str(it.source);
      const target = str(it.target);
      if (!source || !target || source === target || !known.has(source) || !known.has(target)) return null;
      return { op: kind, source, target };
    }
    default:
      return null;
  }
}
