"use client";
/**
 * Segments — build reusable audiences from your leads/contacts and turn them
 * into conversion workflows. Compose nested AND/OR rules over 15+ fields (status,
 * score, funnel, ad source/creative, verified, has-email, SMS-reachable, booked/
 * converted, recency…), watch the match count and per-channel reachability update
 * live, save named segments, and export or copy an email / SMS / call list.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Notice } from "../../../components/ui/Notice";
import { SkeletonList } from "../../../components/Skeleton";
import { SEGMENT_FIELDS, type Group, type Condition, type RuleNode, type Op, isGroup } from "../../../lib/segments/rules";
import { suggestAudiences, AUDIENCE_PROBES, type AudienceStats, type AudienceSuggestion } from "../../../lib/segments/suggestions";
import { MERGE_TOKENS } from "../../../lib/outreach/render";
import SellBetter from "../../../components/SellBetter";
import AIStatus from "../../../components/AIStatus";
import WorkedExample from "../../../components/WorkedExample";
import { Modal, ModalActions, confirmDialog, alertDialog } from "../../../components/Modal";
import { copyText } from "../../../lib/clipboard";
import { EmptyState } from "../../../components/ui/EmptyState";

interface BroadcastSend { address: string; status: "sent" | "failed" | "skipped"; reason: string | null }

interface Segment { id: string; name: string; description: string | null; rules: Group; updatedAt: string; }
interface Contact { id: string; name: string | null; email: string | null; phone: string | null; status: string; score: number; funnelSlug: string; source: string | null; booked: boolean; createdAt: string; }
interface Preview { total: number; withEmail: number; withPhone: number; verified: number; booked: number; sample: Contact[]; }
interface Broadcast { id: string; name: string; channel: "email" | "sms"; subject: string | null; body: string; rules: Group; segmentId: string | null; status: string; recipientCount: number; sentCount: number; failedCount: number; createdAt: string; scheduledAt?: string | null; }
type ComposeTarget = { rules: Group; segmentId: string | null; name: string; initial?: { channel: "email" | "sms"; subject: string; body: string } };

const OP_LABEL: Record<Op, string> = {
  eq: "is", neq: "is not", gt: "greater than", gte: "at least", lt: "less than", lte: "at most",
  in: "is any of", contains: "contains", isTrue: "= yes", isFalse: "= no", withinDays: "in the last (days)",
};
const FIELD_IDS = Object.keys(SEGMENT_FIELDS);
const valueless = (op: Op) => op === "isTrue" || op === "isFalse";

const PRESETS: { name: string; icon: string; rules: Group }[] = [
  { name: "Everyone (all leads)", icon: "👥", rules: { combinator: "and", rules: [] } },
  { name: "Booked — converted", icon: "✅", rules: { combinator: "and", rules: [{ field: "booked", op: "isTrue" }] } },
  { name: "Qualified, not booked", icon: "🔥", rules: { combinator: "and", rules: [{ field: "status", op: "eq", value: "qualified" }, { field: "booked", op: "isFalse" }] } },
  { name: "SMS-reachable", icon: "📱", rules: { combinator: "and", rules: [{ field: "hasPhone", op: "isTrue" }] } },
  { name: "Email-reachable", icon: "✉️", rules: { combinator: "and", rules: [{ field: "hasEmail", op: "isTrue" }] } },
  { name: "Verified contacts", icon: "🔐", rules: { combinator: "and", rules: [{ field: "verified", op: "isTrue" }] } },
  { name: "New in last 7 days", icon: "🆕", rules: { combinator: "and", rules: [{ field: "createdAt", op: "withinDays", value: 7 }] } },
  { name: "Nurture with a phone", icon: "☎️", rules: { combinator: "and", rules: [{ field: "status", op: "eq", value: "nurture" }, { field: "hasPhone", op: "isTrue" }] } },
];

function emptyCondition(): Condition {
  return { field: "status", op: "eq", value: "qualified" };
}

export default function SegmentsPage() {
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [deleted, setDeleted] = useState<{ id: string; name: string; deletedAt: string }[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  // Per-recipient delivery log for the broadcast the owner clicked into.
  const [openLog, setOpenLog] = useState<{ b: Broadcast; sends: BroadcastSend[] | null } | null>(null);
  const openBroadcast = useCallback(async (b: Broadcast) => {
    setOpenLog({ b, sends: null });
    try {
      const r = await fetch(`/api/broadcasts/${encodeURIComponent(b.id)}`, { credentials: "include" });
      if (r.ok) { const d = await r.json(); setOpenLog({ b, sends: Array.isArray(d.sends) ? d.sends : [] }); }
      else setOpenLog({ b, sends: [] });
    } catch { setOpenLog({ b, sends: [] }); }
  }, []);
  // Cancel a scheduled broadcast before it fires. This one MUST surface failure:
  // if the DELETE fails silently the send still goes out to the whole segment
  // while the owner believes it was cancelled. Confirm first (it's a real
  // customer send being stopped), then only mark cancelled on a confirmed OK,
  // and tell the owner loudly if it didn't cancel.
  const cancelScheduled = useCallback(async (b: Broadcast) => {
    if (!(await confirmDialog({ title: "Cancel this scheduled broadcast?", message: "It won't be sent. You can duplicate it later to reschedule.", danger: true, confirmLabel: "Cancel broadcast", cancelLabel: "Keep it" }))) return;
    try {
      const r = await fetch(`/api/broadcasts/${encodeURIComponent(b.id)}`, { method: "DELETE", credentials: "include" });
      if (r.ok) { setBroadcasts((bs) => bs.map((x) => (x.id === b.id ? { ...x, status: "cancelled" } : x))); return; }
      await alertDialog({ title: "Couldn't cancel the broadcast", message: "It may still send. Refresh and try again — if it keeps failing, it may already be sending." });
    } catch {
      await alertDialog({ title: "Couldn't reach the server", message: "The broadcast may still send. Check your connection and refresh to confirm its status." });
    }
  }, []);
  const [editing, setEditing] = useState<{ id: string | null; name: string; description: string; rules: Group } | null>(null);
  const [composing, setComposing] = useState<ComposeTarget | null>(null);
  // Duplicate a past broadcast: reopen the composer on the same audience,
  // pre-filled with its message, as a fresh draft (§ campaigns).
  const duplicate = useCallback((b: Broadcast) => {
    setOpenLog(null);
    setComposing({ rules: b.rules, segmentId: b.segmentId, name: `${b.name} (copy)`, initial: { channel: b.channel, subject: b.subject ?? "", body: b.body } });
  }, []);
  const [suggestions, setSuggestions] = useState<AudienceSuggestion[]>([]);

  // Live count for one audience via the preview endpoint; 0 on any failure.
  const probeCount = async (rules: Group): Promise<number> => {
    try {
      const r = await fetch("/api/segments/preview", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ rules }) });
      if (!r.ok) return 0;
      const d = await r.json();
      return Number(d.preview?.total ?? 0) || 0;
    } catch { return 0; }
  };

  // Fetch a count for each candidate audience, then rank the next-best ones.
  const loadSuggestions = useCallback(async () => {
    try {
      const counts = await Promise.all(AUDIENCE_PROBES.map((p) => probeCount(p.rules)));
      const stats: AudienceStats = { total: 0, qualifiedNotBooked: 0, nurtureWithPhone: 0, newLast7: 0, booked: 0, verifiedEmail: 0, smsReachable: 0 };
      AUDIENCE_PROBES.forEach((p, i) => { stats[p.id] = counts[i] ?? 0; });
      setSuggestions(suggestAudiences(stats));
    } catch { /* non-critical — suggestions just stay empty */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const [rs, rb] = await Promise.all([fetch("/api/segments", { credentials: "include" }), fetch("/api/broadcasts", { credentials: "include" })]);
      if (rs.status === 401) { setState("not-authenticated"); return; }
      if (!rs.ok) { setState("error"); return; }
      const d = await rs.json(); setSegments(d.segments ?? []);
      if (rb.ok) { const db = await rb.json(); setBroadcasts(db.broadcasts ?? []); }
      setState("ok");
      void loadSuggestions();
      void loadDeleted();
    } catch { setState("error"); }
  }, [loadSuggestions]);
  useEffect(() => { void load(); }, [load]);

  const loadDeleted = useCallback(async () => {
    try {
      const r = await fetch("/api/segments/deleted", { credentials: "include" });
      if (r.ok) { const d = await r.json(); setDeleted(Array.isArray(d.deleted) ? d.deleted : []); }
    } catch { /* non-critical */ }
  }, []);

  const startNew = () => setEditing({ id: null, name: "", description: "", rules: { combinator: "and", rules: [] } });
  const editExisting = (s: Segment) => setEditing({ id: s.id, name: s.name, description: s.description ?? "", rules: structuredClone(s.rules) });
  const remove = async (id: string) => {
    if (!(await confirmDialog({ title: "Delete this segment?", message: "It moves to Recently deleted — restorable for 30 days.", danger: true, confirmLabel: "Delete" }))) return;
    // Only drop the row once the server confirms — an optimistic remove hid
    // failures, so a segment that failed to delete silently vanished from the
    // list and reappeared on reload with no explanation.
    try {
      const r = await fetch(`/api/segments/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { await alertDialog({ title: "Couldn't delete the segment", message: "Please try again." }); return; }
      setSegments((l) => l.filter((s) => s.id !== id)); void loadDeleted();
    } catch { await alertDialog({ title: "Couldn't reach the server", message: "Check your connection and try again." }); }
  };
  const restoreSeg = async (id: string) => {
    try { const r = await fetch(`/api/segments/${id}/restore`, { method: "POST", credentials: "include" }); if (r.ok) { void load(); } } catch { /* ignore */ }
  };
  const purgeSeg = async (id: string, name: string) => {
    if (!(await confirmDialog({ title: `Delete "${name}" forever?`, message: "This cannot be undone.", danger: true, confirmLabel: "Delete forever", requireType: "DELETE" }))) return;
    try {
      const r = await fetch(`/api/segments/${id}?permanent=1`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { await alertDialog({ title: "Couldn't delete it", message: "The segment wasn't permanently deleted. Please try again." }); return; }
      void loadDeleted();
    } catch { await alertDialog({ title: "Couldn't reach the server", message: "Check your connection and try again." }); }
  };

  if (state === "loading") return <Shell><SkeletonList rows={4} /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" href="/" cta="Go to sign in" /></Shell>;
  if (state === "error") return <Shell><Notice icon="⚠️" title="Couldn&rsquo;t load segments" onRetry={() => void load()} /></Shell>;

  if (composing) return <Composer target={composing} onCancel={() => setComposing(null)} onSent={() => { setComposing(null); void load(); }} />;
  if (editing) return <Builder init={editing} onCancel={() => setEditing(null)} onMessage={(rules) => setComposing({ rules, segmentId: editing.id, name: editing.name || "Segment" })} onSaved={() => { setEditing(null); void load(); }} />;

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Acquisition OS</div>
          <h1>Segments</h1>
          <p className="sub">Build reusable audiences from your contacts — people who booked, qualified-but-didn&rsquo;t, SMS-reachable, from a given ad — then export or copy an email / SMS / call list for your workflows.</p>
        </div>
        <a href="/business" className="btn ghost">← Business OS</a>
      </div>

      <WorkedExample id="audiences" />

      {broadcasts.length === 0 && (
        <div className="fbg" role="note">
          <h2 className="fbg-h"><span className="fbg-spark" aria-hidden="true">✦</span> Send your first broadcast</h2>
          <p className="fbg-lead">A <b>broadcast</b> is one email or text sent to a whole group of your contacts at once — a new offer, a follow-up, an update. Here&rsquo;s the whole thing in three steps:</p>
          <ol className="fbg-steps">
            <li><b>Pick who.</b> Choose a ready-made audience below (people who booked, qualified-but-didn&rsquo;t…) or build your own segment.</li>
            <li><b>Write it.</b> The composer opens speaking your Message; tap <b>Sell it better with AI</b> to sharpen it.</li>
            <li><b>Send.</b> You&rsquo;ll see how many people are reachable before anything goes out — nothing sends by surprise.</li>
          </ol>
          {suggestions.length > 0 ? (
            <button className="btn primary" onClick={() => { const s = suggestions[0]!; setComposing({ rules: structuredClone(s.rules), segmentId: null, name: s.name }); }}>
              Start with “{suggestions[0]!.name}” →
            </button>
          ) : (
            <button className="btn primary" onClick={startNew}>Build your first audience →</button>
          )}
          <div className="fbg-note">No mailer or SMS provider set up yet? You can still write and preview — sending needs email/SMS configured (a dev code is shown in test mode).</div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="suggest">
          <h2 className="suggest-h"><span className="sg-spark" aria-hidden="true">✦</span> Next best audiences <span className="sg-hint">Ranked by what&rsquo;s worth messaging now</span></h2>
          <div className="suggest-grid">
            {suggestions.map((s) => (
              <div className="sgcard" key={s.id}>
                <div className="sgc-top"><span className="sgc-icon" aria-hidden="true">{s.icon}</span><span className="sgc-name">{s.name}</span><span className="sgc-size">{s.size}</span></div>
                <div className="sgc-reason">{s.reason}</div>
                <button className="btn tiny primary" onClick={() => setComposing({ rules: structuredClone(s.rules), segmentId: null, name: s.name })}>
                  {s.channel === "sms" ? "📱 Text them" : "✉️ Message"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="btn primary big" onClick={startNew}>+ New segment</button>

      <div className="rows" style={{ marginTop: 16 }}>
        {segments.length === 0 && <EmptyState icon="audiences" title="No saved segments yet" description="A segment is just a saved definition of who to reach — everyone who booked, everyone qualified but not booked yet, and so on. Start from a preset or build your own above." />}
        {segments.map((s) => (
          <div className="srow" key={s.id}>
            <div className="srow-main">
              <div className="srow-title">{s.name}</div>
              <div className="srow-sub">{s.description || summarize(s.rules)} · Updated {new Date(s.updatedAt).toLocaleDateString()}</div>
            </div>
            <div className="srow-actions">
              <button className="btn tiny primary" onClick={() => setComposing({ rules: structuredClone(s.rules), segmentId: s.id, name: s.name })}>✉️ Message</button>
              <button className="btn tiny" onClick={() => editExisting(s)}>Open</button>
              <button className="btn tiny danger" onClick={() => void remove(s.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {deleted.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <h2 className="card-h">🗑 Recently deleted <span className="section-tag warn">30-day undo</span></h2>
          <p className="section-hint">Restore a segment any time in the next 30 days, or delete it for good.</p>
          <div className="rows">
            {deleted.map((d) => (
              <div className="srow" key={d.id}>
                <div className="srow-main">
                  <div className="srow-title">{d.name}</div>
                  <div className="srow-sub">deleted {new Date(d.deletedAt).toLocaleDateString()}</div>
                </div>
                <div className="srow-actions">
                  <button className="btn tiny primary" onClick={() => void restoreSeg(d.id)}>Restore</button>
                  <button className="btn tiny danger" onClick={() => void purgeSeg(d.id, d.name)}>Delete forever</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {broadcasts.some((b) => b.status === "scheduled") && (
        <div style={{ marginTop: 26 }}>
          <h2 className="card-h">📅 Scheduled <span className="section-tag info">Sends automatically</span></h2>
          <p className="section-hint">These go out at the time shown — cancel any time before then.</p>
          <div className="rows">
            {broadcasts.filter((b) => b.status === "scheduled").map((b) => (
              <div className="brow" key={b.id}>
                <span className="brow-ic" aria-hidden="true">{b.channel === "sms" ? "📱" : "✉️"}</span>
                <div className="brow-main"><div className="brow-title">{b.name}</div><div className="brow-sub">Sends {b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : "—"} · {b.recipientCount} targeted</div></div>
                <button className="btn ghost sm" onClick={() => void cancelScheduled(b)} aria-label={`Cancel scheduled broadcast "${b.name}"`}>Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {broadcasts.some((b) => b.status !== "scheduled") && (
        <div style={{ marginTop: 26 }}>
          <h2 className="card-h">✉️ Sent messages</h2>
          <p className="section-hint">Tap any message to see exactly who received it.</p>
          <div className="rows">
            {broadcasts.filter((b) => b.status !== "scheduled").map((b) => (
              b.status === "cancelled" ? (
                <div className="brow brow-muted" key={b.id}>
                  <span className="brow-ic" aria-hidden="true">🚫</span>
                  <div className="brow-main"><div className="brow-title">{b.name}</div><div className="brow-sub">Cancelled before sending</div></div>
                </div>
              ) : (
                <button className="brow brow-btn" key={b.id} onClick={() => void openBroadcast(b)} title="See who received it">
                  <span className="brow-ic" aria-hidden="true">{b.channel === "sms" ? "📱" : "✉️"}</span>
                  <div className="brow-main"><div className="brow-title">{b.name}</div><div className="brow-sub">{new Date(b.createdAt).toLocaleString()}</div></div>
                  <div className="brow-stat"><b className="ok">{b.sentCount}</b> sent{b.failedCount > 0 && <> · <b className="bad">{b.failedCount}</b> failed</>} · {b.recipientCount} targeted{b.recipientCount > 0 && <> · {Math.round((b.sentCount / b.recipientCount) * 100)}% delivered</>} <span className="brow-view">View →</span></div>
                </button>
              )
            ))}
          </div>
        </div>
      )}

      <Modal open={!!openLog} onClose={() => setOpenLog(null)} title={openLog ? `Delivery log — ${openLog.b.name}` : ""} width={560}>
        {openLog && (
          <div>
            <div className="blog-sum">
              <span><b className="ok">{openLog.b.sentCount}</b> sent</span>
              {openLog.b.failedCount > 0 && <span><b className="bad">{openLog.b.failedCount}</b> failed</span>}
              <span>{openLog.b.recipientCount} targeted</span>
              {openLog.b.recipientCount > 0 && <span>{Math.round((openLog.b.sentCount / openLog.b.recipientCount) * 100)}% delivered</span>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <button className="btn sm" onClick={() => duplicate(openLog.b)} title="Start a new broadcast to the same audience, pre-filled with this message">⧉ Duplicate</button>
            </div>
            {openLog.sends === null ? (
              <div className="blog-empty">Loading…</div>
            ) : openLog.sends.length === 0 ? (
              <div className="blog-empty">No per-recipient log for this broadcast.</div>
            ) : (
              <div className="blog-list">
                {openLog.sends.map((s, i) => (
                  <div className="blog-row" key={i}>
                    <span className="blog-addr">{s.address}</span>
                    <span className={`blog-pill ${s.status}`}>{s.status}</span>
                    {s.reason && <span className="blog-reason">{s.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Shell>
  );
}

// Above this many recipients, an accidental send is expensive/embarrassing, so
// the review step demands a typed confirmation (§ campaigns) rather than a
// single "Send to N" click being the only safeguard.
const LARGE_SEND = 100;
// Rough SMS cost: providers bill per 160-char GSM segment, per recipient.
const SMS_SEGMENT_COST = 0.01;
function linksIn(text: string): string[] {
  const m = (text || "").match(/https?:\/\/[^\s<>)"']+/g);
  return m ? Array.from(new Set(m)) : [];
}
function smsSegments(body: string): number { return Math.max(1, Math.ceil((body || "").length / 160)); }

function Composer({ target, onCancel, onSent }: { target: ComposeTarget; onCancel: () => void; onSent: () => void }) {
  const [channel, setChannel] = useState<"email" | "sms">(target.initial?.channel ?? "email");
  const [name, setName] = useState(target.initial ? target.name : `Message to ${target.name}`);
  const [subject, setSubject] = useState(target.initial?.subject ?? "");
  const [body, setBody] = useState(target.initial?.body ?? "");
  const [reach, setReach] = useState<number | null>(null);
  const [reachInfo, setReachInfo] = useState<{ reachable: number; optedOut: number; missingChannel: number; total: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [scheduleAt, setScheduleAt] = useState(""); // datetime-local value; empty = send now
  const [result, setResult] = useState<{ sentCount: number; failedCount: number; recipientCount: number; scheduledAt?: string } | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // "Sell it better" AI, seeded with the current message each time it's opened.
  const [showSell, setShowSell] = useState(false);
  const [sellKey, setSellKey] = useState(0);
  // Mandatory pre-send review (§ campaigns). Opening it holds the intended send
  // time (empty string = now) so the same modal covers send-now and schedule.
  const [review, setReview] = useState<{ when: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads the SAME workspace Studio is working in. Absent → the personal
  // workspace, exactly as before. Captured once (lazy) to avoid a server/client
  // hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  // Reachable count for the chosen channel.
  useEffect(() => {
    let live = true;
    void fetch("/api/broadcasts", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ rules: target.rules, channel, previewReach: true }) })
      .then((r) => r.json()).then((d) => {
        if (!live) return;
        setReach(typeof d.reachable === "number" ? d.reachable : null);
        setReachInfo(typeof d.reachable === "number" ? { reachable: d.reachable, optedOut: d.optedOut ?? 0, missingChannel: d.missingChannel ?? 0, total: d.total ?? d.reachable } : null);
      }).catch(() => {});
    return () => { live = false; };
  }, [channel, target.rules]);

  // Open the composer speaking your message: seed the empty body with the saved
  // one-liner (from the Message step) so broadcasts start on-brand, not blank.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/business/message${wsQuery}`, { credentials: "include" });
        if (!r.ok) return;
        const m = await r.json();
        const o = (m?.oneLiner ?? {}) as { problem?: string; solution?: string; result?: string };
        const p = (o.problem ?? "").trim().replace(/[.]+$/, "");
        const s = (o.solution ?? "").trim().replace(/[.]+$/, "");
        const res = (o.result ?? "").trim().replace(/[.]+$/, "");
        if (p && s && res) setBody((b) => b.trim() ? b : `Hi {{firstName}},\n\n${p}. ${s}, so ${res}.\n\n`);
      } catch { /* non-critical */ }
    })();
  }, [wsQuery]);

  const insertToken = (tok: string) => {
    const el = bodyRef.current;
    if (!el) { setBody((b) => b + tok); return; }
    const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length;
    setBody(body.slice(0, s) + tok + body.slice(e));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + tok.length; });
  };

  // One path for both send-now and schedule: with a scheduleAt the server
  // queues it (status 'scheduled') and the cron tick fires it at that time.
  const send = useCallback(async (when?: string) => {
    if (!body.trim()) { setErr("Write a message."); return; }
    if (channel === "email" && !subject.trim()) { setErr("Email needs a subject."); return; }
    if (when && new Date(when).getTime() <= Date.now()) { setErr("Pick a time in the future."); return; }
    setSending(true); setErr("");
    try {
      const payload: Record<string, unknown> = { name, channel, subject, body, rules: target.rules, segmentId: target.segmentId };
      if (when) payload.scheduledAt = new Date(when).toISOString();
      const r = await fetch("/api/broadcasts", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || (when ? "Could not schedule." : "Could not send.")); return; }
      setResult({ sentCount: d.broadcast.sentCount, failedCount: d.broadcast.failedCount, recipientCount: d.broadcast.recipientCount, scheduledAt: d.broadcast.scheduledAt ?? undefined });
    } catch { setErr(when ? "Network error scheduling." : "Network error sending."); }
    finally { setSending(false); }
  }, [name, channel, subject, body, target]);

  // Validate, then open the review step instead of sending straight away.
  const openReview = useCallback((when: string) => {
    if (!body.trim()) { setErr("Write a message."); return; }
    if (channel === "email" && !subject.trim()) { setErr("Email needs a subject."); return; }
    if (when && new Date(when).getTime() <= Date.now()) { setErr("Pick a time in the future."); return; }
    setErr(""); setTyped(""); setTestMsg(""); setReview({ when });
  }, [body, channel, subject]);

  // Send one test message to the sender (email → their account; SMS → a number
  // they type) so they can eyeball the real rendering before the blast.
  const sendTest = useCallback(async () => {
    setTesting(true); setTestMsg("");
    try {
      const r = await fetch("/api/broadcasts", {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: true, channel, subject, body, testTo: testTo.trim() || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setTestMsg(d.error || "Couldn't send the test."); return; }
      setTestMsg(d.ok ? `Test sent to ${d.to}.` : `Logged to ${d.to} — no provider configured, so nothing was delivered.`);
    } catch { setTestMsg("Network error sending the test."); }
    finally { setTesting(false); }
  }, [channel, subject, body, testTo]);

  if (result) {
    // Scheduled: nothing went out yet — confirm when it will.
    if (result.scheduledAt) {
      return (
        <Shell>
          <div className="hub-header"><div><div className="eyebrow">ONEVYRT · Broadcast</div><h1>Message scheduled</h1></div><button className="btn ghost" onClick={onSent}>← Segments</button></div>
          <div className="card">
            <div className="result-big">📅 Sends {new Date(result.scheduledAt).toLocaleString()}</div>
            <div className="sub">It&rsquo;ll go to the {result.recipientCount} {channel === "sms" ? "SMS-reachable" : "email"} contact{result.recipientCount === 1 ? "" : "s"} in &ldquo;{target.name}&rdquo; who are reachable at that time. You can cancel it before then from the list.</div>
            <button className="btn primary" style={{ marginTop: 14 }} onClick={onSent}>Done</button>
          </div>
        </Shell>
      );
    }
    const noProvider = result.sentCount === 0 && result.recipientCount > 0;
    return (
      <Shell>
        <div className="hub-header"><div><div className="eyebrow">ONEVYRT · Broadcast</div><h1>Message sent</h1></div><button className="btn ghost" onClick={onSent}>← Segments</button></div>
        <div className="card">
          <div className="result-big"><b className="ok">{result.sentCount}</b> sent{result.failedCount > 0 && <> · <b className="bad">{result.failedCount}</b> couldn&rsquo;t send</>}</div>
          <div className="sub">Targeted {result.recipientCount} {channel === "sms" ? "SMS-reachable" : "email"} contact{result.recipientCount === 1 ? "" : "s"} in &ldquo;{target.name}&rdquo;.</div>
          {noProvider && <div className="notice-inline">No {channel === "sms" ? "SMS (Twilio)" : "email (SMTP/Resend)"} provider is configured on the server, so nothing was delivered — the messages were logged instead. Configure a provider to send for real.</div>}
          <button className="btn primary" style={{ marginTop: 14 }} onClick={onSent}>Done</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="hub-header">
        <div><div className="eyebrow">ONEVYRT · Broadcast</div><h1>Message &ldquo;{target.name}&rdquo;</h1>
          <p className="sub">Compose an email or SMS to everyone in this segment who&rsquo;s reachable on that channel. Use merge fields to personalise.</p></div>
        <button className="btn ghost" onClick={onCancel}>← Cancel</button>
      </div>

      <AIStatus />

      <div className="card">
        <div className="ch-toggle">
          <button aria-pressed={channel === "email"} className={channel === "email" ? "on" : ""} onClick={() => setChannel("email")}>✉️ Email</button>
          <button aria-pressed={channel === "sms"} className={channel === "sms" ? "on" : ""} onClick={() => setChannel("sms")}>📱 SMS</button>
          <span className="reach" aria-live="polite">
            <span className="reach-pill">{reach === null ? "…" : `${reach} reachable`}</span>
            {reachInfo && (reachInfo.optedOut > 0 || reachInfo.missingChannel > 0) ? <span className="reach-excluded"> · {[reachInfo.optedOut > 0 ? `${reachInfo.optedOut} opted out` : null, reachInfo.missingChannel > 0 ? `${reachInfo.missingChannel} no ${channel === "sms" ? "phone" : "email"}` : null].filter(Boolean).join(", ")} excluded</span> : null}
          </span>
        </div>
        {channel === "email" && (
          <label className="fld"><span>Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Quick question about your goals" />
          </label>
        )}
        <label className="fld"><span>Message</span>
          <textarea ref={bodyRef} rows={channel === "sms" ? 4 : 8} value={body} onChange={(e) => setBody(e.target.value)}
            placeholder={channel === "sms" ? "Hi {{firstName}}, still keen to chat? Grab a time here…" : "Hi {{firstName}},\n\n…"} />
        </label>
        <div className="tokens">
          <span className="tokens-l">Insert:</span>
          {MERGE_TOKENS.map((t) => <button key={t.token} className="token" onClick={() => insertToken(t.token)}>{t.label}</button>)}
        </div>
        {channel === "sms" && <div className="hint">SMS is billed per segment by your provider; keep it short. {body.length} chars.</div>}
        <button type="button" className="sell-toggle" aria-expanded={showSell} onClick={() => { setSellKey((k) => k + 1); setShowSell((s) => !s); }}>
          ✦ {showSell ? "Hide AI" : "Sell it better with AI"}
        </button>
        {showSell && (
          <div className="sell-wrap">
            <SellBetter key={sellKey} initialText={body} kind={channel === "email" ? "email" : "generic"} onUse={(t) => { setBody(t); setShowSell(false); }} />
          </div>
        )}
      </div>

      <div className="savebar">
        {err && <div className="err" role="alert">{err}</div>}
        <input className="seg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Broadcast name" />
        <div className="savebar-btns">
          <label className="sched-fld" title="Leave empty to send now, or pick a future time to schedule">
            <span>📅</span>
            <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
          </label>
          <button className="btn" onClick={onCancel}>Cancel</button>
          {scheduleAt
            ? <button className="btn primary" disabled={sending || !reach} onClick={() => openReview(scheduleAt)}>Review &amp; schedule</button>
            : <button className="btn primary" disabled={sending || !reach} onClick={() => openReview("")}>Review &amp; send{reach ? ` · ${reach}` : ""}</button>}
        </div>
      </div>

      {review && (() => {
        const isLarge = (reach ?? 0) >= LARGE_SEND;
        const armed = !isLarge || typed.trim().toUpperCase() === "SEND";
        const links = linksIn(body);
        const cost = channel === "sms" ? (reach ?? 0) * smsSegments(body) * SMS_SEGMENT_COST : 0;
        return (
          <Modal open onClose={() => !sending && setReview(null)} title="Review before sending" width={520}>
            <div className="rv-summary" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 13.5 }}>
              <b>Audience</b><span>{reach ?? 0} reachable {channel === "sms" ? "SMS" : "email"} contact{(reach ?? 0) === 1 ? "" : "s"} in “{target.name}”</span>
              {reachInfo && (reachInfo.optedOut > 0 || reachInfo.missingChannel > 0) && (
                <><b>Excluded</b><span>{[reachInfo.optedOut > 0 ? `${reachInfo.optedOut} opted out` : null, reachInfo.missingChannel > 0 ? `${reachInfo.missingChannel} with no ${channel === "sms" ? "phone" : "email"}` : null].filter(Boolean).join(", ")} — not messaged</span></>
              )}
              <b>Channel</b><span>{channel === "sms" ? "SMS" : "Email"}</span>
              {channel === "email" && <><b>Subject</b><span>{subject || <em style={{ color: "var(--ds-danger,#c81e1e)" }}>none</em>}</span></>}
              <b>When</b><span>{review.when ? new Date(review.when).toLocaleString() : "Immediately"}</span>
              <b>Opt-outs</b><span>Unsubscribed contacts are automatically excluded.</span>
              <b>Links</b><span>{links.length ? links.map((l) => <div key={l} style={{ wordBreak: "break-all" }}>{l}</div>) : "None in the message."}</span>
              {channel === "sms" && <><b>Est. cost</b><span>~${cost.toFixed(2)} ({smsSegments(body)} seg × {reach ?? 0} recipients @ ${SMS_SEGMENT_COST.toFixed(2)})</span></>}
            </div>

            <div style={{ marginTop: 12, padding: "10px 12px", border: "1px solid var(--ds-border-default,#dde3eb)", borderRadius: 10 }}>
              <div className="rv-test-label">Optional: send yourself a preview before it goes to everyone</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {channel === "sms" && (
                  <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Your phone for the test"
                    className="rv-input" style={{ flex: 1, minWidth: 160 }} />
                )}
                <button className="btn" disabled={testing} onClick={() => void sendTest()}>{testing ? "Sending test…" : channel === "sms" ? "Send test SMS" : "Send test to me"}</button>
                {testMsg && <span role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--ds-text-secondary,#475569)" }}>{testMsg}</span>}
              </div>
            </div>

            {isLarge && (
              <div className="rv-alert">
                <div className="rv-alert-text">
                  This reaches <b>{reach}</b> people — type <b>SEND</b> below to confirm you mean to message all of them.
                </div>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Type SEND to confirm"
                  autoComplete="off" onPaste={(e) => e.preventDefault()}
                  className="rv-input" style={{ width: "100%", boxSizing: "border-box", fontSize: 14 }} />
              </div>
            )}

            <ModalActions>
              <button className="btn" disabled={sending} onClick={() => setReview(null)}>Back</button>
              <button className="btn primary" disabled={sending || !armed}
                onClick={() => { const when = review.when; setReview(null); void send(when || undefined); }}>
                {sending ? "Sending…" : review.when ? "Schedule it" : `Send to ${reach ?? 0}`}
              </button>
            </ModalActions>
          </Modal>
        );
      })()}
    </Shell>
  );
}

function Builder({ init, onCancel, onSaved, onMessage }: { init: { id: string | null; name: string; description: string; rules: Group }; onCancel: () => void; onSaved: () => void; onMessage: (rules: Group) => void }) {
  const [name, setName] = useState(init.name);
  const [description, setDescription] = useState(init.description);
  const [rules, setRules] = useState<Group>(init.rules);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced live preview whenever the rules change.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setPreviewing(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/segments/preview", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ rules }) });
        const d = await r.json().catch(() => ({}));
        if (r.ok) { setPreview(d.preview); setErr(""); } else setErr(d.error || "Couldn't evaluate this segment.");
      } catch { setErr("Network error evaluating the segment."); }
      finally { setPreviewing(false); }
    }, 450);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [rules]);

  const save = useCallback(async () => {
    if (!name.trim()) { setErr("Give the segment a name."); return; }
    setSaving(true); setErr("");
    try {
      const url = init.id ? `/api/segments/${init.id}` : "/api/segments";
      const r = await fetch(url, { method: init.id ? "PUT" : "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, rules }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d.error || "Could not save."); return; }
      onSaved();
    } catch { setErr("Network error saving."); }
    finally { setSaving(false); }
  }, [name, description, rules, init.id, onSaved]);

  const fetchContacts = useCallback(async (): Promise<Contact[]> => {
    const r = await fetch("/api/segments/contacts", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ rules }) });
    const d = await r.json().catch(() => ({}));
    return r.ok ? (d.contacts ?? []) : [];
  }, [rules]);

  const doExport = useCallback(async () => {
    const contacts = await fetchContacts();
    const header = ["name", "email", "phone", "status", "score", "funnel", "source", "booked", "createdAt"];
    const esc = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [header.join(","), ...contacts.map((c) => [c.name, c.email, c.phone, c.status, c.score, c.funnelSlug, c.source, c.booked, c.createdAt].map(esc).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `${(name || "segment").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }, [fetchContacts, name]);

  const copyList = useCallback(async (kind: "email" | "phone") => {
    const contacts = await fetchContacts();
    const vals = [...new Set(contacts.map((c) => kind === "email" ? c.email : c.phone).filter(Boolean) as string[])];
    if (vals.length === 0) return;
    if (await copyText(vals.join("\n"))) { setCopied(kind); window.setTimeout(() => setCopied(""), 1600); }
  }, [fetchContacts]);

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Segments</div>
          <h1>{init.id ? "Edit segment" : "New segment"}</h1>
        </div>
        <button className="btn ghost" onClick={onCancel}>← All segments</button>
      </div>

      {!init.id && (
        <div className="card">
          <h2 className="card-h">Start from a preset</h2>
          <p className="section-hint">A fast starting point — pick one, then fine-tune the exact rules below.</p>
          <div className="presets">
            {PRESETS.map((p) => (
              <button className="preset" key={p.name} onClick={() => setRules(structuredClone(p.rules))}>
                <span className="preset-ic" aria-hidden="true">{p.icon}</span>{p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="split">
        <div className="card">
          <h2 className="card-h">Rules</h2>
          <p className="section-hint">Combine conditions to describe exactly who belongs — add as many as you need, or nest a group for more complex logic.</p>
          <GroupEditor group={rules} onChange={setRules} depth={0} />
        </div>

        <div className="card preview">
          <h2 className="card-h">Live preview {previewing && <span className="dot" aria-hidden="true" />}</h2>
          <p className="section-hint">Updates automatically as you edit the rules — this is exactly who you&rsquo;ll reach.</p>
          <div className="big-count" aria-live="polite">
            <span className={preview ? "ds-gradient-text" : "big-count-dash"}>{preview ? preview.total.toLocaleString() : "—"}</span>
            <span className="big-count-suffix"> {preview && preview.total === 1 ? "person" : "people"}</span>
          </div>
          <div className="chips">
            <Chan label="Email" n={preview?.withEmail} icon="✉️" total={preview?.total} tone="info" />
            <Chan label="SMS" n={preview?.withPhone} icon="📱" total={preview?.total} tone="brand" />
            <Chan label="Verified" n={preview?.verified} icon="🔐" total={preview?.total} tone="success" />
            <Chan label="Booked" n={preview?.booked} icon="✅" total={preview?.total} tone="success" />
          </div>
          <div className="wf">
            <button className="btn sm primary" disabled={!preview?.total} onClick={() => onMessage(rules)}>✉️ Message these people</button>
            <button className="btn sm" disabled={!preview?.total} onClick={() => void doExport()}>⤓ Export CSV</button>
            <button className={`btn sm${copied === "email" ? " copied" : ""}`} disabled={!preview?.withEmail} onClick={() => void copyList("email")}>{copied === "email" ? "Copied ✓" : "Copy email list"}</button>
            <button className={`btn sm${copied === "phone" ? " copied" : ""}`} disabled={!preview?.withPhone} onClick={() => void copyList("phone")}>{copied === "phone" ? "Copied ✓" : "Copy SMS/call list"}</button>
          </div>
          {preview && preview.sample.length > 0 && (
            <div className="sample">
              <div className="sample-h">Sample</div>
              {preview.sample.slice(0, 8).map((c) => (
                <div className="scontact" key={c.id}>
                  <span className="sc-name">{c.name || c.email || "(anonymous)"}</span>
                  <span className={`sc-status ${c.status}`}>{c.status}</span>
                  <span className="sc-ch" aria-label={[c.email ? "has email" : null, c.phone ? "has phone" : null, c.booked ? "booked" : null].filter(Boolean).join(", ") || "no channel on file"}>
                    <span aria-hidden="true">{c.email ? "✉️" : ""}{c.phone ? "📱" : ""}{c.booked ? "✅" : ""}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="savebar">
        {err && <div className="err" role="alert">{err}</div>}
        <input className="seg-name" placeholder="Segment name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="seg-desc" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="savebar-btns">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? "Saving…" : init.id ? "Save changes" : "Save segment"}</button>
        </div>
      </div>
    </Shell>
  );
}

function Chan({ label, n, icon, total, tone }: { label: string; n: number | undefined; icon: string; total?: number; tone: "info" | "brand" | "success" }) {
  // A slim fill under the count shows what share of the whole audience this
  // channel covers — a quick "how reachable is this, really" gut-check.
  const pct = total && n != null && total > 0 ? Math.round((n / total) * 100) : null;
  return (
    <div className="chan">
      <div className="chan-top">
        <span className="chan-ic" aria-hidden="true">{icon}</span>
        <span className="chan-n">{n ?? "—"}</span>
        <span className="chan-l">{label}</span>
      </div>
      {pct !== null && <div className="chan-bar" aria-hidden="true"><span className={`chan-fill ${tone}`} style={{ width: `${pct}%` }} /></div>}
    </div>
  );
}

function GroupEditor({ group, onChange, depth }: { group: Group; onChange: (g: Group) => void; depth: number }) {
  const setCombinator = (c: "and" | "or") => onChange({ ...group, combinator: c });
  const setRule = (i: number, n: RuleNode) => onChange({ ...group, rules: group.rules.map((r, j) => j === i ? n : r) });
  const removeRule = (i: number) => onChange({ ...group, rules: group.rules.filter((_, j) => j !== i) });
  const addCondition = () => onChange({ ...group, rules: [...group.rules, emptyCondition()] });
  const addGroup = () => onChange({ ...group, rules: [...group.rules, { combinator: "and", rules: [emptyCondition()] }] });

  return (
    <div className={`grp d${Math.min(depth, 3)}`}>
      <div className="grp-top">
        <div className="comb">
          <span className="comb-lead">Combine with</span>
          <button aria-pressed={group.combinator === "and"} className={group.combinator === "and" ? "on" : ""} onClick={() => setCombinator("and")}>AND</button>
          <button aria-pressed={group.combinator === "or"} className={group.combinator === "or" ? "on" : ""} onClick={() => setCombinator("or")}>OR</button>
          <span className="comb-hint">{group.combinator === "and" ? "— every condition below must match" : "— any one condition below is enough"}</span>
        </div>
      </div>
      <div className="grp-rules">
        {group.rules.length === 0 && <div className="grp-empty">No conditions yet — everyone matches until you add one below.</div>}
        {group.rules.map((r, i) => (
          <div className="rule" key={i}>
            {isGroup(r)
              ? <GroupEditor group={r} onChange={(g) => setRule(i, g)} depth={depth + 1} />
              : <ConditionEditor condition={r} onChange={(c) => setRule(i, c)} />}
            <button className="rule-x" title="Remove" aria-label="Remove this rule" onClick={() => removeRule(i)}>✕</button>
          </div>
        ))}
      </div>
      <div className="grp-add">
        <button className="btn tiny" onClick={addCondition}>+ Condition</button>
        {depth < 3 && <button className="btn tiny" onClick={addGroup}>+ Nested group</button>}
      </div>
    </div>
  );
}

function ConditionEditor({ condition, onChange }: { condition: Condition; onChange: (c: Condition) => void }) {
  const def = SEGMENT_FIELDS[condition.field];
  const ops = def?.ops ?? [];
  const setField = (field: string) => {
    const nd = SEGMENT_FIELDS[field];
    if (!nd) return;
    const op = nd.ops[0]!;
    const value = nd.options ? nd.options[0]!.value : nd.kind === "number" || nd.kind === "days" ? 0 : "";
    onChange({ field, op, value: valueless(op) ? undefined : value });
  };
  const setOp = (op: Op) => onChange({ ...condition, op, value: valueless(op) ? undefined : (condition.value ?? (def?.options ? def.options[0]!.value : def?.kind === "number" || def?.kind === "days" ? 0 : "")) });

  return (
    <div className="cond">
      <select className="c-field" aria-label="Field to filter on" value={condition.field} onChange={(e) => setField(e.target.value)}>
        {FIELD_IDS.map((f) => <option key={f} value={f}>{SEGMENT_FIELDS[f]?.label}</option>)}
      </select>
      <select className="c-op" aria-label="Comparison" value={condition.op} onChange={(e) => setOp(e.target.value as Op)}>
        {ops.map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </select>
      {!valueless(condition.op) && (
        condition.op === "in" && def?.options
          ? <span className="c-multi">
              {def.options.map((o) => {
                const arr = Array.isArray(condition.value) ? condition.value : [];
                const on = arr.includes(o.value);
                return <label key={o.value} className={`c-chip ${on ? "on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={(e) => onChange({ ...condition, value: e.target.checked ? [...arr, o.value] : arr.filter((v) => v !== o.value) })} />{o.label}
                </label>;
              })}
            </span>
          : def?.options
            ? <select className="c-val" aria-label="Value" value={String(condition.value ?? "")} onChange={(e) => onChange({ ...condition, value: e.target.value })}>
                {def.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            : <input className="c-val" aria-label={def?.kind === "days" ? "Number of days" : "Value"} type={def?.kind === "number" || def?.kind === "days" ? "number" : "text"} value={String(condition.value ?? "")}
                onChange={(e) => onChange({ ...condition, value: def?.kind === "number" || def?.kind === "days" ? Number(e.target.value) : e.target.value })}
                placeholder={def?.kind === "days" ? "days" : "value"} />
      )}
    </div>
  );
}

function summarize(g: Group): string {
  const n = g.rules.length;
  if (n === 0) return "Everyone";
  return `${n} condition${n === 1 ? "" : "s"}, match ${g.combinator === "or" ? "any" : "all"}`;
}

function Shell({ children }: { children: ReactNode }) { return <div className="hub-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.hub-root{
  /* local convenience aliases onto the shared design-system tokens — kept as
     aliases (not hardcoded hex) so both the light theme AND the navy dark
     theme stay correct automatically, with no separate dark override needed. */
  --ds-warn:var(--ds-warning);--ds-warn-soft:var(--ds-warning-soft);--ds-muted-soft:var(--ds-bg-subtle);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--tertiary:var(--ds-text-tertiary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  max-width:920px;margin:0 auto;padding:26px 18px 160px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
.hub-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:26px;font-weight:700;margin:2px 0 5px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--tertiary);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:64ch;line-height:1.5;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:10px;padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s,color .15s,transform .15s,box-shadow .15s;}
.btn:hover{border-color:var(--ds-brand);}
.btn:disabled{opacity:.5;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.primary{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);transform:translateY(-1px);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));}
.btn.primary:active:not(:disabled){transform:translateY(0);box-shadow:none;}
.btn.big{font-size:14px;padding:11px 18px;}
.btn.sm{padding:6px 11px;font-size:12px;border-radius:8px;}
.btn.tiny{padding:5px 9px;font-size:12px;border-radius:8px;}
.btn.tiny.danger,.btn.danger{color:var(--ds-danger);}
.btn.tiny.danger:hover{background:var(--ds-danger-soft);border-color:var(--ds-danger);}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.lock{font-size:34px;}
.empty{background:var(--surface);border:1px dashed var(--border-strong);border-radius:12px;padding:22px 16px;text-align:center;color:var(--tertiary);font-size:13px;line-height:1.6;}
.fbg{background:linear-gradient(135deg,var(--ds-brand-soft),var(--surface) 62%);border:1px solid var(--border);border-left-width:3px;border-left-color:var(--ds-brand);border-radius:14px;padding:16px 18px;margin-bottom:16px;box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.04));}
.fbg-h{font-size:15px;font-weight:700;margin:0;display:flex;align-items:center;gap:8px;letter-spacing:-.2px;}
.fbg-spark{color:var(--ds-brand-active);}
.fbg-lead{font-size:13.5px;line-height:1.55;color:var(--muted);margin:8px 0 10px;} .fbg-lead b{color:var(--text);font-weight:700;}
.fbg-steps{margin:0 0 12px;padding-left:20px;display:flex;flex-direction:column;gap:6px;}
.fbg-steps li{font-size:13px;line-height:1.5;color:var(--muted);} .fbg-steps b{color:var(--text);font-weight:700;}
.fbg-note{font-size:11.5px;color:var(--tertiary);margin-top:10px;line-height:1.5;}
.suggest{margin-top:16px;background:var(--ds-brand-soft);border:1px solid var(--ds-brand);border-radius:14px;padding:14px 16px 16px;}
.suggest-h{font-size:13.5px;font-weight:700;color:var(--ds-brand-active);display:flex;align-items:center;gap:8px;margin:0 0 12px;flex-wrap:wrap;}
.sg-spark{font-size:14px;}
.sg-hint{font-size:11.5px;font-weight:500;color:var(--ds-text-tertiary);}
.suggest-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;}
.sgcard{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 13px;display:flex;flex-direction:column;gap:8px;transition:border-color .15s,box-shadow .15s;}
.sgcard:hover{border-color:var(--ds-brand);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));}
.sgc-top{display:flex;align-items:center;gap:8px;}
.sgc-icon{font-size:16px;}
.sgc-name{font-weight:700;font-size:13.5px;color:var(--text);flex:1;min-width:0;}
.sgc-size{font-size:12px;font-weight:700;color:var(--ds-brand-active);background:var(--ds-brand-soft);border-radius:999px;padding:1px 9px;}
.sgc-reason{font-size:12px;color:var(--muted);line-height:1.5;flex:1;}
.sgcard .btn.tiny{align-self:flex-start;}
.rows{display:flex;flex-direction:column;gap:8px;}
.srow{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:13px 15px;transition:border-color .15s,box-shadow .15s;}
.srow:hover{border-color:var(--border-strong);box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.05));}
.srow-main{flex:1;min-width:0;}
.srow-title{font-weight:700;font-size:14.5px;}
.srow-sub{font-size:12px;color:var(--muted);margin-top:3px;}
.srow-actions{display:flex;gap:6px;flex-wrap:wrap;}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px;transition:box-shadow .15s,border-color .15s;}
.card-h{font-size:14px;font-weight:700;margin:0 0 4px;display:flex;align-items:center;gap:8px;}
.section-hint{font-size:12px;color:var(--muted);margin:0 0 12px;line-height:1.5;max-width:56ch;}
.section-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:2px 8px;border-radius:999px;margin-left:8px;vertical-align:middle;}
.section-tag.warn{background:var(--ds-warn-soft);color:var(--ds-warn);border:1px solid color-mix(in srgb,var(--ds-warn) 30%,transparent);}
.section-tag.info{background:var(--ds-info-soft);color:var(--ds-info);border:1px solid color-mix(in srgb,var(--ds-info) 30%,transparent);}
.presets{display:flex;flex-wrap:wrap;gap:8px;}
.preset{display:inline-flex;align-items:center;gap:7px;background:var(--ds-surface-subtle);border:1px solid var(--border-strong);border-radius:999px;padding:8px 13px;font-size:12.5px;font-weight:500;color:var(--text);cursor:pointer;transition:border-color .15s,transform .15s,box-shadow .15s;}
.preset:hover{border-color:var(--ds-brand);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.05));}
.preset:active{transform:translateY(0);}
.preset:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.preset-ic{font-size:14px;}
.split{display:grid;grid-template-columns:1fr 300px;gap:14px;align-items:start;}
@media(max-width:720px){.split{grid-template-columns:1fr;}}
.grp{border:1px solid var(--border-strong);border-radius:10px;padding:10px;background:var(--ds-surface-subtle);}
.grp.d1{background:var(--surface);}.grp.d2{background:var(--ds-surface-subtle);}
.grp-top{margin-bottom:8px;}
.comb{display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;}
.comb-lead{font-size:11px;color:var(--tertiary);font-weight:600;margin-right:2px;}
.comb button{border:1px solid var(--border-strong);background:var(--surface);color:var(--muted);font-size:11px;font-weight:700;letter-spacing:.4px;padding:4px 10px;border-radius:7px;cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
.comb button:hover{border-color:var(--ds-brand);}
.comb button.on{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.comb button:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.comb-hint{font-size:11px;color:var(--tertiary);margin-left:6px;}
.grp-rules{display:flex;flex-direction:column;gap:8px;}
.grp-empty{font-size:12px;color:var(--tertiary);padding:4px 2px;}
.rule{display:flex;align-items:flex-start;gap:6px;}
.rule > :first-child{flex:1;min-width:0;}
.rule-x{flex:none;width:26px;height:26px;border-radius:7px;border:1px solid var(--border-strong);background:var(--surface);color:var(--ds-danger);font-size:11px;cursor:pointer;margin-top:3px;transition:background .15s,border-color .15s,transform .15s;}
.rule-x:hover{background:var(--ds-danger-soft);border-color:var(--ds-danger);transform:translateY(-1px);}
.rule-x:active{transform:translateY(0);}
.rule-x:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.grp-add{display:flex;gap:6px;margin-top:10px;}
.cond{display:flex;flex-wrap:wrap;gap:6px;align-items:center;}
.cond select,.cond input{font:inherit;font-size:13px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:8px;padding:7px 9px;transition:border-color .15s,box-shadow .15s;}
.cond select:focus,.cond input:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.c-field{font-weight:500;}
.c-val{width:130px;}
.c-multi{display:inline-flex;flex-wrap:wrap;gap:4px;}
.c-chip{display:inline-flex;align-items:center;gap:4px;font-size:12px;border:1px solid var(--border-strong);border-radius:999px;padding:4px 9px;cursor:pointer;color:var(--muted);}
.c-chip.on{background:var(--ds-brand-soft);border-color:var(--ds-brand);color:var(--ds-brand-active);}
.c-chip:hover{border-color:var(--ds-brand);}
.c-chip:has(input:focus-visible){outline:2px solid var(--ds-brand);outline-offset:2px;border-radius:999px;}
.c-chip input{width:auto;margin:0;}
.preview{position:sticky;top:64px;}
.card.preview{background:linear-gradient(180deg,var(--ds-brand-soft),var(--surface) 60%);border-left:3px solid var(--ds-brand);}
.dot{width:8px;height:8px;border-radius:50%;background:var(--ds-brand);animation:pulse 1s infinite;}
@keyframes pulse{50%{opacity:.3;}}
.big-count{font-size:38px;font-weight:700;letter-spacing:-1px;line-height:1;}
.big-count-suffix{font-size:14px;font-weight:500;color:var(--muted);margin-left:6px;letter-spacing:0;}
.big-count-dash{color:var(--tertiary);}
.chips{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0;}
.chan{background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:10px;padding:9px 11px;display:flex;flex-direction:column;gap:7px;transition:border-color .15s;}
.chan:hover{border-color:var(--border-strong);}
.chan-top{display:flex;align-items:center;gap:8px;}
.chan-ic{font-size:15px;}
.chan-n{font-size:16px;font-weight:700;}
.chan-l{font-size:11px;color:var(--muted);font-weight:500;margin-left:auto;text-transform:uppercase;letter-spacing:.4px;}
.chan-bar{height:4px;border-radius:99px;background:var(--border);overflow:hidden;}
.chan-fill{display:block;height:100%;border-radius:99px;transition:width .5s cubic-bezier(.2,.7,.3,1);}
.chan-fill.info{background:var(--ds-info);}
.chan-fill.brand{background:var(--ds-brand);}
.chan-fill.success{background:var(--ds-success);}
.wf{display:flex;flex-direction:column;gap:6px;}
.wf .btn.sm{justify-content:center;}
.wf .btn.copied{background:var(--ds-success-soft);border-color:var(--ds-success);color:var(--ds-success);}
.sample{margin-top:14px;border-top:1px solid var(--border);padding-top:10px;}
.sample-h{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--tertiary);font-weight:700;margin-bottom:8px;}
.scontact{display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 0;}
.sc-name{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500;}
.sc-status{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;padding:1px 6px;border-radius:999px;}
.sc-status.qualified{background:var(--ds-success-soft);color:var(--ds-success);}
.sc-status.nurture{background:var(--ds-warn-soft);color:var(--ds-warn);}
.sc-status.unqualified{background:var(--ds-muted-soft);color:var(--tertiary);}
.sc-ch{font-size:12px;letter-spacing:1px;}
.savebar{position:sticky;bottom:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 -4px 16px -6px rgba(0,0,0,.15);}
.savebar .err{color:var(--ds-danger);font-size:12.5px;font-weight:500;width:100%;}
.seg-name,.seg-desc{font:inherit;font-size:13px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:9px;padding:8px 11px;transition:border-color .15s,box-shadow .15s;}
.seg-name{width:180px;font-weight:500;}.seg-desc{flex:1;min-width:160px;}
.seg-name:focus,.seg-desc:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.savebar-btns{display:flex;gap:8px;margin-left:auto;}
.brow{display:flex;align-items:center;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 15px;transition:border-color .15s,box-shadow .15s;}
.brow:hover{border-color:var(--border-strong);}
.brow-ic{font-size:18px;}
.brow-main{flex:1;min-width:0;}
.brow-title{font-weight:700;font-size:14px;}
.brow-sub{font-size:11.5px;color:var(--tertiary);margin-top:2px;}
.brow-stat{font-size:12px;color:var(--muted);white-space:nowrap;}
.brow-btn{width:100%;text-align:left;cursor:pointer;font:inherit;color:inherit;transition:border-color .15s,box-shadow .15s,transform .15s;}
.brow-btn:hover{border-color:var(--ds-brand);box-shadow:var(--ds-shadow-sm,0 2px 6px -1px rgba(15,23,42,.08));transform:translateY(-1px);}
.brow-btn:active{transform:translateY(0);}
.brow-btn:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.brow-view{color:var(--ds-brand-active);font-weight:700;margin-left:8px;}
.brow-muted{opacity:.6;}
.btn.sm{padding:5px 11px;font-size:12px;height:auto;}
.sched-fld{display:inline-flex;align-items:center;gap:6px;padding:0 8px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font-size:12px;color:var(--muted);}
.sched-fld input{border:none;background:transparent;color:var(--text);font:inherit;padding:7px 2px;outline:none;}
.blog-sum{display:flex;gap:14px;font-size:13px;color:var(--muted);margin-bottom:12px;flex-wrap:wrap;}
.blog-sum .ok{color:var(--ds-success);font-weight:700;} .blog-sum .bad{color:var(--ds-danger);font-weight:700;}
.blog-empty{font-size:13px;color:var(--muted);padding:8px 0;}
.blog-list{display:flex;flex-direction:column;gap:6px;max-height:52vh;overflow:auto;}
.blog-row{display:flex;align-items:center;gap:9px;padding:7px 10px;background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:9px;transition:border-color .15s;}
.blog-row:hover{border-color:var(--border-strong);}
.blog-addr{flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.blog-pill{flex:0 0 auto;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;border-radius:6px;padding:2px 7px;}
.blog-pill.sent{color:var(--ds-success);background:var(--ds-success-soft);}
.blog-pill.failed{color:var(--ds-danger);background:var(--ds-danger-soft);}
.blog-pill.skipped{color:var(--muted);background:var(--ds-bg-subtle);}
.blog-reason{flex:0 0 auto;font-size:11px;color:var(--tertiary);max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ok{color:var(--ds-success);}.bad{color:var(--ds-danger);}
.fld{display:flex;flex-direction:column;gap:5px;margin-bottom:11px;font-size:12.5px;font-weight:500;color:var(--muted);}
.fld input,.fld textarea{font:inherit;font-size:14px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:9px;padding:9px 11px;width:100%;transition:border-color .15s,box-shadow .15s;}
.fld textarea{resize:vertical;line-height:1.5;}
.fld input:focus,.fld textarea:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.ch-toggle{display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap;}
.ch-toggle button{border:1px solid var(--border-strong);background:var(--surface);color:var(--muted);font-size:13px;font-weight:500;padding:8px 14px;border-radius:9px;cursor:pointer;transition:background .15s,border-color .15s,color .15s;}
.ch-toggle button:hover{border-color:var(--ds-brand);}
.ch-toggle button.on{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.ch-toggle button:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.ch-toggle .reach{margin-left:auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;}
.reach-pill{font-size:12px;font-weight:700;color:var(--ds-brand-active);background:var(--ds-brand-soft);padding:4px 10px;border-radius:999px;white-space:nowrap;}
.reach-excluded{font-size:11.5px;color:var(--tertiary);font-weight:500;}
.tokens{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:4px;}
.tokens-l{font-size:11.5px;color:var(--tertiary);font-weight:500;}
.token{border:1px solid var(--border-strong);background:var(--ds-surface-subtle);border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:500;color:var(--text);cursor:pointer;transition:border-color .15s,color .15s,transform .15s,box-shadow .15s;}
.token:hover{border-color:var(--ds-brand);color:var(--ds-brand-active);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs,0 1px 2px rgba(15,23,42,.05));}
.token:active{transform:translateY(0);}
.token:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.hint{font-size:11.5px;color:var(--tertiary);margin-top:8px;}
.result-big{font-size:24px;font-weight:700;}
.notice-inline{margin-top:12px;background:var(--ds-warn-soft);border:1px solid var(--ds-warn);color:var(--ds-warn);border-radius:10px;padding:11px 13px;font-size:12.5px;line-height:1.5;}
.sell-toggle{margin-top:10px;display:inline-flex;align-items:center;gap:5px;background:var(--ds-brand-soft);color:var(--ds-brand-active);border:none;border-radius:8px;padding:6px 12px;font-size:12.5px;font-weight:700;cursor:pointer;transition:filter .15s,transform .15s;}
.sell-toggle:hover{filter:brightness(.97);transform:translateY(-1px);}
.sell-toggle:active{transform:translateY(0);}
.sell-toggle:focus-visible{outline:none;box-shadow:var(--ds-ring);}
.sell-wrap{margin-top:10px;}
.rv-summary{background:var(--ds-surface-subtle);border:1px solid var(--border);border-radius:10px;padding:12px 14px;}
.rv-input{font:inherit;font-size:13px;color:var(--text);background:var(--surface);border:1.5px solid var(--border-strong);border-radius:8px;padding:7px 10px;transition:border-color .15s,box-shadow .15s;}
.rv-input:focus{outline:none;border-color:var(--ds-brand);box-shadow:var(--ds-ring);}
.rv-test-label{font-size:11.5px;font-weight:600;color:var(--tertiary);margin-bottom:8px;}
.rv-alert{margin-top:12px;background:var(--ds-warn-soft);border:1px solid color-mix(in srgb,var(--ds-warn) 30%,transparent);border-left:3px solid var(--ds-warn);border-radius:10px;padding:11px 13px;}
.rv-alert-text{font-size:13px;color:var(--ds-text-secondary);margin-bottom:8px;}
@media (prefers-reduced-motion: reduce){ .hub-root *:not(.dot){transition:none!important;animation:none!important;} }
`;
