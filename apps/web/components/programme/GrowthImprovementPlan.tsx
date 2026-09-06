"use client";
/**
 * GrowthImprovementPlan — the Chapter 4 (IMPROVE & SCALE) permanent artifact:
 * current position → biggest bottleneck → action plan → 90-day impact
 * projection, per docs/IMPLEMENTATION_ROADMAP.md's Growth & Improvement Plan
 * spec. Purely presentational — it renders whatever GrowthPlan
 * (lib/growth-plan-utils.ts's formatPlan output) it's handed, with graceful
 * "not set yet" placeholders for anything the learner hasn't filled in.
 * Fetching, edit mode, and the download/share actions live one level up in
 * app/programme/chapter-4/growth-plan/page.tsx — this component never talks
 * to the network.
 *
 * Styled like the rest of the product's dashboards (see StrategyCard.tsx /
 * app/businesses/page.tsx): a self-scoped "gip-" class prefix, every colour
 * from the app/design-system.css `--ds-*` tokens so it follows the
 * light/dark toggle automatically, no hardcoded hex. Responsive
 * (auto-fit/auto-fill grids, no fixed widths) and print-friendly (flat
 * backgrounds, visible borders instead of shadows, sections that don't split
 * mid-card) since a founder printing or PDF-ing this artifact is the whole
 * point of a "permanent artifact."
 */
import type { GrowthPlan, GrowthPlanAction } from "../../lib/growth-plan-utils";
import { formatCurrency, formatPercent } from "../../lib/growth-plan-utils";

const STATUS_LABEL: Record<GrowthPlan["status"], string> = {
  in_progress: "In progress",
  submitted: "Awaiting coach review",
  changes_requested: "Changes requested",
  approved: "Approved",
};
const STATUS_BADGE: Record<GrowthPlan["status"], string> = {
  in_progress: "ds-badge",
  submitted: "ds-badge ds-badge--info",
  changes_requested: "ds-badge ds-badge--warning",
  approved: "ds-badge ds-badge--success",
};

const TOTAL_SUBCHAPTERS = 6; // 4.1–4.6 (4.6 is optional but still counts toward the total)

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ActionRow({ index, action }: { index: number; action: GrowthPlanAction }) {
  return (
    <li className="gip-action">
      <span className="gip-action-num" aria-hidden="true">{index + 1}</span>
      <div className="gip-action-body">
        <div className="gip-action-title">{action.title}</div>
        {action.expectedImpact && <div className="gip-action-impact">{action.expectedImpact}</div>}
      </div>
    </li>
  );
}

export interface GrowthImprovementPlanProps {
  plan: GrowthPlan;
  /** Shown in the artifact header, e.g. "Acme Coaching Co." — optional since
   *  a plain workspace id is a poor default title to print on a report. */
  workspaceName?: string;
  className?: string;
}

export function GrowthImprovementPlan({ plan, workspaceName, className = "" }: GrowthImprovementPlanProps) {
  const cp = plan.currentPosition;
  const hasCurrentPosition = cp.monthlyRevenue != null || cp.grossMarginPct != null || cp.conversionRatePct != null || cp.avgCustomerValue != null;
  const updated = formatDate(plan.updatedAt);
  const submitted = formatDate(plan.submittedAt);
  const reviewed = formatDate(plan.reviewedAt);

  return (
    <article className={["gip-root", className].filter(Boolean).join(" ")}>
      <style>{CSS}</style>

      <header className="gip-header">
        <div className="gip-header-main">
          <span className="ds-eyebrow">Growth & Improvement Plan</span>
          <h2 className="gip-title">{workspaceName ? `${workspaceName}'s next 90 days` : "Your next 90 days"}</h2>
        </div>
        <div className="gip-header-meta">
          <span className={STATUS_BADGE[plan.status]}>{STATUS_LABEL[plan.status]}</span>
          {updated && <span className="ds-help">Updated {updated}</span>}
        </div>
      </header>

      <div className="gip-progress">
        <div className="gip-progress-track" role="progressbar" aria-valuenow={plan.completedSubchapters.length} aria-valuemin={0} aria-valuemax={TOTAL_SUBCHAPTERS} aria-label="Chapter 4 sections complete">
          <span className="gip-progress-fill" style={{ width: `${Math.min(100, (plan.completedSubchapters.length / TOTAL_SUBCHAPTERS) * 100)}%` }} />
        </div>
        <span className="ds-help">{plan.completedSubchapters.length} of {TOTAL_SUBCHAPTERS} sections complete</span>
      </div>

      {plan.status === "changes_requested" && plan.coachFeedback && (
        <div className="gip-callout gip-callout--warning">
          <strong>Your coach requested changes:</strong> {plan.coachFeedback}
        </div>
      )}

      <section className="gip-section" aria-labelledby="gip-current-position">
        <h3 id="gip-current-position" className="gip-section-title">Current position</h3>
        {hasCurrentPosition ? (
          <div className="gip-stat-grid">
            <div className="gip-stat">
              <span className="gip-stat-label">Monthly revenue</span>
              <span className="gip-stat-value">{formatCurrency(cp.monthlyRevenue)}</span>
            </div>
            <div className="gip-stat">
              <span className="gip-stat-label">Gross margin</span>
              <span className="gip-stat-value">{formatPercent(cp.grossMarginPct)}</span>
            </div>
            <div className="gip-stat">
              <span className="gip-stat-label">Lead → sale conversion</span>
              <span className="gip-stat-value">{formatPercent(cp.conversionRatePct)}</span>
            </div>
            <div className="gip-stat">
              <span className="gip-stat-label">Avg. customer value</span>
              <span className="gip-stat-value">{formatCurrency(cp.avgCustomerValue)}</span>
            </div>
          </div>
        ) : (
          <p className="gip-empty">Baseline numbers haven't been added yet — they're captured in subchapter 4.3 (Improve Profit).</p>
        )}
      </section>

      <section className="gip-section" aria-labelledby="gip-bottleneck">
        <h3 id="gip-bottleneck" className="gip-section-title">Biggest bottleneck</h3>
        {plan.bottleneck ? (
          <div className="gip-bottleneck">
            <div className="gip-bottleneck-area">{plan.bottleneck.area || "Not named yet"}</div>
            {(plan.bottleneck.currentValue != null || plan.bottleneck.targetValue != null) && (
              <div className="gip-bottleneck-rates">
                <div className="gip-rate">
                  <span className="gip-rate-value gip-rate-value--current">{formatPercent(plan.bottleneck.currentValue)}</span>
                  <span className="ds-help">Current</span>
                </div>
                <span className="gip-arrow" aria-hidden="true">→</span>
                <div className="gip-rate">
                  <span className="gip-rate-value gip-rate-value--target">{formatPercent(plan.bottleneck.targetValue)}</span>
                  <span className="ds-help">Target</span>
                </div>
              </div>
            )}
            {plan.bottleneck.why && (
              <p className="gip-why"><span className="ds-eyebrow">Why</span> {plan.bottleneck.why}</p>
            )}
          </div>
        ) : (
          <p className="gip-empty">The constraint holding growth back hasn't been identified yet — that's subchapter 4.1 (Find the Bottleneck).</p>
        )}
      </section>

      <section className="gip-section" aria-labelledby="gip-actions">
        <h3 id="gip-actions" className="gip-section-title">Action plan</h3>
        {plan.actions.length > 0 ? (
          <ol className="gip-action-list">
            {plan.actions.map((a, i) => <ActionRow key={`${a.title}-${i}`} index={i} action={a} />)}
          </ol>
        ) : (
          <p className="gip-empty">No actions added yet — subchapter 4.5 (Build the Growth Plan) selects the top 3–5 improvements for the next 90 days.</p>
        )}
      </section>

      <section className="gip-section gip-section--impact" aria-labelledby="gip-impact">
        <h3 id="gip-impact" className="gip-section-title">Expected 90-day impact</h3>
        {plan.impact ? (
          <div className="gip-impact">
            <div className="gip-impact-row">
              <span className="gip-impact-label">Current</span>
              <span className="gip-impact-calc">{plan.impact.leadVolume.toLocaleString()} leads × {formatPercent(plan.impact.currentRatePct)} = {plan.impact.currentUnits.toLocaleString()} sales</span>
            </div>
            <div className="gip-impact-row">
              <span className="gip-impact-label">Target</span>
              <span className="gip-impact-calc">{plan.impact.leadVolume.toLocaleString()} leads × {formatPercent(plan.impact.targetRatePct)} = {plan.impact.targetUnits.toLocaleString()} sales</span>
            </div>
            <div className="gip-impact-uplift">
              <span className="gip-impact-uplift-label">Uplift</span>
              <span className="gip-impact-uplift-value">{formatPercent(plan.impact.upliftPct, { signed: true })} revenue potential</span>
            </div>
          </div>
        ) : (
          <p className="gip-empty">Add your monthly lead volume alongside the bottleneck's current and target rates to see the projected uplift.</p>
        )}
      </section>

      {(submitted || reviewed) && (
        <footer className="gip-footer">
          {submitted && <span>Submitted for review {submitted}</span>}
          {reviewed && <span>Reviewed {reviewed}</span>}
        </footer>
      )}
    </article>
  );
}

export default GrowthImprovementPlan;

const CSS = `
.gip-root{ --gip-surface: var(--ds-surface); --gip-border: var(--ds-border-subtle); --gip-text: var(--ds-text-primary); --gip-muted: var(--ds-text-secondary);
  display:flex; flex-direction:column; gap:22px; background:var(--gip-surface); border:1px solid var(--gip-border); border-radius:var(--ds-radius-xl);
  padding:24px 26px 26px; box-shadow:var(--ds-shadow-sm); color:var(--gip-text); font-family:var(--ds-font); max-width:100%; box-sizing:border-box; }
.gip-root *{ box-sizing:border-box; }

.gip-header{ display:flex; align-items:flex-start; justify-content:space-between; gap:14px; flex-wrap:wrap; border-bottom:1px solid var(--gip-border); padding-bottom:16px; }
.gip-header-main{ display:flex; flex-direction:column; gap:4px; min-width:0; }
.gip-title{ margin:0; font-size:21px; font-weight:700; letter-spacing:-.3px; line-height:1.25; }
.gip-header-meta{ display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex:0 0 auto; }

.gip-progress{ display:flex; align-items:center; gap:12px; }
.gip-progress-track{ flex:1; height:6px; border-radius:99px; background:var(--ds-bg-subtle); overflow:hidden; border:1px solid var(--ds-border-subtle); }
.gip-progress-fill{ display:block; height:100%; border-radius:99px; background:var(--ds-brand); transition:width .4s ease; }

.gip-callout{ border-radius:var(--ds-radius-md); padding:12px 14px; font-size:13.5px; line-height:1.5; }
.gip-callout--warning{ background:var(--ds-warning-soft); color:var(--ds-text-primary); border:1px solid color-mix(in srgb, var(--ds-warning) 35%, transparent); }
.gip-callout--warning strong{ color:var(--ds-warning); }

.gip-section{ display:flex; flex-direction:column; gap:12px; break-inside:avoid; page-break-inside:avoid; }
.gip-section-title{ margin:0; font-size:13px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--gip-muted); }
.gip-empty{ margin:0; font-size:13.5px; line-height:1.55; color:var(--ds-text-tertiary); font-style:italic; }

.gip-stat-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:14px; }
.gip-stat{ display:flex; flex-direction:column; gap:5px; background:var(--ds-bg-subtle); border:1px solid var(--gip-border); border-radius:var(--ds-radius-lg); padding:13px 15px; }
.gip-stat-label{ font-size:11.5px; color:var(--gip-muted); font-weight:600; }
.gip-stat-value{ font-size:22px; font-weight:700; letter-spacing:-.4px; }

.gip-bottleneck{ display:flex; flex-direction:column; gap:12px; background:var(--ds-bg-subtle); border:1px solid var(--gip-border); border-radius:var(--ds-radius-lg); padding:16px 18px; }
.gip-bottleneck-area{ font-size:17px; font-weight:700; }
.gip-bottleneck-rates{ display:flex; align-items:center; gap:16px; }
.gip-rate{ display:flex; flex-direction:column; align-items:center; gap:2px; }
.gip-rate-value{ font-size:26px; font-weight:700; letter-spacing:-.4px; }
.gip-rate-value--current{ color:var(--ds-text-secondary); }
.gip-rate-value--target{ color:var(--ds-brand); }
.gip-arrow{ font-size:18px; color:var(--ds-text-tertiary); }
.gip-why{ margin:0; font-size:13.5px; line-height:1.55; color:var(--gip-muted); }
.gip-why .ds-eyebrow{ margin-right:6px; }

.gip-action-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
.gip-action{ display:flex; align-items:flex-start; gap:12px; background:var(--ds-bg-subtle); border:1px solid var(--gip-border); border-radius:var(--ds-radius-md); padding:11px 14px; }
.gip-action-num{ flex:0 0 auto; width:22px; height:22px; border-radius:50%; background:var(--ds-brand-soft); color:var(--ds-brand-active); font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; }
.gip-action-body{ display:flex; flex-direction:column; gap:3px; min-width:0; }
.gip-action-title{ font-size:14px; font-weight:600; }
.gip-action-impact{ font-size:12.5px; color:var(--gip-muted); line-height:1.4; }

.gip-section--impact{ background:var(--ds-brand-soft); border:1px solid color-mix(in srgb, var(--ds-brand) 30%, transparent); border-radius:var(--ds-radius-lg); padding:16px 18px; }
.gip-section--impact .gip-section-title{ color:var(--ds-brand-active); }
.gip-impact{ display:flex; flex-direction:column; gap:8px; }
.gip-impact-row{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.gip-impact-label{ flex:0 0 64px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--gip-muted); }
.gip-impact-calc{ font-size:14px; font-weight:600; }
.gip-impact-uplift{ display:flex; align-items:baseline; gap:10px; margin-top:6px; padding-top:10px; border-top:1px solid color-mix(in srgb, var(--ds-brand) 25%, transparent); }
.gip-impact-uplift-label{ flex:0 0 64px; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--gip-muted); }
.gip-impact-uplift-value{ font-size:19px; font-weight:800; color:var(--ds-brand-active); letter-spacing:-.3px; }

.gip-footer{ display:flex; flex-wrap:wrap; gap:16px; font-size:12px; color:var(--ds-text-tertiary); border-top:1px solid var(--gip-border); padding-top:14px; }

@media (max-width: 560px){
  .gip-header{ flex-direction:column; }
  .gip-header-meta{ align-items:flex-start; }
  .gip-bottleneck-rates{ gap:12px; }
}

@media print{
  .gip-root{ box-shadow:none; border-color:#ccc; }
  .gip-stat, .gip-bottleneck, .gip-action, .gip-section--impact{ background:#fff !important; border-color:#ccc !important; }
  .gip-section{ break-inside:avoid; }
}
`;
