"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AI_PROVIDERS, getAIProvider, keyLooksValid, type AIProviderId } from "../../../lib/ai/providers";
import { callAI, loadConnection, saveConnection } from "../../../lib/ai/client";
import { MarketingIcon, type MarketingIconName } from "../../../components/MarketingIcons";
import { Notice } from "../../../components/ui/Notice";
// Canonical shape, not a hand-copy: this page used to redeclare its own
// BrandProduct/BrandTestimonial/BrandMessage/BrandProfile verbatim,
// duplicating lib/brand.ts's real definitions with no shared import — a
// silent-drift risk (this is a "use client" page, but `import type` is
// erased at compile time, so pulling from lib/brand.ts — which itself
// imports server-only pg/withAdvisoryLock — is safe here, same as this
// session's constraint/message/reality pages).
import type { BrandProduct, BrandTestimonial, BrandMessage, BrandProfile } from "../../../lib/brand";
const MESSAGE_FIELDS: { key: keyof BrandMessage; label: string; placeholder: string }[] = [
  { key: "oneLiner", label: "One-liner (the whole message in one sentence)", placeholder: "We help [who] go from [problem] to [success] with [how]." },
  { key: "hero", label: "The customer (the hero) & what they want", placeholder: "Founders who want a business that actually works." },
  { key: "problem", label: "The problem stopping them", placeholder: "They're guessing instead of planning — and it's costing money." },
  { key: "guide", label: "How your brand guides them (empathy + authority)", placeholder: "We've helped 1,000+ founders turn guesses into tested plans." },
  { key: "plan", label: "The plan (simple steps to work with you)", placeholder: "1) Map your model  2) Test it  3) Launch with confidence." },
  { key: "callToAction", label: "The call to action", placeholder: "Build your plan free." },
  { key: "success", label: "What success looks like", placeholder: "A business that grows on purpose, not by accident." },
  { key: "failure", label: "What they avoid (the stakes)", placeholder: "Burning months and budget on a plan that was never going to work." },
];
interface AiBrand {
  companyName?: string; industry?: string; description?: string; brandVoice?: string;
  audience?: string; competitors?: string; guarantees?: string; pricingNotes?: string; locations?: string;
  products?: BrandProduct[]; prohibitedWords?: string[];
}

// The AI connection (provider + key + model) is the shared, app-wide slot
// from lib/ai — set once, used by the Copilot, campaigns and here.

const INDUSTRIES = ["AI Tools", "Agency / Marketing", "SaaS / Software", "E-commerce", "Coaching / Consulting", "Education", "Health & Wellness", "Finance", "Real Estate", "Local Services", "Hospitality", "Other"];
const LANGUAGES = ["English (US)", "English (UK)", "Spanish", "French", "German", "Portuguese", "Italian", "Dutch"];

async function generate(provider: AIProviderId, key: string, model: string, system: string, user: string, maxTokens: number): Promise<string> {
  return callAI({ provider, apiKey: key, model }, system, user, maxTokens);
}
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? (fenced[1] ?? raw) : raw;
  const start = candidate.indexOf("{"), end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("The AI didn't return usable data. Try again.");
  return JSON.parse(candidate.slice(start, end + 1));
}

// `hint` adds a short plain-language line under the field (used sparingly —
// most fields lean on their placeholder for guidance); `badge` shows a small
// numbered marker before the label (used to walk through the 7-part message
// framework in order); `className` lets a specific field opt into extra
// visual treatment (e.g. the one-liner's "headline" styling) without a new prop per case.
function Field({ label, required, hint, badge, className, children }: { label: string; required?: boolean; hint?: ReactNode; badge?: number; className?: string; children: ReactNode }) {
  return (
    <label className={className ? `field ${className}` : "field"}>
      <span className="kv-label">{typeof badge === "number" && <span className="field-num" aria-hidden="true">{badge}</span>}{label}{required && <span className="req">*</span>}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

type ViewState = "loading" | "ok" | "not-authenticated" | "not-enabled" | "forbidden" | "error";
// Each step's colour comes from the shared design-system tokens (not a fixed
// hex) so it reads correctly in both the light and dark themes; `-soft` is the
// tinted "not active yet" state, the base token is the solid "active" fill.
const STEPS: { label: string; icon: MarketingIconName; solid: string; soft: string }[] = [
  { label: "Brand Info", icon: "home", solid: "var(--ds-info)", soft: "var(--ds-info-soft)" },
  { label: "Brand Voice", icon: "wave", solid: "var(--ds-brand)", soft: "var(--ds-brand-soft)" },
  { label: "Products & Proof", icon: "card", solid: "var(--ds-warning)", soft: "var(--ds-warning-soft)" },
];
// A few tone words to jump-start the brand voice field — click to add, no
// pressure to use them. Keeps a blank textarea from feeling like a test.
const VOICE_STARTERS = ["Warm", "Direct", "Playful", "Bold", "Empathetic", "Confident", "Witty", "No-nonsense"];

export default function BrandBrainPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [testimonials, setTestimonials] = useState<BrandTestimonial[]>([]);
  const [prohibited, setProhibited] = useState<string[]>([]);
  const [prohibitedInput, setProhibitedInput] = useState("");
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  // Business Reality Map prefill (AUDIT P0 — data split-brain fix, slice 1).
  // "What business are you in" / "…REALLY in" are canonically owned by the
  // Reality Map (/business/reality, workspace_business.realityMap.{businessIn,
  // businessReallyIn}) — this page's own fields must start aligned with it,
  // never silently diverge.
  // `realityIn` / `realityReallyIn` hold what the Reality Map returned:
  // undefined = not fetched yet, "" = fetched but empty/unavailable, string =
  // a real value.
  const [realityIn, setRealityIn] = useState<string | undefined>(undefined);
  const [realityReallyIn, setRealityReallyIn] = useState<string | undefined>(undefined);
  const appliedRealityPrefill = useRef(false);

  // AI
  const [aiProvider, setAiProvider] = useState<AIProviderId>("openrouter");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [scanUrl, setScanUrl] = useState("");
  const [aiBusy, setAiBusy] = useState<null | "scan" | "voice" | "positioning" | "message" | "proof">(null);
  const [aiErr, setAiErr] = useState("");

  const load = useCallback(async () => {
    setState("loading"); setMsg("");
    try {
      const entRes = await fetch("/api/campaign-studio/entitlements", { credentials: "include" });
      if (entRes.status === 401) { setState("not-authenticated"); return; }
      if (entRes.status === 403) { setState("forbidden"); return; }
      if (!entRes.ok) { setState("error"); return; }
      const entitlements = await entRes.json() as { entitlement: string }[];
      if (!entitlements.some((e) => e.entitlement === "campaign_studio")) { setState("not-enabled"); return; }
      const r = await fetch("/api/campaign-studio/brand", { credentials: "include" });
      if (!r.ok) { setState("error"); return; }
      const p = await r.json() as BrandProfile;
      setProfile(p); setProducts(p.products); setTestimonials(p.testimonials); setProhibited(p.prohibitedWords);
      setScanUrl(p.websiteUrl ?? "");
      setState("ok");
    } catch { setState("error"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const c = loadConnection();
    if (c) { setAiProvider(c.provider); setAiKey(c.apiKey); setAiModel(c.model); }
  }, []);
  const persist = (provider: AIProviderId, key: string, model: string) => saveConnection({ provider, apiKey: key, model });
  const saveProvider = (pv: AIProviderId) => { setAiProvider(pv); persist(pv, aiKey, aiModel); };
  const saveKey = (k: string) => { setAiKey(k); if (k.trim()) setAiErr(""); persist(aiProvider, k, aiModel); };
  const saveModel = (m: string) => { setAiModel(m); persist(aiProvider, aiKey, m); };
  const setField = (patch: Partial<BrandProfile>) => setProfile((p) => (p ? { ...p, ...patch } : p));

  // Fetch the canonical Reality Map value on mount, independent of the Brand
  // profile load above — best-effort, never blocks or errors the page. Only
  // ever read here; this component never writes to /api/business/reality.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/business/reality", { credentials: "include" });
        if (!r.ok) { setRealityIn(""); setRealityReallyIn(""); return; }
        const reality = await r.json() as { businessIn?: string; businessReallyIn?: string };
        setRealityIn(reality.businessIn?.trim() ?? "");
        setRealityReallyIn(reality.businessReallyIn?.trim() ?? "");
      } catch { setRealityIn(""); setRealityReallyIn(""); }
    })();
  }, []);

  // Prefill precedence (AUDIT P0, slice 1): once BOTH the Brand profile and
  // the Reality Map have loaded, seed this page's fields from the Reality Map
  // ONLY where the Brand page's own field is still empty — a value already
  // typed, or previously saved here, always wins and is left untouched.
  // Applies at most once (the ref guard): it seeds the values the user first
  // sees, then never reapplies — including if a field is later cleared —
  // and it never triggers a save by itself.
  useEffect(() => {
    if (appliedRealityPrefill.current) return;
    if (!profile || realityIn === undefined || realityReallyIn === undefined) return; // wait for all sources to resolve
    appliedRealityPrefill.current = true;
    if (realityIn && !profile.businessIn?.trim()) setField({ businessIn: realityIn });
    if (realityReallyIn && !profile.businessReallyIn?.trim()) setField({ businessReallyIn: realityReallyIn });
  }, [profile, realityIn, realityReallyIn]);

  /** Client-side resize of an uploaded logo to <=256px, stored as a data URL
   *  in logoUrl. Keeps it small enough for the brand_profiles row (see MAX_LOGO
   *  in lib/brand.ts) and avoids needing separate object storage for now. */
  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp|svg\+xml)$/.test(file.type)) { setAiErr("Logo must be a PNG, JPG, WEBP or SVG."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === "image/svg+xml") { setField({ logoUrl: src }); return; } // vectors don't need raster resize
      const img = new Image();
      img.onload = () => {
        const max = 256, scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) { setField({ logoUrl: src }); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setField({ logoUrl: canvas.toDataURL("image/png") });
      };
      img.onerror = () => setAiErr("Couldn't read that image.");
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const addProhibited = (raw: string) => {
    const v = raw.trim().replace(/,$/, "");
    if (v && !prohibited.includes(v)) setProhibited((list) => [...list, v]);
    setProhibitedInput("");
  };

  // Appends a tone word to the brand voice field as a starting point — a
  // no-op if it's already mentioned, so tapping a word twice is harmless.
  const addVoiceWord = useCallback((word: string) => {
    setProfile((p) => {
      if (!p) return p;
      const cur = (p.brandVoice ?? "").trim();
      if (new RegExp(`\\b${word}\\b`, "i").test(cur)) return p;
      return { ...p, brandVoice: cur ? `${cur} ${word}.` : `${word}.` };
    });
  }, []);

  const generateFromWebsite = useCallback(async () => {
    if (!profile) return;
    if (aiProvider === "manual") { setAiOpen(true); setAiErr("Connect an AI provider first (the AI button)."); return; }
    const url = scanUrl.trim();
    if (!url) { setAiErr("Enter your website URL to scan."); return; }
    setAiBusy("scan"); setAiErr(""); setMsg("");
    try {
      const scanRes = await fetch("/api/campaign-studio/scan-site", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const scan = await scanRes.json() as { title?: string; text?: string; error?: string };
      if (!scanRes.ok || !scan.text) throw new Error(scan.error ?? "Couldn't read that website.");
      const system = "You extract a brand profile from website text. Reply with ONLY a JSON object, no prose, no markdown fences. Keys (all optional, omit what you can't infer): companyName, industry, description (1-2 sentences), brandVoice (tone description), audience, competitors (named competitors or competitor types the site positions against), guarantees, pricingNotes, locations, products (array of {name, description, price}), prohibitedWords (array of risky claims to avoid). Infer only from the text; never invent facts.";
      const reply = await generate(aiProvider, aiKey, aiModel, system, `Website: ${url}\nTitle: ${scan.title ?? ""}\n\nText:\n${scan.text}`, 1200);
      const ai = extractJson(reply) as AiBrand;
      setProfile((p) => p ? {
        ...p, websiteUrl: url,
        companyName: ai.companyName?.trim() || p.companyName, industry: ai.industry?.trim() || p.industry,
        description: ai.description?.trim() || p.description, brandVoice: ai.brandVoice?.trim() || p.brandVoice,
        audience: ai.audience?.trim() || p.audience, competitors: ai.competitors?.trim() || p.competitors,
        guarantees: ai.guarantees?.trim() || p.guarantees,
        pricingNotes: ai.pricingNotes?.trim() || p.pricingNotes, locations: ai.locations?.trim() || p.locations,
      } : p);
      if (Array.isArray(ai.products) && ai.products.length) setProducts(ai.products.filter((x) => x && x.name));
      if (Array.isArray(ai.prohibitedWords) && ai.prohibitedWords.length) setProhibited(ai.prohibitedWords.filter(Boolean));
      setMsg("Generated from your website ✓ — review each step, then save.");
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setAiBusy(null); }
  }, [profile, aiProvider, aiKey, aiModel, scanUrl]);

  // Best-effort fetch of the saved website's text, to ground AI drafts in the
  // real business. Returns "" when no URL is set or the scan fails, so callers
  // simply fall back to the typed brand info.
  const fetchSiteText = useCallback(async (): Promise<string> => {
    const url = (scanUrl.trim() || profile?.websiteUrl || "").trim();
    if (!url) return "";
    try {
      const r = await fetch("/api/campaign-studio/scan-site", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      if (!r.ok) return "";
      const scan = await r.json();
      return scan?.text ? `\n\nWebsite (${scan.title ?? url}):\n${String(scan.text).slice(0, 4000)}` : "";
    } catch { return ""; }
  }, [scanUrl, profile]);

  const improveVoice = useCallback(async () => {
    if (!profile) return;
    if (aiProvider === "manual") { setAiOpen(true); setAiErr("Connect an AI provider first (the AI button)."); return; }
    setAiBusy("voice"); setAiErr("");
    try {
      const siteText = await fetchSiteText();
      const system = "You write concise brand voice guidelines for a marketing tool. Base the tone on the company info and any website text provided. Reply with ONLY the guideline text (2-4 sentences), no preamble, no quotes.";
      const reply = await generate(aiProvider, aiKey, aiModel, system, `Company: ${profile.companyName || "(unnamed)"}\nIndustry: ${profile.industry || "(unknown)"}\nDescription: ${profile.description || "(none)"}\nExisting notes: ${profile.brandVoice || "(none)"}${siteText}\n\nWrite a brand voice guideline.`, 300);
      if (reply) setField({ brandVoice: reply });
      setMsg("Brand voice drafted ✓");
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setAiBusy(null); }
  }, [profile, aiProvider, aiKey, aiModel, fetchSiteText]);

  // The positioning gut-check: not the category you're in, but the deeper
  // outcome customers actually buy. The AI answers from the description —
  // original strategic insight, not a canned template.
  const askPositioning = useCallback(async () => {
    if (!profile) return;
    if (aiProvider === "manual") { setAiOpen(true); setAiErr("Connect an AI provider first (the AI button)."); return; }
    setAiBusy("positioning"); setAiErr("");
    try {
      const siteText = await fetchSiteText();
      const system = "You are a sharp positioning strategist. Given a business description, answer the classic gut-check: on the surface, what business are they in? And what business are they REALLY in — the deeper transformation, outcome, or feeling customers are actually buying? Reply with ONLY a JSON object {\"surface\": string, \"really\": string}. Each 1 short sentence. Be specific and original; no clichés.";
      const reply = await generate(aiProvider, aiKey, aiModel, system, `Company: ${profile.companyName || "(unnamed)"}\nIndustry: ${profile.industry || "(unknown)"}\nDescription: ${profile.description || "(none)"}\nAudience: ${profile.audience || "(none)"}${siteText}`, 300);
      const r = extractJson(reply) as { surface?: string; really?: string };
      setField({ businessIn: r.surface?.trim() || profile.businessIn, businessReallyIn: r.really?.trim() || profile.businessReallyIn });
      setMsg("Positioning drafted ✓ — make it yours.");
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setAiBusy(null); }
  }, [profile, aiProvider, aiKey, aiModel, fetchSiteText]);

  // Generates the brand's core message on the classic seven-part story
  // structure — customer as hero, brand as guide. Original prompt in our own
  // words; the model fills the eight fields from the brand info.
  const generateMessage = useCallback(async () => {
    if (!profile) return;
    if (aiProvider === "manual") { setAiOpen(true); setAiErr("Connect an AI provider first (the AI button)."); return; }
    setAiBusy("message"); setAiErr("");
    try {
      const siteText = await fetchSiteText();
      const system = "You craft a brand's core marketing message using the well-known seven-part story structure: the CUSTOMER is the hero (not the brand); the brand is the GUIDE with empathy and authority. Reply with ONLY a JSON object with these string keys: hero (who the customer is + what they want), problem (what's stopping them), guide (how the brand shows empathy + authority), plan (simple steps to work with the brand), callToAction (the direct ask), success (what winning looks like), failure (the stakes they avoid), oneLiner (the whole message in one sentence). Keep each short and specific; never invent facts.";
      const userMsg = `Company: ${profile.companyName || "(unnamed)"}\nIndustry: ${profile.industry || "(unknown)"}\nDescription: ${profile.description || "(none)"}\nAudience: ${profile.audience || "(none)"}\nReally in: ${profile.businessReallyIn || "(none)"}${siteText}`;
      const reply = await generate(aiProvider, aiKey, aiModel, system, userMsg, 600);
      const m = extractJson(reply) as BrandMessage;
      setField({ message: { ...profile.message, ...m } });
      setMsg("Message drafted ✓ — refine it, then save.");
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI generation failed."); }
    finally { setAiBusy(null); }
  }, [profile, aiProvider, aiKey, aiModel, fetchSiteText]);

  // Products & Proof step: fill the audience / competitors / guarantees /
  // pricing blanks from the brand info already entered — the same "draft it,
  // then edit" help the Voice and Message steps offer. Only fills EMPTY fields
  // so it never overwrites what the owner typed, and never invents a specific
  // named client, testimonial, or statistic.
  const generateAudienceProof = useCallback(async () => {
    if (!profile) return;
    if (aiProvider === "manual") { setAiOpen(true); setAiErr("Connect an AI provider first (the AI button)."); return; }
    setAiBusy("proof"); setAiErr(""); setMsg("");
    try {
      // Ground the suggestions in the real website text when a URL is available,
      // so they reflect the actual business — not just the typed description.
      const siteText = await fetchSiteText();
      const system = "You fill in a brand's audience and proof details for a marketing tool. From the company info (and any website text provided), infer four things: audience (the ideal customer, 1-2 sentences), competitors (2-4 likely competitor types or names), guarantees (a sensible risk-reversal/guarantee this business could offer), pricingNotes (a realistic pricing approach). Reply with ONLY a JSON object with those four string keys. Be specific and realistic to the business; ground it in the provided material and never invent a specific named client, testimonial, or fake statistic.";
      const prods = products.filter((p) => p.name.trim()).map((p) => `${p.name}${p.price ? ` (${p.price})` : ""}`).join(", ");
      const user = `Company: ${profile.companyName || "(unnamed)"}\nIndustry: ${profile.industry || "(unknown)"}\nDescription: ${profile.description || "(none)"}\nReally in: ${profile.businessReallyIn || "(none)"}\nProducts: ${prods || "(none listed)"}${siteText}`;
      const reply = await generate(aiProvider, aiKey, aiModel, system, user, 500);
      const ai = extractJson(reply) as { audience?: string; competitors?: string; guarantees?: string; pricingNotes?: string };
      // Only fill blanks — never overwrite what the owner already wrote.
      setProfile((p) => p ? {
        ...p,
        audience: p.audience?.trim() ? p.audience : (ai.audience?.trim() || p.audience),
        competitors: p.competitors?.trim() ? p.competitors : (ai.competitors?.trim() || p.competitors),
        guarantees: p.guarantees?.trim() ? p.guarantees : (ai.guarantees?.trim() || p.guarantees),
        pricingNotes: p.pricingNotes?.trim() ? p.pricingNotes : (ai.pricingNotes?.trim() || p.pricingNotes),
      } : p);
      setMsg("Filled in the blanks — edit anything that isn't quite right.");
    } catch (e) { setAiErr(e instanceof Error ? e.message : "AI request failed."); }
    finally { setAiBusy(null); }
  }, [profile, products, aiProvider, aiKey, aiModel, fetchSiteText]);

  const save = useCallback(async () => {
    if (!profile) return;
    setSaving(true); setMsg("");
    try {
      const body = {
        websiteUrl: profile.websiteUrl ?? "", companyName: profile.companyName ?? "", industry: profile.industry ?? "",
        description: profile.description ?? "", logoUrl: profile.logoUrl ?? "", primaryColor: profile.primaryColor ?? "",
        primaryColorName: profile.primaryColorName ?? "", secondaryColor: profile.secondaryColor ?? "", secondaryColorName: profile.secondaryColorName ?? "",
        businessIn: profile.businessIn ?? "", businessReallyIn: profile.businessReallyIn ?? "",
        language: profile.language ?? "", brandVoice: profile.brandVoice ?? "", message: profile.message ?? {},
        audience: profile.audience ?? "", competitors: profile.competitors ?? "", guarantees: profile.guarantees ?? "",
        pricingNotes: profile.pricingNotes ?? "", locations: profile.locations ?? "",
        prohibitedWords: prohibited,
        products: products.filter((p) => p.name.trim()),
        testimonials: testimonials.filter((t) => t.quote.trim()),
      };
      const r = await fetch("/api/campaign-studio/brand", { method: "PATCH", headers: { "content-type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      const d = await r.json() as BrandProfile & { error?: string };
      if (!r.ok) { setMsg(d.error ?? "Could not save."); setSaving(false); return; }
      setProfile(d); setProducts(d.products); setTestimonials(d.testimonials); setProhibited(d.prohibitedWords);
      setMsg("Saved ✓ — your Brand Brain is ready.");
    } catch { setMsg("Network error."); }
    setSaving(false);
  }, [profile, prohibited, products, testimonials]);

  return (
    <div className="bb-root">
      <style>{CSS}</style>
      <header className="bb-header">
        <div>
          <div className="eyebrow">CAMPAIGN STUDIO</div>
          <h1>Brand Brain</h1>
          <p className="sub">Set this once — every AI ad, landing page, and email reads from here.</p>
        </div>
        <div className="header-right">
          <a href="/campaign-studio/campaigns" className="btn ghost"><MarketingIcon name="campaigns" size={14} /> Campaigns</a>
          <a href="/campaign-studio/connections" className="btn ghost"><MarketingIcon name="link" size={14} /> Connections</a>
          <button className="btn ghost" onClick={() => setAiOpen((o) => !o)}><MarketingIcon name="gear" size={14} /> AI key</button>
          <a href="/" className="btn ghost">← Back</a>
        </div>
      </header>

      {aiOpen && (() => {
        const prov = getAIProvider(aiProvider);
        const isManual = aiProvider === "manual";
        return (
        <div className="ai-key-card">
          <div className="prov-row">
            {AI_PROVIDERS.map((pv) => {
              const on = aiProvider === pv.id;
              return (
                <button key={pv.id} type="button" onClick={() => saveProvider(pv.id)} className={`prov-chip${on ? " on" : ""}`} aria-pressed={on}
                  style={on ? { borderColor: pv.hue, background: `${pv.hue}14`, color: pv.hue } : undefined}>
                  <span aria-hidden="true">{pv.icon}</span>{pv.name}
                </button>
              );
            })}
          </div>
          {!isManual && (<>
            <Field label={`${prov?.name ?? "Provider"} API key — saved securely to your account, sent straight to the provider`}>
              <input type="password" value={aiKey} onChange={(e) => saveKey(e.target.value)} placeholder={prov?.keyPrefix ? `${prov.keyPrefix}…` : "your API key"} autoComplete="off" />
            </Field>
            <Field label="Model">
              <input value={aiModel} onChange={(e) => saveModel(e.target.value)} placeholder={prov?.defaultModel} list="brand-ai-models" />
              <datalist id="brand-ai-models">{(prov?.models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
            </Field>
          </>)}
          <p className="hint">
            {prov?.note}{" "}{prov?.keyUrl && <a href={prov.keyUrl} target="_blank" rel="noreferrer">Get a key →</a>}
          </p>
          {!isManual && prov && aiKey.trim() && !keyLooksValid(prov, aiKey) && (
            <p className="hint" style={{ color: "var(--ds-danger)" }}>That doesn&apos;t look like a {prov.name} key — double-check it.</p>
          )}
        </div>
        );
      })()}

      {msg && <div className={`msg ${msg.includes("✓") ? "ok" : "err"}`} role="status" aria-live="polite">{msg}</div>}
      {aiErr && <div className="msg err" role="alert">{aiErr}</div>}

      {state === "loading" && <div className="panel center"><div className="spinner" /><p className="sub">Loading your brand…</p></div>}
      {state === "error" && <Notice icon="⚠️" title="Something went wrong" body="We couldn't load your Brand Brain." onRetry={() => void load()} />}
      {state === "not-authenticated" && <Notice icon="🔑" title="Please sign in" body="Sign in to set up your workspace's Brand Brain." href="/" cta="Go to sign in" />}
      {state === "forbidden" && <Notice icon="🔒" title="No access" body="You're not a member of this workspace." href="/" cta="Back" />}
      {state === "not-enabled" && <Notice icon="✨" title="Campaign Studio isn't enabled here" body="It's included with the Performance plan, or available as an add-on for Pro / Business." />}

      {state === "ok" && profile && (
        <>
          {/* Step tabs */}
          <div className="steps" aria-label="Brand Brain setup steps">
            {STEPS.map((s, i) => (
              <button key={s.label} type="button" aria-current={i === step ? "step" : undefined}
                className={`step-tab ${i === step ? "active" : ""} ${i < step ? "done" : ""}`} onClick={() => setStep(i)}>
                <span className="step-ic" style={i === step ? { background: s.solid, borderColor: s.solid, color: "#fff" } : { background: s.soft, borderColor: "transparent", color: s.solid }}><MarketingIcon name={i < step ? "check" : s.icon} size={13} /></span>
                <span className="step-label">{s.label}</span>
              </button>
            ))}
          </div>

          <div className="panel step-anim" key={step}>
            {step === 0 && (
              <>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow info">The basics</div>
                    <h2>Add your business details</h2>
                    <p className="sub">So every generated ad and page fits your brand.</p>
                  </div>
                </div>
                <div className="ai-hero">
                  <div className="ai-hero-copy"><span className="ai-badge" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MarketingIcon name="spark" size={11} /> AI</span> <b>Autofill everything from your website.</b> Paste your URL and we&apos;ll read the page.</div>
                  <div className="ai-hero-row">
                    <input className="ai-url" value={scanUrl} onChange={(e) => setScanUrl(e.target.value)} placeholder="yourbusiness.com" />
                    <button className="btn primary" onClick={() => void generateFromWebsite()} disabled={aiBusy !== null}>{aiBusy === "scan" ? "Reading your site…" : <><MarketingIcon name="spark" size={14} /> Generate from website</>}</button>
                  </div>
                </div>
                <div className="cols">
                  <div className="sub-card">
                    <h3><span className="ic" style={{ background: "var(--ds-info-soft)", color: "var(--ds-info)" }}><MarketingIcon name="home" size={14} /></span> Base info</h3>
                    <Field label="Brand name" required><input value={profile.companyName ?? ""} onChange={(e) => setField({ companyName: e.target.value })} placeholder="Enter your brand name" /></Field>
                    <Field label="Industry" required>
                      <input list="industries" value={profile.industry ?? ""} onChange={(e) => setField({ industry: e.target.value })} placeholder="Select or type…" />
                      <datalist id="industries">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist>
                    </Field>
                    <Field label="Description" required hint="Powers your campaigns, ads, and AI-suggested audiences."><textarea className="ta" value={profile.description ?? ""} onChange={(e) => setField({ description: e.target.value })} placeholder="What the business does." /></Field>
                    <Field label="Language">
                      <input list="languages" value={profile.language ?? ""} onChange={(e) => setField({ language: e.target.value })} placeholder="English (US)" />
                      <datalist id="languages">{LANGUAGES.map((l) => <option key={l} value={l} />)}</datalist>
                    </Field>
                  </div>
                  <div className="sub-card">
                    <h3><span className="ic" style={{ background: "var(--ds-brand-soft)", color: "var(--ds-brand-active)" }}><MarketingIcon name="pen" size={14} /></span> Branding kit</h3>
                    <Field label="Website"><input value={profile.websiteUrl ?? ""} onChange={(e) => setField({ websiteUrl: e.target.value })} placeholder="https://…" /></Field>
                    <div className="logo-field">
                      <span className="kv-label">Logo</span>
                      <div className="logo-row">
                        {profile.logoUrl
                          ? <div className="logo-preview"><img src={profile.logoUrl} alt="logo" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} /></div>
                          : <div className="logo-placeholder" />}
                        <div className="logo-actions">
                          <label className="btn ghost sm upload-btn">⬆ Upload
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => onLogoFile(e.target.files?.[0])} hidden />
                          </label>
                          {profile.logoUrl && <button className="btn ghost sm" onClick={() => setField({ logoUrl: "" })}>Remove</button>}
                        </div>
                      </div>
                      <input value={profile.logoUrl && !profile.logoUrl.startsWith("data:") ? profile.logoUrl : ""} onChange={(e) => setField({ logoUrl: e.target.value })} placeholder="…or paste an image URL" />
                    </div>
                    <div className="swatch-row">
                      <div className="swatch-field">
                        <span className="kv-label">Primary colour</span>
                        <div className="swatch"><input type="color" value={profile.primaryColor || "#4f46e5"} onChange={(e) => setField({ primaryColor: e.target.value })} /><input className="hex" value={profile.primaryColor ?? "#4f46e5"} onChange={(e) => setField({ primaryColor: e.target.value })} /></div>
                        <input className="cname" value={profile.primaryColorName ?? ""} onChange={(e) => setField({ primaryColorName: e.target.value })} placeholder="Name it — e.g. Brand blue" />
                      </div>
                      <div className="swatch-field">
                        <span className="kv-label">Secondary colour</span>
                        <div className="swatch"><input type="color" value={profile.secondaryColor || "#111827"} onChange={(e) => setField({ secondaryColor: e.target.value })} /><input className="hex" value={profile.secondaryColor ?? "#111827"} onChange={(e) => setField({ secondaryColor: e.target.value })} /></div>
                        <input className="cname" value={profile.secondaryColorName ?? ""} onChange={(e) => setField({ secondaryColorName: e.target.value })} placeholder="Name it — e.g. Ink" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Positioning gut-check */}
                <div className="pos-card">
                  <div className="panel-head">
                    <div><h3><span className="ic" style={{ background: "var(--ds-warning-soft)", color: "var(--ds-warning)" }}><MarketingIcon name="plan" size={14} /></span> What business are you <em>really</em> in?</h3>
                      <p className="sub">Not your category — the deeper outcome people actually buy. (A gym sells confidence, not treadmills.)</p></div>
                    <button className="btn primary sm" onClick={() => void askPositioning()} disabled={aiBusy !== null}>{aiBusy === "positioning" ? "Thinking…" : <><MarketingIcon name="spark" size={13} /> Ask AI</>}</button>
                  </div>
                  <div className="cols">
                    <Field label="What business are you in? (the surface answer)"><textarea className="ta" value={profile.businessIn ?? ""} onChange={(e) => setField({ businessIn: e.target.value })} placeholder="e.g. We run a business-planning app." /></Field>
                    <Field label="What business are you REALLY in? (the deeper answer)" hint={<>Pulled from your <a href="/business/reality">Business Reality Map</a> — your single source of truth.</>}><textarea className="ta" value={profile.businessReallyIn ?? ""} onChange={(e) => setField({ businessReallyIn: e.target.value })} placeholder="e.g. We're in the certainty business — turning a founder's anxiety into a plan they trust." /></Field>
                  </div>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow brand">Find your voice</div>
                    <h2>Set your brand voice</h2>
                    <p className="sub">The tone and guardrails for everything we generate — say it once, sound like you everywhere.</p>
                  </div>
                  <button className="btn primary sm" onClick={() => void improveVoice()} disabled={aiBusy !== null} title="Draft a brand voice from your company info (and your website, if set)">{aiBusy === "voice" ? "Writing…" : <><MarketingIcon name="spark" size={13} /> Generate for me</>}</button>
                </div>
                <Field label="How should this brand sound?" required hint="2-4 sentences: tone, point of view, and anything to steer clear of.">
                  <textarea className="ta tall" value={profile.brandVoice ?? ""} onChange={(e) => setField({ brandVoice: e.target.value })} placeholder="e.g. Warm and direct. Second person. No corporate jargon. Confident, not hype." />
                </Field>
                <div className="voice-starters">
                  <span className="voice-starters-label">Stuck? Tap a word to work it in:</span>
                  <div className="voice-chip-row">
                    {VOICE_STARTERS.map((w) => {
                      const active = new RegExp(`\\b${w}\\b`, "i").test(profile.brandVoice ?? "");
                      return (
                        <button type="button" key={w} className={`voice-chip${active ? " on" : ""}`} onClick={() => addVoiceWord(w)}
                          aria-label={active ? `${w} — already in your brand voice` : `Add “${w}” to your brand voice`}>
                          {active && <MarketingIcon name="check" size={10} />}{w}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="chip-block">
                  <span className="kv-label">Never use these words &amp; claims</span>
                  <p className="hint">We&apos;ll steer every generated ad, page and email away from these. Type a word or phrase, then press Enter or comma.</p>
                  <div className="chips">
                    {prohibited.map((w) => (
                      <span key={w} className="chip">{w}<button onClick={() => setProhibited((l) => l.filter((x) => x !== w))} aria-label={`remove ${w}`}>×</button></span>
                    ))}
                    <input className="chip-input" value={prohibitedInput}
                      onChange={(e) => setProhibitedInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addProhibited(prohibitedInput); } else if (e.key === "Backspace" && !prohibitedInput && prohibited.length) { setProhibited((l) => l.slice(0, -1)); } }}
                      placeholder={prohibited.length ? "" : "guaranteed, cure, #1…"} />
                  </div>
                </div>

                {/* Core message — the seven-part story: customer as hero, brand as guide */}
                <div className="msg-card">
                  <div className="panel-head">
                    <div><h3>Your core message</h3><p className="sub">The customer is the hero; your brand is the guide. Fill in the seven-part story below — every ad and page pulls from this.</p></div>
                    <button className="btn primary sm" onClick={() => void generateMessage()} disabled={aiBusy !== null}>{aiBusy === "message" ? "Writing…" : <><MarketingIcon name="spark" size={13} /> Generate message</>}</button>
                  </div>
                  {MESSAGE_FIELDS.map((f, i) => (
                    <Field key={f.key} label={f.key === "oneLiner" ? "One-liner (built from your Message tool)" : f.label} badge={f.key === "oneLiner" ? undefined : i} className={f.key === "oneLiner" ? "field-hero" : undefined}>
                      {f.key === "oneLiner"
                        ? (
                          <>
                            <input value={profile.message?.[f.key] ?? ""} readOnly placeholder="Build this in your Message tool, then it shows here." title="Composed automatically from your Message tool's Problem/Solution/Result — edit it there, not here." />
                            <p className="hint">Composed automatically from your <a href="/business/message">Message tool</a>'s Problem → Solution → Result — edit it there, not here.</p>
                          </>
                        )
                        : <textarea className="ta" value={profile.message?.[f.key] ?? ""} onChange={(e) => setField({ message: { ...profile.message, [f.key]: e.target.value } })} placeholder={f.placeholder} />}
                    </Field>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="panel-head">
                  <div>
                    <div className="eyebrow warning">Show the proof</div>
                    <h2>Products &amp; proof</h2>
                    <p className="sub">What you sell, who it&apos;s for, and why they trust you.</p>
                  </div>
                  <button className="btn primary sm" onClick={() => void generateAudienceProof()} disabled={aiBusy !== null} title="Draft audience, competitors, guarantees & pricing from your brand info (and your website, if set) — fills blanks only">
                    {aiBusy === "proof" ? "Thinking…" : <><MarketingIcon name="spark" size={13} /> Suggest with AI</>}
                  </button>
                </div>
                <div className="rep-block">
                  <div className="rep-head">
                    <span className="ic" style={{ background: "var(--ds-warning-soft)", color: "var(--ds-warning)" }}><MarketingIcon name="card" size={14} /></span>
                    <div><span className="kv-label">Products / services</span><p className="hint">What you sell — quoted in ad copy and landing pages.</p></div>
                  </div>
                  {products.map((p, i) => (
                    <div className="rep-row" key={i}>
                      <input className="rep-name" value={p.name} onChange={(e) => setProducts((list) => list.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Name" />
                      <input value={p.description ?? ""} onChange={(e) => setProducts((list) => list.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Short description" />
                      <input className="rep-price" value={p.price ?? ""} onChange={(e) => setProducts((list) => list.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="Price" />
                      <button className="rep-del" onClick={() => setProducts((list) => list.filter((_, j) => j !== i))} aria-label="remove">×</button>
                    </div>
                  ))}
                  <button className="btn ghost sm" onClick={() => setProducts((l) => [...l, { name: "" }])}>+ Add product</button>
                </div>
                <div className="cols">
                  <Field label="Audience" hint="Who the ads and emails should speak to."><textarea className="ta" value={profile.audience ?? ""} onChange={(e) => setField({ audience: e.target.value })} placeholder="Who is the ideal customer?" /></Field>
                  <Field label="Competitors"><textarea className="ta" value={profile.competitors ?? ""} onChange={(e) => setField({ competitors: e.target.value })} /></Field>
                </div>
                <div className="cols">
                  <Field label="Guarantees" hint="A risk-reversal you're comfortable promising in a call to action."><textarea className="ta" value={profile.guarantees ?? ""} onChange={(e) => setField({ guarantees: e.target.value })} /></Field>
                  <Field label="Pricing notes"><textarea className="ta" value={profile.pricingNotes ?? ""} onChange={(e) => setField({ pricingNotes: e.target.value })} /></Field>
                </div>
                <Field label="Locations served"><input value={profile.locations ?? ""} onChange={(e) => setField({ locations: e.target.value })} /></Field>
                <div className="rep-block">
                  <div className="rep-head">
                    <span className="ic" style={{ background: "var(--ds-warning-soft)", color: "var(--ds-warning)" }}><MarketingIcon name="message" size={14} /></span>
                    <div><span className="kv-label">Testimonials</span><p className="hint">Real words from real customers — used as social proof in ads and pages.</p></div>
                  </div>
                  {testimonials.map((t, i) => (
                    <div className="rep-row" key={i}>
                      <input value={t.quote} onChange={(e) => setTestimonials((list) => list.map((x, j) => j === i ? { ...x, quote: e.target.value } : x))} placeholder="What they said" />
                      <input className="rep-price" value={t.author ?? ""} onChange={(e) => setTestimonials((list) => list.map((x, j) => j === i ? { ...x, author: e.target.value } : x))} placeholder="Author" />
                      <button className="rep-del" onClick={() => setTestimonials((list) => list.filter((_, j) => j !== i))} aria-label="remove">×</button>
                    </div>
                  ))}
                  <button className="btn ghost sm" onClick={() => setTestimonials((l) => [...l, { quote: "" }])}>+ Add testimonial</button>
                </div>
              </>
            )}
          </div>

          {/* Sticky step bar */}
          <div className="step-bar">
            <span className="step-count">Step {step + 1} of {STEPS.length}</span>
            <div className="step-actions">
              <button className="btn ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>← Back</button>
              {step < STEPS.length - 1
                ? <button className="btn primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>Continue →</button>
                : <button className="btn primary" onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "✓ Save Brand Brain"}</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const CSS = `
/* Brand Brain, migrated onto ONEVYRT Design System v1 tokens (app/design-system.css)
   so it correlates with the whole product. Light-first with a restrained dark
   handled by the DS tokens themselves — no heavy per-page dark navy. Local
   aliases map onto --ds-* so the existing class rules inherit the shared palette. */
.bb-root{
  /* Local radius scale only. Colour, shadow and focus-ring tokens are left to
     cascade in from the shared design system (app/design-system.css) rather
     than being pinned here, so the page renders correctly in both the light
     theme and the navy-blue-grey dark theme. */
  --ds-radius-sm:8px;--ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--panel:var(--ds-surface);
  --accent:var(--ds-brand);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);
  --border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);--radius:var(--ds-radius-xl);
  max-width:900px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font);border-radius:16px;}
.bb-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px;}
.bb-header h1{font-size:26px;font-weight:700;margin:2px 0 4px;letter-spacing:-.4px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;margin-bottom:2px;}
.eyebrow.info{color:var(--ds-info);}
.eyebrow.brand{color:var(--ds-brand-active);}
.eyebrow.warning{color:var(--ds-warning);}
.sub{color:var(--muted);font-size:13.5px;margin:0;}
.hint{color:var(--ds-text-tertiary);font-size:12px;margin:0 0 8px;}
.header-right{display:flex;gap:8px;align-items:center;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,transform .15s,box-shadow .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:var(--ds-shadow-sm);}
.btn:active:not(:disabled){transform:translateY(0);box-shadow:none;}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.ghost:hover:not(:disabled){box-shadow:none;}
.btn.sm{padding:6px 12px;font-size:12.5px;}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.btn.primary:active:not(:disabled){background:var(--ds-brand-active);border-color:var(--ds-brand-active);}
.link{background:none;border:none;color:var(--accent);cursor:pointer;padding:0;font:inherit;transition:color .15s;}
.link:hover{color:var(--ds-brand-hover);text-decoration:underline;}
.link:focus-visible{outline:none;box-shadow:var(--ds-ring);border-radius:3px;}
.msg{padding:10px 14px;border-radius:var(--ds-radius-md);font-size:13px;margin-bottom:14px;font-weight:500;}
.msg.ok{background:var(--ds-success-soft);color:var(--ds-success);border:1px solid var(--ds-success-soft);}
.msg.err{background:var(--ds-danger-soft);color:var(--ds-danger);border:1px solid var(--ds-danger-soft);}

/* Steps — understated segmented tabs, no glow */
.steps{display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap;background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:4px;}
.step-tab{flex:1;min-width:150px;display:flex;align-items:center;gap:10px;background:transparent;border:1px solid transparent;border-radius:var(--ds-radius-md);padding:9px 13px;cursor:pointer;font:inherit;color:var(--muted);font-weight:500;transition:background .15s,color .15s,transform .15s,box-shadow .15s;}
.step-tab:hover{color:var(--text);transform:translateY(-1px);}
.step-tab:active{transform:translateY(0);}
.step-tab.active{background:var(--surface);color:var(--text);border-color:var(--border);box-shadow:var(--ds-shadow-xs);}
.step-tab.active:hover{box-shadow:var(--ds-shadow-sm);}
.step-tab.done .step-ic{background:var(--ds-success) !important;border-color:var(--ds-success) !important;color:#fff !important;}
.step-ic{display:grid;place-items:center;width:28px;height:28px;border-radius:var(--ds-radius-sm);border:1.5px solid var(--border);font-size:14px;flex:none;transition:background .15s,border-color .15s,color .15s;}
.step-tab.active .step-ic{color:#fff;}
.step-label{font-size:13.5px;}
.ic{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:var(--ds-radius-sm);border:1.5px solid var(--border);font-size:14px;margin-right:7px;vertical-align:-6px;}

/* Panel — a light surface, not a heavy container */
.panel{background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:22px;display:flex;flex-direction:column;gap:18px;box-shadow:var(--ds-shadow-xs);}
.panel.center{align-items:center;justify-content:center;min-height:200px;text-align:center;}
.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.panel-head h2{font-size:19px;margin:0 0 2px;letter-spacing:-.3px;}
.step-anim{animation:slidein .24s var(--ds-ease);}
@keyframes slidein{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}

/* AI hero — subtle brand insight, token-aware in both themes */
.ai-hero{background:var(--ds-brand-soft);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:15px 17px;display:flex;flex-direction:column;gap:11px;}
.ai-hero-copy{font-size:13.5px;}
.ai-badge{display:inline-block;font-size:11px;font-weight:700;color:#fff;background:var(--ds-brand);padding:2px 9px;border-radius:999px;margin-right:4px;}
.ai-hero-row{display:flex;gap:9px;flex-wrap:wrap;}
.ai-url{flex:1;min-width:200px;}

/* Fields / groups — reduced nesting: sub-cards are quiet, not heavy boxes */
.cols{display:flex;gap:14px;flex-wrap:wrap;}
.cols>*{flex:1;min-width:230px;}
.sub-card{background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 17px;display:flex;flex-direction:column;gap:12px;flex:1;min-width:250px;}
.sub-card h3{font-size:14px;margin:0 0 2px;}
.field{display:flex;flex-direction:column;gap:5px;flex:1;min-width:170px;}
.kv-label{font-size:12px;font-weight:500;color:var(--text);letter-spacing:0;}
.req{color:var(--ds-danger);margin-left:2px;}
.field-hint{font-size:11.5px;color:var(--ds-text-tertiary);margin-top:-1px;}
.field-num{display:inline-grid;place-items:center;width:15px;height:15px;border-radius:50%;background:var(--ds-brand-soft);color:var(--ds-brand-active);font-size:9px;font-weight:700;margin-right:6px;vertical-align:1px;}
/* The one-liner is the headline of the core message — an accent border and
   tint make it read as the anchor field, not just item 1 of a list. */
.field-hero{border-left:3px solid var(--ds-brand);background:var(--ds-brand-soft);border-radius:0 var(--ds-radius-sm) var(--ds-radius-sm) 0;padding:9px 12px;gap:6px;}
.field-hero .kv-label{color:var(--ds-brand-active);font-weight:600;}
input,textarea{font:inherit;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:9px 11px;font-size:13.5px;box-sizing:border-box;width:100%;background:var(--surface);color:var(--text);transition:border-color .15s,box-shadow .15s;}
input:focus,textarea:focus{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
input::placeholder,textarea::placeholder{color:var(--ds-text-disabled);}
.ta{min-height:70px;resize:vertical;font-family:inherit;}
.ta.tall{min-height:120px;}
.swatch-row{display:flex;gap:12px;flex-wrap:wrap;}
.swatch-field{flex:1;min-width:130px;display:flex;flex-direction:column;gap:5px;}
.swatch{display:flex;gap:8px;align-items:center;}
.swatch input[type=color]{width:42px;height:38px;padding:2px;border-radius:var(--ds-radius-sm);flex:none;cursor:pointer;border:1px solid var(--ds-border-default);transition:border-color .15s,box-shadow .15s;}
.swatch input[type=color]:hover{border-color:var(--ds-border-strong);}
.swatch input[type=color]:focus-visible{outline:none;border-color:var(--accent);box-shadow:var(--ds-ring);}
.swatch .hex{flex:1;}
.logo-field{display:flex;flex-direction:column;gap:6px;}
.logo-row{display:flex;align-items:center;gap:12px;}
.logo-preview img{max-height:52px;max-width:130px;border-radius:var(--ds-radius-sm);border:1px solid var(--border);background:#fff;padding:4px;display:block;}
.logo-placeholder{width:56px;height:56px;border-radius:var(--ds-radius-md);border:1.5px dashed var(--ds-border-default);display:grid;place-items:center;font-size:22px;background:var(--surface);flex:none;}
.logo-actions{display:flex;gap:7px;flex-wrap:wrap;}
.upload-btn{position:relative;overflow:hidden;}
.cname{margin-top:6px;font-size:12.5px;}
.pos-card{background:var(--ds-brand-soft);border:1px solid var(--ds-border-subtle);border-radius:var(--ds-radius-lg);padding:16px 18px;display:flex;flex-direction:column;gap:12px;}
.pos-card h3{font-size:15px;margin:0 0 2px;}
.pos-card em{font-style:italic;color:var(--ds-brand);}
.msg-card{background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:16px 18px;display:flex;flex-direction:column;gap:11px;}
.msg-card h3{font-size:15px;margin:0 0 2px;}

/* Chips */
.chip-block{display:flex;flex-direction:column;gap:5px;}
.chips{display:flex;flex-wrap:wrap;gap:7px;align-items:center;background:var(--surface);border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);padding:8px 10px;min-height:44px;}
.chip{display:inline-flex;align-items:center;gap:5px;background:var(--ds-brand-soft);color:var(--ds-brand);border:1px solid transparent;border-radius:999px;padding:3px 6px 3px 11px;font-size:12.5px;font-weight:500;}
.chip button{background:none;border:none;color:var(--ds-brand);cursor:pointer;font-size:15px;line-height:1;padding:0 2px;transition:color .15s,transform .15s;border-radius:50%;}
.chip button:hover{color:var(--ds-danger);transform:scale(1.15);}
.chip button:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.chip-input{flex:1;min-width:120px;border:none;padding:4px;box-shadow:none;background:transparent;}
.chip-input:focus{box-shadow:none;}

/* Tone-word starters for the brand voice field */
.voice-starters{display:flex;flex-direction:column;gap:7px;}
.voice-starters-label{font-size:11.5px;color:var(--ds-text-tertiary);}
.voice-chip-row{display:flex;flex-wrap:wrap;gap:7px;}
.voice-chip{display:inline-flex;align-items:center;gap:4px;background:var(--ds-brand-soft);border:1px solid transparent;color:var(--ds-brand-active);border-radius:999px;padding:4px 12px;font:inherit;font-size:12px;font-weight:500;cursor:pointer;transition:transform .15s,box-shadow .15s,background .15s,color .15s;}
.voice-chip:hover{transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.voice-chip:active{transform:translateY(0);}
.voice-chip:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.voice-chip.on{background:var(--ds-brand);color:#fff;}

/* Repeaters */
.rep-block{display:flex;flex-direction:column;gap:8px;}
.rep-head{display:flex;align-items:flex-start;gap:2px;margin-bottom:2px;}
.rep-head .hint{margin:2px 0 0;}
.rep-row{display:flex;gap:8px;align-items:center;}
.rep-name{flex:0 0 32%;}
.rep-price{flex:0 0 110px;}
.rep-del{background:none;border:1px solid var(--ds-border-default);border-radius:var(--ds-radius-sm);width:34px;height:34px;flex:none;cursor:pointer;color:var(--muted);font-size:17px;line-height:1;transition:border-color .15s,color .15s,transform .15s;}
.rep-del:hover{border-color:var(--ds-danger);color:var(--ds-danger);transform:translateY(-1px);}
.rep-del:active{transform:translateY(0);}
.rep-del:focus-visible{outline:none;box-shadow:var(--ds-ring);}

/* AI provider picker chips */
.prov-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;}
.prov-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:999px;cursor:pointer;font:inherit;font-size:13px;font-weight:500;border:1px solid var(--ds-border-default);background:transparent;color:inherit;transition:transform .15s,box-shadow .15s,border-color .15s,background .15s;}
.prov-chip:hover{transform:translateY(-1px);}
.prov-chip:hover:not(.on){border-color:var(--ds-border-strong);background:var(--ds-bg-subtle);}
.prov-chip.on{box-shadow:var(--ds-shadow-xs);}
.prov-chip.on:hover{box-shadow:var(--ds-shadow-sm);}
.prov-chip:active{transform:translateY(0);}
.prov-chip:focus-visible{outline:none;box-shadow:var(--ds-ring);}

/* AI key card — quiet surface, not a dark box */
.ai-key-card{background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:15px 17px;margin-bottom:14px;display:flex;flex-direction:column;gap:11px;color:var(--text);}
.ai-key-card .kv-label{color:var(--muted);}

/* Sticky step bar */
.step-bar{position:sticky;bottom:14px;margin-top:16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:11px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:var(--ds-shadow-md);}
.step-count{font-size:12.5px;font-weight:500;color:var(--muted);}
.step-actions{display:flex;gap:9px;}

.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:10px;}
@keyframes spin{to{transform:rotate(360deg);}}

@media (prefers-reduced-motion: reduce){ * { transition:none!important; animation:none!important } }
`;
