"use client";
/**
 * Presentation & trust — the fourth Psychology area. A guided self-audit of the
 * landing-page essentials that decide whether a visitor trusts you enough to
 * act. Check state persists client-side; the visual build itself lives in Brand.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRESENTATION_GROUPS, itemsByGroup, scorePresentation, sanitizeCheckedIds } from "../../../lib/studio/presentation";

// localStorage stays as a fast, offline cache (the persuasion-score readers
// read it), but the source of truth is now the workspace so the checklist —
// and the presentation part of the persuasion score — follows the owner across
// devices.
const STORAGE_KEY = "ov-presentation-checked";
const cache = (ids: string[]) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* ignore */ } };

// Per-group presentation: a token-based accent colour + a plain-language line
// that tells the owner WHY this group of checks earns trust. Purely visual/
// copy metadata — the items and scoring still come from lib/studio/presentation.
type GroupAccent = "info" | "trust" | "craft";
const GROUP_META: Record<string, { accent: GroupAccent; why: string }> = {
  Clarity: { accent: "info", why: "Can a stranger tell what you offer — and what to do next — within five seconds?" },
  Trust: { accent: "trust", why: "Give visitors real reasons to believe you before you ask them to act." },
  Craft: { accent: "craft", why: "Small touches of polish signal you sweat the details — and can be trusted with theirs." },
};
const GROUP_DEFAULT = { accent: "trust" as GroupAccent, why: "" };

// Geometry for the readiness ring in the header (r = 16 in a 40×40 viewBox).
const RING_C = 2 * Math.PI * 16;

export default function PresentationPage() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);

  // Load from the server; if the server is empty but this browser has old local
  // checks, migrate them up once. Falls back to the local cache when offline.
  useEffect(() => {
    let live = true;
    (async () => {
      let local: string[] = [];
      try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) local = sanitizeCheckedIds(JSON.parse(raw)); } catch { /* ignore */ }
      try {
        const r = await fetch("/api/business/presentation", { credentials: "include" });
        if (r.ok) {
          const server = sanitizeCheckedIds((await r.json())?.checked);
          if (server.length === 0 && local.length > 0) {
            // migrate the local checklist to the workspace
            void fetch("/api/business/presentation", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ checked: local }) }).catch(() => {});
            if (live) setChecked(new Set(local));
          } else {
            cache(server);
            if (live) setChecked(new Set(server));
          }
        } else if (live) {
          setChecked(new Set(local));
        }
      } catch { if (live) setChecked(new Set(local)); }
      if (live) setReady(true);
    })();
    return () => { live = false; };
  }, []);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: Set<string>) => {
    const ids = [...next];
    cache(ids);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch("/api/business/presentation", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ checked: ids }) }).catch(() => {});
    }, 500);
  }, []);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persist(next);
      return next;
    });
  };

  const health = useMemo(() => scorePresentation(checked), [checked]);
  const tone = health.score >= 80 ? "good" : health.score >= 50 ? "warn" : "bad";

  // A warm, plain-language line under the progress bar — meets the owner where
  // they are so the checklist feels like coaching, not a grade.
  const bandCopy =
    health.done === 0
      ? "Nothing checked yet — start at the top: could a stranger tell what you offer in five seconds?"
      : health.score === 100
      ? "Every essential is checked — you look like the obvious choice. Time to build it in Brand."
      : tone === "good"
      ? "Looking sharp. Clear the last few and this page is ready to earn trust."
      : tone === "warn"
      ? "Good momentum. Tighten the rest before you send real traffic to it."
      : "Early days — each check makes your page a little more convincing.";

  return (
    <div className="pres-root">
      <style>{CSS}</style>
      <div className="hub-header">
        <div className="hub-heading">
          <div className="eyebrow">PSYCHOLOGY · PRESENTATION &amp; TRUST</div>
          <h1>Look like the obvious choice</h1>
          <p className="sub">Great copy dies on a page that looks untrustworthy. Work through these essentials — then build the visuals in <a href="/campaign-studio/brand">Brand</a>.</p>
        </div>
        <div className={`score s-${tone}`} role="img" aria-label={`Presentation readiness: ${ready ? `${health.score} out of 100, ${health.done} of ${health.total} essentials ready` : "loading"}.`}>
          <div className="ring">
            <svg viewBox="0 0 40 40" aria-hidden="true">
              <circle className="ring-bg" cx="20" cy="20" r="16" />
              <circle className="ring-fg" cx="20" cy="20" r="16" style={{ strokeDasharray: RING_C, strokeDashoffset: ready ? RING_C * (1 - health.score / 100) : RING_C }} />
            </svg>
            <span className="ring-n">{ready ? health.score : "—"}</span>
          </div>
          <span className="score-cap">{ready ? `${health.done}/${health.total} ready` : "loading"}</span>
        </div>
      </div>

      {ready && (
        <div className={`band s-${tone}`}>
          <div className="band-top">
            <span className="band-label">You&rsquo;re <b>{health.score}%</b> presentation-ready</span>
            <span className="band-count">{health.done} of {health.total} essentials</span>
          </div>
          <div className="track" role="progressbar" aria-valuenow={health.score} aria-valuemin={0} aria-valuemax={100} aria-label="Overall presentation readiness">
            <div className="track-fill" style={{ width: `${health.score}%` }} />
          </div>
          <p className="band-msg">{bandCopy}</p>
        </div>
      )}

      {ready ? (
        PRESENTATION_GROUPS.map((g) => {
          const items = itemsByGroup(g);
          const done = items.reduce((n, it) => n + (checked.has(it.id) ? 1 : 0), 0);
          const total = items.length;
          const complete = total > 0 && done === total;
          const meta = GROUP_META[g] ?? GROUP_DEFAULT;
          return (
            <section className={`card${complete ? " complete" : ""}`} data-accent={meta.accent} key={g} aria-label={`${g}: ${done} of ${total} checked`}>
              <div className="card-h">
                <div className="card-h-main">
                  <span className="card-eyebrow">{g}</span>
                  <span className="card-why">{meta.why}</span>
                </div>
                <span className={`count${complete ? " done" : ""}`}>{complete ? "All set ✓" : `${done}/${total}`}</span>
              </div>
              <div className="gtrack" aria-hidden="true"><div className="gtrack-fill" style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
              <div className="items">
                {items.map((it) => {
                  const on = checked.has(it.id);
                  return (
                    <button type="button" className={`item${on ? " on" : ""}`} key={it.id} onClick={() => toggle(it.id)} aria-pressed={on}>
                      <span className="box" aria-hidden="true">{on ? "✓" : ""}</span>
                      <span className="it-body"><span className="it-label">{it.label}</span><span className="it-hint">{it.hint}</span></span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        <div className="loading" role="status" aria-live="polite">Loading your checklist&hellip;</div>
      )}

      <p className="foot">This checklist saves to your workspace and follows you across devices. The actual design work — hero, proof blocks, brand — lives in <a href="/campaign-studio/brand">Brand &amp; Presentation</a>.</p>
    </div>
  );
}

const CSS = `
.pres-root{
  /* All colour comes from the shared, theme-aware design-system tokens so the
     page adapts to both the light and the navy dark theme automatically. */
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
.pres-root *{box-sizing:border-box;}

/* ---- Header ---- */
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px 20px;flex-wrap:wrap;margin-bottom:16px;}
.hub-heading{min-width:0;flex:1 1 260px;}
.hub-header h1{font-size:26px;font-weight:700;margin:5px 0 6px;letter-spacing:-.5px;line-height:1.15;}
.eyebrow{display:inline-flex;align-items:center;gap:7px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eyebrow::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ds-brand);box-shadow:0 0 0 3px var(--ds-brand-soft);}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:66ch;line-height:1.55;}
.sub a{color:var(--ds-brand-hover);font-weight:500;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px;transition:color .15s;}
.sub a:hover{color:var(--ds-brand-active);}

/* ---- Readiness ring ---- */
.score{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;}
.ring{position:relative;width:74px;height:74px;}
.ring svg{width:100%;height:100%;transform:rotate(-90deg);}
.ring-bg{fill:none;stroke:var(--ds-border-default);stroke-width:4;}
.ring-fg{fill:none;stroke:currentColor;stroke-width:4;stroke-linecap:round;transition:stroke-dashoffset .6s var(--ds-ease,cubic-bezier(.2,.7,.3,1));}
.ring-n{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:23px;font-weight:700;letter-spacing:-1px;color:var(--text);}
.score-cap{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);}
.score.s-good{color:var(--ds-success);}
.score.s-warn{color:var(--ds-warning);}
.score.s-bad{color:var(--ds-danger);}

/* ---- Progress band ---- */
.band{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);box-shadow:var(--ds-shadow-xs);padding:14px 16px;margin-bottom:16px;}
.band-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px 14px;flex-wrap:wrap;margin-bottom:9px;}
.band-label{font-size:13.5px;color:var(--text);font-weight:500;}
.band-label b{font-weight:700;}
.band-count{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);}
.track{height:10px;border-radius:999px;background:var(--ds-bg-subtle);border:1px solid var(--border);overflow:hidden;}
.track-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--ds-brand),var(--ds-brand-hover));box-shadow:0 0 0 1px rgba(0,0,0,.02) inset;transition:width .55s var(--ds-ease,cubic-bezier(.2,.7,.3,1));min-width:0;}
.band.s-good .track-fill{background:linear-gradient(90deg,var(--ds-success),var(--ds-brand));}
.band-msg{font-size:12.5px;color:var(--ds-text-tertiary);line-height:1.5;margin:9px 0 0;}

/* ---- Group cards (accent-tinted, theme-aware) ---- */
.card{position:relative;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--accent,var(--ds-border-default));border-radius:var(--ds-radius-lg);padding:14px 16px 16px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;transition:box-shadow .15s var(--ds-ease,ease),transform .15s var(--ds-ease,ease);}
.card:hover{box-shadow:var(--ds-shadow-sm);transform:translateY(-1px);}
.card[data-accent="info"]{--accent:var(--ds-info);--accent-soft:var(--ds-info-soft);}
.card[data-accent="trust"]{--accent:var(--ds-brand);--accent-soft:var(--ds-brand-soft);}
.card[data-accent="craft"]{--accent:var(--ds-warning);--accent-soft:var(--ds-warning-soft);}
.card.complete{--accent:var(--ds-success);--accent-soft:var(--ds-success-soft);}
.card-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px;}
.card-h-main{display:flex;flex-direction:column;gap:3px;min-width:0;}
.card-eyebrow{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--accent);}
.card-why{font-size:12.5px;color:var(--ds-text-tertiary);line-height:1.4;max-width:58ch;}
.count{flex:0 0 auto;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--ds-bg-subtle);color:var(--ds-text-secondary);border:1px solid var(--border);white-space:nowrap;transition:background .15s,color .15s,border-color .15s;}
.count.done{background:var(--accent-soft);color:var(--accent);border-color:transparent;}
.gtrack{height:4px;border-radius:999px;background:var(--ds-bg-subtle);overflow:hidden;margin:0 0 12px;}
.gtrack-fill{height:100%;border-radius:999px;background:var(--accent);transition:width .45s var(--ds-ease,cubic-bezier(.2,.7,.3,1));}

/* ---- Check items ---- */
.items{display:flex;flex-direction:column;gap:8px;}
.item{display:flex;align-items:flex-start;gap:12px;width:100%;text-align:left;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:10px;padding:12px 14px;cursor:pointer;font-family:inherit;transition:border-color .15s var(--ds-ease,ease),background .15s,box-shadow .15s,transform .15s;}
.item:hover{border-color:var(--border-strong);background:var(--surface);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);}
.item:active{transform:translateY(0);box-shadow:none;}
.item:focus-visible{outline:2px solid var(--accent,var(--ds-brand));outline-offset:2px;}
.item.on{background:var(--ds-brand-soft);border-color:var(--ds-brand);}
.item.on:hover{border-color:var(--ds-brand-hover);}
.box{flex:0 0 auto;width:22px;height:22px;border-radius:6px;border:2px solid var(--border-strong);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--ds-brand-contrast);background:var(--surface);transition:background .15s,border-color .15s;}
.item.on .box{background:var(--ds-brand);border-color:var(--ds-brand);animation:pres-pop .22s var(--ds-ease,cubic-bezier(.2,.7,.3,1));}
.it-body{display:flex;flex-direction:column;gap:2px;min-width:0;}
.it-label{font-size:14px;font-weight:500;color:var(--text);line-height:1.35;transition:color .15s;}
.item.on .it-label{color:var(--ds-brand-active);}
.it-hint{font-size:12px;color:var(--ds-text-tertiary);line-height:1.45;}
@keyframes pres-pop{0%{transform:scale(.55);}60%{transform:scale(1.18);}100%{transform:scale(1);}}

/* ---- Loading / foot ---- */
.loading{background:var(--surface);border:1px dashed var(--border-strong);border-radius:var(--ds-radius-lg);padding:22px 16px;text-align:center;color:var(--ds-text-tertiary);font-size:13.5px;}
.foot{font-size:12.5px;color:var(--ds-text-tertiary);margin:16px 2px 0;line-height:1.5;}
.foot a{color:var(--ds-brand-hover);font-weight:500;text-decoration:underline;text-underline-offset:2px;transition:color .15s;}
.foot a:hover{color:var(--ds-brand-active);}

@media (max-width:520px){
  .hub-header{gap:14px;}
  .score{flex-direction:row;align-items:center;gap:12px;}
}
@media (prefers-reduced-motion: reduce){
  .pres-root *,.pres-root *::before,.pres-root *::after{transition:none!important;animation:none!important;}
}
`;
