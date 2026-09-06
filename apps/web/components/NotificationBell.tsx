"use client";

import { useCallback, useEffect, useState } from "react";
import { barGhost } from "../lib/studio-ui";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  linkUrl?: string;
  createdAt: string;
  readAt?: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/** Bell icon + unread count, polled on an interval so a reminder created by
 *  a background job (see lib/jobs.ts) shows up without a page reload. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const data = await r.json() as { notifications: NotificationItem[]; unread: number };
      setItems(data.notifications);
      setUnread(data.unread);
    } catch { /* transient — next poll retries */ }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 90_000);
    return () => clearInterval(id);
  }, [load]);

  const markRead = async (id: string) => {
    setItems((xs) => xs.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }); } catch { /* best effort */ }
  };
  const markAllRead = async () => {
    setItems((xs) => xs.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
    try { await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ all: true }) }); } catch { /* best effort */ }
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ ...barGhost, position: "relative" }} title="Notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} aria-haspopup="menu" aria-expanded={open}>
        {"\u{1F514}"}
        {unread > 0 && (
          <span style={{ position: "absolute", top: -3, right: -3, background: "#dc2626", color: "#fff", borderRadius: 999, fontSize: 10, fontWeight: 700, minWidth: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 340, maxHeight: 420, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 10, boxShadow: "var(--shadow-soft, 0 10px 30px rgba(0,0,0,0.2))", zIndex: 41 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Notifications</span>
              {unread > 0 && <button onClick={() => void markAllRead()} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 11.5, cursor: "pointer" }}>Mark all read</button>}
            </div>
            {items.length === 0 ? (
              <div style={{ padding: "18px 12px", fontSize: 12.5, color: "var(--dim)", textAlign: "center" }}>Nothing yet.</div>
            ) : (
              items.map((n) => {
                const unreadItem = !n.readAt;
                const content = (
                  <div style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", background: unreadItem ? "var(--accent-soft)" : "transparent", cursor: n.linkUrl ? "pointer" : "default" }}
                    onClick={() => { if (unreadItem) void markRead(n.id); }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: unreadItem ? 700 : 600 }}>{n.title}</span>
                      <span style={{ fontSize: 10.5, color: "var(--dim)", whiteSpace: "nowrap" }}>{timeAgo(n.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{n.body}</div>
                  </div>
                );
                return n.linkUrl ? <a key={n.id} href={n.linkUrl} style={{ display: "block", textDecoration: "none", color: "inherit" }}>{content}</a> : <div key={n.id}>{content}</div>;
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
