"use client";
/**
 * "Fix first" — shows the ranked list from lib/studio/fix-first: the single
 * highest-leverage thing to fix next, then the rest, each tagged by kind.
 * Clicking a block-scoped item selects that block on the canvas.
 */
import { Modal } from "./Modal";
import type { FixItem, FixKind } from "../../lib/studio/fix-first";

const KIND_TAG: Record<FixKind, { label: string; color: string; bg: string }> = {
  leak: { label: "Money leak", color: "var(--bad-text)", bg: "var(--bad-bg)" },
  decision: { label: "Overdue", color: "var(--warn-text)", bg: "var(--warn-bg)" },
  risk: { label: "Risk", color: "var(--bad-text)", bg: "var(--bad-bg)" },
  audit: { label: "Weak page", color: "#7c3aed", bg: "rgba(124,58,237,0.14)" },
  benchmark: { label: "Below norm", color: "var(--warn-text)", bg: "var(--warn-bg)" },
  // Overdue/unattended items from the 7 Systems, Goal Hierarchy, and
  // Experiment Register — same "overdue" treatment as the Decision Log.
  actionItem: { label: "Overdue", color: "var(--warn-text)", bg: "var(--warn-bg)" },
};

export function FixFirst({ items, onClose, onOpenBlock }: {
  items: FixItem[];
  onClose: () => void;
  onOpenBlock?: (nodeId: string) => void;
}) {
  return (
    <Modal title="Fix first" onClose={onClose} width={560}>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
          Nothing urgent right now — no money leaks, overdue decisions or action items, high risks, or below-benchmark pages. Good time to pressure-test the plan in Simulate.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => {
            const tag = KIND_TAG[it.kind];
            const clickable = !!(it.nodeId && onOpenBlock);
            return (
              <div key={`${it.kind}-${it.rank}`}
                onClick={clickable ? () => { onOpenBlock!(it.nodeId!); onClose(); } : undefined}
                style={{ display: "flex", gap: 10, alignItems: "flex-start", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", cursor: clickable ? "pointer" : "default" }}>
                <span style={{ width: 22, height: 22, flexShrink: 0, borderRadius: 6, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{it.rank}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: tag.color, background: tag.bg, padding: "2px 6px", borderRadius: 5 }}>{tag.label}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.title}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.45 }}>{it.detail}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
