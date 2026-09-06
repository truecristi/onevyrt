"use client";
/**
 * AIStatus — a friendly, non-technical heads-up on AI-powered pages. Every
 * "Draft with AI" / "Sell it better" button needs AI that can generate. There
 * are two ways that's true: the user added their own provider key, OR the owner
 * enabled the included ("managed") AI on the server. This reads the saved
 * connection AND asks the server whether managed AI is on, and only shows a bar
 * when neither can generate — so a user on the included AI is never nagged to
 * "connect" something that already works. When AI can generate it renders
 * nothing (stays out of the way); when the included AI's monthly allowance is
 * used up it says so and points to adding a key for unlimited use.
 *
 * Client-only (the key lives in localStorage); self-scoped ("ais-" prefix).
 */
import { useEffect, useState } from "react";
import { loadConnection } from "../lib/ai/client";
import { providerCanGenerate, getAIProvider } from "../lib/ai/providers";
import Explain from "./Explain";

type Managed = { configured: boolean; used: number; quota: number };

export default function AIStatus() {
  // null = not yet checked (render nothing to avoid a flash on connected users)
  const [ready, setReady] = useState<boolean | null>(null);
  const [managed, setManaged] = useState<Managed | null>(null);

  useEffect(() => {
    let live = true;
    // Ask the server once whether the included AI is enabled (and how much of
    // this workspace's monthly allowance is left).
    fetch("/api/ai/generate", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d && typeof d.configured === "boolean") setManaged(d); })
      .catch(() => { /* non-critical — treat as no managed AI */ });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    const check = () => {
      const conn = loadConnection();
      const ownKey = !!conn && providerCanGenerate(conn.provider) && conn.apiKey.trim().length > 0;
      // Managed AI can serve any real provider (it doesn't apply to "manual",
      // where the user deliberately pastes output themselves) while allowance remains.
      const managedReady = !!managed?.configured && !!conn && conn.provider !== "manual"
        && managed.used < managed.quota;
      setReady(ownKey || managedReady);
    };
    check();
    // Re-check if the key is changed in another tab or on the Connections page.
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => { window.removeEventListener("storage", check); window.removeEventListener("focus", check); };
  }, [managed]);

  if (ready === null || ready === true) return null;

  const conn = loadConnection();
  const providerName = conn ? getAIProvider(conn.provider)?.name : undefined;
  const hasProviderNoKey = !!conn && conn.provider !== "manual" && !conn.apiKey.trim();
  // The included AI is on, but this workspace has spent its monthly allowance.
  const managedSpent = !!managed?.configured && !!conn && conn.provider !== "manual"
    && managed.used >= managed.quota;

  return (
    <div className="ais" role="note">
      <style>{CSS}</style>
      <span className="ais-ic" aria-hidden>✦</span>
      <span className="ais-text">
        {managedSpent ? (
          <>
            <b>You&rsquo;ve used all {managed!.quota} included AI generations this month.</b>{" "}
            Add your own API&nbsp;key<Explain term="API key" /> below for unlimited use — or write the copy by hand.
          </>
        ) : (
          <>
            <b>AI isn&rsquo;t connected yet.</b>{" "}
            {hasProviderNoKey
              ? <>You picked {providerName ?? "a provider"} but haven&rsquo;t added its API&nbsp;key<Explain term="API key" />. </>
              : <>The &ldquo;Draft with AI&rdquo; buttons need a one-time key<Explain term="API key" /> from an AI provider<Explain term="AI provider" />. </>}
            You can still write everything by hand.
          </>
        )}
      </span>
      <a className="ais-cta" href="/campaign-studio/connections">Connect AI →</a>
    </div>
  );
}

const CSS = `
.ais{display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  background:var(--ds-brand-soft,#e7f6f0);border:1px solid color-mix(in srgb, var(--ds-brand,#0a9e6e) 28%, transparent);
  border-radius:12px;padding:11px 14px;margin-bottom:14px;color:var(--ds-text-primary,#111827);}
:root[data-theme="dark"] .ais{color:#f8fafc;}
.ais-ic{color:var(--ds-brand,#0a9e6e);font-weight:700;}
.ais-text{flex:1;min-width:220px;font-size:13px;line-height:1.5;color:var(--ds-text-secondary,#475569);}
:root[data-theme="dark"] .ais-text{color:#cbd5e1;}
.ais-text b{color:var(--ds-text-primary,#111827);font-weight:700;} :root[data-theme="dark"] .ais-text b{color:#f8fafc;}
.ais-cta{flex:0 0 auto;background:var(--ds-brand,#0a9e6e);color:#fff;border-radius:9px;padding:8px 14px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;}
.ais-cta:hover{background:var(--ds-brand-hover,#08875e);}
`;
