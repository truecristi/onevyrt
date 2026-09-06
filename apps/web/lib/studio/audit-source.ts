/**
 * Turns a funnel block (or a whole funnel) into the plain text the landing
 * audit reads. A "page block" is a traffic / step / offer node — the parts of
 * a funnel that correspond to an actual page a visitor sees. The auditable
 * text is the block's own name plus whatever copy the user pasted into its
 * note (the inspector's "Page copy…" field), with the offer's price/rates
 * folded in as context so the AI can judge message-to-offer match.
 *
 * Pure and dependency-free so it can be unit-tested and reused by both the
 * single-block audit and the funnel-wide audit without importing React.
 */
export type AuditableKind = "traffic" | "step" | "offer";
const PAGE_KINDS = new Set<string>(["traffic", "step", "offer"]);

export interface AuditNode {
  id: string;
  kind: string;
  label?: string;
  /** free-text the user pasted for this block (page copy, offer notes, URL) */
  note?: string;
  price?: number; // minor units
  passRate?: number; // 0..1
  conversionRate?: number; // 0..1
}

/** Whether this block maps to a page a landing audit can meaningfully grade. */
export function isAuditablePage(kind: string): kind is AuditableKind {
  return PAGE_KINDS.has(kind);
}

function money(minor?: number): string {
  if (typeof minor !== "number" || !Number.isFinite(minor)) return "";
  return `$${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Compose the auditable text for one block. Returns "" when there's nothing
 *  worth auditing (no copy and only a bare kind label). */
export function blockAuditText(n: AuditNode): string {
  const parts: string[] = [];
  const name = (n.label ?? "").trim();
  if (name) parts.push(`Page: ${name}`);
  const note = (n.note ?? "").trim();
  if (note) parts.push(note);
  const context: string[] = [];
  if (n.kind === "offer" && typeof n.price === "number") context.push(`offer price ${money(n.price)}`);
  if (n.kind === "offer" && typeof n.conversionRate === "number") context.push(`current conversion ${Math.round(n.conversionRate * 100)}%`);
  if (n.kind === "step" && typeof n.passRate === "number") context.push(`current pass rate ${Math.round(n.passRate * 100)}%`);
  if (context.length) parts.push(`(${context.join(", ")})`);
  // A block with only its kind name and no real copy isn't worth an AI call.
  if (!note && !name) return "";
  return parts.join("\n");
}

/** Does a block carry enough text for a useful audit? Guards the UI so we
 *  don't fire an AI call on an empty block. */
export function hasAuditableCopy(n: AuditNode): boolean {
  return blockAuditText(n).trim().length >= 12;
}

export interface FunnelAuditTarget {
  id: string;
  label: string;
  kind: AuditableKind;
  text: string;
}

/** Every page block in the funnel that has enough copy to audit, in canvas
 *  order. Used by the funnel-wide "audit everything" runner. */
export function funnelAuditTargets(nodes: AuditNode[]): FunnelAuditTarget[] {
  const out: FunnelAuditTarget[] = [];
  for (const n of nodes) {
    if (!isAuditablePage(n.kind)) continue;
    const text = blockAuditText(n);
    if (text.trim().length < 12) continue;
    out.push({ id: n.id, label: (n.label ?? n.kind).trim() || n.kind, kind: n.kind, text });
  }
  return out;
}
