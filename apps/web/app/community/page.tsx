"use client";
/**
 * Community hub — one destination for the shared-artifact layer. Surfaces both
 * galleries an owner can pull from: funnel templates other owners have shared
 * (copied into your builder) and the ad swipe file (copied to your clipboard).
 * A single search filters both. "Use template" hands off to the Lead Funnel Builder
 * with the template preselected (?template=id); "Copy ad" copies the ad copy
 * and bumps the shared creative's use counter. Authors can unpublish their own.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SkeletonCards } from "../../components/Skeleton";
import { MarketingIcon } from "../../components/MarketingIcons";
import { copyText } from "../../lib/clipboard";
import { EmptyState } from "../../components/ui/EmptyState";
import { confirmDialog } from "../../components/Modal";
import { useToast } from "../../components/Toast";

interface CommunityTemplate { id: string; name: string; description: string | null; category: string | null; uses: number; mine: boolean; authorName: string | null; authorWorkspaceId: string; }
interface SwipeCreative { id: string; headline: string; primaryText: string | null; cta: string | null; angle: string | null; score: number; uses: number; mine: boolean; authorName: string | null; authorWorkspaceId: string; }
interface Comment { id: string; authorName: string | null; body: string; createdAt: string; mine: boolean; }
interface Reaction { count: number; mine: boolean; }
type ArtifactType = "template" | "creative";

function byName(name: string | null, mine: boolean): string { return mine ? "you" : (name || "an owner"); }
function AuthorLink({ wsId, name, mine }: { wsId: string; name: string | null; mine: boolean }) {
  return <>by <a className="author-link" href={`/community/u/${encodeURIComponent(wsId)}`}>{byName(name, mine)}</a></>;
}
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function CommunityPage() {
  const toast = useToast();
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [templates, setTemplates] = useState<CommunityTemplate[]>([]);
  const [creatives, setCreatives] = useState<SwipeCreative[]>([]);
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [tCounts, setTCounts] = useState<Record<string, number>>({});
  const [cCounts, setCCounts] = useState<Record<string, number>>({});
  const [tReacts, setTReacts] = useState<Record<string, Reaction>>({});
  const [cReacts, setCReacts] = useState<Record<string, Reaction>>({});
  const [thread, setThread] = useState<{ type: ArtifactType; id: string; title: string } | null>(null);

  const loadCounts = useCallback(async (type: ArtifactType, ids: string[], set: (m: Record<string, number>) => void) => {
    if (ids.length === 0) { set({}); return; }
    try {
      const r = await fetch(`/api/community/comments?type=${type}&ids=${encodeURIComponent(ids.join(","))}`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); set(d.counts ?? {}); }
    } catch { /* leave counts empty */ }
  }, []);

  const loadReacts = useCallback(async (type: ArtifactType, ids: string[], set: (m: Record<string, Reaction>) => void) => {
    if (ids.length === 0) { set({}); return; }
    try {
      const r = await fetch(`/api/community/reactions?type=${type}&ids=${encodeURIComponent(ids.join(","))}`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); set(d.reactions ?? {}); }
    } catch { /* leave empty */ }
  }, []);

  const toggleReact = useCallback(async (type: ArtifactType, id: string) => {
    const set = type === "template" ? setTReacts : setCReacts;
    // Optimistic flip.
    set((m) => { const cur = m[id] ?? { count: 0, mine: false }; return { ...m, [id]: { count: cur.count + (cur.mine ? -1 : 1), mine: !cur.mine } }; });
    try {
      const r = await fetch("/api/community/reactions", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, id }) });
      if (r.ok) { const d = await r.json(); set((m) => ({ ...m, [id]: d.state })); }
    } catch { /* keep optimistic value */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const [rt, rc, rp] = await Promise.all([
        fetch("/api/templates", { credentials: "include" }),
        fetch("/api/community/creatives", { credentials: "include" }),
        fetch("/api/community/profile", { credentials: "include" }),
      ]);
      if (rt.status === 401 || rc.status === 401) { setState("not-authenticated"); return; }
      if (!rt.ok || !rc.ok) { setState("error"); return; }
      const dt = await rt.json(); const dc = await rc.json();
      const tpls: CommunityTemplate[] = dt.templates ?? []; const crs: SwipeCreative[] = dc.creatives ?? [];
      setTemplates(tpls); setCreatives(crs); setState("ok");
      if (rp.ok) { const dp = await rp.json(); setDisplayName(dp.displayName ?? ""); }
      void loadCounts("template", tpls.map((t) => t.id), setTCounts);
      void loadCounts("creative", crs.map((c) => c.id), setCCounts);
      void loadReacts("template", tpls.map((t) => t.id), setTReacts);
      void loadReacts("creative", crs.map((c) => c.id), setCReacts);
    } catch { setState("error"); }
  }, [loadCounts, loadReacts]);
  useEffect(() => { void load(); }, [load]);

  const bumpCount = useCallback((type: ArtifactType, id: string, delta: number) => {
    const set = type === "template" ? setTCounts : setCCounts;
    set((m) => ({ ...m, [id]: Math.max(0, (m[id] ?? 0) + delta) }));
  }, []);

  const saveName = useCallback(async () => {
    setSavingName(true);
    try {
      const r = await fetch("/api/community/profile", { method: "PUT", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ displayName: nameDraft }) });
      if (r.ok) { const d = await r.json(); setDisplayName(d.displayName ?? ""); setEditingName(false); }
    } catch { /* keep editing open */ }
    finally { setSavingName(false); }
  }, [nameDraft]);

  const needle = q.trim().toLowerCase();
  const shownTemplates = useMemo(() => templates.filter((t) =>
    !needle || `${t.name} ${t.description ?? ""} ${t.category ?? ""}`.toLowerCase().includes(needle)), [templates, needle]);
  const shownCreatives = useMemo(() => creatives.filter((c) =>
    !needle || `${c.headline} ${c.primaryText ?? ""} ${c.angle ?? ""}`.toLowerCase().includes(needle)), [creatives, needle]);

  const copyAd = useCallback((c: SwipeCreative) => {
    const text = [c.headline, c.primaryText, c.cta ? `CTA: ${c.cta}` : ""].filter(Boolean).join("\n\n");
    void copyText(text).then((ok) => {
      if (!ok) { toast("Couldn't copy — select the text and copy manually.", "error"); return; }
      setCopied(c.id); window.setTimeout(() => setCopied(""), 1500);
      toast("Copied — ready to paste.");
      void fetch(`/api/community/creatives?id=${encodeURIComponent(c.id)}`, { method: "PATCH", credentials: "include" }).catch(() => {});
      setCreatives((list) => list.map((x) => x.id === c.id ? { ...x, uses: x.uses + 1 } : x));
    });
  }, [toast]);

  // Only drop the card once the server confirms — an unconditional filter made
  // a failed unpublish look done, then the item reappeared on reload. Confirm
  // first (it's destructive to others' view) and surface any failure via toast
  // rather than swallowing it.
  const unpublishTemplate = useCallback(async (id: string) => {
    const ok = await confirmDialog({ title: "Unpublish this funnel?", message: "It'll be removed from the community library. You can share it again later.", confirmLabel: "Unpublish", danger: true });
    if (!ok) return;
    try {
      const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (r.ok) setTemplates((l) => l.filter((t) => t.id !== id));
      else { const d = await r.json().catch(() => ({})); toast((d as { error?: string }).error || "Couldn't unpublish — please try again.", "error"); }
    } catch { toast("Network error — couldn't unpublish.", "error"); }
  }, [toast]);
  const unpublishCreative = useCallback(async (id: string) => {
    const ok = await confirmDialog({ title: "Unpublish this creative?", message: "It'll be removed from the community library. You can share it again later.", confirmLabel: "Unpublish", danger: true });
    if (!ok) return;
    try {
      const r = await fetch(`/api/community/creatives?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (r.ok) setCreatives((l) => l.filter((c) => c.id !== id));
      else { const d = await r.json().catch(() => ({})); toast((d as { error?: string }).error || "Couldn't unpublish — please try again.", "error"); }
    } catch { toast("Network error — couldn't unpublish.", "error"); }
  }, [toast]);

  if (state === "loading") return <Shell><SkeletonCards count={6} /></Shell>;
  if (state === "not-authenticated") return <Shell><EmptyState icon="lock" title="Please sign in" description="Sign in to browse funnels and ad creatives other ONEVYRT owners have shared." action={<a className="btn primary" href="/">Go to sign in</a>} /></Shell>;
  if (state === "error") return <Shell><EmptyState icon="warning" title="Couldn&rsquo;t load the community" description="Something went wrong fetching shared funnels and ads. Your own work is safe — just try again." action={<button className="btn" onClick={() => void load()}>Retry</button>} /></Shell>;

  const empty = templates.length === 0 && creatives.length === 0;
  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow"><MarketingIcon name="community" size={12} /> ONEVYRT · Community</div>
          <h1>Community <span className="cm-grad">library</span></h1>
          <p className="sub">Funnels and ad creatives other owners have shared — copy what&rsquo;s working straight into your own builder and swipe file. Share yours from the <a href="/business/funnels">Lead Funnel Builder</a> and <a href="/campaign-studio/creative">Creative Studio</a> to give back.</p>
        </div>
        <div className="identity">
          {editingName
            ? <div className="id-edit">
                <input autoFocus value={nameDraft} maxLength={40} onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void saveName(); if (e.key === "Escape") setEditingName(false); }}
                  placeholder="Your community name" aria-label="Your community display name" />
                <button className="btn tiny primary" disabled={savingName} onClick={() => void saveName()}>{savingName ? "…" : "Save"}</button>
                <button className="btn tiny" onClick={() => setEditingName(false)}>Cancel</button>
              </div>
            : <button className="id-chip" title="Change your community name" aria-label="Change your community display name" onClick={() => { setNameDraft(displayName); setEditingName(true); }}>
                <span className="id-avatar" aria-hidden="true">{(displayName || "?").charAt(0).toUpperCase()}</span>
                Sharing as <b>{displayName || "…"}</b> <span className="id-edit-ic" aria-hidden="true">✎</span>
              </button>}
        </div>
      </div>

      {empty
        ? <div className="empty-hero">
            <span className="empty-hero-ic"><MarketingIcon name="community" size={26} /></span>
            <h2>Be the first to share something</h2>
            <p>This library grows every time an owner publishes a funnel or ad that&rsquo;s working. Nothing&rsquo;s here yet — yours could be first, and everyone gets better together.</p>
            <div className="empty-hero-actions">
              <a className="btn primary" href="/business/funnels">Share a funnel →</a>
              <a className="btn" href="/campaign-studio/creative">Share an ad →</a>
            </div>
          </div>
        : (
          <>
            <div className="searchbar">
              <span className="mag"><MarketingIcon name="search" size={15} /></span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates and ad creatives…" aria-label="Search community templates and ad creatives" />
              {q && <button type="button" className="search-clear" onClick={() => setQ("")} aria-label="Clear search">✕</button>}
            </div>

            <section className="sec sec-templates">
              <div className="sec-head"><h2><span className="sec-ic tpl"><MarketingIcon name="funnels" size={16} /></span> Funnel templates <span className="count" aria-live="polite">{shownTemplates.length}</span></h2><a className="btn tiny" href="/business/funnels">Share a funnel →</a></div>
              <p className="sec-sub">Full funnel flows other owners are running right now — preview the steps, then make it yours in one click.</p>
              {shownTemplates.length === 0
                ? <div className="empty">
                    {templates.length === 0
                      ? <>No funnel templates shared yet. <a href="/business/funnels">Be the first to share one →</a></>
                      : <>No templates match &ldquo;{q}&rdquo;. <button type="button" className="link-btn" onClick={() => setQ("")}>Clear search</button></>}
                  </div>
                : <div className="grid">
                    {shownTemplates.map((t) => (
                      <div className="tile" key={t.id}>
                        {t.mine && <button className="unpub" title="Unpublish" aria-label="Unpublish this funnel" onClick={() => void unpublishTemplate(t.id)}>✕</button>}
                        <div className="tile-meta">{t.category || "Funnel"} · <AuthorLink wsId={t.authorWorkspaceId} name={t.authorName} mine={t.mine} /> · {t.uses} use{t.uses === 1 ? "" : "s"}</div>
                        <div className="tile-name">{t.name}</div>
                        {t.description && <div className="tile-desc">{t.description}</div>}
                        <div className="tile-actions">
                          <a className="btn sm primary" href={`/business/funnels?template=${encodeURIComponent(t.id)}`}>Use template →</a>
                          <button className={`btn sm react ${tReacts[t.id]?.mine ? "on" : ""}`} aria-pressed={!!tReacts[t.id]?.mine} aria-label={tReacts[t.id]?.mine ? "Remove your like from this template" : "Like this template"} onClick={() => void toggleReact("template", t.id)}>👍 {tReacts[t.id]?.count ?? 0}</button>
                          <button className="btn sm" aria-label={`Open discussion — ${tCounts[t.id] ?? 0} comment${(tCounts[t.id] ?? 0) === 1 ? "" : "s"}`} onClick={() => setThread({ type: "template", id: t.id, title: t.name })}>💬 {tCounts[t.id] ?? 0}</button>
                        </div>
                      </div>
                    ))}
                  </div>}
            </section>

            <section className="sec sec-creatives">
              <div className="sec-head"><h2><span className="sec-ic ad"><MarketingIcon name="spark" size={16} /></span> Ad swipe file <span className="count" aria-live="polite">{shownCreatives.length}</span></h2><a className="btn tiny" href="/campaign-studio/creative">Share an ad →</a></div>
              <p className="sec-sub">Headlines and angles that are already converting for other owners — copy one, then adapt it to your offer.</p>
              {shownCreatives.length === 0
                ? <div className="empty">
                    {creatives.length === 0
                      ? <>No ad creatives shared yet. <a href="/campaign-studio/creative">Be the first to share one →</a></>
                      : <>No ads match &ldquo;{q}&rdquo;. <button type="button" className="link-btn" onClick={() => setQ("")}>Clear search</button></>}
                  </div>
                : <div className="grid">
                    {shownCreatives.map((c) => (
                      <div className="tile" key={c.id}>
                        {c.mine && <button className="unpub" title="Unpublish" aria-label="Unpublish this creative" onClick={() => void unpublishCreative(c.id)}>✕</button>}
                        <div className="tile-meta">{c.angle || "Ad"} · <AuthorLink wsId={c.authorWorkspaceId} name={c.authorName} mine={c.mine} /> · {c.uses} copie{c.uses === 1 ? "" : "s"}</div>
                        <div className="tile-name">{c.headline}</div>
                        {c.primaryText && <div className="tile-desc clamp">{c.primaryText}</div>}
                        {c.cta && <div className="tile-cta">CTA: <b>{c.cta}</b></div>}
                        <div className="tile-actions">
                          <button className={`btn sm ${copied === c.id ? "is-copied" : ""}`} onClick={() => copyAd(c)}>{copied === c.id ? "Copied ✓" : "Copy ad"}</button>
                          <button className={`btn sm react ${cReacts[c.id]?.mine ? "on" : ""}`} aria-pressed={!!cReacts[c.id]?.mine} aria-label={cReacts[c.id]?.mine ? "Remove your like from this ad" : "Like this ad"} onClick={() => void toggleReact("creative", c.id)}>👍 {cReacts[c.id]?.count ?? 0}</button>
                          <button className="btn sm" aria-label={`Open discussion — ${cCounts[c.id] ?? 0} comment${(cCounts[c.id] ?? 0) === 1 ? "" : "s"}`} onClick={() => setThread({ type: "creative", id: c.id, title: c.headline })}>💬 {cCounts[c.id] ?? 0}</button>
                        </div>
                      </div>
                    ))}
                  </div>}
            </section>
          </>
        )}

      {thread && <CommentModal type={thread.type} id={thread.id} title={thread.title}
        onClose={() => setThread(null)} onCountChange={(delta) => bumpCount(thread.type, thread.id, delta)} />}
    </Shell>
  );
}

function CommentModal({ type, id, title, onClose, onCountChange }: { type: ArtifactType; id: string; title: string; onClose: () => void; onCountChange: (delta: number) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/community/comments?type=${type}&id=${encodeURIComponent(id)}`, { credentials: "include" });
      setComments(r.ok ? ((await r.json()).comments ?? []) : []);
    } catch { setComments([]); }
  }, [type, id]);
  useEffect(() => { void load(); }, [load]);

  // Escape-to-close — this is a real dialog over the page content, so it
  // should behave like one even though it's a bespoke overlay, not the shared
  // Modal component (which doesn't model a live comment thread + composer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const post = useCallback(async () => {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    try {
      const r = await fetch("/api/community/comments", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, id, body: text }) });
      if (r.ok) { const d = await r.json(); setComments((cs) => [...(cs ?? []), d.comment]); setDraft(""); onCountChange(1); }
    } catch { /* keep the draft */ }
    finally { setPosting(false); }
  }, [draft, type, id, onCountChange]);

  const remove = useCallback(async (cid: string) => {
    try {
      const r = await fetch(`/api/community/comments?id=${encodeURIComponent(cid)}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) return; // keep the comment visible rather than lie it's deleted
      setComments((cs) => (cs ?? []).filter((c) => c.id !== cid)); onCountChange(-1);
    } catch { /* comment stays; reload shows the true state */ }
  }, [onCountChange]);

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cm-comment-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div><div className="modal-eyebrow"><MarketingIcon name="message" size={11} /> Discussion</div><div className="modal-title" id="cm-comment-title">{title}</div></div>
          <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="thread">
          {comments === null
            ? <div className="thread-loading"><div className="spinner sm" /></div>
            : comments.length === 0
              ? <div className="thread-empty">No comments yet. Share what worked, what you changed, or what to watch for.</div>
              : comments.map((c) => (
                  <div className="cmt" key={c.id}>
                    <div className="cmt-head"><b>{c.mine ? "You" : (c.authorName || "An owner")}</b><span className="cmt-time">{ago(c.createdAt)}</span>
                      {c.mine && <button className="cmt-del" title="Delete" aria-label="Delete your comment" onClick={() => void remove(c.id)}>✕</button>}
                    </div>
                    <div className="cmt-body">{c.body}</div>
                  </div>
                ))}
        </div>
        <div className="composer">
          <textarea rows={2} value={draft} maxLength={1000} placeholder="Add a comment…" aria-label="Write a comment" onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void post(); }} />
          <button className="btn sm primary" disabled={posting || !draft.trim()} onClick={() => void post()}>{posting ? "Posting…" : "Post"}</button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="cm-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.cm-root{
  /* colour tokens inherited from the shared design system (theme-aware) —
     aliased to short local names so the rest of this block stays readable. */
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--tertiary:var(--ds-text-tertiary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:900px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
.cm-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:26px;font-weight:700;margin:2px 0 5px;letter-spacing:-.5px;}
/* Quiet brand→info gradient on the one memorable word — same treatment used
   across the redesigned pages, so this page reads as part of the same family. */
.cm-grad{background-image:linear-gradient(92deg,var(--ds-brand),var(--ds-info));color:var(--ds-brand);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.cm-grad{color:transparent;-webkit-background-clip:text;background-clip:text;}}
.identity{flex:none;}
.id-chip{display:inline-flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border-strong);border-radius:99px;padding:6px 13px 6px 6px;font-size:12.5px;font-weight:500;color:var(--muted);cursor:pointer;transition:border-color .15s var(--ds-ease,ease),transform .15s var(--ds-ease,ease),box-shadow .15s;}
.id-chip:hover{border-color:var(--ds-brand);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.id-chip:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.id-chip b{color:var(--ds-brand-active);}
/* Little avatar disc so "sharing as" reads like a profile, not a settings row. */
.id-avatar{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand-active);font-size:11px;font-weight:700;flex:none;}
.id-edit-ic{font-size:11px;opacity:.7;}
.id-edit{display:flex;align-items:center;gap:6px;}
.id-edit input{border:1.5px solid var(--border-strong);border-radius:9px;padding:7px 10px;font:inherit;font-size:13px;color:var(--text);background:var(--surface);width:170px;transition:border-color .15s,box-shadow .15s;}
.id-edit input:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.btn.tiny.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:var(--ds-brand-contrast);}
.btn.tiny.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:66ch;line-height:1.55;}
.sub a{color:var(--ds-brand);font-weight:600;text-decoration:none;}
.sub a:hover{text-decoration:underline;}
/* .btn styling is canonical in design-system.css; keep only layout tweaks. */
.btn.sm{align-self:flex-start;margin-top:auto;}
.empty{background:var(--surface);border:1px dashed var(--border-strong);border-radius:12px;padding:20px 16px;text-align:center;color:var(--tertiary);font-size:13px;line-height:1.6;}
.empty a{color:var(--ds-brand);font-weight:500;}
/* Text-styled button for inline "undo the search" actions — reads as a link,
   behaves as a button (keyboard + screen-reader correct). */
.link-btn{border:none;background:none;padding:0;font:inherit;font-size:inherit;color:var(--ds-brand);font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:2px;}
.link-btn:hover{color:var(--ds-brand-hover);}
.link-btn:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:3px;}

/* Warm "nothing shared yet" hero — the first thing a brand-new workspace
   sees here, so it should invite instead of apologise: one clear reason to be
   first, and two one-click ways to do it. */
.empty-hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;background:linear-gradient(180deg,var(--ds-brand-soft),var(--surface) 68%);border:1px solid var(--border);border-radius:18px;padding:44px 24px;}
.empty-hero-ic{display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:50%;background:var(--ds-surface);color:var(--ds-brand);box-shadow:var(--ds-shadow-xs);margin-bottom:4px;}
.empty-hero h2{margin:0;font-size:19px;font-weight:700;letter-spacing:-.3px;color:var(--text);}
.empty-hero p{margin:0;max-width:48ch;color:var(--muted);font-size:13.5px;line-height:1.55;}
.empty-hero-actions{display:flex;gap:10px;margin-top:8px;flex-wrap:wrap;justify-content:center;}

.searchbar{display:flex;align-items:center;gap:8px;background:var(--surface);border:1.5px solid var(--border-strong);border-radius:11px;padding:0 12px;margin-bottom:20px;transition:border-color .15s,box-shadow .15s;}
.searchbar:focus-within{border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.searchbar .mag{display:flex;font-size:14px;color:var(--tertiary);}
.searchbar input{flex:1;border:none;background:none;font:inherit;font-size:14px;color:var(--text);padding:11px 2px;}
.searchbar input:focus{outline:none;}
.search-clear{flex:none;width:22px;height:22px;border-radius:50%;border:none;background:var(--ds-bg-subtle);color:var(--tertiary);font-size:11px;cursor:pointer;display:grid;place-items:center;transition:background .15s,color .15s,transform .15s;}
.search-clear:hover{background:var(--ds-border-default);color:var(--text);transform:scale(1.06);}
.search-clear:focus-visible{outline:2px solid var(--ds-brand);outline-offset:1px;}

.sec{margin-bottom:28px;}
.sec-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;}
.sec-head h2{font-size:16px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;color:var(--text);}
/* Small tinted icon badge per section — brand for funnels, info-blue for ads —
   so the two galleries read as distinct at a glance, echoed by each card's
   left accent below. */
.sec-ic{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;flex:none;}
.sec-ic.tpl{background:var(--ds-brand-soft);color:var(--ds-brand-active);}
.sec-ic.ad{background:var(--ds-info-soft);color:var(--ds-info);}
.count{font-size:11px;font-weight:700;color:var(--tertiary);background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:99px;padding:1px 8px;}
.sec-sub{margin:0 0 12px;font-size:12.5px;color:var(--tertiary);line-height:1.5;max-width:70ch;}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;}
.sec-templates .grid{--c:var(--ds-brand);}
.sec-creatives .grid{--c:var(--ds-info);}
.tile{position:relative;background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--c,var(--ds-brand));border-radius:12px;padding:14px 14px 14px 13px;box-shadow:var(--ds-shadow-xs);display:flex;flex-direction:column;gap:6px;min-height:120px;transition:transform .15s var(--ds-ease,ease),border-color .15s,box-shadow .15s;}
.tile:hover{transform:translateY(-2px);border-color:var(--border-strong);box-shadow:var(--ds-shadow-sm);}
.tile-meta{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--tertiary);}
.author-link{color:var(--ds-brand);text-decoration:none;font-weight:600;}
.author-link:hover{text-decoration:underline;}
.author-link:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:2px;}
.tile-name{font-size:15px;font-weight:700;letter-spacing:-.2px;line-height:1.3;color:var(--text);}
.tile-desc{font-size:12.5px;color:var(--muted);line-height:1.5;}
.tile-desc.clamp{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}
.tile-cta{font-size:12px;color:var(--muted);}.tile-cta b{color:var(--text);}
.tile-actions{display:flex;gap:6px;align-items:center;margin-top:auto;padding-top:2px;flex-wrap:wrap;}
/* A little "pop" the instant a like lands — purely celebratory, so it's fully
   covered by the reduced-motion override below. */
@keyframes react-pop{0%{transform:scale(1);}45%{transform:scale(1.2);}100%{transform:scale(1);}}
.btn.react.on{background:var(--ds-brand-soft);border-color:var(--ds-brand);color:var(--ds-brand-active);animation:react-pop .3s var(--ds-ease,ease);}
.btn.is-copied{background:var(--ds-success-soft);border-color:color-mix(in srgb,var(--ds-success) 35%,transparent);color:var(--ds-success);}
.unpub{position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;border:1px solid var(--border-strong);background:var(--surface);color:var(--tertiary);font-size:11px;font-weight:700;cursor:pointer;display:grid;place-items:center;line-height:1;transition:background .15s,border-color .15s,color .15s,transform .15s;}
.unpub:hover{background:var(--ds-danger-soft);border-color:color-mix(in srgb,var(--ds-danger) 40%,transparent);color:var(--ds-danger);transform:scale(1.08);}
.unpub:focus-visible{outline:2px solid var(--ds-danger);outline-offset:2px;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.spinner.sm{width:20px;height:20px;border-width:2.5px;}
@keyframes scrim-in{from{opacity:0;}to{opacity:1;}}
@keyframes modal-in{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}
.modal-scrim{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.45);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:18px;animation:scrim-in .15s ease;}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--ds-shadow-lg);width:100%;max-width:520px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;animation:modal-in .18s var(--ds-ease,ease);}
.modal-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border);}
.modal-eyebrow{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-brand);}
.modal-title{font-size:16px;font-weight:700;line-height:1.3;margin-top:2px;color:var(--text);}
.modal-x{flex:none;width:28px;height:28px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--muted);font-size:13px;cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
.modal-x:hover{background:var(--ds-bg-subtle);border-color:var(--border-strong);color:var(--text);}
.modal-x:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.thread{flex:1;overflow-y:auto;padding:14px 18px;display:flex;flex-direction:column;gap:12px;min-height:80px;}
.thread-loading{display:flex;justify-content:center;padding:20px;}
.thread-empty{color:var(--tertiary);font-size:13px;line-height:1.6;text-align:center;padding:16px 8px;}
.cmt{display:flex;flex-direction:column;gap:3px;}
.cmt-head{display:flex;align-items:center;gap:8px;font-size:12.5px;}
.cmt-head b{font-weight:700;color:var(--text);}
.cmt-time{color:var(--tertiary);font-size:11.5px;}
.cmt-del{margin-left:auto;border:none;background:none;color:var(--tertiary);cursor:pointer;font-size:11px;padding:2px 4px;border-radius:5px;transition:background .15s,color .15s;}
.cmt-del:hover{color:var(--ds-danger);background:var(--ds-danger-soft);}
.cmt-del:focus-visible{outline:2px solid var(--ds-danger);outline-offset:1px;}
.cmt-body{font-size:13.5px;line-height:1.5;color:var(--text);white-space:pre-wrap;}
.composer{display:flex;gap:8px;align-items:flex-end;padding:12px 18px;border-top:1px solid var(--border);}
.composer textarea{flex:1;border:1.5px solid var(--border-strong);border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;color:var(--text);background:var(--surface);resize:vertical;line-height:1.5;transition:border-color .15s,box-shadow .15s;}
.composer textarea:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.composer .btn.sm.primary{margin-top:0;}

@media (prefers-reduced-motion: reduce){.cm-root *{transition:none!important;animation:none!important;}}
`;
