"use client";
/**
 * ProgressIndicator — Wave 2 Lane 1 foundation task #4: "where am I in the
 * journey," read straight from the engine's ProgrammeMap/NextAction
 * view-model (packages/engine/src/programme-nav.ts) so it can never disagree
 * with ProgrammeJourney or LessonGuide about a learner's position. Closes
 * the gap the Wave 1 spec called out in §2.1.4 — "no progress visibility in
 * the nav bar."
 *
 * Two variants:
 *  - "compact" — a single-line chip for a top bar or sidebar rail (chapter +
 *    step + a slim bar); renders nothing when there's no map, matching the
 *    current top bar's total absence of a progress element (a safe,
 *    non-regressive default for a spot that today shows nothing at all).
 *  - "full" — a standalone panel (adds the gate-status pill, the stage
 *    title, and the overall completed/total + percent footer).
 *
 * Not wired into any layout yet (Wave 3) — components/navigation/UnifiedNav
 * is the one component meant to render this today.
 */
import type { NextAction, NodeStatus, ProgrammeMap, ProgrammeMapNode } from "@onevyrt/engine";

export interface ProgressIndicatorProps {
  map: ProgrammeMap | null;
  nextAction?: NextAction | null;
  variant?: "compact" | "full";
  className?: string;
}

/** Labels for the engine's own NodeStatus — the exact "locked / available /
 *  completed" vocabulary the task calls for, plus "current" (in progress),
 *  the fourth state the engine actually tracks (packages/engine/src/programme-nav.ts). */
const STATUS_LABEL: Record<NodeStatus, string> = {
  locked: "Locked", available: "Available", current: "In progress", complete: "Complete",
};

interface CurrentPosition {
  node: ProgrammeMapNode;
  chapterNumber: number;
  totalChapters: number;
  /** 1-based index of the current lesson within its stage, or null if the
   *  engine's currentLessonId isn't one of this stage's lessons (shouldn't
   *  happen, but a chip that reads "Chapter 2/5" with no step is a better
   *  failure mode than a broken "Step 0/7"). */
  stepNumber: number | null;
}

function currentPositionOf(map: ProgrammeMap): CurrentPosition | null {
  const idx = map.nodes.findIndex((n) => n.stageId === map.currentStageId);
  if (idx === -1) return null;
  const node = map.nodes[idx]!;
  const stepIdx = node.lessons.findIndex((l) => l.id === map.currentLessonId);
  return { node, chapterNumber: idx + 1, totalChapters: map.nodes.length, stepNumber: stepIdx === -1 ? null : stepIdx + 1 };
}

export function ProgressIndicator({ map, nextAction = null, variant = "compact", className = "" }: ProgressIndicatorProps) {
  const rootClass = (extra: string) => `pgi pgi-${variant}${extra ? ` ${extra}` : ""}${className ? ` ${className}` : ""}`;

  if (!map) {
    if (variant !== "full") return null;
    return (
      <div className={rootClass("pgi-empty")}>
        <style>{CSS}</style>
        Sign in to track your programme progress.
      </div>
    );
  }

  if (nextAction?.done) {
    return (
      <div className={rootClass("pgi-done")} data-status="complete">
        <style>{CSS}</style>
        <span className="pgi-dot" aria-hidden="true" />
        <span className="pgi-label">Programme complete</span>
      </div>
    );
  }

  const current = currentPositionOf(map);
  if (!current) {
    // Paced out (a cohort cap) or nothing enrolled yet — nextAction already
    // distinguishes "not started" from "caught up"; either way there's no
    // chapter/step to show, so match its copy rather than inventing our own.
    return (
      <div className={rootClass("pgi-waiting")}>
        <style>{CSS}</style>
        <span className="pgi-label">{nextAction?.ctaLabel ?? "You're all caught up"}</span>
        {variant === "full" && <span className="pgi-sub">Your coach opens the next step.</span>}
      </div>
    );
  }

  const { node, chapterNumber, totalChapters, stepNumber } = current;

  if (variant === "compact") {
    return (
      <div className={rootClass("")} data-status={node.status} title={`${node.title} — ${STATUS_LABEL[node.status]}`}>
        <style>{CSS}</style>
        <span className="pgi-dot" aria-hidden="true" />
        <span className="pgi-chip">Ch {chapterNumber}/{totalChapters}</span>
        {stepNumber !== null && <span className="pgi-chip">Step {stepNumber}/{node.totalLessons}</span>}
        <span className="pgi-bar"><span style={{ width: `${map.overallPercent}%` }} /></span>
      </div>
    );
  }

  return (
    <div className={rootClass("")} data-status={node.status}>
      <style>{CSS}</style>
      <div className="pgi-top">
        <span className="pgi-chip">Chapter {chapterNumber} of {totalChapters}</span>
        <span className={`pgi-status ${node.status}`}>{STATUS_LABEL[node.status]}</span>
      </div>
      <div className="pgi-title">{node.title}</div>
      {stepNumber !== null && <div className="pgi-sub">Step {stepNumber} of {node.totalLessons}</div>}
      <div className="pgi-bar full"><span style={{ width: `${map.overallPercent}%` }} /></div>
      <div className="pgi-foot">
        <span>{map.completedLessons}/{map.totalLessons} modules</span>
        <span className="pgi-pct">{map.overallPercent}%</span>
      </div>
    </div>
  );
}

const CSS = `
.pgi{display:flex;flex-direction:column;gap:6px;font-family:var(--ds-font,-apple-system,BlinkMacSystemFont,system-ui,sans-serif);color:var(--ds-text-primary,#111827);}
.pgi-compact{flex-direction:row;align-items:center;gap:8px;font-size:11.5px;}
.pgi-empty,.pgi-waiting{font-size:12.5px;color:var(--ds-text-tertiary,#586173);}
.pgi-compact.pgi-empty,.pgi-compact.pgi-waiting{flex-direction:row;}
.pgi-dot{flex:none;width:8px;height:8px;border-radius:999px;background:var(--ds-text-disabled,#94a3b8);}
.pgi[data-status="current"] .pgi-dot{background:var(--ds-brand,#088057);box-shadow:0 0 0 3px color-mix(in srgb,var(--ds-brand,#088057) 20%,transparent);}
.pgi[data-status="complete"] .pgi-dot,.pgi-done .pgi-dot{background:var(--ds-success,#12703a);}
.pgi[data-status="locked"] .pgi-dot{background:var(--ds-text-disabled,#94a3b8);}
.pgi-chip{white-space:nowrap;font-weight:700;color:var(--ds-text-secondary,#475569);}
.pgi-compact .pgi-chip{font-size:11px;}
.pgi-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--ds-text-tertiary,#586173);}
.pgi-top .pgi-chip{text-transform:uppercase;letter-spacing:.03em;font-size:11px;}
.pgi-status{margin-left:auto;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;text-transform:none;letter-spacing:0;background:var(--ds-bg-subtle,#f1f4f9);color:var(--ds-text-secondary,#475569);}
.pgi-status.complete{background:var(--ds-success-soft,#ecfdf3);color:var(--ds-success,#12703a);}
.pgi-status.current{background:var(--ds-brand-soft,#e7f6f0);color:var(--ds-brand,#088057);}
.pgi-status.locked{background:var(--ds-bg-subtle,#f1f4f9);color:var(--ds-text-disabled,#94a3b8);}
.pgi-title{font-size:13px;font-weight:600;}
.pgi-bar{flex:1 1 auto;min-width:36px;height:4px;border-radius:99px;background:var(--ds-bg-subtle,#f1f4f9);overflow:hidden;}
.pgi-bar.full{height:6px;flex:none;}
.pgi-bar span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--ds-brand,#088057),#3fd39e);transition:width .4s var(--ds-ease,ease);}
.pgi-foot{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ds-text-tertiary,#586173);}
.pgi-pct{font-weight:700;color:var(--ds-brand,#088057);}
.pgi-label{font-size:12.5px;font-weight:600;}
.pgi-compact .pgi-label{font-size:11.5px;}
.pgi-sub{font-size:11.5px;color:var(--ds-text-tertiary,#586173);}
.pgi-done{flex-direction:row;align-items:center;}
`;
