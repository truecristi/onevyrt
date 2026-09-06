"use client";
/**
 * CoachMessages — the learner-facing receiving end of "Reach out". Shows an
 * ambient banner with unread notes from a coach/mentor/admin the next time a
 * learner is on the platform, and lets them mark them all read in one shot.
 * Renders NOTHING when there's nothing unread (or the fetch fails), so it's
 * safe to mount anywhere on a learner's home/programme screen — it can never
 * show a broken or empty banner.
 */
import type React from "react";
import { useEffect, useState } from "react";

interface CoachMessage {
  id: string;
  at: string;
  fromEmail: string;
  fromName?: string;
  subject?: string;
  body: string;
  read: boolean;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}

export function CoachMessages({ wsId }: { wsId?: string }): React.JSX.Element | null {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [busy, setBusy] = useState(false);

  // wsId is optional: with it, we read that workspace's messages; without it the
  // API falls back to the viewer's personal workspace — so this is safe to mount
  // on a learner's home where no explicit workspace id is in scope.
  useEffect(() => {
    let live = true;
    setMessages([]);
    const q = wsId ? `?ws=${encodeURIComponent(wsId)}&unread=1` : "?unread=1";
    fetch(`/api/programme/messages${q}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { messages?: CoachMessage[] } | null) => {
        const list = d?.messages;
        if (live && list && list.length > 0) setMessages(list);
      })
      .catch(() => { /* banner stays hidden */ });
    return () => { live = false; };
  }, [wsId]);

  if (messages.length === 0) return null;

  const dismiss = async () => {
    setBusy(true);
    try {
      await fetch("/api/programme/messages", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wsId ? { ws: wsId } : {}),
      });
    } catch {
      /* best-effort mark-as-read; hide locally regardless */
    }
    setMessages([]);
    setBusy(false);
  };

  return (
    <div className="cmsg-banner">
      <style>{CSS}</style>
      <div className="cmsg-eyebrow">Message from your coach</div>
      <div className="cmsg-list">
        {messages.map((m) => (
          <div className="cmsg-card" key={m.id}>
            <div className="cmsg-meta">
              <span className="cmsg-from">{m.fromName || m.fromEmail}</span>
              <span className="cmsg-time">{timeAgo(m.at)}</span>
            </div>
            {m.subject && <div className="cmsg-subject">{m.subject}</div>}
            <p className="cmsg-body">{m.body}</p>
          </div>
        ))}
      </div>
      <button className="cmsg-btn" disabled={busy} onClick={() => void dismiss()}>
        {busy ? "Marking as read…" : "Got it"}
      </button>
    </div>
  );
}

const CSS = `
.cmsg-banner { border: 1px solid color-mix(in srgb, var(--ds-brand, #088057) 30%, transparent); background: var(--ds-brand-soft, #e7f6f0);
  border-radius: var(--ds-radius-lg, 14px); padding: 16px 18px; margin: 12px 0; display: flex; flex-direction: column; gap: 10px; }
.cmsg-eyebrow { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--ds-brand-active, #088057); }
.cmsg-list { display: flex; flex-direction: column; gap: 10px; }
.cmsg-card { display: flex; flex-direction: column; gap: 4px; padding-bottom: 10px; border-bottom: 1px solid color-mix(in srgb, var(--ds-brand, #088057) 18%, transparent); }
.cmsg-card:last-child { padding-bottom: 0; border-bottom: none; }
.cmsg-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.cmsg-from { font-size: 13px; font-weight: 700; color: var(--ds-text-primary, #111827); }
.cmsg-time { font-size: 11.5px; color: var(--ds-text-secondary, #475569); white-space: nowrap; }
.cmsg-subject { font-size: 13.5px; font-weight: 800; color: var(--ds-text-primary, #111827); }
.cmsg-body { font-size: 13px; line-height: 1.55; color: var(--ds-text-secondary, #475569); margin: 0; white-space: pre-line; }
.cmsg-btn { align-self: flex-start; font: inherit; font-size: 13.5px; font-weight: 700; border: none; cursor: pointer;
  border-radius: 10px; padding: 9px 16px; color: #fff; background: var(--ds-brand-solid, #088057); }
.cmsg-btn:disabled { opacity: .6; cursor: default; }
.cmsg-btn:focus-visible { outline: 2px solid var(--ds-brand, #088057); outline-offset: 2px; }
`;
