"use client";
/**
 * JourneyCelebration — a one-time "🎉 you finished X" banner, shown wherever the
 * owner lands (Your Plan or the home). It compares the journey's done steps to a
 * persisted "seen" set: any step done that wasn't acknowledged fires a
 * celebration, then is recorded. On the very first ever load it records silently
 * (no retroactive confetti). Because both mount points share the same key, the
 * first page visited celebrates and the other stays quiet — no double-party.
 */
import { useEffect, useState } from "react";
import { newlyDone, type Journey } from "../lib/studio/journey";

const SEEN_KEY = "ov-journey-seen-done";

export default function JourneyCelebration({ journey }: { journey: Journey | null }) {
  const [titles, setTitles] = useState<string[]>([]);

  useEffect(() => {
    if (!journey) return;
    let seen: string[] | null = null;
    try { const raw = localStorage.getItem(SEEN_KEY); if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) seen = a.filter((x) => typeof x === "string"); } } catch { /* ignore */ }
    if (seen !== null) {
      const fresh = newlyDone(journey.steps, seen);
      if (fresh.length) setTitles(fresh.map((k) => journey.steps.find((s) => s.key === k)?.title ?? k));
    }
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(journey.steps.filter((s) => s.done).map((s) => s.key))); } catch { /* ignore */ }
  }, [journey]);

  if (titles.length === 0 || !journey) return null;

  return (
    <div className="jc" role="status">
      <style>{CSS}</style>
      <span>🎉 Nice — you finished {titles.map((t, i) => <span key={t}>{i > 0 ? (i === titles.length - 1 ? " and " : ", ") : ""}<b>{t}</b></span>)}! {journey.finished ? "That's the whole plan — you're selling." : `${journey.total - journey.done} to go — keep the momentum.`}</span>
      <button className="jc-x" onClick={() => setTitles([])} aria-label="Dismiss">✕</button>
    </div>
  );
}

const CSS = `
.jc{display:flex;align-items:center;gap:10px;justify-content:space-between;background:linear-gradient(135deg,var(--ds-brand,#0a9e6e),#0bb87f);color:#fff;border-radius:12px;padding:12px 15px;margin-bottom:14px;font-size:14px;line-height:1.5;font-weight:500;box-shadow:0 12px 30px -14px rgba(10,158,110,.5);}
.jc b{font-weight:700;}
.jc-x{flex:0 0 auto;background:rgba(255,255,255,.2);border:none;color:#fff;width:24px;height:24px;border-radius:50%;cursor:pointer;font-size:12px;font-weight:700;line-height:1;}
.jc-x:hover{background:rgba(255,255,255,.32);}
`;
