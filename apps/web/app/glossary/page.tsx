"use client";
/**
 * Glossary — every term the app uses, in plain language. OneVYRT is for owners
 * who sell, not marketers who already speak the jargon, so this is a first-class
 * page (linked from every <Explain> popover): searchable, browsable A–Z, and
 * each term is deep-linkable via its own #anchor.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { glossarySorted, type GlossaryEntry } from "../../lib/studio/glossary";

export default function GlossaryPage() {
  const [q, setQ] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const all = useMemo(() => glossarySorted(), []);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((e) =>
      e.term.toLowerCase().includes(s) ||
      e.short.toLowerCase().includes(s) ||
      e.plain.toLowerCase().includes(s) ||
      (e.aliases ?? []).some((a) => a.toLowerCase().includes(s)),
    );
  }, [q, all]);

  // A–Z buckets of the full list (unaffected by the search box) — this is what
  // powers the browse view below and the "jump to a letter" nav.
  const groups = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>();
    for (const e of all) {
      const ch = e.term.trim().charAt(0).toUpperCase();
      const letter = ch >= "A" && ch <= "Z" ? ch : "#";
      const list = map.get(letter);
      if (list) list.push(e); else map.set(letter, [e]);
    }
    return Array.from(map.entries());
  }, [all]);

  const isSearching = q.trim().length > 0;

  // Press "/" anywhere on the page to jump into search — skipped whenever a
  // form field already has focus, so it never steals a keystroke meant elsewhere.
  useEffect(() => {
    function onKeyDown(ev: KeyboardEvent) {
      if (ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const target = ev.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      ev.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const clearSearch = () => { setQ(""); searchRef.current?.focus(); };
  const termWord = (n: number) => (n === 1 ? "term" : "terms");

  return (
    <div className="gl-root">
      <style>{CSS}</style>
      <div className="gl-head">
        <div className="gl-eyebrow-row">
          <div className="eyebrow">PLAIN-LANGUAGE GLOSSARY</div>
          <span className="gl-count-pill">{all.length} {termWord(all.length)}</span>
        </div>
        <h1>Every word, in plain English</h1>
        <p className="sub">No jargon left unexplained. Search a term above or browse the full A–Z list below — wherever you see a <span className="q">?</span> in the app, it links back here.</p>

        <div className="gl-searchwrap">
          <IconSearch className="gl-search-ic" />
          <input
            ref={searchRef}
            className="gl-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search — e.g. margin, positioning, break-even…"
            aria-label="Search the glossary"
            aria-keyshortcuts="/"
            type="text"
            autoComplete="off"
            spellCheck={false}
          />
          {q ? (
            <button type="button" className="gl-clear" onClick={clearSearch} aria-label="Clear search">×</button>
          ) : !searchFocused ? (
            <kbd className="gl-kbd" aria-hidden="true">/</kbd>
          ) : null}
        </div>

        {isSearching && shown.length > 0 && (
          <p className="gl-meta">{`Showing ${shown.length} of ${all.length} ${termWord(all.length)} for "${q.trim()}"`}</p>
        )}

        {!isSearching && groups.length > 1 && (
          <nav className="gl-az" aria-label="Jump to a letter">
            <span className="gl-az-label" aria-hidden="true">Jump to</span>
            {groups.map(([letter]) => (
              <a key={letter} href={`#${anchorId(letter)}`} className="gl-az-pill">{letter}</a>
            ))}
          </nav>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="gl-empty">
          <IconSearch className="gl-empty-ic" size={26} />
          <p className="gl-empty-title" role="status" aria-live="polite">{q.trim() ? `No term matches "${q.trim()}"` : "No glossary terms yet"}</p>
          <p className="gl-empty-sub">Try a shorter word, a different spelling, or clear the search to browse the full A–Z list.</p>
          {isSearching && <button type="button" className="gl-empty-clear" onClick={clearSearch}>Clear search</button>}
        </div>
      ) : isSearching ? (
        <div className="gl-results">
          <h2 className="gl-sr-only">Search results</h2>
          <div className="gl-list">
            {shown.map((e) => <Entry key={e.term} e={e} q={q} />)}
          </div>
        </div>
      ) : (
        <div className="gl-groups">
          {groups.map(([letter, entries]) => (
            <div key={letter} className="gl-group">
              <h2 className="gl-letter" id={anchorId(letter)}>{letter}</h2>
              <div className="gl-list">
                {entries.map((e) => <Entry key={e.term} e={e} q={q} />)}
              </div>
            </div>
          ))}
          <p className="gl-footer-note">That's the full list — {all.length} {termWord(all.length)} today, and it grows as OneVYRT does.</p>
        </div>
      )}
    </div>
  );
}

function Entry({ e, q }: { e: GlossaryEntry; q: string }) {
  const slug = slugify(e.term);
  const aliases = (e.aliases ?? []).filter((a) => a.toLowerCase() !== e.term.toLowerCase());
  return (
    <div className="gl-item" id={slug}>
      <div className="gl-term-row">
        <h3 className="gl-term">{highlight(e.term, q)}</h3>
        <a className="gl-anchor" href={`#${slug}`} aria-label={`Link to "${e.term}"`} title="Permalink to this term">#</a>
      </div>
      <p className="gl-short">{highlight(e.short, q)}</p>
      {aliases.length > 0 && <p className="gl-aliases">Also called {highlight(aliases.join(", "), q)}</p>}
      <p className="gl-plain">{highlight(e.plain, q)}</p>
      {e.why && (
        <p className="gl-why">
          <span className="gl-why-ic" aria-hidden="true">→</span>
          <span><b>Why it matters:</b> {highlight(e.why, q)}</span>
        </p>
      )}
    </div>
  );
}

function IconSearch({ className, size = 16 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <circle cx="9" cy="9" r="6.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="M13.6 13.6L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Stable, URL-safe id for a term — powers the per-entry "#" permalink. */
function slugify(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/** Anchor id for an A–Z group heading — encoded so the "#" fallback bucket can't break the URL. */
function anchorId(letter: string): string {
  return `gl-letter-${encodeURIComponent(letter)}`;
}

/** Wrap every case-insensitive occurrence of `query` inside `text` in a <mark>, so a match is easy to spot at a glance. */
function highlight(text: string, query: string): ReactNode {
  const needle = query.trim().toLowerCase();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let idx = lower.indexOf(needle, i);
  while (idx !== -1) {
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(<mark className="gl-hit" key={idx}>{text.slice(idx, idx + needle.length)}</mark>);
    i = idx + needle.length;
    idx = lower.indexOf(needle, i);
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

const CSS = `
.gl-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-radius-lg:12px;--ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:820px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);}
:root[data-theme="dark"] .gl-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);}
.gl-root *{box-sizing:border-box;}

.gl-head{margin-bottom:20px;}
.gl-eyebrow-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
.gl-head h1{font-size:27px;font-weight:700;margin:5px 0 6px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand-active);text-transform:uppercase;}
.gl-count-pill{display:inline-flex;align-items:center;font-size:11px;font-weight:700;letter-spacing:.2px;color:var(--ds-brand-active);background:var(--ds-brand-soft);border-radius:999px;padding:3px 10px;white-space:nowrap;}
.sub{color:var(--muted);font-size:14px;margin:0 0 16px;max-width:66ch;line-height:1.55;}
.sub .q{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand-active);font-size:10px;font-weight:700;vertical-align:middle;}

.gl-searchwrap{position:relative;display:flex;align-items:center;}
.gl-search-ic{position:absolute;left:13px;color:var(--ds-text-tertiary);pointer-events:none;}
.gl-search{width:100%;font-family:inherit;font-size:15px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:10px;padding:11px 42px 11px 38px;transition:border-color .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.gl-search:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.gl-search::placeholder{color:var(--ds-text-tertiary);}
.gl-clear{position:absolute;right:6px;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;border:none;background:transparent;color:var(--muted);font-size:19px;line-height:1;cursor:pointer;transition:background .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease);}
.gl-clear:hover{background:var(--ds-bg-subtle);color:var(--text);transform:translateY(-1px);}
.gl-clear:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.gl-clear:active{transform:translateY(0);}
.gl-kbd{position:absolute;right:12px;font:700 11px/1 var(--ds-font,inherit);color:var(--ds-text-tertiary);background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:5px;padding:4px 7px;pointer-events:none;}
@media(hover:none){.gl-kbd{display:none;}}

.gl-meta{font-size:12px;color:var(--muted);margin:9px 2px 0;font-weight:500;}

.gl-az{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:14px 0 0;}
.gl-az-label{font-size:11px;color:var(--ds-text-tertiary);font-weight:600;margin-right:2px;}
.gl-az-pill{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:var(--ds-radius-md);border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:12px;font-weight:700;text-decoration:none;transition:transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease),border-color .15s var(--ds-ease),color .15s var(--ds-ease),background .15s var(--ds-ease);}
.gl-az-pill:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);border-color:var(--ds-brand);color:var(--ds-brand-active);}
.gl-az-pill:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;color:var(--ds-brand-active);}
.gl-az-pill:active{transform:translateY(0);}

.gl-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}

.gl-group{margin-top:28px;}
.gl-group:first-child{margin-top:6px;}
.gl-letter{
  margin:0 0 10px;font-size:20px;font-weight:800;letter-spacing:.2px;
  background-image:linear-gradient(135deg,var(--ds-brand),var(--ds-brand-active));
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;
  scroll-margin-top:76px;}

.gl-list{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
@media(max-width:640px){.gl-list{grid-template-columns:1fr;}}

.gl-item{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:14px 16px;box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s var(--ds-ease),border-color .15s var(--ds-ease);scroll-margin-top:76px;}
.gl-item:hover{border-color:var(--border-strong);box-shadow:var(--ds-shadow-sm);}
.gl-item:hover .gl-anchor,.gl-item:focus-within .gl-anchor{opacity:1;}
.gl-term-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;}
.gl-term{font-size:15px;font-weight:700;letter-spacing:-.2px;margin:0;}
.gl-anchor{opacity:0;flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-top:-3px;border-radius:6px;color:var(--ds-text-tertiary);text-decoration:none;font-size:13px;font-weight:700;transition:opacity .15s var(--ds-ease),background .15s var(--ds-ease),color .15s var(--ds-ease),transform .15s var(--ds-ease);}
.gl-anchor:hover{background:var(--ds-brand-soft);color:var(--ds-brand-active);transform:translateY(-1px);}
.gl-anchor:focus-visible{opacity:1;outline:2px solid var(--ds-brand);outline-offset:1px;}
.gl-short{font-size:12.5px;font-weight:500;color:var(--ds-brand-active);margin:2px 0 0;}
.gl-aliases{font-size:11.5px;color:var(--ds-text-tertiary);margin:3px 0 0;font-style:italic;}
.gl-plain{font-size:13px;line-height:1.55;color:var(--muted);margin:8px 0 0;}
.gl-why{display:flex;gap:7px;align-items:flex-start;margin:10px 0 0;padding:8px 10px;background:var(--ds-info-soft);border-left:3px solid var(--ds-info);border-radius:8px;font-size:12.5px;line-height:1.5;color:var(--muted);}
.gl-why b{color:var(--text);font-weight:700;}
.gl-why-ic{color:var(--ds-info);flex:none;font-weight:700;line-height:1.4;}
.gl-hit{background:var(--ds-brand-soft);color:var(--ds-brand-active);border-radius:3px;padding:0 1px;}

.gl-empty{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;background:var(--ds-bg-subtle);border:1px dashed var(--border-strong);border-radius:var(--ds-radius-lg);padding:36px 22px;color:var(--muted);animation:glFadeIn .25s var(--ds-ease) both;}
.gl-empty-ic{color:var(--ds-text-tertiary);}
.gl-empty-title{margin:0;font-weight:700;font-size:14.5px;color:var(--text);}
.gl-empty-sub{margin:0;font-size:12.5px;max-width:44ch;line-height:1.55;}
.gl-empty-clear{margin-top:4px;display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:border-color .15s var(--ds-ease),background .15s var(--ds-ease),transform .15s var(--ds-ease),box-shadow .15s var(--ds-ease);}
.gl-empty-clear:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);border-color:var(--ds-brand);color:var(--ds-brand-active);}
.gl-empty-clear:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.gl-empty-clear:active{transform:translateY(0);}
@keyframes glFadeIn{from{opacity:0;transform:translateY(4px);}}

.gl-footer-note{text-align:center;color:var(--ds-text-tertiary);font-size:12px;margin:30px 0 0;}

@media (prefers-reduced-motion: reduce){ .gl-root *{ transition:none!important; animation:none!important; } }
`;
