"use client";
/**
 * Your Transformation Report — the programme's closing artifact. Reads
 * /api/account/transformation-report (compiled server-side from the
 * workspace's enrollment, chapter submissions, and Business-OS tools — see
 * lib/reports/transformation-report.ts) and renders it as three sections:
 * the journey so far, what Chapter 4 (IMPROVE & SCALE) says to improve next,
 * and the next 90 days. Export to PDF, a 24-hour share link, and emailing a
 * copy to yourself all work from the SAME compiled report so every surface
 * agrees on the numbers.
 *
 * Styled with the shared design-system tokens, matching
 * app/business/constraint/page.tsx's structure (Shell + scoped <style>, a
 * captured ?ws= deep-link, loading/error states via Notice).
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import TransformationReportPDF from "../../../components/reports/TransformationReportPDF";
import type { TransformationReport, JourneyStep } from "../../../lib/reports/transformation-report";

type ViewState = "loading" | "ok" | "not-authenticated" | "forbidden" | "rate-limited" | "error";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}
function fmtDateTime(when: string | number): string {
  const d = new Date(when);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function retryLabel(seconds: number): string {
  if (seconds <= 60) return "in under a minute";
  const mins = Math.ceil(seconds / 60);
  return `in about ${mins} minute${mins === 1 ? "" : "s"}`;
}

const GATE_LABEL: Record<JourneyStep["state"], { label: string; color: string }> = {
  locked: { label: "Not reached", color: "var(--ds-text-tertiary)" },
  in_progress: { label: "In progress", color: "var(--ds-warning)" },
  ready_to_submit: { label: "Ready to submit", color: "var(--ds-info)" },
  awaiting_review: { label: "Awaiting review", color: "var(--ds-info)" },
  changes_requested: { label: "Changes requested", color: "var(--ds-danger)" },
  approved: { label: "Approved", color: "var(--ds-success)" },
};

export default function TransformationReportPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [report, setReport] = useState<TransformationReport | null>(null);
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);

  const [share, setShare] = useState<{ url: string; expiresAt: number } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareErr, setShareErr] = useState("");
  const [copyMsg, setCopyMsg] = useState("");

  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");
  const [emailErr, setEmailErr] = useState("");

  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch(`/api/account/transformation-report${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (r.status === 403) { setState("forbidden"); return; }
      if (r.status === 429) {
        const retryAfter = Number(r.headers.get("retry-after"));
        setRetryAfterSec(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 3600);
        setState("rate-limited");
        return;
      }
      if (!r.ok) { setState("error"); return; }
      const d = (await r.json()) as { report: TransformationReport };
      setReport(d.report);
      setState("ok");
    } catch {
      setState("error");
    }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  // Best-effort: only the owner can see/manage an active share link, so a
  // 403 here (a manager/editor/viewer opening this page) is silently ignored
  // — the share card below simply won't have an existing link to show.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/account/transformation-report/share${wsQuery}`, { credentials: "include" });
        if (!r.ok) return;
        const d = (await r.json()) as { active: { url: string; expiresAt: number } | null };
        if (d.active) setShare(d.active);
      } catch { /* silent — background check only */ }
    })();
  }, [wsQuery]);

  const createShare = useCallback(async () => {
    setShareBusy(true); setShareErr(""); setCopyMsg("");
    try {
      const r = await fetch(`/api/account/transformation-report/share${wsQuery}`, { method: "POST", credentials: "include" });
      const d = (await r.json()) as { url?: string; expiresAt?: number; error?: string };
      if (!r.ok || !d.url || !d.expiresAt) { setShareErr(d.error ?? "Could not create a share link."); return; }
      setShare({ url: d.url, expiresAt: d.expiresAt });
    } catch { setShareErr("Could not create a share link."); }
    finally { setShareBusy(false); }
  }, [wsQuery]);

  const revokeShare = useCallback(async () => {
    setShareBusy(true); setShareErr("");
    try {
      const r = await fetch(`/api/account/transformation-report/share${wsQuery}`, { method: "DELETE", credentials: "include" });
      if (r.ok) setShare(null);
    } catch { setShareErr("Could not revoke the share link."); }
    finally { setShareBusy(false); }
  }, [wsQuery]);

  const copyShareUrl = useCallback(async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopyMsg("Link copied.");
      window.setTimeout(() => setCopyMsg(""), 2000);
    } catch { setCopyMsg(share.url); }
  }, [share]);

  const emailReport = useCallback(async () => {
    setEmailBusy(true); setEmailErr(""); setEmailMsg("");
    try {
      const r = await fetch(`/api/account/transformation-report/email${wsQuery}`, { method: "POST", credentials: "include" });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) { setEmailErr(d.error ?? "Could not send the email."); return; }
      setEmailMsg("Sent — check your inbox.");
      window.setTimeout(() => setEmailMsg(""), 4000);
    } catch { setEmailErr("Could not send the email."); }
    finally { setEmailBusy(false); }
  }, [wsQuery]);

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Compiling your Transformation Report…</div></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="You need to be signed in to view your Transformation Report." href="/" cta="Go to sign in" /></Shell>;
  if (state === "forbidden") return <Shell><Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" /></Shell>;
  if (state === "rate-limited") {
    return (
      <Shell>
        <Notice
          icon="⚠️"
          title="Already generated this hour"
          body={`Your Transformation Report can be regenerated once an hour. Try again ${retryLabel(retryAfterSec ?? 3600)}.`}
          onRetry={() => void load()}
        />
      </Shell>
    );
  }
  if (state === "error" || !report) return <Shell><Notice icon="⚠️" title="Something went wrong" body="We couldn't compile your Transformation Report." onRetry={() => void load()} /></Shell>;

  const { account, readiness, journey, improve, next90, achievements } = report;

  return (
    <Shell>
      <div className="tr-header">
        <div>
          <div className="eyebrow">{account.status === "complete" ? "Programme complete" : "Programme in progress"}</div>
          <h1>Your Transformation Report</h1>
          <p className="sub">{account.workspaceName} · {account.programmeName}</p>
          <p className="hint">
            Generated {fmtDate(account.generatedAt)}
            {account.completedAt ? ` · Completed ${fmtDate(account.completedAt)}` : ""}
          </p>
        </div>
        <div className="header-right no-print">
          <a href="/programme" className="btn ghost sm">Back to Programme</a>
          <a href="/" className="btn ghost sm">Home</a>
        </div>
      </div>

      <div className="kpis no-print-gap">
        {kpiCard("Programme progress", `${account.overallPercent}%`, "var(--ds-brand)")}
        {readiness.current != null && kpiCard("Readiness score", String(readiness.current), "var(--ds-brand)")}
        {readiness.delta != null && kpiCard("Readiness change", `${readiness.delta >= 0 ? "+" : ""}${readiness.delta}`, readiness.delta >= 0 ? "var(--ds-success)" : "var(--ds-danger)")}
      </div>

      <div className="actions-bar no-print">
        <TransformationReportPDF report={report} />
        <div className="action-group">
          {share ? (
            <>
              <a className="btn ghost sm share-link" href={share.url} target="_blank" rel="noreferrer">{share.url}</a>
              <button className="btn ghost sm" onClick={() => void copyShareUrl()}>Copy</button>
              <button className="btn ghost sm" onClick={() => void revokeShare()} disabled={shareBusy}>Revoke</button>
              <span className="hint">Expires {fmtDateTime(share.expiresAt)}</span>
            </>
          ) : (
            <button className="btn ghost sm" onClick={() => void createShare()} disabled={shareBusy}>{shareBusy ? "Creating link…" : "Get share link (24h)"}</button>
          )}
          {copyMsg && <span className="hint ok">{copyMsg}</span>}
          {shareErr && <span className="hint err">{shareErr}</span>}
        </div>
        <div className="action-group">
          <button className="btn ghost sm" onClick={() => void emailReport()} disabled={emailBusy}>{emailBusy ? "Sending…" : "Email me this report"}</button>
          {emailMsg && <span className="hint ok">{emailMsg}</span>}
          {emailErr && <span className="hint err">{emailErr}</span>}
        </div>
      </div>

      <Section title="Your Transformation Journey" subtitle="Where you started, what you defined, what you built, and what you can now measure.">
        <div className="journey">
          {journey.map((step) => {
            const g = GATE_LABEL[step.state] ?? GATE_LABEL.locked;
            return (
              <div key={step.stageId} className="step">
                <div className="step-top">
                  <div>
                    <h3>{step.heading}</h3>
                    {step.outputName && <div className="step-output">{step.outputName}</div>}
                  </div>
                  <span className="pill" style={{ color: g.color, borderColor: g.color }}>{g.label}</span>
                </div>
                <p className="step-narrative">{step.narrative}</p>
                {step.approvedAt && <div className="step-meta">Approved {fmtDate(step.approvedAt)}</div>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="What You Will Improve" subtitle="Your Growth &amp; Improvement Plan — the single biggest constraint on growth, and where the targets are.">
        <p className="narrative">{improve.narrative}</p>
        {improve.bottleneck && (
          <div className="bottleneck-card">
            <div className="bottleneck-head">
              <span className="pill pill-accent">Bottleneck identified</span>
              <h3>{improve.bottleneck.area}</h3>
            </div>
            <div className="mini-label">Why this matters</div>
            <p>{improve.bottleneck.why}</p>
            {improve.bottleneck.relieve !== "Not documented yet." && (
              <>
                <div className="mini-label">The move to relieve it</div>
                <p>{improve.bottleneck.relieve}</p>
              </>
            )}
          </div>
        )}
        {improve.metrics.length > 0 && (
          <>
            <div className="mini-label">Current → Target metrics</div>
            <div className="metric-table">
              {improve.metrics.map((m, i) => (
                <div key={i} className="metric-row">
                  <span className="metric-label">{m.label}</span>
                  <span className="metric-current">{m.current}</span>
                  <span className="metric-arrow">→</span>
                  <span className="metric-target">{m.target}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Your Next 90 Days" subtitle={`${fmtDate(next90.windowStart)} → ${fmtDate(next90.windowEnd)}`}>
        <p className="narrative">{next90.narrative}</p>
        {next90.actions.length > 0 && (
          <>
            <div className="mini-label">Top actions</div>
            <ul className="list">
              {next90.actions.map((a, i) => (
                <li key={i}>
                  <strong>{a.title}</strong>
                  {a.owner ? ` — ${a.owner}` : ""}{a.due ? ` (due ${a.due})` : ""}
                </li>
              ))}
            </ul>
          </>
        )}
        {next90.milestones.length > 0 && (
          <>
            <div className="mini-label">Milestones &amp; expected impact</div>
            <ul className="list">
              {next90.milestones.map((m, i) => <li key={i}><strong>{m.title}</strong>{m.impact ? ` — ${m.impact}` : ""}</li>)}
            </ul>
          </>
        )}
        {next90.successCriteria.length > 0 && (
          <>
            <div className="mini-label">Success criteria</div>
            <ul className="list">{next90.successCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </>
        )}
      </Section>

      <Section title="Key Achievements">
        <ul className="list achievements">{achievements.map((a, i) => <li key={i}>{a}</li>)}</ul>
      </Section>

      <div className="footer-note">ONEVYRT · Transformation Report for {account.workspaceName} · Generated {fmtDateTime(account.generatedAt)}</div>
    </Shell>
  );
}

function kpiCard(label: string, value: string, color: string): ReactNode {
  return (
    <div className="kpi" key={label}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={{ color }}>{value}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="tr-section">
      <div className="sec-head">
        <h2>{title}</h2>
        {subtitle && <p className="hint">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="tr-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.tr-root{
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --surface:var(--ds-surface);--panel:var(--ds-surface);--accent:var(--ds-brand);
  --text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:880px;margin:0 auto;padding:26px 18px 100px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.tr-root *{box-sizing:border-box;}
.tr-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.tr-header h1{font-size:27px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.sub{color:var(--text);font-size:14px;margin:0;font-weight:500;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:2px 0 0;line-height:1.6;}
.hint.ok{color:var(--ds-success);font-weight:600;}
.hint.err{color:var(--ds-danger);font-weight:600;}
.header-right{display:flex;gap:8px;align-items:center;flex-wrap:wrap;flex:none;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;color:var(--muted);}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:var(--ds-brand-contrast);}
.share-link{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

.kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 18px;min-width:140px;box-shadow:var(--ds-shadow-xs);}
.kpi-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;}
.kpi-value{font-size:20px;font-weight:700;margin-top:2px;}

.actions-bar{display:flex;gap:12px;flex-wrap:wrap;align-items:center;background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 14px;margin-bottom:24px;}
.action-group{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}

.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:160px;text-align:center;color:var(--muted);}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.tr-section{margin-bottom:28px;}
.sec-head{margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:10px;}
.sec-head h2{font-size:18px;margin:0 0 2px;letter-spacing:-.3px;}
.narrative{font-size:13.5px;line-height:1.7;color:var(--text);margin:0 0 14px;white-space:pre-wrap;}
.mini-label{font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--ds-brand-active);margin:14px 0 6px;}

.journey{display:flex;flex-direction:column;gap:14px;}
.step{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:14px 16px;}
.step-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;}
.step h3{margin:0;font-size:15px;}
.step-output{font-size:11px;color:var(--ds-brand-active);font-weight:600;margin-top:2px;}
.step-narrative{font-size:13px;line-height:1.65;color:var(--muted);margin:8px 0 0;white-space:pre-wrap;}
.step-meta{font-size:11px;color:var(--ds-success);font-weight:600;margin-top:8px;}
.pill{font-size:10.5px;font-weight:700;border:1px solid;border-radius:999px;padding:3px 10px;white-space:nowrap;flex:none;}
.pill-accent{color:var(--ds-brand-active);border-color:var(--ds-brand);background:var(--ds-brand-soft);}

.bottleneck-card{background:var(--ds-brand-soft);border:1px solid var(--border);border-left:3px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:14px;}
.bottleneck-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;}
.bottleneck-card h3{margin:0;font-size:16px;}
.bottleneck-card p{font-size:13px;line-height:1.6;color:var(--text);margin:0 0 6px;}

.metric-table{display:flex;flex-direction:column;gap:2px;}
.metric-row{display:grid;grid-template-columns:1fr auto auto auto;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;}
.metric-label{font-weight:500;color:var(--text);}
.metric-current{color:var(--muted);}
.metric-arrow{color:var(--ds-text-tertiary);}
.metric-target{font-weight:700;color:var(--ds-brand-active);}

.list{margin:0 0 12px;padding-left:20px;font-size:13.5px;line-height:1.8;color:var(--text);}
.list.achievements{list-style:none;padding-left:0;}
.list.achievements li{padding:8px 0 8px 24px;border-bottom:1px solid var(--border);position:relative;}
.list.achievements li:last-child{border-bottom:none;}
.list.achievements li::before{content:"✓";position:absolute;left:0;color:var(--ds-success);font-weight:700;}

.footer-note{margin-top:30px;padding-top:14px;border-top:1px solid var(--border);font-size:11px;color:var(--ds-text-tertiary);text-align:center;}

@media print{
  .no-print,.no-print-gap{display:none!important;}
  .tr-root{max-width:none;padding:0;}
  .step,.bottleneck-card,.panel{box-shadow:none;}
}
@media (prefers-reduced-motion: reduce){ .tr-root *{ transition:none!important; animation:none!important; } }
`;
