"use client";
/**
 * Swipe Library — proven copy formulas that adapt to the owner's saved Message.
 * Part of the Psychology pillar. Each swipe fills from the Message (with clear
 * [hints] where it's still blank) and copies in one click.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useToast } from "../../../components/Toast";
import { SWIPES, SWIPE_CATEGORIES, fillSwipe, type SwipeCategory } from "../../../lib/studio/swipe-library";
import type { MessageInput } from "../../../lib/studio/message-copy";
import { copyText } from "../../../lib/clipboard";

type Filter = "All" | SwipeCategory;

/** One plain-language line per category — shown when that filter is active so
 *  browsing a type also teaches what the type is for (this is a coaching app;
 *  a name alone can leave a founder guessing). */
const CATEGORY_BLURB: Record<SwipeCategory, string> = {
  Headlines: "top-of-page promises that earn the first read.",
  Hooks: "openers that stop the scroll and pull the reader in.",
  Offer: "frame what they get — and why it's safe to say yes.",
  Story: "cast the reader as the hero of a tiny narrative.",
  Ads: "punchy lines built for cold traffic and the feed.",
  Email: "low-pressure openers and P.S. lines that earn replies.",
};

/** How many swipes live in each category — a small count on every filter so the
 *  library is easy to scan before you click in. Computed once (SWIPES is static). */
const CATEGORY_COUNTS: Record<string, number> = SWIPES.reduce<Record<string, number>>((acc, s) => {
  acc[s.category] = (acc[s.category] ?? 0) + 1;
  return acc;
}, {});

export default function SwipeLibraryPage() {
  const toast = useToast();
  const [msg, setMsg] = useState<MessageInput | null>(null);
  const [filter, setFilter] = useState<Filter>("All");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/business/message", { credentials: "include" });
      if (!r.ok) return;
      setMsg((await r.json()) as MessageInput);
    } catch { /* non-critical — swipes still render with [hints] */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const hasMessage = useMemo(() => {
    const o = msg?.oneLiner;
    return !!(o?.problem || o?.solution || o?.result || msg?.character || msg?.wants);
  }, [msg]);

  const shown = useMemo(() => (filter === "All" ? SWIPES : SWIPES.filter((s) => s.category === filter)), [filter]);

  const copy = async (id: string, text: string) => {
    if (await copyText(text)) {
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? "" : c)), 1600);
      toast("Copied — paste it and finish any [bracketed] bits.");
    } else toast("Couldn't copy — select the text and copy manually.", "error");
  };

  return (
    <div className="swipe-root">
      <style>{CSS}</style>
      <div className="hub-header">
        <div>
          <div className="eyebrow"><span className="eb-spark" aria-hidden>✦</span> PSYCHOLOGY · SWIPE LIBRARY</div>
          <h1>Never start from a <span className="sw-grad">blank page</span></h1>
          <p className="sub">Proven copy formulas, filled in with <b>your</b> Message. Anything the Message hasn&rsquo;t answered shows as a <span className="hint-chip">[hint]</span> to complete.</p>
        </div>
        <a href="/psychology" className="btn ghost">← Psychology</a>
      </div>

      {!hasMessage && (
        <div className="notice" role="note">
          <span className="notice-ic" aria-hidden>◎</span>
          <p>These fill in from your Message. <a href="/business/message">Write your one-liner &amp; story →</a> and every swipe below adapts to your own words.</p>
        </div>
      )}

      {/* How it works — teaches the two chips and the one-click flow up front, so
          the page reads as a set of drafts to finish, never as broken text. */}
      <div className="sw-how" aria-label="How the swipe library works">
        <span className="sw-how-item"><span className="hint-chip">[hint]</span> a blank to finish in your words</span>
        <span className="sw-how-item"><span className="pill-ready">Ready</span> fully built from your Message</span>
        <span className="sw-how-item"><span className="sw-how-key">Copy</span> paste it anywhere, then tidy the brackets</span>
      </div>

      <div className="filters" role="group" aria-label="Filter formulas by type">
        {(["All", ...SWIPE_CATEGORIES] as Filter[]).map((f) => (
          <button
            key={f}
            className={`filter${filter === f ? " on" : ""}${f === "All" ? "" : " cat-" + f}`}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            <span>{f}</span>
            <span className="filter-n" aria-hidden>{f === "All" ? SWIPES.length : (CATEGORY_COUNTS[f] ?? 0)}</span>
          </button>
        ))}
      </div>

      <div className={`sw-context${filter === "All" ? " all" : " cat-" + filter}`} aria-live="polite">
        <strong>{shown.length}</strong>{" "}
        {filter === "All"
          ? `proven formulas across ${SWIPE_CATEGORIES.length} types — browse them all, or filter above.`
          : <>{filter} — {CATEGORY_BLURB[filter]}</>}
      </div>

      <div className="swipes" role="list" aria-label={filter === "All" ? "All copy formulas" : `${filter} copy formulas`}>
        {shown.map((s) => {
          const { text, filled, total } = fillSwipe(s.template, msg);
          const complete = total === 0 || filled === total;
          return (
            <div className={`swipe cat-${s.category}`} role="listitem" key={s.id}>
              <div className="sw-top">
                <div className="sw-id">
                  <span className="sw-cat">{s.category}</span>
                  <span className="sw-name">{s.name}</span>
                </div>
                <button
                  className={`sw-copy${copied === s.id ? " is-copied" : ""}`}
                  onClick={() => void copy(s.id, text)}
                  aria-label={copied === s.id ? "Copied to clipboard" : `Copy the ${s.name} formula`}
                >
                  {copied === s.id ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <p className="sw-text">{renderWithHints(text)}</p>
              <div className="sw-foot">
                <span className="sw-note">{s.note}</span>
                {total > 0 && <span className={`sw-fill${complete ? " done" : ""}`}>{complete ? "Ready" : `${filled}/${total} from your Message`}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Render [bracketed hints] as visually distinct chips inside the swipe text. */
function renderWithHints(text: string): ReactNode {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((p, i) => (/^\[[^\]]+\]$/.test(p) ? <span className="hint-chip" key={i}>{p}</span> : <span key={i}>{p}</span>));
}

const CSS = `
.swipe-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-border-strong:#cbd5e1;
  --ds-radius-lg:12px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:1000px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .swipe-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.swipe-root *{box-sizing:border-box;}

/* Header — spark eyebrow, a quiet brand→info gradient on the memorable phrase,
   and a back button that lifts on hover so it reads as interactive. */
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px;}
.hub-header h1{font-size:27px;font-weight:700;margin:3px 0 6px;letter-spacing:-.5px;}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.eb-spark{color:var(--ds-brand);font-size:12px;line-height:1;}
.sw-grad{background-image:linear-gradient(92deg,var(--ds-brand),var(--ds-info));color:var(--ds-brand);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.sw-grad{color:transparent;-webkit-background-clip:text;background-clip:text;}}
.sub{color:var(--muted);font-size:14px;margin:0;max-width:70ch;line-height:1.55;}
.sub b{color:var(--text);font-weight:700;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:10px;padding:9px 14px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.swipe-root .hub-header a.btn{transition:transform .15s var(--ds-ease,ease),background .15s,border-color .15s,color .15s,box-shadow .15s;}
.swipe-root .hub-header a.btn:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));color:var(--text);}

/* Inline "hint" chip — amber, because a [hint] is a blank still asking to be
   filled. Uses the warning tokens so it adapts to both themes automatically. */
.hint-chip{display:inline;background:var(--ds-warning-soft);color:var(--ds-warning);border-radius:5px;padding:0 5px;font-size:.92em;font-weight:600;}

/* No-Message nudge — a calm blue "informational" cue (not an alarm) with an icon,
   pointing to the one page that makes every swipe below fill in. */
.notice{display:flex;align-items:flex-start;gap:10px;background:var(--ds-info-soft);border:1px solid color-mix(in srgb,var(--ds-info) 26%,transparent);border-radius:var(--ds-radius-md,11px);padding:11px 14px;font-size:13px;line-height:1.5;color:var(--muted);margin-bottom:14px;}
.notice p{margin:0;}
.notice-ic{flex:0 0 auto;color:var(--ds-info);font-weight:700;line-height:1.5;}
.notice a{color:var(--ds-info);font-weight:600;text-decoration:underline;text-underline-offset:2px;}

/* How-it-works legend — shows the two live chips plus the one-click flow, so a
   first-time visitor knows what the colours and the Copy button mean. */
.sw-how{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;background:var(--ds-bg-subtle);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-md,11px);padding:10px 14px;margin-bottom:16px;font-size:12.5px;color:var(--muted);line-height:1.4;}
.sw-how-item{display:inline-flex;align-items:center;gap:7px;}
.pill-ready{font-size:10.5px;font-weight:700;color:var(--ds-brand);background:var(--ds-brand-soft);border-radius:20px;padding:2px 9px;}
.sw-how-key{font-size:11px;font-weight:700;color:var(--ds-brand);background:var(--ds-brand-soft);border-radius:6px;padding:2px 8px;}

/* Filters — rounded pills carrying a live count so the library is scannable at a
   glance. Active pill glows in its category colour (soft tint + colour text/
   border, AA in both themes); every pill lifts on hover. */
.filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}
.filter{--c:var(--ds-brand);display:inline-flex;align-items:center;gap:7px;background:var(--surface);border:1px solid var(--border-strong);color:var(--muted);border-radius:99px;padding:6px 10px 6px 14px;font-size:12.5px;font-weight:600;cursor:pointer;transition:transform .15s var(--ds-ease,ease),background .15s,border-color .15s,color .15s,box-shadow .15s;}
.filter:hover{border-color:var(--c);color:var(--text);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.filter:focus-visible{outline:2px solid var(--c);outline-offset:2px;}
.filter.on{background:color-mix(in srgb,var(--c) 12%,var(--ds-surface));border-color:var(--c);color:var(--c);}
.filter-n{font-size:10.5px;font-weight:700;line-height:1;padding:2px 6px;border-radius:99px;background:var(--ds-bg-subtle);color:var(--ds-text-tertiary);}
.filter.on .filter-n{background:color-mix(in srgb,var(--c) 20%,transparent);color:var(--c);}

/* Context band — restates the count and, for a chosen type, its plain-language
   purpose, tinted in that type's colour. Neutral surface for "All". */
.sw-context{--c:var(--ds-brand);border-radius:var(--ds-radius-md,11px);padding:9px 13px;font-size:12.5px;line-height:1.45;margin-bottom:14px;}
.sw-context strong{color:var(--c);font-weight:700;}
.sw-context.all{background:var(--ds-bg-subtle);border:1px solid var(--ds-border-subtle);color:var(--muted);}
.sw-context.all strong{color:var(--text);}
.sw-context:not(.all){background:color-mix(in srgb,var(--c) 6%,var(--ds-surface));border:1px solid color-mix(in srgb,var(--c) 24%,transparent);border-left:3px solid var(--c);color:var(--muted);}

/* Cards — a category-coloured left edge for at-a-glance sorting, and a gentle
   lift on hover so each reads as a grab-and-go card. */
.swipes{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:720px){.swipes{grid-template-columns:1fr;}}
.swipe{--c:var(--ds-brand);background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--c);border-radius:var(--ds-radius-lg);padding:15px 17px;box-shadow:var(--ds-shadow-xs);display:flex;flex-direction:column;transition:transform .15s var(--ds-ease,ease),box-shadow .15s,border-color .15s;}
.swipe:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));}
.sw-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px;}
.sw-id{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;}
.sw-cat{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--c);background:color-mix(in srgb,var(--c) 13%,transparent);border-radius:20px;padding:2px 8px;}
.sw-name{font-size:13.5px;font-weight:700;color:var(--text);}
/* Copy button — brand-solid fill (fixed dark green, AA under white in BOTH
   themes) that turns a soft success-green when it lands. */
.sw-copy{flex:0 0 auto;background:var(--ds-brand-solid);color:var(--ds-brand-contrast);border:1px solid transparent;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s,transform .06s ease,box-shadow .15s;}
.sw-copy:hover{background:var(--ds-brand-solid-hover);transform:translateY(-1px);box-shadow:0 2px 8px -2px color-mix(in srgb,var(--ds-brand) 50%,transparent);}
.sw-copy:active{transform:translateY(0.5px) scale(.99);}
.sw-copy:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.sw-copy.is-copied{background:var(--ds-success-soft);color:var(--ds-success);border-color:color-mix(in srgb,var(--ds-success) 30%,transparent);box-shadow:none;}
.sw-copy.is-copied:hover{transform:none;box-shadow:none;background:var(--ds-success-soft);}
.sw-text{font-size:14px;line-height:1.55;color:var(--text);margin:0 0 12px;flex:1;}
.sw-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;}
.sw-note{font-size:11.5px;color:var(--ds-text-tertiary);line-height:1.4;flex:1;min-width:0;}
/* Fill status — amber while the Message still owes it words, brand-green once
   the whole formula is built. Token-driven, so both read right in dark mode. */
.sw-fill{flex:0 0 auto;font-size:10.5px;font-weight:700;color:var(--ds-warning);background:var(--ds-warning-soft);border-radius:20px;padding:2px 9px;}
.sw-fill.done{color:var(--ds-brand);background:var(--ds-brand-soft);}

/* Per-category accent — one theme-aware token per type, reused by the filter
   pills, the context band and every card so a colour reads as "this type"
   everywhere on the page. Defined LAST so, at equal (single-class) specificity,
   this .cat-* value wins the shared --c over the .swipe / .filter / .sw-context
   base declarations for any element carrying both classes. */
.cat-Headlines{--c:var(--ds-brand);}
.cat-Hooks{--c:var(--ds-info);}
.cat-Offer{--c:var(--ds-warning);}
.cat-Story{--c:var(--ds-success);}
.cat-Ads{--c:var(--ds-danger);}
.cat-Email{--c:var(--ds-info);}

@media (prefers-reduced-motion: reduce){.swipe-root *{transition:none!important;animation:none!important;}}
`;
