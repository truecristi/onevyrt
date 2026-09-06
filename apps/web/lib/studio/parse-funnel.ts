/**
 * Strict parser/validator for the AI funnel builder: turns the AI's untrusted
 * text into the app's own funnel model, or null if it isn't usable. Pure (no
 * React/AI deps) so it's unit-testable — the whole point is that a malformed or
 * hostile AI response can never reach the canvas as anything but a validated,
 * bounded structure.
 */
export type BuiltNode = { id: string; kind: "traffic" | "step" | "offer" | "split"; label: string };
export type BuiltFunnel = { name: string; nodes: BuiltNode[]; edges: [string, string][] };

const KINDS = new Set(["traffic", "step", "offer", "split"]);
const MAX_NODES = 20;
const MAX_LABEL = 60;

export function parseFunnel(raw: string): BuiltFunnel | null {
  // Strip markdown fences / any prose around the JSON object.
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj: unknown;
  try { obj = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  const rawNodes = Array.isArray(o.nodes) ? o.nodes : [];
  const nodes: BuiltNode[] = [];
  const seen = new Set<string>();
  for (const n of rawNodes.slice(0, MAX_NODES)) {
    if (!n || typeof n !== "object") continue;
    const nn = n as Record<string, unknown>;
    const kind = String(nn.kind ?? "").toLowerCase();
    const label = typeof nn.label === "string" ? nn.label.trim().slice(0, MAX_LABEL) : "";
    let id = typeof nn.id === "string" ? nn.id.trim() : "";
    if (!KINDS.has(kind) || !label) continue;
    if (!id || seen.has(id)) id = `n${nodes.length + 1}`;
    seen.add(id);
    nodes.push({ id, kind: kind as BuiltNode["kind"], label });
  }
  if (nodes.length < 2) return null; // need at least a source and a step to be a funnel

  const rawEdges = Array.isArray(o.edges) ? o.edges : [];
  const ids = new Set(nodes.map((n) => n.id));
  const edges: [string, string][] = [];
  const edgeSeen = new Set<string>();
  for (const e of rawEdges) {
    if (!Array.isArray(e) || e.length < 2) continue;
    const a = String(e[0]), b = String(e[1]);
    const key = `${a}->${b}`;
    if (a === b || !ids.has(a) || !ids.has(b) || edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    edges.push([a, b]);
  }
  // If the AI gave no usable edges, chain the nodes in order so the funnel still flows.
  if (edges.length === 0) for (let i = 0; i < nodes.length - 1; i++) edges.push([nodes[i]!.id, nodes[i + 1]!.id]);

  const name = typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 80) : "AI funnel";
  return { name, nodes, edges };
}
