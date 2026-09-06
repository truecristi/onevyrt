/**
 * Detects a project that is still exactly the untouched starter every new
 * project seeds (see freshInitial()/initialNodes in FunnelCanvas.tsx: a
 * traffic -> landing -> offer chain with stock numbers so the canvas isn't
 * blank and the simulator has something to show while building). Those stock
 * numbers ($97 price, 1,000 visitors, etc.) are placeholders, not the
 * founder's real business — but simulate() happily computes a real-looking
 * revenue/profit from them the instant a project exists, before the founder
 * has entered a single number of their own.
 *
 * The project library used to show that computed figure on every brand-new
 * project's card, which reads as an invented result. This is the one-place
 * guard: as soon as the founder changes ANY of it — a rate, a price, adds or
 * removes a node — this stops matching and the project's real numbers show
 * instead. Pure and structural, so it never depends on a separate "dirty"
 * flag that some edit path could forget to set.
 */
import { defaultData, type RFNodeData } from "../funnel-map";
import { TEMPLATES, buildTemplate } from "./templates";

export interface StarterNode { id: string; data: RFNodeData }
export interface StarterEdge { source: string; target: string }

const TRAFFIC_DEFAULT = defaultData("traffic", "");
const LANDING_DEFAULT = defaultData("step", "");
const OFFER_DEFAULT = defaultData("offer", "");

/** True only when the project is precisely the freshInitial() starter: the
 *  same three node ids with unmodified default numbers, the same two edges,
 *  and no expenses recorded. */
export function isUntouchedStarter(nodes: StarterNode[], edges: StarterEdge[], hasExpenses: boolean): boolean {
  if (hasExpenses) return false;
  if (nodes.length !== 3) return false;

  const byId = new Map(nodes.map((n) => [n.id, n.data]));
  const traffic = byId.get("traffic");
  const landing = byId.get("landing");
  const sale = byId.get("sale");
  if (!traffic || !landing || !sale) return false;

  if (traffic.kind !== "traffic" || traffic.visitors !== TRAFFIC_DEFAULT.visitors || traffic.costPerVisitor !== TRAFFIC_DEFAULT.costPerVisitor) return false;
  if (landing.kind !== "step" || landing.passRate !== LANDING_DEFAULT.passRate) return false;
  if (sale.kind !== "offer" || sale.conversionRate !== OFFER_DEFAULT.conversionRate || sale.price !== OFFER_DEFAULT.price) return false;

  if (edges.length !== 2) return false;
  const edgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`));
  if (!edgeSet.has("traffic->landing") || !edgeSet.has("landing->sale")) return false;

  return true;
}

/**
 * Every number in a node's data that feeds the simulation, as one stable
 * string, so two nodes compare equal iff every such number matches. Labels and
 * positions are deliberately ignored: renaming "Orders at counter" doesn't
 * change whose numbers these are — only editing the numbers does.
 */
function numericSig(data: RFNodeData): string {
  const d = data as unknown as Record<string, unknown>;
  return Object.keys(d)
    .filter((k) => typeof d[k] === "number")
    .sort()
    .map((k) => `${k}=${d[k] as number}`)
    .join("|");
}

/**
 * When the project is still exactly one of the built-in templates — same node
 * ids and kinds, the same template numbers, the same edges, and no recorded
 * actuals or expenses — returns that template's name; otherwise null.
 *
 * A template (McDonald's value ladder, a lead-gen funnel…) is seeded with the
 * template author's ILLUSTRATIVE numbers — 12,000 visitors, specific prices —
 * and simulate() turns those into a real-looking revenue/profit the moment the
 * project exists, before the founder has entered a single figure of their own.
 * That's the same class of "invented result shown as real" the untouched
 * starter had; the difference is the founder deliberately chose the template,
 * so the honest fix is to KEEP the numbers but mark them clearly as EXAMPLE
 * data, not to blank them. Editing any number, adding/removing a node,
 * rewiring an edge, or recording a single real figure un-matches it — because
 * at that point the plan reflects the founder's own thinking, not the sample.
 */
export function matchUntouchedTemplate(
  nodes: StarterNode[],
  edges: StarterEdge[],
  hasActuals: boolean,
  hasExpenses: boolean,
): string | null {
  if (hasActuals || hasExpenses) return null;
  const curById = new Map(nodes.map((n) => [n.id, n.data]));
  const curEdges = new Set(edges.map((e) => `${e.source}->${e.target}`));

  for (const tpl of TEMPLATES) {
    const built = buildTemplate(tpl);
    if (built.nodes.length !== nodes.length || built.edges.length !== edges.length) continue;

    let matches = true;
    for (const bn of built.nodes) {
      const cur = curById.get(bn.id);
      const bd = bn.data as RFNodeData;
      if (!cur || cur.kind !== bd.kind || numericSig(cur) !== numericSig(bd)) { matches = false; break; }
    }
    if (!matches) continue;

    for (const be of built.edges) {
      if (!curEdges.has(`${be.source}->${be.target}`)) { matches = false; break; }
    }
    if (matches) return tpl.name;
  }
  return null;
}
