"use client";
/**
 * Leads Inbox — the app's side of the Acquisition OS loop. Ads run → visitors
 * qualify at /q/[slug] → the good ones book a call, and everything lands here:
 * booked calls up top, every qualified/nurture/unqualified lead below, each
 * tagged with its score, route, and the ad it came from. Scoped to the
 * viewer's workspace by the API. When the demo funnel is unclaimed, a banner
 * lets this workspace adopt its sample leads so the loop is visible at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDialogA11y } from "../../../lib/use-dialog-a11y";
import { Notice } from "../../../components/ui/Notice";
import { SkeletonList } from "../../../components/Skeleton";
import { MarketingIcon } from "../../../components/MarketingIcons";
import { EmptyState } from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/Toast";

// Working-inbox stage, distinct from the funnel verdict (status). Kept in sync
// with LEAD_LIFECYCLES in lib/acquisition/leads.ts (that module can't be
// imported here — it pulls in the pg pool).
const LEAD_LIFECYCLES = ["new", "contacted", "booked", "won", "lost", "nurture", "unsubscribed"] as const;
type Lifecycle = (typeof LEAD_LIFECYCLES)[number];
// Stage colours reference theme-aware CSS tokens (defined in this page's CSS for
// both light and dark) with a hex fallback, so a stage pill stays legible in the
// navy dark theme instead of showing a fixed light-mode hue.
const LIFECYCLE_META: Record<Lifecycle, { label: string; color: string }> = {
  new: { label: "New", color: "var(--ds-stage-new, #2563eb)" },
  contacted: { label: "Contacted", color: "var(--ds-stage-contacted, #7c3aed)" },
  booked: { label: "Booked", color: "var(--ds-stage-booked, #0891b2)" },
  won: { label: "Won", color: "var(--ds-stage-won, #15803d)" },
  lost: { label: "Lost", color: "var(--ds-stage-lost, #b91c1c)" },
  nurture: { label: "Nurture", color: "var(--ds-stage-nurture, #b45309)" },
  unsubscribed: { label: "Unsubscribed", color: "var(--ds-stage-unsubscribed, #6b7280)" },
};

interface Member { userId: string; email: string; role: string; }
interface Lead { id: string; funnelSlug: string; status: "qualified" | "nurture" | "unqualified"; lifecycle: Lifecycle; score: number; route: string | null; name: string | null; email: string | null; phone: string | null; attribution: Record<string, unknown> | null; verified: boolean; assigneeId: string | null; nextAction: string | null; dueAt: string | null; createdAt: string; }
interface Booking { id: string; funnelSlug: string; slotStart: string; name: string | null; email: string | null; phone: string | null; createdAt: string; }
interface Payload { leads: Lead[]; bookings: Booking[]; summary: { leadsTotal: number; bookingsTotal: number }; demoClaimable: boolean; ownsDemo: boolean; members: Member[]; currentUserId: string | null; }
interface LeadEvent { id: string; kind: string; detail: Record<string, unknown> | null; actorEmail: string | null; createdAt: string; }
interface ScoreReason { reasons: { label: string; points: number }[]; maxScore: number; percent: number; }
interface LeadDetail { lead: Lead; answers: { prompt: string; value: string }[]; funnelTitle: string; events: LeadEvent[]; scoreReason: ScoreReason | null; }

/** Human sentence for one timeline event. */
function eventText(e: LeadEvent): string {
  const to = e.detail?.to;
  switch (e.kind) {
    case "created": return `Lead captured${e.detail?.status ? ` — ${String(e.detail.status)}` : ""}${typeof e.detail?.score === "number" ? `, score ${e.detail.score}` : ""}`;
    case "stage": return `Moved to ${to ? LIFECYCLE_META[to as Lifecycle]?.label ?? String(to) : "—"}`;
    case "assignee": return to ? `Assigned to ${String(to).split("@")[0]}` : "Unassigned";
    case "next_action": return to ? `Next action: ${String(to)}` : "Cleared the next action";
    case "due": return to ? `Due date set to ${new Date(String(to)).toLocaleDateString()}` : "Cleared the due date";
    case "contacted": return `Included in broadcast${to ? ` “${String(to)}”` : ""}`;
    default: return e.kind;
  }
}

type LeadPatch = { lifecycle?: Lifecycle; assigneeId?: string | null; nextAction?: string | null; dueAt?: string | null };

/** Short label for an assignee id, using the members list. */
function memberLabel(members: Member[], userId: string | null): string {
  if (!userId) return "Unassigned";
  const m = members.find((x) => x.userId === userId);
  return m ? (m.email.split("@")[0] || "Someone") : "Someone";
}
/** A due date is "overdue" once its day is before today (date-only compare). */
function dueMeta(dueAt: string | null): { label: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(due); d.setHours(0, 0, 0, 0);
  return { label: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }), overdue: d.getTime() < today.getTime() };
}
/** ISO datetime → yyyy-mm-dd for a <input type=date> value. */
function dateInputValue(iso: string | null): string { return iso ? iso.slice(0, 10) : ""; }

/** A stable identity for a person across repeat submissions: normalised email
 *  (lowercased/trimmed) preferred, else digits-only phone. Null when we have
 *  neither, so anonymous leads are never merged together (§322 dedup — group
 *  the same person's submissions without ever conflating two real strangers). */
function personKey(l: { email: string | null; phone: string | null }): string | null {
  const e = (l.email || "").trim().toLowerCase();
  if (e) return `e:${e}`;
  const p = (l.phone || "").replace(/\D/g, "");
  if (p.length >= 7) return `p:${p}`;
  return null;
}

// Funnel verdict + a plain-language meaning for each, so the pills and filters
// can carry a "what this means / what to do" hint instead of a bare label.
const STATUS_META: Record<Lead["status"], { label: string; cls: string; short: string; help: string }> = {
  qualified: { label: "Qualified", cls: "q", short: "ready for a call", help: "A strong fit — prioritise these for a call." },
  nurture: { label: "Nurture", cls: "n", short: "warm, not ready yet", help: "Interested but not ready — keep in touch until the timing is right." },
  unqualified: { label: "Unqualified", cls: "u", short: "not a fit right now", help: "Not a match today — low priority, but kept for the record." },
};

/** Small stage picker used both in a row and in the detail drawer. Stops click
 *  propagation so changing stage in a row doesn't also open the drawer. */
function LifecycleSelect({ value, onChange, busy }: { value: Lifecycle; onChange: (v: Lifecycle) => void; busy?: boolean }) {
  const meta = LIFECYCLE_META[value];
  return (
    <select aria-label="Lead stage" title="Move this lead to a working stage" className="stage-select" value={value} disabled={busy}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as Lifecycle)}
      style={{ appearance: "auto", fontSize: 12, fontWeight: 600, color: meta.color, background: "var(--surface, #fff)",
        border: `1.5px solid ${meta.color}`, borderRadius: 999, padding: "3px 8px", cursor: busy ? "wait" : "pointer" }}>
      {LEAD_LIFECYCLES.map((s) => <option key={s} value={s} style={{ color: "inherit" }}>{LIFECYCLE_META[s].label}</option>)}
    </select>
  );
}

function adOf(a: Record<string, unknown> | null): string {
  if (!a) return "";
  const src = (a.utmSource || a.source) as string | undefined;
  const camp = (a.utmCampaign || a.campaignId) as string | undefined;
  const creative = (a.creativeId || a.adId) as string | undefined;
  const parts = [src, camp, creative].filter(Boolean) as string[];
  if (parts.length) return parts.join(" · ");
  if (a.fbclid) return "Meta ad";
  return "Direct / unknown";
}

function fmtSlot(iso: string): string {
  // "2026-08-18T09:00" — parse as UTC wall clock, matching the availability engine.
  const [d, t] = iso.split("T");
  const [y, m, dd] = (d ?? "").split("-").map(Number);
  const dateLabel = new Date(Date.UTC(y ?? NaN, (m ?? NaN) - 1, dd ?? NaN)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const [hh, mm] = (t || "00:00").split(":").map(Number);
  const ampm = (hh ?? 0) < 12 ? "AM" : "PM";
  const h12 = (hh ?? 0) % 12 === 0 ? 12 : (hh ?? 0) % 12;
  return `${dateLabel}, ${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
}
function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function LeadsInboxPage() {
  const toast = useToast();
  const [state, setState] = useState<"loading" | "ok" | "not-authenticated" | "error">("loading");
  const [data, setData] = useState<Payload | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [filter, setFilter] = useState<"all" | Lead["status"]>("all");
  const [lifeFilter, setLifeFilter] = useState<"all" | Lifecycle>("all");
  const [ownFilter, setOwnFilter] = useState<"all" | "mine" | "overdue" | "due7">("all");
  const [collapseDupes, setCollapseDupes] = useState(false);
  const [lifeBusy, setLifeBusy] = useState<string | null>(null);
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  // Honour a ?ws=<id> deep-link (e.g. from Studio's Business-OS bridge) so this
  // page reads and writes the SAME workspace Studio is working in. Absent → the
  // personal workspace, exactly as before. Captured once (lazy) to avoid a
  // server/client hydration mismatch.
  const [wsQuery] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    const ws = new URLSearchParams(window.location.search).get("ws");
    return ws ? `?ws=${encodeURIComponent(ws)}` : "";
  });

  const openLead = useCallback(async (id: string) => {
    setDetail(null); setDetailState("loading");
    try {
      const r = await fetch(`/api/business/leads/${encodeURIComponent(id)}${wsQuery}`, { credentials: "include" });
      if (!r.ok) { setDetailState("error"); return; }
      setDetail(await r.json()); setDetailState("idle");
    } catch { setDetailState("error"); }
  }, [wsQuery]);
  const closeLead = useCallback(() => { setDetail(null); setDetailState("idle"); }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/business/leads${wsQuery}`, { credentials: "include" });
      if (r.status === 401) { setState("not-authenticated"); return; }
      if (!r.ok) { setState("error"); return; }
      setData(await r.json()); setState("ok");
    } catch { setState("error"); }
  }, [wsQuery]);

  useEffect(() => { void load(); }, [load]);

  const claimDemo = useCallback(async () => {
    setClaiming(true);
    try {
      await fetch(`/api/business/leads${wsQuery}`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "claim", slug: "demo" }) });
      await load();
    } finally { setClaiming(false); }
  }, [load, wsQuery]);

  const patchLead = useCallback(async (id: string, patch: LeadPatch, okMsg?: string) => {
    setLifeBusy(id);
    // Optimistic — reflect immediately in the list and any open drawer.
    setData((prev) => prev ? { ...prev, leads: prev.leads.map((l) => (l.id === id ? { ...l, ...patch } : l)) } : prev);
    setDetail((prev) => prev && prev.lead.id === id ? { ...prev, lead: { ...prev.lead, ...patch } } : prev);
    try {
      const r = await fetch(`/api/business/leads/${encodeURIComponent(id)}${wsQuery}`, {
        method: "PATCH", credentials: "include", headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) throw new Error("failed");
      if (okMsg) toast(okMsg);
    } catch {
      toast("Couldn't update the lead.", "error");
      await load(); // reconcile from the server on failure
    } finally { setLifeBusy(null); }
  }, [toast, load, wsQuery]);
  const setLifecycle = useCallback((id: string, lifecycle: Lifecycle) =>
    patchLead(id, { lifecycle }, `Moved to ${LIFECYCLE_META[lifecycle].label}`), [patchLead]);

  const leads = data?.leads ?? [];
  const members = data?.members ?? [];
  const currentUserId = data?.currentUserId ?? null;
  // Group repeat submissions by the same person (normalised email/phone), newest
  // first — every submission is preserved; grouping is a view over them (§322).
  const dupGroups = useMemo(() => {
    const g = new Map<string, Lead[]>();
    for (const l of leads) { const k = personKey(l); if (!k) continue; (g.get(k) ?? g.set(k, []).get(k)!).push(l); }
    for (const arr of g.values()) arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return g;
  }, [leads]);
  const groupOf = useCallback((l: Lead): Lead[] => { const k = personKey(l); return k ? (dupGroups.get(k) ?? [l]) : [l]; }, [dupGroups]);
  const dupTotal = useMemo(() => [...dupGroups.values()].filter((a) => a.length > 1).length, [dupGroups]);
  const shown = useMemo(
    () => leads.filter((l) => {
      if (filter !== "all" && l.status !== filter) return false;
      if (lifeFilter !== "all" && l.lifecycle !== lifeFilter) return false;
      if (ownFilter === "mine" && l.assigneeId !== currentUserId) return false;
      if (ownFilter === "overdue") { const dm = dueMeta(l.dueAt); if (!dm?.overdue) return false; }
      if (ownFilter === "due7") {
        if (!l.dueAt) return false;
        const days = (new Date(l.dueAt).getTime() - Date.now()) / 86_400_000;
        if (days < -1 || days > 7) return false;
      }
      // Collapsed: show only the newest submission per person (keyless leads
      // always show — they can't be safely grouped).
      if (collapseDupes) { const k = personKey(l); if (k) { const g = dupGroups.get(k); if (g && g[0]!.id !== l.id) return false; } }
      return true;
    }),
    [leads, filter, lifeFilter, ownFilter, currentUserId, collapseDupes, dupGroups],
  );
  const ownCounts = useMemo(() => ({
    mine: leads.filter((l) => l.assigneeId && l.assigneeId === currentUserId).length,
    overdue: leads.filter((l) => dueMeta(l.dueAt)?.overdue).length,
    due7: leads.filter((l) => {
      if (!l.dueAt) return false;
      const days = (new Date(l.dueAt).getTime() - Date.now()) / 86_400_000;
      return days >= -1 && days <= 7;
    }).length,
  }), [leads, currentUserId]);
  const counts = useMemo(() => ({
    qualified: leads.filter((l) => l.status === "qualified").length,
    nurture: leads.filter((l) => l.status === "nurture").length,
    unqualified: leads.filter((l) => l.status === "unqualified").length,
  }), [leads]);
  const lifeCounts = useMemo(() => {
    const c = Object.fromEntries(LEAD_LIFECYCLES.map((s) => [s, 0])) as Record<Lifecycle, number>;
    for (const l of leads) c[l.lifecycle] = (c[l.lifecycle] ?? 0) + 1;
    return c;
  }, [leads]);

  if (state === "loading") return <Shell><SkeletonList rows={6} /></Shell>;
  if (state === "not-authenticated") return <Shell><Notice icon="🔑" title="Please sign in" body="Sign in to open your Leads Inbox." href="/" cta="Go to sign in" /></Shell>;
  if (state === "error" || !data) return <Shell><Notice icon="⚠️" title="Couldn&rsquo;t load leads" body="Please refresh and try again." onRetry={() => void load()} /></Shell>;

  const bookings = data.bookings;

  return (
    <Shell>
      <div className="hub-header">
        <div>
          <div className="eyebrow">ONEVYRT · Acquisition OS</div>
          <h1>Leads Inbox</h1>
          <p className="sub">Every visitor who finished a qualification funnel — booked calls first, then all leads with their score, route, and the ad they came from.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* The journey promises "reach these leads" — give the inbox a direct
              door to Audiences & Broadcasts instead of a dead end. */}
          <a href="/business/segments" className="btn"><MarketingIcon name="audiences" size={15} /> Audiences &amp; broadcast</a>
          {leads.length > 0 && <a href={`/api/business/leads/export${wsQuery}`} className="btn">⬇ Export CSV</a>}
          <a href="/business" className="btn ghost">← Business OS</a>
        </div>
      </div>

      {data.demoClaimable && (
        <div className="claim">
          <div>
            <strong>See the loop working.</strong> The demo funnel (<code>/q/demo</code>) isn&rsquo;t linked to a workspace yet. Claim it to adopt its sample leads and bookings into this inbox.
          </div>
          <button className="btn primary" disabled={claiming} onClick={() => void claimDemo()}>{claiming ? "Claiming…" : "Claim demo funnel →"}</button>
        </div>
      )}

      {/* Pipeline at a glance — colour-coded so the eye lands on what needs
          action (overdue / due-soon follow-ups) before scrolling the list. */}
      {leads.length > 0 && (
        <div className="stats" role="group" aria-label="Pipeline at a glance">
          <div className="stat brand">
            <div className="stat-top"><MarketingIcon name="leads" size={13} /> Leads</div>
            <div className="stat-num grad">{data.summary.leadsTotal.toLocaleString()}</div>
            <div className="stat-sub">Captured from your funnels</div>
          </div>
          <div className="stat ok">
            <div className="stat-top"><MarketingIcon name="trophy" size={13} /> Qualified</div>
            <div className="stat-num">{counts.qualified.toLocaleString()}</div>
            <div className="stat-sub">Ready for a call</div>
          </div>
          <div className="stat info">
            <div className="stat-top"><MarketingIcon name="calendar" size={13} /> Booked</div>
            <div className="stat-num">{data.summary.bookingsTotal.toLocaleString()}</div>
            <div className="stat-sub">Calls on the calendar</div>
          </div>
          <div className={`stat ${ownCounts.overdue > 0 ? "warn" : "quiet"}`}>
            <div className="stat-top"><MarketingIcon name="bolt" size={13} /> {ownCounts.overdue > 0 ? "Overdue" : "Follow-ups"}</div>
            <div className="stat-num">{(ownCounts.overdue > 0 ? ownCounts.overdue : ownCounts.due7).toLocaleString()}</div>
            <div className="stat-sub">{ownCounts.overdue > 0 ? "Past their due date" : "Due within 7 days"}</div>
          </div>
        </div>
      )}

      {/* Booked calls */}
      <section>
        <div className="sec-head"><span className="sec-ic"><MarketingIcon name="calendar" size={16} /></span><h2>Booked calls</h2><span className="sec-count">{bookings.length}</span></div>
        <p className="sec-help">People who picked a time on your calendar. Reach out to confirm before the call.</p>
        {bookings.length < data.summary.bookingsTotal && (
          <div className="trunc-note" role="status">Showing the {bookings.length} nearest of {data.summary.bookingsTotal.toLocaleString()} bookings.</div>
        )}
        {bookings.length === 0
          ? <div className="empty">No calls booked yet. When a qualified lead picks a time on your funnel&rsquo;s calendar, it lands here — first call up top.</div>
          : <div className="rows">
              {bookings.map((b) => (
                <div className="row book" key={b.id}>
                  <div className="row-main">
                    <div className="row-name">{b.name || b.email || "Guest"}</div>
                    <div className="row-sub">{[b.email, b.phone].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <div className="row-slot">{fmtSlot(b.slotStart)}</div>
                </div>
              ))}
            </div>}
      </section>

      {/* Leads */}
      <section>
        <div className="sec-head"><span className="sec-ic"><MarketingIcon name="leads" size={16} /></span><h2>Leads</h2><span className="sec-count">{leads.length}</span></div>
        <p className="sec-help">Everyone who finished a funnel, newest first. Open any lead to read their answers and score, then set who owns it, when it&rsquo;s due, and the next step.</p>
        {leads.length < data.summary.leadsTotal && (
          <div className="trunc-note" role="status">Showing your {leads.length} most recent of {data.summary.leadsTotal.toLocaleString()} leads. Filter to narrow down, or <a href={`/api/business/leads/export${wsQuery}`}>export the full CSV</a>.</div>
        )}
        <div className="filters">
          {(["all", "qualified", "nurture", "unqualified"] as const).map((f) => (
            <button key={f} className={`chip ${filter === f ? "on" : ""}`} title={f === "all" ? "Show every lead" : STATUS_META[f].help} onClick={() => setFilter(f)}>
              {f === "all" ? `All ${leads.length}` : `${STATUS_META[f].label} ${counts[f]}`}
            </button>
          ))}
        </div>
        {/* Plain-language key so the three funnel verdicts aren't a mystery. */}
        {leads.length > 0 && (
          <div className="legend">
            {(["qualified", "nurture", "unqualified"] as const).map((s) => (
              <span className="lg" key={s}>
                <span className="dot" aria-hidden style={{ background: s === "qualified" ? "var(--ds-success)" : s === "nurture" ? "var(--ds-warn)" : "var(--ds-text-tertiary)" }} />
                <span><b>{STATUS_META[s].label}</b> — {STATUS_META[s].short}</span>
              </span>
            ))}
          </div>
        )}
        {/* Working stage — the follow-up state the audit calls for (§322). Only
            surface stages that actually have leads so the row stays compact. */}
        <div className="filters" style={{ marginTop: 6 }}>
          <button className={`chip ${lifeFilter === "all" ? "on" : ""}`} onClick={() => setLifeFilter("all")}>Any stage</button>
          {LEAD_LIFECYCLES.filter((s) => lifeCounts[s] > 0).map((s) => (
            <button key={s} className={`chip ${lifeFilter === s ? "on" : ""}`} onClick={() => setLifeFilter(s)}>
              {LIFECYCLE_META[s].label} {lifeCounts[s]}
            </button>
          ))}
        </div>
        {/* Follow-up filters — the working views that make this an inbox, not a
            report: my leads, what's overdue, what's due this week (§322). */}
        <div className="filters" style={{ marginTop: 6 }}>
          <button className={`chip ${ownFilter === "all" ? "on" : ""}`} onClick={() => setOwnFilter("all")}>Everyone</button>
          {currentUserId && <button className={`chip ${ownFilter === "mine" ? "on" : ""}`} onClick={() => setOwnFilter("mine")}>My leads {ownCounts.mine}</button>}
          {ownCounts.overdue > 0 && <button className={`chip ${ownFilter === "overdue" ? "on" : ""}`} title="Leads past their due date — chase these first" onClick={() => setOwnFilter("overdue")} style={ownFilter === "overdue" ? undefined : { color: "var(--ds-danger)" }}>Overdue {ownCounts.overdue}</button>}
          <button className={`chip ${ownFilter === "due7" ? "on" : ""}`} onClick={() => setOwnFilter("due7")}>Due this week</button>
          {dupTotal > 0 && <button className={`chip ${collapseDupes ? "on" : ""}`} onClick={() => setCollapseDupes((v) => !v)} title="Show one row per person (their repeat submissions collapse into the newest)">{collapseDupes ? "✓ " : ""}Merge duplicates ({dupTotal})</button>}
        </div>
        {shown.length === 0
          ? (leads.length === 0
              ? <EmptyState icon="leads" title="No leads yet"
                  description="This is where people land after they finish one of your qualification funnels. Share your funnel link and send traffic to it — the first lead shows up here automatically, tagged with its score and the ad it came from."
                  action={<a className="btn primary" href="/business/funnels"><MarketingIcon name="funnels" size={15} /> Set up your funnel</a>} />
              : <EmptyState icon="search" title="No leads match these filters"
                  description="Nothing here with the filters you've set. Widen them, or clear everything to see every lead again."
                  action={<button className="btn" onClick={() => { setFilter("all"); setLifeFilter("all"); setOwnFilter("all"); setCollapseDupes(false); }}>Clear filters</button>} />)
          : <div className="rows">
              {shown.map((l) => {
                const m = STATUS_META[l.status];
                return (
                  <div className="row clickable" key={l.id} role="button" tabIndex={0}
                    onClick={() => void openLead(l.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void openLead(l.id); } }}>
                    <div className={`pill ${m.cls}`} title={m.help}>{m.label}</div>
                    <div className="row-main">
                      <div className="row-name">{l.name || l.email || "Anonymous lead"} {l.verified && <span className="vbadge" title="Verified contact">✓ verified</span>}{(() => { const n = groupOf(l).length; return n > 1 ? <span title={`${n} submissions from this contact`} style={{ fontSize: 11, fontWeight: 600, color: "var(--accent, #0a9e6e)", marginLeft: 6 }}>{n} submissions</span> : null; })()}</div>
                      <div className="row-sub" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span>{adOf(l.attribution)}</span>
                        {l.assigneeId && <span title={`Assigned to ${memberLabel(members, l.assigneeId)}`} style={{ fontSize: 11, color: "var(--muted)" }}>· {memberLabel(members, l.assigneeId)}</span>}
                        {(() => { const dm = dueMeta(l.dueAt); return dm ? <span style={{ fontSize: 11, fontWeight: 600, color: dm.overdue ? "var(--ds-danger)" : "var(--muted)" }}>· due {dm.label}{dm.overdue ? " (overdue)" : ""}</span> : null; })()}
                        {l.nextAction && <span title={l.nextAction} style={{ fontSize: 11, color: "var(--dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>· {l.nextAction}</span>}
                      </div>
                    </div>
                    <LifecycleSelect value={l.lifecycle} busy={lifeBusy === l.id} onChange={(v) => void setLifecycle(l.id, v)} />
                    <div className="row-score">
                      <div className="score-n">{l.score}</div>
                      <div className="score-l">score</div>
                    </div>
                    <div className="row-when">{fmtWhen(l.createdAt)}</div>
                  </div>
                );
              })}
            </div>}
      </section>

      {(detail || detailState !== "idle") && (
        <LeadDialog onClose={closeLead}>
            {detailState === "loading" && <div className="panel center" style={{ boxShadow: "none", border: "none" }}><div className="spinner" />Loading…</div>}
            {detailState === "error" && <div className="empty">Couldn&rsquo;t load this lead.</div>}
            {detail && <LeadDetailView d={detail} members={members} busy={lifeBusy === detail.lead.id}
              related={groupOf(detail.lead).filter((x) => x.id !== detail.lead.id)}
              onOpenRelated={(id) => void openLead(id)}
              onLifecycle={(v) => void setLifecycle(detail.lead.id, v)}
              onPatch={(patch, msg) => void patchLead(detail.lead.id, patch, msg)} />}
        </LeadDialog>
      )}
    </Shell>
  );
}

// The lead-details modal, as its own component so it MOUNTS when opened — that
// mount is what lets useDialogA11y engage the focus trap, Escape-to-close, and
// focus return (an inline conditional block wouldn't re-run the hook on open).
function LeadDialog({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogA11y(ref, onClose);
  return (
    <div className="ld-backdrop" onClick={onClose}>
      <div ref={ref} className="ld-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Lead details">
        <button className="ld-close" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>
  );
}

function LeadDetailView({ d, members, busy, related, onOpenRelated, onLifecycle, onPatch }: { d: LeadDetail; members: Member[]; busy?: boolean; related: Lead[]; onOpenRelated: (id: string) => void; onLifecycle: (v: Lifecycle) => void; onPatch: (patch: LeadPatch, msg?: string) => void }) {
  const l = d.lead;
  const m = STATUS_META[l.status];
  const [action, setAction] = useState(l.nextAction ?? "");
  useEffect(() => { setAction(l.nextAction ?? ""); }, [l.id, l.nextAction]);
  const labelStyle = { display: "block", fontSize: 10.5, textTransform: "uppercase" as const, letterSpacing: ".4px", color: "var(--ds-text-tertiary)", fontWeight: 700, marginBottom: 4 };
  const fieldStyle = { width: "100%", boxSizing: "border-box" as const, border: "1px solid var(--ds-border-strong, #cbd5e1)", borderRadius: 8, padding: "7px 10px", fontSize: 13, background: "var(--surface, #fff)", color: "var(--text)" };
  return (
    <div>
      <div className="ld-head">
        <div className={`pill ${m.cls}`} title={m.help}>{m.label}</div>
        {l.verified && <span className="vbadge">✓ verified</span>}
        <LifecycleSelect value={l.lifecycle} busy={busy} onChange={onLifecycle} />
        <span className="ld-score">{l.score} <span className="ld-score-l">score</span></span>
      </div>
      <h2 className="ld-name">{l.name || l.email || "Anonymous lead"}</h2>
      <div className="ld-meta">
        {l.email && <a href={`mailto:${l.email}`} className="ld-link">{l.email}</a>}
        {l.phone && <a href={`tel:${l.phone}`} className="ld-link">{l.phone}</a>}
      </div>
      {/* Follow-up state (§322) — who owns it, what's next, when it's due. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "0 0 16px" }}>
        <label>
          <span style={labelStyle}>Assignee</span>
          <select aria-label="Assignee" value={l.assigneeId ?? ""} disabled={busy}
            onChange={(e) => onPatch({ assigneeId: e.target.value || null }, e.target.value ? "Lead assigned" : "Lead unassigned")}
            style={{ ...fieldStyle, cursor: busy ? "wait" : "pointer" }}>
            <option value="">Unassigned</option>
            {members.map((mem) => <option key={mem.userId} value={mem.userId}>{mem.email}</option>)}
          </select>
        </label>
        <label>
          <span style={labelStyle}>Due date</span>
          <input type="date" aria-label="Due date" value={dateInputValue(l.dueAt)} disabled={busy}
            onChange={(e) => onPatch({ dueAt: e.target.value ? new Date(e.target.value + "T09:00:00").toISOString() : null }, e.target.value ? "Due date set" : "Due date cleared")}
            style={fieldStyle} />
        </label>
      </div>
      <label style={{ display: "block", marginBottom: 16 }}>
        <span style={labelStyle}>Next action</span>
        <input aria-label="Next action" value={action} disabled={busy}
          placeholder="e.g. Call to confirm budget"
          onChange={(e) => setAction(e.target.value)}
          onBlur={() => { const t = action.trim(); if (t !== (l.nextAction ?? "")) onPatch({ nextAction: t || null }, "Next action saved"); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={fieldStyle} />
      </label>
      <div className="ld-facts">
        <div><span>Funnel</span>{d.funnelTitle}</div>
        <div><span>Source</span>{adOf(l.attribution) || "Direct / unknown"}</div>
        <div><span>Route</span>{l.route || "—"}</div>
        <div><span>Received</span>{new Date(l.createdAt).toLocaleString()}</div>
      </div>
      {d.scoreReason && d.scoreReason.reasons.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="ld-answers-h">Why this score — {l.score} of {d.scoreReason.maxScore} ({d.scoreReason.percent}%)</div>
          <div className="score-bar" role="img" aria-label={`Score is ${d.scoreReason.percent}% of the maximum`}>
            <span style={{ width: `${Math.max(0, Math.min(100, d.scoreReason.percent))}%` }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {d.scoreReason.reasons.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, color: "var(--text)" }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
                <span style={{ flexShrink: 0, fontWeight: 600, color: r.points >= 0 ? "var(--ds-success)" : "var(--ds-danger)" }}>{r.points >= 0 ? "+" : ""}{r.points}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {related.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div className="ld-answers-h">Other submissions from this contact ({related.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {related.map((r) => (
              <button key={r.id} type="button" onClick={() => onOpenRelated(r.id)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, textAlign: "left", cursor: "pointer",
                  background: "var(--ds-bg-subtle, #f6f8fa)", border: "1px solid var(--ds-border-default, #e2e8f0)", borderRadius: 8, padding: "8px 11px", fontSize: 12.5, color: "var(--text)" }}>
                <span>{new Date(r.createdAt).toLocaleDateString()} · {r.funnelSlug}{adOf(r.attribution) ? ` · ${adOf(r.attribution)}` : ""}</span>
                <span style={{ color: "var(--dim)", flexShrink: 0 }}>{STATUS_META[r.status].label} · {r.score}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="ld-answers-h">Their answers</div>
      {d.answers.length === 0
        ? <div className="empty">No answers recorded.</div>
        : <div className="ld-answers">
            {d.answers.map((a, i) => (
              <div className="ld-qa" key={i}>
                <div className="ld-q">{a.prompt}</div>
                <div className="ld-a">{a.value}</div>
              </div>
            ))}
          </div>}
      {d.events.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="ld-answers-h">Activity</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative" }}>
            {d.events.map((e) => (
              <div key={e.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--ds-border-subtle, #eef2f6)" }}>
                <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: "var(--accent, #0a9e6e)", flexShrink: 0, marginTop: 5 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text)" }}>{eventText(e)}</div>
                  <div style={{ fontSize: 11, color: "var(--dim)" }}>{new Date(e.createdAt).toLocaleString()}{e.actorEmail ? ` · ${e.actorEmail.split("@")[0]}` : ""}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) { return <div className="hub-root"><style>{CSS}</style>{children}</div>; }

const CSS = `
.hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-warn:#b45309;--ds-warn-soft:#fff7ed;--ds-muted-soft:#f1f5f9;
  --ds-radius-md:10px;--ds-radius-lg:12px;--ds-radius-xl:16px;
  --ds-shadow-xs:0 1px 2px rgba(15,23,42,.04);--ds-shadow-md:0 4px 12px -2px rgba(15,23,42,.10),0 2px 6px -2px rgba(15,23,42,.06);
  --ds-ease:cubic-bezier(.2,.7,.3,1);
  --surface:var(--ds-surface);--text:var(--ds-text-primary);--muted:var(--ds-text-secondary);--border:var(--ds-border-subtle);--border-strong:var(--ds-border-default);
  /* Local aliases so long-standing var(--accent)/var(--dim) references resolve to
     theme-aware DS tokens instead of a fixed light-mode fallback hex. */
  --accent:var(--ds-brand);--dim:var(--ds-text-tertiary);
  /* Working-stage hues (light). Redefined for dark below so pills stay legible. */
  --ds-stage-new:#2563eb;--ds-stage-contacted:#7c3aed;--ds-stage-booked:#0891b2;--ds-stage-won:#15803d;--ds-stage-lost:#b91c1c;--ds-stage-nurture:#b45309;--ds-stage-unsubscribed:#586173;
  max-width:820px;margin:0 auto;padding:26px 18px 120px;background:var(--ds-bg-app);color:var(--text);
  font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);border-radius:16px;}
:root[data-theme="dark"] .hub-root{
  /* colour tokens inherited from the shared design system (theme-aware) */
  --ds-warn-soft:#2a2005;--ds-muted-soft:#1a2234;
  /* Lighter working-stage hues so they read on the navy dark surfaces. */
  --ds-stage-new:#60a5fa;--ds-stage-contacted:#a78bfa;--ds-stage-booked:#22d3ee;--ds-stage-won:#34d399;--ds-stage-lost:#f87171;--ds-stage-nurture:#fbbf24;--ds-stage-unsubscribed:#94a3b8;
  --ds-shadow-xs:0 1px 3px rgba(0,0,0,.4);--ds-shadow-md:0 4px 14px -2px rgba(0,0,0,.5);}
.hub-root *{box-sizing:border-box;}
.hub-header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hub-header h1{font-size:27px;font-weight:700;margin:2px 0 5px;letter-spacing:-.5px;}
.eyebrow{font-size:11px;letter-spacing:.7px;font-weight:700;color:var(--ds-text-tertiary);text-transform:uppercase;}
.sub{color:var(--muted);font-size:13.5px;margin:0;max-width:62ch;line-height:1.5;}
.btn{display:inline-flex;align-items:center;gap:6px;background:var(--surface);border:1px solid var(--border-strong);color:var(--text);border-radius:var(--ds-radius-md);padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;transition:border-color .15s,background .15s;}
.btn:hover{border-color:var(--ds-border-strong);background:var(--ds-surface-subtle);}
.btn:disabled{opacity:.6;cursor:default;}
.btn.ghost{background:transparent;border-color:transparent;color:var(--muted);}
.btn.ghost:hover{background:var(--ds-bg-subtle);color:var(--text);}
.btn.primary{background:var(--ds-brand);border:1px solid var(--ds-brand);color:#fff;}
.btn.primary:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}
.panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);padding:20px;box-shadow:var(--ds-shadow-xs);}
.panel.center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;min-height:160px;text-align:center;color:var(--muted);}
.panel.notice{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:44px 22px;}
.panel.notice h2{margin:4px 0 0;font-size:19px;}
.lock{font-size:34px;}

.claim{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:var(--ds-brand-soft);border:1px solid var(--border);border-left:3px solid var(--ds-brand);border-radius:var(--ds-radius-lg);padding:14px 16px;margin-bottom:20px;font-size:13.5px;color:var(--text);line-height:1.5;}
.claim code{background:var(--ds-surface);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:1px 6px;font-size:12px;}

section{margin-bottom:26px;}
.sec-head{display:flex;align-items:center;gap:9px;margin-bottom:12px;}
.sec-head h2{font-size:16px;font-weight:700;margin:0;letter-spacing:-.2px;}
.sec-ic{display:inline-flex;color:var(--ds-brand);}
.sec-count{font-size:12px;font-weight:700;color:var(--muted);background:var(--ds-muted-soft);border-radius:999px;padding:1px 9px;}
.trunc-note{font-size:12.5px;color:var(--muted);background:var(--ds-warn-soft,var(--surface2));border:1px solid var(--border);border-radius:8px;padding:7px 11px;margin-bottom:12px;}
.trunc-note a{color:var(--ds-brand,#0a9e6e);font-weight:600;}
.empty{background:var(--surface);border:1px dashed var(--border-strong);border-radius:var(--ds-radius-lg);padding:22px 16px;text-align:center;color:var(--ds-text-tertiary);font-size:13px;}

.filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
.chip{background:var(--surface);border:1px solid var(--border-strong);color:var(--muted);border-radius:999px;padding:5px 12px;font-size:12.5px;font-weight:500;cursor:pointer;transition:background .15s var(--ds-ease),border-color .15s var(--ds-ease),color .15s var(--ds-ease),box-shadow .15s var(--ds-ease),transform .15s var(--ds-ease);}
.chip:hover{border-color:var(--ds-border-strong);transform:translateY(-1px);box-shadow:var(--ds-shadow-xs);}
.chip:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}
.chip:active{transform:translateY(0);}
.chip.on{background:var(--ds-brand);border-color:var(--ds-brand);color:#fff;}
.chip.on:hover{background:var(--ds-brand-hover);border-color:var(--ds-brand-hover);}

.rows{display:flex;flex-direction:column;gap:8px;}
.row{display:flex;align-items:center;gap:13px;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-lg);padding:12px 15px;box-shadow:var(--ds-shadow-xs);transition:border-color .15s var(--ds-ease),box-shadow .15s var(--ds-ease),transform .15s var(--ds-ease);}
.row:hover{border-color:var(--ds-border-strong);box-shadow:var(--ds-shadow-md);}
.row.clickable:hover{transform:translateY(-1px);}
.row.clickable:active{transform:translateY(0);}
.row.book{border-left:3px solid var(--ds-success);}
.row-main{flex:1;min-width:0;}
.row-name{font-weight:500;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.row-sub{font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.row-slot{font-size:13px;font-weight:700;color:var(--ds-success);white-space:nowrap;}
.row-score{text-align:center;flex:none;}
.score-n{font-size:17px;font-weight:700;line-height:1;color:var(--text);}
.score-l{font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--ds-text-tertiary);margin-top:2px;}
.row-when{font-size:12px;color:var(--ds-text-tertiary);white-space:nowrap;flex:none;width:52px;text-align:right;}
.pill{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:3px 9px;border-radius:999px;flex:none;}
.pill.q{background:var(--ds-success-soft);color:var(--ds-success);}
.pill.n{background:var(--ds-warn-soft);color:var(--ds-warn);}
.pill.u{background:var(--ds-muted-soft);color:var(--ds-text-tertiary);}
.vbadge{font-size:10px;font-weight:700;color:var(--ds-success);background:var(--ds-success-soft);padding:1px 6px;border-radius:999px;margin-left:4px;vertical-align:middle;}
.row.clickable{cursor:pointer;}
.row.clickable:focus-visible{outline:2px solid var(--ds-brand);outline-offset:1px;}

.ld-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.42);display:flex;align-items:flex-start;justify-content:center;padding:6vh 16px 24px;z-index:50;overflow-y:auto;}
.ld-panel{position:relative;background:var(--surface);border:1px solid var(--border);border-radius:var(--ds-radius-xl);box-shadow:0 24px 60px rgba(15,23,42,.24);width:min(520px,100%);padding:26px 24px;}
.ld-close{position:absolute;top:12px;right:12px;background:var(--ds-bg-subtle);border:none;width:30px;height:30px;border-radius:8px;cursor:pointer;color:var(--muted);font-size:14px;}
.ld-close:hover{background:var(--ds-muted-soft);}
.ld-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.ld-score{margin-left:auto;font-size:18px;font-weight:700;}
.ld-score-l{font-size:11px;font-weight:500;color:var(--ds-text-tertiary);text-transform:uppercase;letter-spacing:.4px;}
.ld-name{font-size:22px;margin:0 0 6px;letter-spacing:-.3px;}
.ld-meta{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;}
.ld-link{font-size:13.5px;color:var(--ds-brand);font-weight:500;text-decoration:none;}
.ld-link:hover{text-decoration:underline;}
.ld-facts{display:grid;grid-template-columns:1fr 1fr;gap:10px;background:var(--ds-bg-subtle);border-radius:var(--ds-radius-md);padding:12px 14px;margin-bottom:18px;}
.ld-facts div{font-size:13px;color:var(--text);min-width:0;}
.ld-facts span{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);font-weight:700;margin-bottom:2px;}
.ld-answers-h{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--ds-text-tertiary);margin-bottom:10px;}
.ld-answers{display:flex;flex-direction:column;gap:1px;}
.ld-qa{padding:9px 2px;border-bottom:1px solid var(--border);}
.ld-q{font-size:12.5px;color:var(--muted);margin-bottom:2px;}
.ld-a{font-size:14.5px;font-weight:500;color:var(--text);}
.spinner{width:28px;height:28px;border:3px solid var(--border);border-top-color:var(--ds-brand);border-radius:50%;animation:spin .8s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* Section helper — the one-line "what this is / what to do" under a heading. */
.sec-help{font-size:12.5px;line-height:1.5;color:var(--muted);margin:-4px 0 12px;max-width:66ch;}

/* Pipeline-at-a-glance overview band — soft tinted, informational (not clickable),
   colour telling the eye where to look first. */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px;}
@media (max-width:560px){.stats{grid-template-columns:repeat(2,1fr);}}
.stat{display:flex;flex-direction:column;gap:3px;padding:13px 14px;border-radius:var(--ds-radius-lg);border:1px solid var(--border);background:var(--surface);box-shadow:var(--ds-shadow-xs);}
.stat.brand{background:var(--ds-brand-soft);border-color:transparent;}
.stat.ok{background:var(--ds-success-soft);border-color:transparent;}
.stat.info{background:var(--ds-info-soft);border-color:transparent;}
.stat.warn{background:var(--ds-danger-soft);border-color:transparent;}
.stat.quiet{background:var(--ds-bg-subtle);border-color:transparent;}
.stat-top{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--muted);}
.stat.brand .stat-top{color:var(--ds-brand);}
.stat.ok .stat-top{color:var(--ds-success);}
.stat.info .stat-top{color:var(--ds-info);}
.stat.warn .stat-top{color:var(--ds-danger);}
.stat-num{font-size:24px;font-weight:800;line-height:1.05;letter-spacing:-.5px;color:var(--text);}
.stat-num.grad{color:var(--ds-brand);}
@supports ((background-clip:text) or (-webkit-background-clip:text)){.stat-num.grad{background:linear-gradient(90deg,var(--ds-brand),var(--ds-info));-webkit-background-clip:text;background-clip:text;color:transparent;}}
.stat-sub{font-size:11.5px;line-height:1.35;color:var(--muted);}

/* Status key — the three funnel verdicts in plain language. */
.legend{display:flex;flex-wrap:wrap;gap:8px 18px;background:var(--ds-bg-subtle);border:1px solid var(--border);border-radius:var(--ds-radius-md);padding:9px 13px;margin-bottom:12px;font-size:12px;line-height:1.4;color:var(--muted);}
.legend .lg{display:inline-flex;align-items:center;gap:7px;}
.legend .dot{width:9px;height:9px;border-radius:999px;flex:none;}
.legend b{color:var(--text);font-weight:700;}

/* Stage picker — interactive affordances that inline styles can't carry. */
.stage-select{transition:box-shadow .15s var(--ds-ease),transform .15s var(--ds-ease);}
.stage-select:hover{box-shadow:var(--ds-shadow-xs);transform:translateY(-1px);}
.stage-select:focus-visible{outline:2px solid var(--ds-brand);outline-offset:2px;}

/* Score meter — fills on open so the qualification strength reads at a glance. */
.score-bar{height:7px;border-radius:999px;background:var(--ds-bg-subtle);border:1px solid var(--border);overflow:hidden;margin:2px 0 12px;}
.score-bar>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--ds-brand),var(--ds-success));animation:scorefill .7s var(--ds-ease) both;}
@keyframes scorefill{from{width:0 !important;}}

@media (prefers-reduced-motion:reduce){.hub-root *{transition:none !important;animation:none !important;}}
`;
