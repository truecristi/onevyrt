"use client";
/**
 * MajorDecisionReminder — a pause-and-reflect prompt shown before a high-impact
 * action (payment, level-up, big decision). Surfaces the learner's own Why &
 * Creed alongside the decision at hand, then lets them either take a moment
 * (onReflect) or continue (onApprove).
 *
 * Built on the shared Modal primitive (components/Modal.tsx) so it gets focus
 * trapping, Escape/backdrop close, and body-scroll locking for free — same
 * pattern as confirmDialog/promptDialog/alertDialog in that file.
 *
 * Paired with hooks/useMajorDecisionReminder.ts, which owns the open/close and
 * approve/reflect callback wiring:
 *
 *   const reminder = useMajorDecisionReminder({ onApprove, onReflect });
 *   <MajorDecisionReminder
 *     isOpen={reminder.isOpen}
 *     onApprove={reminder.handleApprove}
 *     onReflect={reminder.handleReflect}
 *     whyAndCreedData={whyCreedData}
 *     decisionContext={{ title, description, icon }}
 *   />
 */
import { useState, type ReactNode } from "react";
import { Modal, ModalActions } from "@/components/Modal";
import type { WhyAndCreedData } from "@/lib/dashboard/why-creed";

export interface DecisionContext {
  title: string;
  description: string;
  icon?: ReactNode;
}

export function MajorDecisionReminder({
  isOpen,
  onApprove,
  onReflect,
  whyAndCreedData,
  decisionContext,
}: {
  isOpen: boolean;
  onApprove: () => void | Promise<void>;
  onReflect: () => void;
  whyAndCreedData: WhyAndCreedData | null;
  decisionContext: DecisionContext;
}) {
  const [approving, setApproving] = useState(false);

  const why = whyAndCreedData?.why?.trim() ?? "";
  const creed = whyAndCreedData?.creed?.trim() ?? "";
  const hasWhyCreed = why.length > 0 || creed.length > 0;

  const handleApprove = async () => {
    setApproving(true);
    try {
      await onApprove();
    } finally {
      setApproving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onReflect}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {decisionContext.icon}
          {decisionContext.title}
        </span>
      }
    >
      <p style={{ margin: "0 0 4px", fontSize: 13.5, color: "var(--ds-text-secondary, #475569)", lineHeight: 1.55 }}>
        {decisionContext.description}
      </p>

      {hasWhyCreed && (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 12,
            background: "var(--ds-surface-subtle, #f8fafc)",
            border: "1px solid var(--ds-border-default, #dde3eb)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {why.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ds-text-secondary, #64748b)", marginBottom: 4 }}>
                Your Why
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ds-text-primary, #111827)" }}>{why}</div>
            </div>
          )}
          {creed.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--ds-text-secondary, #64748b)", marginBottom: 4 }}>
                Your Creed
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--ds-text-primary, #111827)" }}>{creed}</div>
            </div>
          )}
        </div>
      )}

      {!hasWhyCreed && (
        <p style={{ marginTop: 14, fontSize: 13, color: "var(--ds-text-secondary, #64748b)" }}>
          You haven't set your Why & Creed yet — once you do, they'll show up here to ground moments like this one.
        </p>
      )}

      <ModalActions>
        <button className="ov-mbtn" onClick={onReflect} disabled={approving}>Take a moment</button>
        <button className="ov-mbtn primary" onClick={handleApprove} disabled={approving}>
          {approving ? "Continuing…" : "Continue"}
        </button>
      </ModalActions>
    </Modal>
  );
}
