"use client";
/**
 * The read-only "one client's progress" info block shared by /coaching's
 * learner list and ProgrammeCentre.tsx's "My clients" tab (components/
 * ProgrammeCentre.tsx) — both fetch the same /api/programme/coach-workspaces
 * data and used to independently hand-roll the same name/progress-bar/
 * status-badges display, one with semantic CSS classes + real ds-badge
 * components, the other with inline styles inside a dark modal.
 *
 * Deliberately just the read-only info — NOT the surrounding chrome. Each
 * caller keeps its own wrapper/action: /coaching wraps this in its own
 * <Card> + a "Review" link; ProgrammeCentre wraps it in its own clickable
 * workspace-switch button plus (for a manager) an access-toggle button and
 * a private coach-notes textarea. Those are real, caller-specific behaviors
 * this component has no opinion about.
 *
 * Uses the real ds-* design-system tokens + the shared Badge primitive
 * (components/ui/Card.tsx) rather than reinventing badge styling a third
 * time — safe inside ProgrammeCentre's modal since both are pure,
 * class-name-only components with no page-level dependency.
 */
import { Badge } from "../ui/Card";
import type { ReadinessLabel } from "@onevyrt/engine";

export type { ReadinessLabel } from "@onevyrt/engine";

const READINESS_TEXT: Record<ReadinessLabel, string> = {
  no_data: "No data yet",
  fragile: "Fragile",
  developing: "Developing",
  strong: "Strong",
};

export interface ClientProgressCardProps {
  workspaceName: string;
  percentComplete: number;
  completedLessons: number;
  totalLessons: number;
  awaitingReviewCount: number;
  changesRequestedCount: number;
  overdueCount: number;
  /** Only ProgrammeCentre's richer coach-workspaces caller carries these —
   *  /coaching's own fetch doesn't request readinessLabel/topGoal/
   *  accessGranted, so all three are optional and simply omitted there. */
  readinessLabel?: ReadinessLabel;
  topGoalTitle?: string | null;
  /** undefined = not applicable/unknown (don't render the badge either way);
   *  false = render the "Access paused" badge. */
  accessGranted?: boolean;
}

export function ClientProgressCard({
  workspaceName, percentComplete, completedLessons, totalLessons,
  awaitingReviewCount, changesRequestedCount, overdueCount,
  readinessLabel, topGoalTitle, accessGranted,
}: ClientProgressCardProps) {
  return (
    <div className="cpc">
      <style>{`
        .cpc-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
        .cpc-name { font-weight: 700; font-size: 14px; color: var(--ds-text-primary, #111827); }
        .cpc-readiness { font-size: 11px; font-weight: 700; color: var(--ds-text-secondary, #64748b); flex-shrink: 0; }
        .cpc-progress-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
        .cpc-progress-bar { flex: 1; height: 4px; background: var(--ds-border, #e2e8f0); border-radius: 2px; min-width: 80px; overflow: hidden; }
        .cpc-progress-fill { height: 100%; background: var(--ds-success, #16a34a); border-radius: 2px; transition: width 200ms ease; }
        .cpc-progress-text { font-size: 12px; color: var(--ds-text-secondary, #64748b); white-space: nowrap; }
        .cpc-badges { display: flex; gap: 6px; flex-wrap: wrap; }
      `}</style>
      <div className="cpc-head">
        <span className="cpc-name">{workspaceName}</span>
        {readinessLabel && <span className="cpc-readiness">{READINESS_TEXT[readinessLabel]}</span>}
      </div>
      <div className="cpc-progress-row">
        <div className="cpc-progress-bar"><div className="cpc-progress-fill" style={{ width: `${percentComplete}%` }} /></div>
        <span className="cpc-progress-text">
          {completedLessons} of {totalLessons} lessons · {percentComplete}%
          {topGoalTitle ? ` · Goal: ${topGoalTitle}` : ""}
        </span>
      </div>
      <div className="cpc-badges">
        {awaitingReviewCount > 0 && <Badge tone="info">{awaitingReviewCount} awaiting review</Badge>}
        {changesRequestedCount > 0 && <Badge tone="warning">{changesRequestedCount} changes requested</Badge>}
        {overdueCount > 0 && <Badge tone="danger">{overdueCount} overdue</Badge>}
        {percentComplete === 100 && <Badge tone="success">Completed</Badge>}
        {accessGranted === false && <Badge tone="danger">Access paused</Badge>}
      </div>
    </div>
  );
}
