"use client";
/**
 * /programme/chapter-4/growth-plan — the Chapter 4 (IMPROVE & SCALE)
 * permanent artifact page: fetches the workspace's Growth & Improvement Plan
 * (GET /api/programme/chapter/4/get) and renders it via
 * GrowthImprovementPlan. Uses useEnrollment for the shared workspace/role
 * context (the same ?ws=<id> deep-link convention every Business-OS page
 * honours — see app/business/constraint/page.tsx), then layers its own
 * Chapter-4-specific fetch on top, since that plan lives in a separate table
 * behind separate routes (see lib/chapter4-submissions.ts).
 *
 * Editing here is deliberately narrow: once a coach has approved the plan,
 * docs/IMPLEMENTATION_ROADMAP.md's "Growth & Improvement Plan is mutable"
 * decision lets it be revised afterward without a full re-review, and that's
 * the ONE case this page's edit mode covers. Building the plan in the first
 * place is the Chapter 4 subchapter curriculum's job (4.1–4.5, a separate
 * workstream) — this page doesn't duplicate that wizard.
 *
 * PDF download and share link are fully functional — tied to
 * /api/programme/chapter/4/pdf and /api/growth-plan/share respectively.
 */
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "../../../../components/ui/PageShell";
import { Button } from "../../../../components/ui/Button";
import { Field } from "../../../../components/ui/Card";
import { Notice } from "../../../../components/ui/Notice";
import { EmptyState } from "../../../../components/ui/EmptyState";
import { useEnrollment } from "../../../../components/programme/useEnrollment";
import { GrowthImprovementPlan } from "../../../../components/programme/GrowthImprovementPlan";
import { formatPlan } from "../../../../lib/growth-plan-utils";
import type { Chapter4Submission, GrowthPlanMetrics, GrowthPlanBottleneck, GrowthPlanAction } from "../../../../lib/chapter4-submissions";

type LoadState = "loading" | "ok" | "not-authenticated" | "error";

function parseNum(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

interface EditPlanFormProps {
  wsId: string;
  initial: ReturnType<typeof formatPlan>;
  onCancel: () => void;
  onSaved: (submission: Chapter4Submission) => void;
}

/** The narrow post-approval edit form — current position, bottleneck, and
 *  the action list, reusing the exact fields GrowthImprovementPlan displays.
 *  Saves with submitForReview omitted, so lib/chapter4-submissions.ts's
 *  saveChapter4Plan leaves `status` as "approved" rather than knocking the
 *  plan back into a review queue for a numbers tweak. */
function EditPlanForm({ wsId, initial, onCancel, onSaved }: EditPlanFormProps) {
  const [revenue, setRevenue] = useState(initial.currentPosition.monthlyRevenue?.toString() ?? "");
  const [margin, setMargin] = useState(initial.currentPosition.grossMarginPct?.toString() ?? "");
  const [conversion, setConversion] = useState(initial.currentPosition.conversionRatePct?.toString() ?? "");
  const [customerValue, setCustomerValue] = useState(initial.currentPosition.avgCustomerValue?.toString() ?? "");

  const [area, setArea] = useState(initial.bottleneck?.area ?? "");
  const [currentRate, setCurrentRate] = useState(initial.bottleneck?.currentValue?.toString() ?? "");
  const [targetRate, setTargetRate] = useState(initial.bottleneck?.targetValue?.toString() ?? "");
  const [why, setWhy] = useState(initial.bottleneck?.why ?? "");
  const [leadVolume, setLeadVolume] = useState(initial.impact?.leadVolume?.toString() ?? "");

  const [actions, setActions] = useState<GrowthPlanAction[]>(initial.actions.length > 0 ? initial.actions : [{ title: "" }]);
  const updateAction = (i: number, patch: Partial<GrowthPlanAction>) =>
    setActions((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  const addAction = () => setActions((prev) => (prev.length >= 8 ? prev : [...prev, { title: "" }]));
  const removeAction = (i: number) => setActions((prev) => prev.filter((_, idx) => idx !== i));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const currentPosition: GrowthPlanMetrics = {
      ...(parseNum(revenue) !== undefined ? { monthlyRevenue: parseNum(revenue) } : {}),
      ...(parseNum(margin) !== undefined ? { grossMarginPct: parseNum(margin) } : {}),
      ...(parseNum(conversion) !== undefined ? { conversionRatePct: parseNum(conversion) } : {}),
      ...(parseNum(customerValue) !== undefined ? { avgCustomerValue: parseNum(customerValue) } : {}),
    };
    const bottleneck: GrowthPlanBottleneck = {
      ...(area.trim() ? { area: area.trim() } : {}),
      ...(parseNum(currentRate) !== undefined ? { currentValue: parseNum(currentRate) } : {}),
      ...(parseNum(targetRate) !== undefined ? { targetValue: parseNum(targetRate) } : {}),
      ...(why.trim() ? { why: why.trim() } : {}),
    };
    const cleanActions = actions.filter((a) => a.title.trim().length > 0).map((a) => ({ title: a.title.trim(), ...(a.expectedImpact?.trim() ? { expectedImpact: a.expectedImpact.trim() } : {}) }));
    try {
      const r = await fetch(`/api/programme/chapter/4/submit?ws=${encodeURIComponent(wsId)}`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subchapter: "4.5",
          currentPosition,
          bottleneck,
          actions: cleanActions,
          impact: { ...(parseNum(leadVolume) !== undefined ? { leadVolume: parseNum(leadVolume) } : {}) },
        }),
      });
      const data = (await r.json()) as { submission?: Chapter4Submission; error?: string };
      if (!r.ok || !data.submission) { setError(data.error ?? "Could not save the plan."); return; }
      onSaved(data.submission);
    } catch {
      setError("Could not save the plan — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gpp-edit-card">
      <h3 className="ds-section">Edit the approved plan</h3>
      <p className="ds-help">Numbers only — this updates the plan in place without sending it back for review.</p>

      <div className="gpp-edit-grid">
        <Field label="Monthly revenue (£)"><input className="ds-input" inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></Field>
        <Field label="Gross margin (%)"><input className="ds-input" inputMode="decimal" value={margin} onChange={(e) => setMargin(e.target.value)} /></Field>
        <Field label="Lead → sale conversion (%)"><input className="ds-input" inputMode="decimal" value={conversion} onChange={(e) => setConversion(e.target.value)} /></Field>
        <Field label="Avg. customer value (£)"><input className="ds-input" inputMode="decimal" value={customerValue} onChange={(e) => setCustomerValue(e.target.value)} /></Field>
      </div>

      <Field label="Bottleneck area"><input className="ds-input" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Sales conversion" /></Field>
      <div className="gpp-edit-grid gpp-edit-grid--rates">
        <Field label="Current rate (%)"><input className="ds-input" inputMode="decimal" value={currentRate} onChange={(e) => setCurrentRate(e.target.value)} /></Field>
        <Field label="Target rate (%)"><input className="ds-input" inputMode="decimal" value={targetRate} onChange={(e) => setTargetRate(e.target.value)} /></Field>
        <Field label="Monthly lead volume"><input className="ds-input" inputMode="numeric" value={leadVolume} onChange={(e) => setLeadVolume(e.target.value)} /></Field>
      </div>
      <Field label="Why this is the bottleneck"><textarea className="ds-textarea" value={why} onChange={(e) => setWhy(e.target.value)} rows={2} /></Field>

      <div className="ds-field">
        <span className="ds-label">Action plan</span>
        {actions.map((a, i) => (
          <div className="gpp-action-edit" key={i}>
            <input className="ds-input" placeholder="Action title" value={a.title} onChange={(e) => updateAction(i, { title: e.target.value })} />
            <input className="ds-input" placeholder="Expected impact (optional)" value={a.expectedImpact ?? ""} onChange={(e) => updateAction(i, { expectedImpact: e.target.value })} />
            <Button variant="ghost" size="sm" iconOnly aria-label="Remove action" onClick={() => removeAction(i)}>×</Button>
          </div>
        ))}
        {actions.length < 8 && <Button variant="ghost" size="sm" onClick={addAction}>+ Add action</Button>}
      </div>

      {error && <p className="ds-help" style={{ color: "var(--ds-danger)" }}>{error}</p>}

      <div className="gpp-edit-actions">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant="primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
      </div>
    </div>
  );
}

export default function GrowthPlanPage() {
  // Honour a ?ws=<id> deep-link (a coach opening a specific client's plan),
  // same convention as app/business/constraint/page.tsx. Captured once
  // (lazy) to avoid a server/client hydration mismatch.
  const [wsParam] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("ws") ?? undefined;
  });
  const enrollment = useEnrollment(wsParam);

  const [planState, setPlanState] = useState<LoadState>("loading");
  const [submission, setSubmission] = useState<Chapter4Submission | null>(null);
  const [editing, setEditing] = useState(false);

  // PDF download state
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfMsg, setPdfMsg] = useState("");

  // Share link state
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const loadPlan = useCallback(async () => {
    if (!enrollment.wsId) return;
    setPlanState("loading");
    try {
      const r = await fetch(`/api/programme/chapter/4/get?ws=${encodeURIComponent(enrollment.wsId)}`, { credentials: "include" });
      if (r.status === 401) { setPlanState("not-authenticated"); return; }
      if (!r.ok) { setPlanState("error"); return; }
      const data = (await r.json()) as { submission: Chapter4Submission | null };
      setSubmission(data.submission);
      setPlanState("ok");
    } catch {
      setPlanState("error");
    }
  }, [enrollment.wsId]);

  useEffect(() => { void loadPlan(); }, [loadPlan]);

  const downloadPdf = useCallback(async () => {
    if (!enrollment.wsId) return;
    setPdfBusy(true);
    setPdfMsg("");
    try {
      const r = await fetch(`/api/programme/chapter/4/pdf?ws=${encodeURIComponent(enrollment.wsId)}`, { credentials: "include" });
      if (!r.ok) { setPdfMsg("Could not download the PDF."); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `growth-plan-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setPdfMsg("Downloaded.");
      setTimeout(() => setPdfMsg(""), 2000);
    } catch {
      setPdfMsg("Could not download the PDF — check your connection.");
    } finally {
      setPdfBusy(false);
    }
  }, [enrollment.wsId]);

  const generateShareLink = useCallback(async () => {
    if (!enrollment.wsId) return;
    setShareBusy(true);
    setShareErr("");
    setCopyMsg("");
    try {
      const r = await fetch(`/api/growth-plan/share?ws=${encodeURIComponent(enrollment.wsId)}`, { method: "POST", credentials: "include" });
      const d = (await r.json()) as { url?: string; expiresAt?: number; error?: string };
      if (!r.ok || !d.url) { setShareErr(d.error ?? "Could not create a share link."); return; }
      setShareUrl(d.url);
    } catch {
      setShareErr("Could not create a share link.");
    } finally {
      setShareBusy(false);
    }
  }, [enrollment.wsId]);

  const copyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMsg("Link copied.");
      window.setTimeout(() => setCopyMsg(""), 2000);
    } catch {
      setCopyMsg(shareUrl);
    }
  }, [shareUrl]);

  const revokeShareLink = useCallback(() => {
    setShareUrl(null);
    setShareErr("");
    setCopyMsg("");
  }, []);

  const overallState: LoadState =
    enrollment.state === "not-authenticated" || planState === "not-authenticated" ? "not-authenticated"
    : enrollment.state === "error" || planState === "error" ? "error"
    : enrollment.state === "loading" || (enrollment.wsId != null && planState === "loading") ? "loading"
    : "ok";

  const plan = submission ? formatPlan(submission) : null;
  const canEdit = enrollment.role != null && enrollment.role !== "viewer";
  const canShare = enrollment.role === "owner" && plan?.status === "approved";

  const actions = (
    <>
      {plan && (
        <>
          <Button variant="secondary" size="sm" disabled={pdfBusy} onClick={() => void downloadPdf()}>
            {pdfBusy ? "Generating…" : "Download PDF"}
          </Button>
          {pdfMsg && <span className="gpp-msg">{pdfMsg}</span>}

          {canShare ? (
            shareUrl ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ds-btn ds-btn--ghost ds-btn--sm gpp-share-link"
                  style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {shareUrl}
                </a>
                <Button variant="ghost" size="sm" onClick={() => void copyShareUrl()} disabled={shareBusy}>
                  Copy
                </Button>
                <Button variant="ghost" size="sm" onClick={revokeShareLink} disabled={shareBusy}>
                  New link
                </Button>
                {copyMsg && <span className="gpp-msg">{copyMsg}</span>}
              </div>
            ) : (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={shareBusy}
                  onClick={() => void generateShareLink()}
                >
                  {shareBusy ? "Creating link…" : "Get share link (24h)"}
                </Button>
                {shareErr && <span className="gpp-msg gpp-msg--error">{shareErr}</span>}
              </>
            )
          ) : plan?.status !== "approved" ? (
            <span className="ds-help">Share link available after coach approval</span>
          ) : null}
        </>
      )}

      {plan?.status === "approved" && canEdit && !editing && (
        <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
          Edit plan
        </Button>
      )}
      <a href="/programme" className="ds-btn ds-btn--ghost ds-btn--sm no-print">
        ← Programme
      </a>
    </>
  );

  return (
    <PageShell
      className="gpp"
      maxWidth={860}
      eyebrow="Chapter 4 — Improve & Scale"
      title="Growth & Improvement Plan"
      subtitle="Your current position, the single biggest constraint on growth, the actions that close it, and the impact you can expect over the next 90 days."
      actions={<span className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</span>}
    >
      <style>{CSS}</style>

      {overallState === "loading" && (
        <div className="gpp-panel">
          <div className="gpp-spinner" />
          <p className="ds-body">Loading your Growth & Improvement Plan…</p>
        </div>
      )}

      {overallState === "not-authenticated" && (
        <Notice icon="lock" title="Sign in to see your plan" body="Sign in to view your Growth & Improvement Plan." href="/" cta="Sign in" />
      )}

      {overallState === "error" && (
        <Notice icon="warning" title="Something went wrong" body="Couldn't load your Growth & Improvement Plan." onRetry={() => void loadPlan()} />
      )}

      {overallState === "ok" && !plan && (
        <EmptyState
          icon="rocket"
          title="Chapter 4 hasn't been started yet"
          description="Work through Find the Bottleneck, Improve Conversion, Improve Profit, Systemise & Automate and Build the Growth Plan in the programme to generate your plan here."
          action={<a className="ds-btn ds-btn--primary ds-btn--sm" href="/programme">Go to the programme</a>}
        />
      )}

      {overallState === "ok" && plan && !editing && (
        <GrowthImprovementPlan plan={plan} />
      )}

      {overallState === "ok" && plan && editing && enrollment.wsId && (
        <EditPlanForm
          wsId={enrollment.wsId}
          initial={plan}
          onCancel={() => setEditing(false)}
          onSaved={(s) => { setSubmission(s); setEditing(false); }}
        />
      )}
    </PageShell>
  );
}

const CSS = `
.gpp .gpp-panel{ background:var(--ds-surface); border:1px solid var(--ds-border-subtle); border-radius:var(--ds-radius-lg); padding:40px 22px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; }
.gpp .gpp-spinner{ width:26px; height:26px; border:3px solid var(--ds-border-default); border-top-color:var(--ds-brand); border-radius:50%; animation:gpp-spin .8s linear infinite; }
@keyframes gpp-spin{ to{ transform:rotate(360deg); } }

.gpp .gpp-msg{ font-size:12px; color:var(--ds-success); font-weight:600; }
.gpp .gpp-msg--error{ color:var(--ds-danger); }
.gpp .gpp-share-link{ max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

.gpp .gpp-edit-card{ display:flex; flex-direction:column; gap:14px; background:var(--ds-surface); border:1px solid var(--ds-border-default); border-radius:var(--ds-radius-xl); padding:22px 24px; }
.gpp .gpp-edit-grid{ display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; }
.gpp .gpp-edit-grid--rates{ grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); }
.gpp .gpp-action-edit{ display:grid; grid-template-columns:1fr 1fr auto; gap:8px; align-items:center; margin-bottom:8px; }
.gpp .gpp-edit-actions{ display:flex; justify-content:flex-end; gap:8px; margin-top:6px; }

@media (max-width: 520px){
  .gpp .gpp-action-edit{ grid-template-columns:1fr; }
}

@media print{
  .no-print{ display:none !important; }
}
`;
