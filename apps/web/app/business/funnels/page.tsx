"use client";
/**
 * Funnel Builder — where an owner creates their own qualification funnel
 * instead of using the fixed demo. Deliberately simple: each answer option
 * carries points (how much it signals a good lead) and can be a hard
 * disqualifier; two thresholds split qualified / nurture / everyone else. The
 * server compiles this into engine rules, so the live /q/[slug] funnel, the
 * calendar and the Leads Inbox all just work.
 *
 * One page, two views: the funnel list and the editor, toggled in state so a
 * new funnel opens straight into editing without a round-trip.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { blankFunnelDoc, slugify, validateFunnelDoc, attainableMaxScore, type FunnelDoc, type BuilderQuestion, type BuilderOption } from "../../../lib/studio/funnel-builder";
import { composeOneLiner, outcomesFromMessage, type MessageInput } from "../../../lib/studio/message-copy";
import { buildQuestionsPrompt, parseQuestions, QUESTIONS_SYSTEM } from "../../../lib/studio/funnel-questions";
import { critiqueFunnel, applyFix, CRITIQUE_SYSTEM, buildCritiquePrompt } from "../../../lib/studio/funnel-critique";
import { FUNNEL_TEMPLATES, templateDoc } from "../../../lib/studio/funnel-templates";
import { CURRENCIES, normalizeCurrency, DEFAULT_CURRENCY } from "../../../lib/studio/currency";
import { SkeletonList } from "../../../components/Skeleton";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { useToast } from "../../../components/Toast";
import { confirmDialog } from "../../../components/Modal";
import { callAI, loadConnection } from "../../../lib/ai/client";
import { loadBrandProfile, brandBrief, hasBrand, type BrandProfile } from "../../../lib/campaign/brand-brief";
import { loadStrategyBrief, strategyBlock, type StrategyBrief } from "../../../lib/campaign/strategy-brief";
import { GroundingChips } from "../../../components/campaign/GroundingChips";
import SellBetter from "../../../components/SellBetter";
import Explain from "../../../components/Explain";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";
import { EmptyState } from "../../../components/ui/EmptyState";

interface StoredFunnel { slug: string; workspaceId: string; doc: FunnelDoc; published: boolean; updatedAt: string; }
interface CommunityTemplate { id: string; name: string; description: string | null; category: string | null; uses: number; mine: boolean; authorName: string | null; }

// Attainable maximum lives in the shared qualification domain module so the
// score bar, threshold hints and validation all agree on what "100%" means.
// (The old local version summed every positive option, inflating single-choice
// questions — see attainableMaxScore.)
const maxScore = attainableMaxScore;

export default function FunnelBuilderPage() {
  const toast = useToast();
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [funnels, setFunnels] = useState<StoredFunnel[]>([]);
  const [editing, setEditing] = useState<FunnelDoc | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [analyticsSlug, setAnalyticsSlug] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [community, setCommunity] = useState<CommunityTemplate[]>([]);
  const [communityState, setCommunityState] = useState<"idle" | "loading" | "loaded">("idle");
  const [copying, setCopying] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  // The workspace one-liner (from the Message step) — used to seed a blank
  // funnel's intro so the funnel opens speaking your message, not a blank field.
  const [oneLiner, setOneLiner] = useState("");
  const [msg, setMsg] = useState<MessageInput | null>(null);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/business/funnels${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      const d = await r.json();
      setFunnels(d.funnels ?? []); setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);
  useEffect(() => { void load(); }, [load]);

  // Pull the saved Message once, to seed new funnels' intro *and* outcome copy
  // (which in turn seeds the follow-up email) — so a new funnel opens speaking
  // the owner's one voice instead of blank fields.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/business/message${wsQuery}`, { credentials: "include" });
        if (!r.ok) return;
        const m = (await r.json()) as MessageInput;
        setMsg(m);
        const ol = composeOneLiner(m?.oneLiner);
        if (ol) setOneLiner(ol);
      } catch { /* non-critical */ }
    })();
  }, [wsQuery]);

  const loadCommunity = useCallback(async () => {
    setCommunityState("loading");
    try {
      const r = await fetch("/api/templates", { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      setCommunity(r.ok ? (d.templates ?? []) : []);
    } catch { setCommunity([]); }
    setCommunityState("loaded");
  }, []);
  // Load the gallery the first time the picker opens.
  const openPicker = () => { setPicking(true); if (communityState === "idle") void loadCommunity(); };

  const freshSlug = () => slugify(`funnel-${Math.random().toString(36).slice(2, 6)}`);
  const startBlank = () => {
    const doc = blankFunnelDoc(freshSlug(), "New qualification funnel");
    if (oneLiner) doc.intro = oneLiner; // open speaking your message
    // Seed the outcome screens (and thus the follow-up email) from the story
    // grid, keeping each field's sensible default where the Message is silent.
    const seed = outcomesFromMessage(msg);
    for (const k of ["qualified", "nurture", "unqualified"] as const) {
      const s = seed[k];
      if (s?.heading) doc.outcomes[k].heading = s.heading;
      if (s?.body) doc.outcomes[k].body = s.body;
    }
    setEditing(doc); setIsNew(true); setPicking(false);
  };
  const startFromTemplate = (templateId: string) => {
    const doc = templateDoc(templateId, freshSlug());
    if (doc) { setEditing(doc); setIsNew(true); setPicking(false); }
  };
  const startFromCommunity = async (id: string) => {
    setCopying(id);
    try {
      const r = await fetch(`/api/templates/${encodeURIComponent(id)}`, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.template?.doc) { setNotice("Couldn't load that template."); return; }
      const doc: FunnelDoc = { ...structuredClone(d.template.doc), slug: freshSlug() };
      setEditing(doc); setIsNew(true); setPicking(false);
    } catch { setNotice("Couldn't load that template."); }
    finally { setCopying(null); }
  };
  // Deep-link from the Community hub: /business/funnels?template=<id> opens the
  // editor with that shared template loaded. Runs once, then cleans the URL.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("template");
    if (!id) return;
    window.history.replaceState(null, "", "/business/funnels");
    void startFromCommunity(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const editExisting = (f: StoredFunnel) => { setEditing(structuredClone(f.doc)); setIsNew(false); };
  const duplicate = (f: StoredFunnel) => {
    const doc = structuredClone(f.doc);
    doc.slug = freshSlug();
    doc.title = `${f.doc.title} (copy)`;
    setEditing(doc); setIsNew(true); // saving creates a new funnel
  };
  const publish = async (f: StoredFunnel) => {
    setPublishing(f.slug); setNotice("");
    try {
      const r = await fetch("/api/templates", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: f.doc.title, description: f.doc.intro ?? "", doc: f.doc }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const m = (d as { error?: string }).error || "Couldn't publish."; setNotice(m); toast(m, "error"); return; }
      setNotice(`"${f.doc.title}" is now in the community gallery.`);
      toast(`"${f.doc.title}" shared to the community gallery.`);
      if (communityState !== "idle") void loadCommunity();
    } catch { setNotice("Network error — please try again."); toast("Network error — please try again.", "error"); }
    finally { setPublishing(null); }
  };
  const unpublish = async (id: string) => {
    if (!(await confirmDialog({ title: "Unpublish this template?", message: "It's removed from the community gallery. Your own funnel stays untouched.", confirmLabel: "Unpublish", danger: true }))) return;
    try {
      const r = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) return; // leave it in the list rather than lie that it's gone
      setCommunity((c) => c.filter((t) => t.id !== id));
    } catch { /* best-effort — the row stays, so a reload shows the true state */ }
  };
  // Toggle a funnel between Live (served at /q/slug) and Draft (not served),
  // re-saving the same doc with the flipped published flag. This is the
  // staging control the list's Live/Draft tag implied but never had.
  const [togglingLive, setTogglingLive] = useState<string | null>(null);
  const toggleLive = async (f: StoredFunnel) => {
    const goLive = !f.published;
    if (!goLive && !(await confirmDialog({ title: "Take this funnel offline?", message: `Visitors to /q/${f.slug} will no longer see it until you publish again. Existing leads are kept.`, confirmLabel: "Unpublish", danger: true }))) return;
    setTogglingLive(f.slug); setNotice("");
    try {
      const r = await fetch(`/api/business/funnels${wsQuery}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc: f.doc, published: goLive }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const m = (d as { error?: string }).error || "Couldn't update."; toast(m, "error"); return; }
      toast(goLive ? `"${f.doc.title}" is live.` : `"${f.doc.title}" is now a draft.`);
      await load();
    } catch { toast("Network error — please try again.", "error"); }
    finally { setTogglingLive(null); }
  };
  // Permanently delete a funnel (the DELETE route is owner/manager-gated).
  const [deleting, setDeleting] = useState<string | null>(null);
  const del = async (f: StoredFunnel) => {
    if (!(await confirmDialog({ title: `Delete "${f.doc.title}"?`, message: `This removes the funnel and its /q/${f.slug} link for good. Leads already collected stay in your inbox. This can't be undone.`, confirmLabel: "Delete funnel", danger: true }))) return;
    setDeleting(f.slug); setNotice("");
    try {
      const r = await fetch(`/api/business/funnels${wsQuery}${wsQuery ? "&" : "?"}slug=${encodeURIComponent(f.slug)}`, { method: "DELETE", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { const m = (d as { error?: string }).error || "Couldn't delete."; toast(m, "error"); return; }
      toast(`"${f.doc.title}" deleted.`);
      await load();
    } catch { toast("Network error — please try again.", "error"); }
    finally { setDeleting(null); }
  };

  if (state === "loading") return <Shell><SkeletonList rows={5} /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="Sign in to build funnels." href="/" cta="Go to sign in" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Couldn&rsquo;t load funnels" onRetry={() => void load()} /></Shell>;

  if (editing) {
    return <Editor doc={editing} isNew={isNew} oneLiner={oneLiner} msg={msg} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void load(); }} />;
  }
  if (analyticsSlug) {
    const f = funnels.find((x) => x.slug === analyticsSlug);
    return <Analytics slug={analyticsSlug} title={f?.doc.title ?? analyticsSlug} onBack={() => setAnalyticsSlug(null)} />;
  }

  // Derived state for the at-a-glance summary — how many funnels are actually
  // serving visitors vs. still hidden as drafts.
  const liveCount = funnels.filter((f) => f.published).length;
  const draftCount = funnels.length - liveCount;

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Acquisition OS</div>
          <h1>Lead Funnel Builder</h1>
          <p className="sub">Build a qualification funnel visitors fill in from your ads. Score each answer, set who qualifies, and the calendar + Leads Inbox wire up automatically.</p>
        </div>
        <a href="/business" className="btn ghost">← Business OS</a>
      </div>

      <WorkedExample id="funnel" />

      {notice && <div className="banner" onClick={() => setNotice("")}>{notice}</div>}

      {!picking
        ? <button className="btn primary big" onClick={openPicker}>+ New funnel</button>
        : (
          <div className="picker">
            <div className="picker-head"><span className="picker-title">Start from a template</span><button className="btn tiny" onClick={() => setPicking(false)}>Cancel</button></div>
            <div className="picker-grid">
              <button className="tmpl blank" onClick={startBlank}>
                <span className="tmpl-ic">＋</span>
                <span className="tmpl-name">Blank funnel</span>
                <span className="tmpl-desc">Start from scratch with a couple of starter questions.</span>
              </button>
              {FUNNEL_TEMPLATES.map((t) => (
                <button className="tmpl" key={t.id} onClick={() => startFromTemplate(t.id)}>
                  <span className="tmpl-ic">{t.icon}</span>
                  <span className="tmpl-name">{t.name}</span>
                  <span className="tmpl-desc">{t.description}</span>
                </button>
              ))}
            </div>

            <div className="picker-head" style={{ marginTop: 20 }}>
              <span className="picker-title">🌐 Community templates <span className="hint">Funnels other owners have shared</span></span>
            </div>
            {communityState === "loading" && <div className="hint pad">Loading the gallery…</div>}
            {communityState === "loaded" && community.length === 0 && <EmptyState compact icon="community" title="No community templates yet" description="Publish one of your funnels below to seed the gallery." />}
            {community.length > 0 && (
              <div className="picker-grid">
                {community.map((t) => (
                  <div className="tmpl community" key={t.id}>
                    <button className="tmpl-copy" disabled={copying === t.id} onClick={() => void startFromCommunity(t.id)}>
                      <span className="tmpl-ic">🌐</span>
                      <span className="tmpl-name">{t.name}</span>
                      <span className="tmpl-desc">{t.description || "A shared qualification funnel."}</span>
                      <span className="tmpl-uses">{copying === t.id ? "Copying…" : `${t.uses} use${t.uses === 1 ? "" : "s"} · by ${t.mine ? "you" : (t.authorName || "an owner")}`}</span>
                    </button>
                    {t.mine && <button className="tmpl-unpub" title="Unpublish" onClick={() => void unpublish(t.id)}>✕</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {funnels.length > 0 && (
        <div className="list-head">
          <div className="list-heading">
            <span className="list-title">Your funnels</span>
            <span className="list-help">Live funnels capture leads at their link; drafts stay hidden until you publish.</span>
          </div>
          <div className="counts" aria-label={`${liveCount} live, ${draftCount} draft`}>
            <span className={`count-pill ${liveCount > 0 ? "live" : "muted"}`}>{liveCount} live</span>
            <span className="count-pill muted">{draftCount} draft</span>
          </div>
        </div>
      )}

      <div className="rows" style={{ marginTop: funnels.length > 0 ? 10 : 16 }}>
        {funnels.length === 0 && (
          <EmptyState icon="funnels" title="Build your first funnel"
            description={<>A funnel asks visitors a few quick questions, scores each answer, and sends your best leads straight to the calendar. Create one now — or try the ready-made <a href="/q/demo" target="_blank" rel="noreferrer">demo funnel</a> and claim its leads from the <a href="/business/leads">Leads Inbox</a>.</>}
            action={<button className="btn primary" onClick={openPicker}>Build your first funnel</button>} />
        )}
        {funnels.map((f) => (
          <div className={`frow ${f.published ? "live" : "draft"}`} key={f.slug}>
            <div className="frow-main">
              <div className="frow-title">{f.doc.title} {f.published ? <span className="tag live">Live</span> : <span className="tag draft">Draft</span>}</div>
              <div className="frow-sub">/q/{f.slug} · {f.doc.questions.length} question{f.doc.questions.length === 1 ? "" : "s"} · qualifies at {f.doc.thresholds.qualified}/{maxScore(f.doc)}</div>
              <div className="frow-next">
                {f.published
                  ? <>Live and capturing — new leads arrive in your <a href="/business/leads">Leads Inbox</a>.</>
                  : <>Draft — hidden from visitors. Publish when you&rsquo;re ready to capture leads.</>}
              </div>
            </div>
            <div className="frow-actions">
              <button className="btn tiny" onClick={() => setAnalyticsSlug(f.slug)}><MarketingIcon name="insights" size={14} /> Analytics</button>
              <a className="btn tiny" href={`/q/${f.slug}`} target="_blank" rel="noreferrer">Open ↗</a>
              <button className="btn tiny" onClick={() => duplicate(f)}>Duplicate</button>
              <button className={`btn tiny${!f.published ? " go-live" : ""}`} disabled={togglingLive === f.slug} onClick={() => void toggleLive(f)} title={f.published ? "Take this funnel offline" : "Make this funnel live at its /q link"}>{togglingLive === f.slug ? "…" : f.published ? "Unpublish" : "Publish"}</button>
              <button className="btn tiny" disabled={publishing === f.slug} onClick={() => void publish(f)}>{publishing === f.slug ? "Publishing…" : <><MarketingIcon name="community" size={14} /> Share</>}</button>
              <button className="btn tiny" onClick={() => editExisting(f)}>Edit</button>
              <button className="btn tiny danger" disabled={deleting === f.slug} onClick={() => void del(f)} aria-label={`Delete ${f.doc.title}`}>{deleting === f.slug ? "…" : "Delete"}</button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Editor({ doc: initial, isNew, oneLiner, msg, onCancel, onSaved }: { doc: FunnelDoc; isNew: boolean; oneLiner: string; msg: MessageInput | null; onCancel: () => void; onSaved: () => void }) {
  const [doc, setDoc] = useState<FunnelDoc>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [introBusy, setIntroBusy] = useState(false);
  const [questionsBusy, setQuestionsBusy] = useState(false);
  const [sellFor, setSellFor] = useState<"qualified" | "nurture" | "unqualified" | null>(null);
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [strategy, setStrategy] = useState<StrategyBrief | null>(null);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });
  useEffect(() => { void loadBrandProfile().then(setBrand); void loadStrategyBrief().then(setStrategy); }, []); // ground intro copy in the Brand Brain voice + Business-OS strategy
  // Stripe Connect status, so the Paid-step card can tell the owner whether a
  // charge will actually go through (the runtime only charges when the funnel
  // is payable AND the workspace's Connect account is active).
  const [connectStatus, setConnectStatus] = useState<"loading" | "unconfigured" | "none" | "onboarding" | "restricted" | "active" | "error">("loading");
  useEffect(() => {
    let live = true;
    fetch("/api/billing/connect/status", { credentials: "include" })
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => {
        if (!live) return;
        if (!d) { setConnectStatus("none"); return; }
        if (d.configured === false) { setConnectStatus("unconfigured"); return; }
        const s = d.status as string | undefined;
        setConnectStatus(s === "onboarding" || s === "restricted" || s === "active" || s === "none" ? s : "none");
      })
      .catch(() => { if (live) setConnectStatus("error"); });
    return () => { live = false; };
  }, []);
  // The workspace currency (set in the Numbers/break-even area, stored on the
  // economics record) so a *new* paid step defaults to the currency the owner
  // actually works in instead of always USD. Stripe wants lower-case codes, so
  // we keep the payment field lower-case at the edge.
  const [wsCurrency, setWsCurrency] = useState<string>(DEFAULT_CURRENCY.toLowerCase());
  useEffect(() => {
    let live = true;
    fetch(`/api/business/economics${wsQuery}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d && typeof d.currency === "string") setWsCurrency(normalizeCurrency(d.currency).toLowerCase()); })
      .catch(() => { /* default USD */ });
    return () => { live = false; };
  }, [wsQuery]);
  // True right after "Draft from Message" replaces the questions — a set the
  // user hasn't read, even though the funnel health score and max-points
  // scoring below update on it immediately. Cleared the moment they touch a
  // question (edit, reorder, add, remove) or save.
  const [questionsDraftPending, setQuestionsDraftPending] = useState(false);
  const toast = useToast();

  const patch = (p: Partial<FunnelDoc>) => setDoc((d) => ({ ...d, ...p }));

  // Rewrite the intro with the connected AI, grounded in the funnel title and
  // the workspace one-liner. Plain-text output → straight into the intro field.
  const improveIntro = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setIntroBusy(true);
    try {
      const system = "You write warm, plain-language funnel intros: one or two short sentences that make a visitor want to answer a few quick questions. No hype, no jargon. When a BRAND brief is given, write in that brand's voice and speak to its audience. Return ONLY the intro text, no quotes or preamble.";
      const ctx = [hasBrand(brand) && `BRAND:\n${brandBrief(brand)}`, strategyBlock(strategy) || false, oneLiner && `Business one-liner: ${oneLiner}`, `Funnel: ${doc.title}`, doc.intro && `Current intro: ${doc.intro}`].filter(Boolean).join("\n");
      const reply = await callAI(conn, system, `${ctx}\n\nWrite the intro now.`, 180);
      const text = reply.trim().replace(/^["'\s]+|["'\s]+$/g, "").slice(0, 400);
      if (text) { patch({ intro: text }); toast("Intro rewritten."); }
      else toast("The model didn't return usable copy — try again.", "error");
    } catch (e) { toast(e instanceof Error ? e.message : "Rewrite failed — check your AI connection.", "error"); }
    finally { setIntroBusy(false); }
  };
  // Draft the whole qualification set from the saved Message — the same one
  // voice that seeds the intro now proposes the questions that gate the lead.
  // Replaces the current questions (with a confirm when they'd be overwritten).
  const draftQuestions = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    if (doc.questions.length > 0 && !(await confirmDialog({ title: "Replace the questions?", message: "AI will draft a fresh qualification set from your Message. Your current questions will be replaced.", confirmLabel: "Draft new questions" }))) return;
    setQuestionsBusy(true);
    try {
      const reply = await callAI(conn, QUESTIONS_SYSTEM, buildQuestionsPrompt(msg, doc.title, strategy?.has ? strategy.brief : "", hasBrand(brand) ? brandBrief(brand) : ""), 700);
      const qs = parseQuestions(reply);
      if (qs.length === 0) { toast("The model didn't return usable questions — try again.", "error"); return; }
      patch({ questions: qs });
      setQuestionsDraftPending(true);
      toast(`Drafted ${qs.length} question${qs.length === 1 ? "" : "s"} from your Message — tune the points and save.`);
    } catch (e) { toast(e instanceof Error ? e.message : "Draft failed — check your AI connection.", "error"); }
    finally { setQuestionsBusy(false); }
  };
  const setQuestion = (i: number, q: BuilderQuestion) => { setQuestionsDraftPending(false); setDoc((d) => ({ ...d, questions: d.questions.map((x, j) => j === i ? q : x) })); };
  const removeQuestion = (i: number) => { setQuestionsDraftPending(false); setDoc((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) })); };
  const moveQuestion = (i: number, dir: -1 | 1) => { setQuestionsDraftPending(false); setDoc((d) => {
    const j = i + dir; if (j < 0 || j >= d.questions.length) return d;
    const qs = d.questions.slice(); [qs[i], qs[j]] = [qs[j]!, qs[i]!]; return { ...d, questions: qs };
  }); };
  const addQuestion = () => { setQuestionsDraftPending(false); setDoc((d) => ({
    ...d, questions: [...d.questions, { id: `q${d.questions.length + 1}`, prompt: "New question", kind: "single", required: true, options: [{ value: "yes", label: "Yes", points: 10 }, { value: "no", label: "No", points: 0 }] }],
  })); };

  const validation = useMemo(() => validateFunnelDoc(doc), [doc]);
  const max = maxScore(doc);
  // Deterministic funnel health — recomputes live as the doc changes.
  const health = useMemo(() => critiqueFunnel(doc), [doc]);
  const [aiCritique, setAiCritique] = useState("");
  const [critiqueBusy, setCritiqueBusy] = useState(false);
  const applyFinding = (fixId: string) => { setDoc((d) => applyFix(d, fixId)); toast("Fix applied — re-check and save."); };
  const critiqueCopy = async () => {
    const conn = loadConnection();
    if (!conn) { toast("Connect an AI provider in Campaign Studio → Connections first.", "error"); return; }
    setCritiqueBusy(true); setAiCritique("");
    try {
      const reply = await callAI(conn, CRITIQUE_SYSTEM, buildCritiquePrompt(doc, strategy?.has ? strategy.brief : "", hasBrand(brand) ? brandBrief(brand) : ""), 500);
      const text = reply.trim();
      if (text) setAiCritique(text); else toast("The model didn't return a critique — try again.", "error");
    } catch (e) { toast(e instanceof Error ? e.message : "Critique failed — check your AI connection.", "error"); }
    finally { setCritiqueBusy(false); }
  };
  const contact = doc.contact ?? { enabled: false };
  const verification = doc.verification ?? { enabled: false, channel: "email" as const };
  const followUp = doc.followUp ?? { enabled: false };
  const payment = doc.payment ?? { enabled: false, priceCents: 0, currency: wsCurrency };
  const priceMajor = payment.priceCents ? (payment.priceCents / 100).toString() : "";

  // publish=true serves it live at /q/slug immediately; publish=false saves a
  // draft that isn't served — the staging path the old "always published:true"
  // save never allowed.
  const save = useCallback(async (publish = true) => {
    const v = validateFunnelDoc(doc);
    if (v) { setErr(v); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/business/funnels${wsQuery}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc, published: publish }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr((d as { error?: string }).error || "Could not save."); setSaving(false); return; }
      setQuestionsDraftPending(false);
      onSaved();
    } catch { setErr("Network error — please try again."); setSaving(false); }
  }, [doc, onSaved, wsQuery]);

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Lead Funnel Builder</div>
          <h1>{isNew ? "New funnel" : "Edit funnel"}</h1>
          <div style={{ marginTop: 8 }}><GroundingChips brand={hasBrand(brand)} strategy={!!strategy?.has} /></div>
        </div>
        <button className="btn ghost" onClick={onCancel}>← All funnels</button>
      </div>

      <AIStatus />

      {/* Basics */}
      <div className="card">
        <div className="card-h">Basics</div>
        <label className="fld"><span>Title</span>
          <input value={doc.title} onChange={(e) => { patch({ title: e.target.value }); if (isNew && !slugEdited) patch({ slug: slugify(e.target.value) }); }} />
        </label>
        <label className="fld"><span>Link slug <em>/q/{doc.slug || "…"}</em></span>
          <input value={doc.slug} disabled={!isNew} onChange={(e) => { setSlugEdited(true); patch({ slug: slugify(e.target.value) }); }} />
        </label>
        <label className="fld"><span>Intro <button type="button" className="mini-ai" disabled={introBusy} onClick={() => void improveIntro()}><MarketingIcon name="spark" size={12} /> {introBusy ? "Writing…" : "Improve with AI"}</button></span>
          <textarea rows={2} value={doc.intro ?? ""} onChange={(e) => patch({ intro: e.target.value })} />
        </label>
        <label className="fld"><span>Brand colour</span>
          <span className="colorrow"><input type="color" value={doc.brandColor || "#0a9e6e"} onChange={(e) => patch({ brandColor: e.target.value })} /><code>{doc.brandColor}</code></span>
        </label>
      </div>

      {/* Questions */}
      <div className="card">
        <div className="card-h">Questions <span className="hint">Points on each answer decide the score</span>
          <button type="button" className="mini-ai" style={{ marginLeft: "auto" }} disabled={questionsBusy} onClick={() => void draftQuestions()}><MarketingIcon name="spark" size={12} /> {questionsBusy ? "Drafting…" : "Draft from Message"}</button>
        </div>
        {questionsDraftPending && (
          <div className="draft-pending"><b>AI draft</b> Not yet reviewed — read the questions and points below, then save.</div>
        )}
        {doc.questions.map((q, i) => (
          <QuestionEditor key={i} q={q} index={i} total={doc.questions.length}
            onChange={(nq) => setQuestion(i, nq)} onRemove={() => removeQuestion(i)} onMove={(dir) => moveQuestion(i, dir)} />
        ))}
        <button className="btn" onClick={addQuestion}>+ Add question</button>
      </div>

      {/* Scoring */}
      <div className="card">
        <div className="card-h">Who qualifies <Explain term="Qualified lead" /> <span className="hint">Max possible score: {max}</span></div>
        <label className="fld inline"><span>Qualified at ≥</span>
          <input type="number" value={doc.thresholds.qualified} onChange={(e) => patch({ thresholds: { ...doc.thresholds, qualified: Number(e.target.value) || 0 } })} />
          <em>points → shows the calendar</em>
        </label>
        <label className="fld inline"><span>Nurture at ≥</span>
          <input type="number" value={doc.thresholds.nurture} onChange={(e) => patch({ thresholds: { ...doc.thresholds, nurture: Number(e.target.value) || 0 } })} />
          <em>points → playbook follow-up</em>
        </label>
        <div className="scorebar">
          <span className="seg u" style={{ flex: Math.max(1, doc.thresholds.nurture) }}>Unqualified</span>
          <span className="seg n" style={{ flex: Math.max(1, doc.thresholds.qualified - doc.thresholds.nurture) }}>Nurture</span>
          <span className="seg q" style={{ flex: Math.max(1, (max - doc.thresholds.qualified) || 1) }}>Qualified</span>
        </div>
      </div>

      {/* Contact capture */}
      <div className="card">
        <div className="card-h">Collect contact <span className="hint">Asked once, after the questions — so every lead has a name + email</span></div>
        <label className="chk big"><input type="checkbox" checked={contact.enabled} onChange={(e) => patch({ contact: { ...contact, enabled: e.target.checked } })} /> Ask visitors for their contact details</label>
        {contact.enabled && (
          <div style={{ marginTop: 10 }}>
            <label className="fld"><span>Headline</span>
              <input value={contact.headline ?? ""} onChange={(e) => patch({ contact: { ...contact, headline: e.target.value } })} placeholder="Where should we send this?" />
            </label>
            <label className="fld"><span>Subtext</span>
              <input value={contact.subtext ?? ""} onChange={(e) => patch({ contact: { ...contact, subtext: e.target.value } })} placeholder="So we can follow up with the right next step." />
            </label>
            <div className="q-meta" style={{ margin: 0 }}>
              <label className="chk"><input type="checkbox" checked={contact.askName !== false} onChange={(e) => patch({ contact: { ...contact, askName: e.target.checked } })} /> Ask name</label>
              <label className="chk"><input type="checkbox" checked={contact.askPhone !== false} onChange={(e) => patch({ contact: { ...contact, askPhone: e.target.checked } })} /> Ask phone</label>
              <label className="chk"><input type="checkbox" checked={!!contact.requirePhone} disabled={contact.askPhone === false} onChange={(e) => patch({ contact: { ...contact, requirePhone: e.target.checked } })} /> Phone required</label>
            </div>
            <div className="hint" style={{ paddingTop: 8 }}>Email is always required. Qualified leads see the calendar after this — with these details pre-filled.</div>
          </div>
        )}
      </div>

      {/* Verification */}
      <div className="card">
        <div className="card-h">Verify contact <span className="hint">A one-time code before qualified leads can book</span></div>
        <label className="chk big"><input type="checkbox" checked={verification.enabled} onChange={(e) => patch({ verification: { ...verification, enabled: e.target.checked } })} /> Require verification before booking</label>
        {verification.enabled && (
          <div className="q-meta" style={{ marginTop: 10, marginBottom: 0 }}>
            <label>Send code by
              <select value={verification.channel} onChange={(e) => patch({ verification: { ...verification, channel: e.target.value as "email" | "sms" } })}>
                <option value="email">Email</option>
                <option value="sms">SMS (text)</option>
              </select>
            </label>
            <span className="hint">{verification.channel === "sms" ? "Needs an SMS provider (Twilio) configured; falls back to a dev code otherwise." : "Uses your email sender; a dev code is shown when no mailer is set."}</span>
          </div>
        )}
      </div>

      {/* Paid step */}
      <div className="card">
        <div className="card-h">Charge a fee <span className="hint">A deposit, paid consult or tripwire — collected before the calendar</span></div>
        <label className="chk big"><input type="checkbox" checked={payment.enabled} onChange={(e) => patch({ payment: { ...payment, enabled: e.target.checked } })} /> Take a payment on this funnel</label>
        {payment.enabled && (
          <div style={{ marginTop: 10 }}>
            <div className="q-meta" style={{ margin: 0 }}>
              <label>Price
                <input type="number" min="0" step="0.01" inputMode="decimal" value={priceMajor}
                  onChange={(e) => { const major = parseFloat(e.target.value); patch({ payment: { ...payment, priceCents: Number.isFinite(major) ? Math.max(0, Math.round(major * 100)) : 0 } }); }}
                  placeholder="49.00" style={{ width: 110 }} />
              </label>
              <label>Currency
                <select value={payment.currency} onChange={(e) => patch({ payment: { ...payment, currency: e.target.value } })}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code.toLowerCase()}>{c.code} {c.symbol}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="fld"><span>Button label</span>
              <input value={payment.label ?? ""} onChange={(e) => patch({ payment: { ...payment, label: e.target.value } })} placeholder="Reserve your spot" />
            </label>
            <label className="fld"><span>Receipt description</span>
              <input value={payment.description ?? ""} onChange={(e) => patch({ payment: { ...payment, description: e.target.value } })} placeholder="Strategy call deposit" />
            </label>
            <div className="hint" style={{ paddingTop: 4 }}>The price is fixed server-side — visitors can never change it. Stripe pays out straight to your connected account.</div>
            {connectStatus === "active" ? (
              <div className="draft-pending" style={{ marginTop: 10 }}><b>Payments ready</b> Your Stripe account is connected — charges will go through.</div>
            ) : connectStatus === "unconfigured" ? (
              <div className="err" role="status" style={{ marginTop: 10 }}>Payments aren&rsquo;t enabled on this server yet — an admin sets the Stripe keys. You can configure the price now; it&rsquo;ll charge once payments are on.</div>
            ) : connectStatus === "loading" ? null : (
              <div className="err" role="status" style={{ marginTop: 10 }}>
                No active Stripe account yet, so this funnel won&rsquo;t charge until you connect one. <a href="/business" style={{ textDecoration: "underline" }}>Connect payments in Business →</a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Outcomes */}
      <div className="card">
        <div className="card-h">Outcome screens</div>
        {(["qualified", "nurture", "unqualified"] as const).map((k) => (
          <div className="outcome" key={k}>
            <div className={`outcome-tag ${k}`}>{k}</div>
            <input className="oc-h" placeholder="Heading" value={doc.outcomes[k].heading} onChange={(e) => patch({ outcomes: { ...doc.outcomes, [k]: { ...doc.outcomes[k], heading: e.target.value } } })} />
            <input className="oc-b" placeholder="Body" value={doc.outcomes[k].body} onChange={(e) => patch({ outcomes: { ...doc.outcomes, [k]: { ...doc.outcomes[k], body: e.target.value } } })} />
            <input className="oc-c" placeholder="Button label" value={doc.outcomes[k].ctaLabel} onChange={(e) => patch({ outcomes: { ...doc.outcomes, [k]: { ...doc.outcomes[k], ctaLabel: e.target.value } } })} />
            {k === "qualified"
              ? <div className="oc-note">Opens the booking calendar.</div>
              : <input className="oc-c" placeholder="Button link (https://…)" value={doc.outcomes[k].ctaHref ?? ""} onChange={(e) => patch({ outcomes: { ...doc.outcomes, [k]: { ...doc.outcomes[k], ctaHref: e.target.value } } })} />}
            <div className="oc-sell">
              <button type="button" className="oc-sellbtn" onClick={() => setSellFor((s) => (s === k ? null : k))}>
                <MarketingIcon name="spark" size={12} /> {sellFor === k ? "Hide" : "Sell this screen better"}
              </button>
              {sellFor === k && (
                <div className="oc-sellpanel">
                  <SellBetter
                    key={k}
                    initialText={doc.outcomes[k].body}
                    kind="landing"
                    onUse={(t) => { patch({ outcomes: { ...doc.outcomes, [k]: { ...doc.outcomes[k], body: t } } }); setSellFor(null); }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="hint" style={{ paddingTop: 4 }}>Give the nurture &amp; unqualified buttons a real link — your playbook, a free training, a lead magnet — so they go somewhere.</div>
        <label className="chk big" style={{ marginTop: 12 }}><input type="checkbox" checked={followUp.enabled} onChange={(e) => patch({ followUp: { ...followUp, enabled: e.target.checked } })} /> Email the resource to nurture &amp; unqualified leads automatically</label>
        <div className="hint" style={{ paddingTop: 4 }}>When on, a lead who doesn&rsquo;t book still gets their outcome&rsquo;s link by email (needs a mail sender configured).</div>
      </div>

      {/* Funnel health */}
      <div className="card">
        <div className="card-h">Funnel health <span className="hint">A quick check before you publish</span>
          <button type="button" className="mini-ai" style={{ marginLeft: "auto" }} disabled={critiqueBusy} onClick={() => void critiqueCopy()}><MarketingIcon name="spark" size={12} /> {critiqueBusy ? "Reviewing…" : "AI review the copy"}</button>
        </div>
        <div className="health">
          <div className={`health-score s-${health.score >= 80 ? "good" : health.score >= 50 ? "warn" : "bad"}`}>
            <div className="hs-num">{health.score}</div><div className="hs-cap">/ 100</div>
          </div>
          <ul className="findings">
            {health.findings.map((fd) => (
              <li className={`finding sev-${fd.severity}`} key={fd.id}>
                <span className="fd-dot" aria-hidden />
                <span className="fd-area">{fd.area}</span>
                <span className="fd-msg">{fd.message}</span>
                {fd.fixId && <button type="button" className="fd-fix" onClick={() => applyFinding(fd.fixId!)}>{fd.fixLabel ?? "Fix"}</button>}
              </li>
            ))}
          </ul>
        </div>
        {aiCritique && <div className="ai-critique">{aiCritique}</div>}
      </div>

      {/* Save bar */}
      <div className="savebar">
        {(err || validation) && <div className="err" role="alert">{err || validation}</div>}
        <div className="savebar-btns">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" disabled={saving || !!validation} onClick={() => void save(false)} title="Save without serving it publicly">{saving ? "Saving…" : "Save as draft"}</button>
          <button className="btn primary" disabled={saving || !!validation} onClick={() => void save(true)}>{saving ? "Saving…" : isNew ? "Publish funnel" : "Save & publish"}</button>
        </div>
      </div>
    </Shell>
  );
}

interface FunnelReport {
  scope: string; views: number; starts: number; leads: number; qualified: number; nurture: number; unqualified: number; verified: number; booked: number;
  stages: { key: string; label: string; count: number }[];
  byAd: { source: string; leads: number; qualified: number; booked: number }[];
  spend: number; currency: string; costPerQualified: number; costPerBooking: number;
}

function money(n: number, ccy: string): string {
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n); }
  catch { return `${ccy} ${n.toFixed(2)}`; }
}

function Analytics({ slug, title, onBack }: { slug: string; title: string; onBack: () => void }) {
  const [rep, setRep] = useState<FunnelReport | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [spendInput, setSpendInput] = useState("");
  const [savingSpend, setSavingSpend] = useState(false);
  // Seed the spend field from the server exactly once. Without this, keying the
  // fetch on spendInput refetched on every keystroke and could stomp what the
  // user was typing (or re-fill a field they intentionally cleared).
  const spendSeeded = useRef(false);
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/business/funnels/analytics${wsQuery}${wsQuery ? "&" : "?"}slug=${encodeURIComponent(slug)}`, { credentials: "include" });
      if (!r.ok) { setState("error"); return; }
      const d = await r.json();
      setRep(d.report); setState("ok");
      if (d.report && !spendSeeded.current) { spendSeeded.current = true; setSpendInput(d.report.spend ? String(d.report.spend) : ""); }
    } catch { setState("error"); }
  }, [slug, wsQuery]);
  useEffect(() => { void load(); }, [load]);

  const saveSpend = useCallback(async () => {
    setSavingSpend(true);
    try {
      await fetch(`/api/business/funnels/analytics${wsQuery}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, amount: Number(spendInput) || 0 }) });
      await load();
    } finally { setSavingSpend(false); }
  }, [slug, spendInput, load, wsQuery]);

  if (state === "loading") return <Shell><div className="panel center"><div className="spinner" />Loading analytics…</div></Shell>;
  if (state === "error" || !rep) return <Shell><Notice icon="⚠️" title="Couldn&rsquo;t load analytics" onRetry={() => void load()} /></Shell>;

  const top = Math.max(1, rep.stages[0]?.count ?? 1, ...rep.stages.map((s) => s.count));
  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Funnel Analytics</div>
          <h1>{title}</h1>
          <p className="sub">How visitors move through <code>/q/{slug}</code> — and what each qualified lead and booked call is costing you.</p>
        </div>
        <button className="btn ghost" onClick={onBack}>← All funnels</button>
      </div>

      {/* Conversion funnel */}
      <div className="card">
        <div className="card-h">Conversion</div>
        {rep.stages.map((s, i) => {
          const prev = i > 0 ? rep.stages[i - 1]!.count : s.count;
          const pct = prev > 0 ? Math.round((s.count / prev) * 100) : 0;
          return (
            <div className="stage" key={s.key}>
              <div className="stage-label">{s.label}</div>
              <div className="stage-bar"><span style={{ width: `${Math.round((s.count / top) * 100)}%` }}>{s.count}</span></div>
              <div className="stage-pct">{i === 0 ? "" : `${pct}%`}</div>
            </div>
          );
        })}
        {rep.views === 0 && rep.leads === 0 && <div className="hint" style={{ paddingTop: 8 }}>No traffic yet — share your funnel link and the numbers fill in.</div>}
      </div>

      {/* Cost / CAC */}
      <div className="card">
        <div className="card-h">Cost per result <span className="hint">Enter ad spend to see CAC</span></div>
        <div className="spend-row">
          <label className="fld inline" style={{ margin: 0 }}><span>Ad spend</span>
            <input type="number" value={spendInput} onChange={(e) => setSpendInput(e.target.value)} placeholder="0" />
          </label>
          <button className="btn" disabled={savingSpend} onClick={() => void saveSpend()}>{savingSpend ? "Saving…" : "Save"}</button>
        </div>
        <div className="cac">
          <div className="cac-stat"><div className="cac-n">{rep.qualified > 0 && rep.spend > 0 ? money(rep.costPerQualified, rep.currency) : "—"}</div><div className="cac-l">per qualified lead</div></div>
          <div className="cac-stat"><div className="cac-n">{rep.booked > 0 && rep.spend > 0 ? money(rep.costPerBooking, rep.currency) : "—"}</div><div className="cac-l">per booked call</div></div>
        </div>
      </div>

      {/* Per-ad breakdown */}
      <div className="card">
        <div className="card-h">By source</div>
        {rep.byAd.length === 0
          ? <div className="hint">No leads yet — once visitors complete your funnel, you&rsquo;ll see which ads bring the best-qualified ones here.</div>
          : <div className="adtable">
              <div className="adrow adhead"><span>Source</span><span>Leads</span><span>Qualified</span><span>Rate</span></div>
              {rep.byAd.map((a) => (
                <div className="adrow" key={a.source}>
                  <span className="adsrc">{a.source}</span>
                  <span>{a.leads}</span>
                  <span>{a.qualified}</span>
                  <span>{a.leads > 0 ? Math.round((a.qualified / a.leads) * 100) : 0}%</span>
                </div>
              ))}
            </div>}
      </div>
    </Shell>
  );
}

function QuestionEditor({ q, index, total, onChange, onRemove, onMove }: { q: BuilderQuestion; index: number; total: number; onChange: (q: BuilderQuestion) => void; onRemove: () => void; onMove: (dir: -1 | 1) => void }) {
  const hasOptions = q.kind === "single" || q.kind === "multi";
  const setOption = (i: number, o: BuilderOption) => onChange({ ...q, options: (q.options ?? []).map((x, j) => j === i ? o : x) });
  const addOption = () => onChange({ ...q, options: [...(q.options ?? []), { value: `opt${(q.options?.length ?? 0) + 1}`, label: "New option", points: 0 }] });
  const removeOption = (i: number) => onChange({ ...q, options: (q.options ?? []).filter((_, j) => j !== i) });

  return (
    <div className="q">
      <div className="q-top">
        <span className="q-n">{index + 1}</span>
        <input className="q-prompt" value={q.prompt} onChange={(e) => onChange({ ...q, prompt: e.target.value })} placeholder="Question prompt" />
        <div className="q-moves">
          <button className="btn tiny" aria-label="Move question up" title="Move up" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button className="btn tiny" aria-label="Move question down" title="Move down" disabled={index === total - 1} onClick={() => onMove(1)}>↓</button>
          <button className="btn tiny danger" aria-label="Remove question" title="Remove question" onClick={onRemove}>✕</button>
        </div>
      </div>
      <div className="q-meta">
        <label>ID <input className="q-id" value={q.id} onChange={(e) => onChange({ ...q, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })} /></label>
        <label>Type
          <select value={q.kind} onChange={(e) => onChange({ ...q, kind: e.target.value as BuilderQuestion["kind"] })}>
            <option value="single">Single choice</option>
            <option value="multi">Multiple choice</option>
            <option value="number">Number</option>
            <option value="text">Text</option>
          </select>
        </label>
        <label className="chk"><input type="checkbox" checked={!!q.required} onChange={(e) => onChange({ ...q, required: e.target.checked })} /> Required</label>
      </div>
      {hasOptions && (
        <div className="opts">
          <div className="opts-head"><span>Answer</span><span>Points</span><span>Instant no</span><span /></div>
          {(q.options ?? []).map((o, i) => (
            <div className="opt" key={i}>
              <input value={o.label} onChange={(e) => setOption(i, { ...o, label: e.target.value, value: o.value || slugValue(e.target.value) })} placeholder="Answer label" />
              <input type="number" value={o.points ?? 0} disabled={o.disqualify} onChange={(e) => setOption(i, { ...o, points: Number(e.target.value) || 0 })} />
              <label className="chk"><input type="checkbox" checked={!!o.disqualify} onChange={(e) => setOption(i, { ...o, disqualify: e.target.checked })} /></label>
              <button className="btn tiny danger" onClick={() => removeOption(i)}>✕</button>
            </div>
          ))}
          <button className="btn tiny" onClick={addOption}>+ Add answer</button>
        </div>
      )}
      {!hasOptions && <div className="hint pad">Text / number answers are captured but don&rsquo;t score.</div>}
    </div>
  );
}

function slugValue(label: string): string { return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "opt"; }

function Shell({ children }: { children: ReactNode }) { return <div className="hub-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-warn:#b45309;--ds-warn-soft:#fff7ed;--ds-danger-soft:#fff1f1;--ds-muted-soft:#f1f5f9;
  --ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:760px;margin:0 auto;padding:26px 18px 140px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-warn-soft:#2a2005;--ds-muted-soft:#1a2234;
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.hub-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:26px;font-weight:700;margin:2px 0 5px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-brand);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:62ch;line-height:1.5;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.btn.big{font-size:14px;padding:11px 18px;}
.btn.tiny{padding:5px 9px;font-size:12px;border-radius:8px;}
.btn.tiny.danger{color:var(--ds-danger);border-color:var(--ds-danger-soft);}
.btn.tiny.danger:hover{background:var(--ds-danger-soft);}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px;box-shadow:var(--ds-shadow-xs);}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:160px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.lock{font-size:34px;}
.empty{background:var(--surface);border:1px dashed var(--border-strong);border-radius:var(--ds-radius-lg);padding:22px 16px;text-align:center;color:var(--ds-text-tertiary);font-size:13px;line-height:1.6;}
.empty a{color:var(--ds-brand);font-weight:500;}

.rows{display:flex;flex-direction:column;gap:8px;}
.picker{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px;box-shadow:var(--ds-shadow-xs);}
.picker-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.picker-title{font-size:14px;font-weight:700;}
.picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
.tmpl{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;background:var(--ds-surface-subtle);border:1px solid var(--border-strong);border-radius:var(--ds-radius-md);padding:14px;cursor:pointer;transition:border-color .12s,transform .1s,box-shadow .12s;}
.tmpl:hover{border-color:var(--ds-brand);transform:translateY(-1px);box-shadow:var(--ds-shadow-md);}
.tmpl.blank{background:var(--ds-brand-soft);border-style:dashed;border-color:var(--ds-brand);}
.tmpl-ic{font-size:22px;}
.tmpl-name{font-size:14px;font-weight:700;color:var(--text);}
.tmpl-desc{font-size:12px;color:var(--muted);line-height:1.45;}
.tmpl.community{position:relative;padding:0;background:transparent;border:none;}
.tmpl-copy{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;width:100%;height:100%;background:var(--ds-surface-subtle);border:1px solid var(--border-strong);border-radius:var(--ds-radius-md);padding:14px;cursor:pointer;transition:border-color .12s,transform .1s,box-shadow .12s;}
.tmpl-copy:hover{border-color:var(--ds-brand);transform:translateY(-1px);box-shadow:var(--ds-shadow-md);}
.tmpl-copy:disabled{cursor:default;opacity:.7;}
.tmpl-uses{font-size:11px;font-weight:700;color:var(--ds-brand);margin-top:auto;padding-top:4px;}
.tmpl-unpub{position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;border:1px solid var(--border-strong);background:var(--surface);color:var(--ds-danger);font-size:11px;font-weight:700;cursor:pointer;display:grid;place-items:center;line-height:1;}
.tmpl-unpub:hover{background:var(--ds-danger-soft);border-color:var(--ds-danger-soft);}
.banner{background:var(--ds-brand-soft);border:1px solid var(--ds-brand);color:var(--ds-brand-hover);border-radius:var(--ds-radius-md);padding:10px 14px;font-size:13px;font-weight:500;margin-bottom:14px;cursor:pointer;}
.frow{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-left-width:3px;border-left-color:var(--border);border-radius:var(--ds-radius-lg);padding:13px 15px;box-shadow:var(--ds-shadow-xs);transition:box-shadow .15s var(--ds-ease,ease),border-left-color .15s var(--ds-ease,ease);}
.frow.live{border-left-color:var(--ds-success);}
.frow.draft{border-left-color:var(--ds-border-strong);}
.frow:hover{box-shadow:var(--ds-shadow-sm);}
.frow-main{flex:1;min-width:0;}
.frow-title{font-weight:700;font-size:14.5px;display:flex;align-items:center;gap:8px;}
.frow-sub{font-size:12px;color:var(--muted);margin-top:3px;}
.frow-next{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:11.5px;line-height:1.4;color:var(--ds-text-tertiary);}
.frow-next::before{content:"";flex:none;width:6px;height:6px;border-radius:50%;background:var(--ds-text-tertiary);}
.frow.live .frow-next::before{background:var(--ds-success);}
.frow-next a{color:var(--ds-brand);font-weight:700;text-decoration:none;}
.frow-next a:hover{text-decoration:underline;}
.frow-actions{display:flex;gap:6px;flex-wrap:wrap;}
.btn.tiny.go-live{background:var(--ds-brand-soft);border-color:var(--ds-brand);color:var(--ds-brand-active);}
.btn.tiny.go-live:hover{background:var(--ds-brand-soft);border-color:var(--ds-brand-hover);color:var(--ds-brand-active);}
.tag{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:2px 7px;border-radius:999px;}
.tag.live::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;animation:frowLivePulse 2s var(--ds-ease,ease) infinite;}
.tag.draft::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.7;}
@keyframes frowLivePulse{0%,100%{opacity:1;}50%{opacity:.35;}}
.list-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px;}
.list-heading{display:flex;flex-direction:column;gap:2px;min-width:0;}
.list-title{font-size:13.5px;font-weight:700;color:var(--text);}
.list-help{font-size:11.5px;color:var(--ds-text-tertiary);line-height:1.4;}
.counts{display:flex;align-items:center;gap:6px;flex:none;}
.count-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:var(--ds-muted-soft);color:var(--ds-text-tertiary);}
.count-pill::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;}
.count-pill.live{background:var(--ds-success-soft);color:var(--ds-success);}
@media(max-width:560px){
  .frow{flex-direction:column;align-items:stretch;}
  .frow-title{flex-wrap:wrap;}
}
.tag.live{background:var(--ds-success-soft);color:var(--ds-success);}
.tag.draft{background:var(--ds-muted-soft);color:var(--ds-text-tertiary);}

.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 16px 18px;box-shadow:var(--ds-shadow-xs);margin-bottom:14px;}
.card-h{font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:10px;}
.hint{font-size:11.5px;font-weight:500;color:var(--ds-text-tertiary);}
.hint.pad{padding:6px 2px 0;}
.fld{display:flex;flex-direction:column;gap:5px;margin-bottom:11px;font-size:12.5px;font-weight:500;color:var(--muted);}
.fld em{font-weight:500;color:var(--ds-text-tertiary);font-style:normal;}
.mini-ai{margin-left:8px;display:inline-flex;align-items:center;gap:4px;background:var(--ds-brand-soft);color:var(--ds-brand);border:none;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer;vertical-align:middle;}
.mini-ai:disabled{opacity:.6;cursor:default;}
.mini-ai svg{color:var(--ds-brand);}
/* Informational — real content sitting in the form, not yet reviewed; not a
   problem, so it stays blue, not amber/red. */
.draft-pending{display:flex;align-items:center;gap:8px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;border-radius:10px;padding:9px 12px;font-size:12.5px;line-height:1.5;margin:0 0 10px;}
.draft-pending b{flex:0 0 auto;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;background:#1d4ed8;color:#fff;border-radius:6px;padding:2px 7px;}
:root[data-theme="dark"] .draft-pending{background:#0f1d3a;border-color:#1e3a6e;color:#bfdbfe;}
.fld.inline{flex-direction:row;align-items:center;gap:10px;}
.fld.inline input{width:80px;}
.fld input,.fld textarea,.q input,.q select,.opt input,.outcome input{font-family:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:9px;padding:9px 11px;width:100%;}
.fld input:focus,.q input:focus,.opt input:focus,.outcome input:focus{outline:none;border-color:var(--ds-brand);}
.colorrow{display:flex;align-items:center;gap:10px;}
.colorrow input[type=color]{width:44px;height:32px;padding:2px;border-radius:8px;}
.colorrow code{font-size:12px;color:var(--muted);}

.q{border:1px solid var(--border);border-radius:var(--ds-radius-md);padding:12px;margin-bottom:10px;background:var(--ds-surface-subtle);}
.q-top{display:flex;align-items:center;gap:9px;}
.q-n{width:24px;height:24px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand);font-weight:700;font-size:12px;display:grid;place-items:center;flex:none;}
.q-prompt{flex:1;font-weight:500;}
.q-moves{display:flex;gap:4px;}
.q-meta{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:10px 0;font-size:12px;color:var(--muted);}
.q-meta label{display:flex;align-items:center;gap:6px;}
.q-meta select{width:auto;padding:6px 9px;}
.q-id{width:90px;padding:6px 9px !important;}
.chk{display:flex;align-items:center;gap:5px;cursor:pointer;}
.chk input{width:auto !important;}
.chk.big{font-size:13.5px;font-weight:500;color:var(--text);gap:8px;}
.opts{margin-top:6px;}
.opts-head{display:grid;grid-template-columns:1fr 80px 64px 34px;gap:8px;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);font-weight:700;padding:0 2px 6px;}
.opt{display:grid;grid-template-columns:1fr 80px 64px 34px;gap:8px;align-items:center;margin-bottom:7px;}
.opt .chk{justify-content:center;}

.scorebar{display:flex;gap:4px;margin-top:12px;height:34px;font-size:11px;font-weight:700;}
.scorebar .seg{display:flex;align-items:center;justify-content:center;border-radius:7px;color:#fff;padding:0 6px;text-align:center;overflow:hidden;}
.seg.u{background:#94a3b8;}.seg.n{background:var(--ds-warn);}.seg.q{background:var(--ds-success);}

.outcome{display:grid;grid-template-columns:96px 1fr;gap:8px 10px;align-items:start;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border);}
.outcome:last-child{border-bottom:none;margin-bottom:0;padding-bottom:0;}
.outcome-tag{grid-row:span 3;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:5px 8px;border-radius:8px;text-align:center;align-self:start;}
.outcome-tag.qualified{background:var(--ds-success-soft);color:var(--ds-success);}
.outcome-tag.nurture{background:var(--ds-warn-soft);color:var(--ds-warn);}
.outcome-tag.unqualified{background:var(--ds-muted-soft);color:var(--ds-text-tertiary);}
.oc-h{font-weight:500;}.oc-b,.oc-c{font-size:13px !important;}
.oc-note{font-size:12px;color:var(--ds-text-tertiary);padding:4px 2px;}
.oc-sell{grid-column:2 / -1;}
.oc-sellbtn{display:inline-flex;align-items:center;gap:4px;background:var(--ds-brand-soft);color:var(--ds-brand);border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;}
.oc-sellbtn svg{color:var(--ds-brand);}
.oc-sellpanel{margin-top:8px;}
@media(max-width:520px){.oc-sell{grid-column:1 / -1;}}

.savebar{position:sticky;bottom:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 14px;box-shadow:0 -4px 16px -6px rgba(15,23,42,.12);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px;}
.savebar .err{color:var(--ds-danger);font-size:12.5px;font-weight:500;flex:1;min-width:180px;}
.savebar-btns{display:flex;gap:8px;margin-left:auto;}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.stage{display:grid;grid-template-columns:88px 1fr 44px;gap:10px;align-items:center;margin-bottom:8px;}
.stage-label{font-size:12.5px;font-weight:500;color:var(--muted);text-align:right;}
.stage-bar{background:var(--ds-bg-subtle);border-radius:8px;overflow:hidden;height:30px;display:flex;}
.stage-bar span{background:linear-gradient(90deg,var(--ds-brand),#3fd39e);color:#fff;font-size:12.5px;font-weight:700;display:flex;align-items:center;padding:0 10px;border-radius:8px;min-width:28px;transition:width .4s var(--ds-ease,ease);white-space:nowrap;}
.stage-pct{font-size:12px;font-weight:700;color:var(--ds-success);text-align:right;}
.spend-row{display:flex;align-items:flex-end;gap:10px;margin-bottom:14px;}
.spend-row .fld.inline input{width:120px;}
.cac{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.cac-stat{background:var(--ds-bg-subtle);border-radius:var(--ds-radius-md);padding:12px 14px;text-align:center;}
.cac-n{font-size:22px;font-weight:700;letter-spacing:-.5px;}
.cac-l{font-size:11.5px;color:var(--muted);margin-top:4px;}
.adtable{display:flex;flex-direction:column;gap:2px;}
.adrow{display:grid;grid-template-columns:1fr 60px 72px 56px;gap:8px;align-items:center;padding:8px 4px;border-bottom:1px solid var(--border);font-size:13px;}
.adrow.adhead{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);font-weight:700;border-bottom:1px solid var(--border-strong);}
.adrow span:not(.adsrc){text-align:right;}
.adsrc{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
@media(max-width:520px){.outcome{grid-template-columns:1fr;}.outcome-tag{grid-row:auto;justify-self:start;}}

.health{display:flex;gap:16px;align-items:flex-start;}
.health-score{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;width:84px;height:84px;border-radius:16px;border:2px solid;}
.health-score.s-good{border-color:var(--ds-success,#15803d);color:var(--ds-success,#15803d);background:var(--ds-success-soft,#ecfdf3);}
.health-score.s-warn{border-color:#b45309;color:#b45309;background:#fff7ed;}
.health-score.s-bad{border-color:var(--ds-danger,#c81e1e);color:var(--ds-danger,#c81e1e);background:var(--ds-danger-soft,#fef2f2);}
.hs-num{font-size:30px;font-weight:700;line-height:1;letter-spacing:-1px;}
.hs-cap{font-size:11px;font-weight:700;opacity:.75;margin-top:2px;}
.findings{list-style:none;margin:0;padding:0;flex:1;min-width:0;display:flex;flex-direction:column;gap:7px;}
.finding{display:flex;align-items:center;gap:8px;font-size:12.5px;line-height:1.45;flex-wrap:wrap;}
.fd-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--ds-text-tertiary);}
.finding.sev-good .fd-dot{background:var(--ds-success,#15803d);}
.finding.sev-warn .fd-dot{background:#d97706;}
.finding.sev-fix .fd-dot{background:var(--ds-danger,#c81e1e);}
.fd-area{font-weight:700;color:var(--text);flex:0 0 auto;}
.fd-msg{color:var(--muted);flex:1;min-width:120px;}
.fd-fix{flex:0 0 auto;background:var(--ds-brand);color:#fff;border:none;border-radius:6px;padding:3px 10px;font-size:11.5px;font-weight:700;cursor:pointer;}
.fd-fix:hover{background:var(--ds-brand-hover);}
.ai-critique{margin-top:14px;padding:12px 14px;background:var(--ds-bg-subtle,var(--ds-surface-subtle,#fafbfc));border:1px solid var(--border);border-radius:10px;font-size:13px;line-height:1.55;color:var(--text);white-space:pre-wrap;}
@media(max-width:520px){.health{flex-direction:column;}.health-score{align-self:flex-start;}}

/* Visible keyboard focus on text controls — the per-field :focus rule clears
   the outline but never drew a ring, leaving keyboard users without a cue. */
.hub-root input:not([type=checkbox]):not([type=radio]):not([type=color]):focus-visible,
.hub-root textarea:focus-visible,
.hub-root select:focus-visible{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}

@media (prefers-reduced-motion: reduce){
  .hub-root *,.hub-root *::before,.hub-root *::after{transition:none!important;animation:none!important;}
}
`;
