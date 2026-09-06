"use client";
/**
 * The live qualification runtime: renders a funnel config one question per
 * screen, collects answers, and on the final step scores them with the engine
 * (scoreLead) to branch into the qualified / nurture / unqualified outcome.
 * Deliberately self-contained and dependency-light — this is what a real
 * visitor sees at /q/[slug]. Attribution capture + the Meta event are the next
 * bricks; this one proves the wizard + engine loop end to end.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scoreLead, type QualAnswers, type QualResult } from "@onevyrt/engine";
import { isPayable, type QualFunnelConfig, type QualQuestion } from "../../lib/studio/qualification-config";
import { parseAttribution, type Attribution } from "../../lib/acquisition/attribution";
import { loadStripeJs, formatCents, type StripeJs, type StripeElements } from "../../lib/stripe-loader";

interface DayAvail { date: string; slots: { start: string; label: string }[] }

/** "2026-08-18" → "Tue, Aug 18". Parsed as UTC so the label matches the
 *  wall-clock date the availability engine emitted (no host-tz shift). */
function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? NaN, (m ?? NaN) - 1, d ?? NaN)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

function answered(q: QualQuestion, a: QualAnswers): boolean {
  const v = a[q.id];
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  return String(v).trim() !== "";
}

// Backoff between retries of the qualified-lead POST below — immediate first
// try, growing waits after a failure (same shape as the AI client's retry
// loop in lib/ai/client.ts). This all runs in the background after the
// result is already on screen, so the extra seconds cost nothing in UX.
const QUALIFIED_MAX_ATTEMPTS = 3;
const QUALIFIED_RETRY_DELAYS_MS = [500, 1500];
function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

/** POST the qualified-lead payload, retrying a transient failure with
 *  backoff. Resolves true only for a genuine r.ok — a non-OK response or a
 *  thrown network error keeps retrying until attempts run out, then resolves
 *  false so the caller can fall back to the localStorage copy instead of
 *  losing the lead. */
async function postQualifiedWithRetry(payload: unknown): Promise<boolean> {
  for (let attempt = 0; attempt < QUALIFIED_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(QUALIFIED_RETRY_DELAYS_MS[attempt - 1]!);
    try {
      const r = await fetch("/api/q/qualified", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      if (r.ok) return true;
    } catch { /* network error — fall through and retry, or give up below */ }
  }
  return false;
}

// Durable fallback so a qualified lead never just vanishes: the payload is
// saved to localStorage BEFORE the first network attempt (not only after a
// failure), keyed by this visit's event id, and removed only once the server
// genuinely accepts it. That covers both a hard failure (all retries above
// exhausted) and the tab closing mid-attempt — there's nothing left to catch
// on unload, since the write already happened. All access is try/catch'd —
// localStorage can throw in private/locked-down browsing modes, and that
// must never break the funnel.
const PENDING_QUALIFIED_PREFIX = "gearbox:qual-pending:";
function savePendingQualified(eventId: string, payload: unknown): void {
  try { localStorage.setItem(PENDING_QUALIFIED_PREFIX + eventId, JSON.stringify(payload)); } catch { /* private mode etc. */ }
}
function clearPendingQualified(eventId: string): void {
  try { localStorage.removeItem(PENDING_QUALIFIED_PREFIX + eventId); } catch { /* private mode etc. */ }
}

/** Flush any qualified-lead payload a previous visit couldn't deliver — runs
 *  once on mount. Best effort: a failed flush just leaves the entry for the
 *  next mount to try again. */
function flushPendingQualified(): void {
  let keys: string[];
  try { keys = Object.keys(localStorage).filter((k) => k.startsWith(PENDING_QUALIFIED_PREFIX)); }
  catch { return; }
  for (const key of keys) {
    let payload: unknown;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      payload = JSON.parse(raw);
    } catch { continue; }
    void postQualifiedWithRetry(payload).then((ok) => { if (ok) clearPendingQualified(key.slice(PENDING_QUALIFIED_PREFIX.length)); });
  }
}

export function QualificationWizard({ config }: { config: QualFunnelConfig }) {
  const brand = config.brandColor || "#0a9e6e";
  const [step, setStep] = useState(-1); // -1 = intro, 0..n-1 = questions, n = result
  const [answers, setAnswers] = useState<QualAnswers>({});
  const total = config.questions.length;
  // Validation is shown only after the visitor tries to advance without an
  // answer (never before they interact — §19). Moving between steps clears it
  // and moves focus to the new question so screen-reader users hear it (§13).
  const [showValidation, setShowValidation] = useState(false);
  const qHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    setShowValidation(false);
    if (step >= 0 && step < total) qHeadingRef.current?.focus();
  }, [step, total]);

  // Booking sub-flow — only reachable from a *qualified* outcome. The calendar
  // is intentionally after qualification, so unqualified/nurture never see it.
  const [booking, setBooking] = useState(false);
  const [avail, setAvail] = useState<DayAvail[] | null>(null);
  const [availErr, setAvailErr] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<string>("");
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [bookState, setBookState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [bookMsg, setBookMsg] = useState("");
  const [confirmed, setConfirmed] = useState<{ label: string; date: string } | null>(null);

  // Paid step — reachable only from a *qualified* outcome, and only when the
  // funnel has a payable config. The /pay route is the amount authority (a
  // destination charge to the business's connected account); the client just
  // reflects what it returns and confirms with Stripe's hosted fields, so raw
  // card data never touches this origin. Whether the platform + business are
  // actually connected is decided server-side — the client optimistically
  // offers the step and shows an honest error if the route declines.
  const needsPayment = isPayable(config.payment);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [payState, setPayState] = useState<"idle" | "loading" | "ready" | "confirming" | "error">("idle");
  const [payErr, setPayErr] = useState("");
  const [payAmount, setPayAmount] = useState<{ cents: number; currency: string } | null>(null);
  const stripeRef = useRef<StripeJs | null>(null);
  const payElementsRef = useRef<StripeElements | null>(null);
  const payMountRef = useRef<HTMLDivElement | null>(null);
  // Where Stripe sends the visitor back after a redirect-based method — minted
  // by the /pay route (see confirmPay). Kept in a ref so it survives re-renders
  // without re-triggering the mount effect.
  const payReturnRef = useRef<string>("");

  // Start the paid step: ask the server for a destination PaymentIntent (it
  // owns the amount), load Stripe.js, and mount the Payment Element. Runs once
  // when the visitor enters the pay step; any decline surfaces honestly.
  useEffect(() => {
    if (!paying) return;
    let cancelled = false;
    setPayState("loading"); setPayErr("");
    (async () => {
      try {
        const r = await fetch(`/api/q/${encodeURIComponent(config.slug)}/pay`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok || !d.clientSecret || !d.publishableKey) { setPayErr(d.error || "Payment couldn't be started."); setPayState("error"); return; }
        setPayAmount({ cents: d.amountCents, currency: d.currency });
        payReturnRef.current = typeof d.returnUrl === "string" ? d.returnUrl : "";
        await loadStripeJs();
        if (cancelled || !window.Stripe) { setPayErr("Could not load the payment form."); setPayState("error"); return; }
        const stripe = window.Stripe(d.publishableKey);
        const elements = stripe.elements({ clientSecret: d.clientSecret });
        const el = elements.create("payment");
        stripeRef.current = stripe; payElementsRef.current = elements;
        // Mount once the container is in the DOM (payState → ready renders it).
        setPayState("ready");
        requestAnimationFrame(() => { if (!cancelled && payMountRef.current) el.mount(payMountRef.current); });
      } catch {
        if (!cancelled) { setPayErr("Payment couldn't be started."); setPayState("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [paying, config.slug]);

  const confirmPay = useCallback(async () => {
    if (!stripeRef.current || !payElementsRef.current) return;
    setPayState("confirming"); setPayErr("");
    try {
      // Always give Stripe a return_url so a redirect-based method (APM / bank
      // redirect) can complete and land back on the funnel instead of dead-
      // ending; for cards, redirect:"if_required" resolves inline and never
      // navigates. The shared StripeJs type doesn't model confirmParams yet, so
      // widen it locally rather than reach outside this component.
      type ConfirmPaymentOpts = Parameters<StripeJs["confirmPayment"]>[0] & { confirmParams?: { return_url: string } };
      const opts: ConfirmPaymentOpts = {
        elements: payElementsRef.current,
        redirect: "if_required",
        confirmParams: { return_url: payReturnRef.current || window.location.href },
      };
      const res = await stripeRef.current.confirmPayment(opts);
      if (res.error) { setPayErr(res.error.message || "The payment couldn't be completed."); setPayState("ready"); return; }
      setPaid(true); setPaying(false); setPayState("idle");
    } catch { setPayErr("The payment couldn't be completed."); setPayState("ready"); }
  }, []);

  // Contact capture — shown once after the questions and before the result, so
  // every lead (not just those who book) carries a name + email.
  const contactCfg = config.contact;
  const contactEnabled = !!contactCfg?.enabled;
  const [contactDone, setContactDone] = useState(false);

  // Contact verification (OTP) — gates the calendar for qualified leads when
  // the funnel requires it, so only reachable people book.
  const verifyCfg = config.verification;
  const needsVerify = !!verifyCfg?.enabled;
  const verifyChannel = verifyCfg?.channel ?? "email";
  const [verified, setVerified] = useState(false);
  const [verifyId, setVerifyId] = useState("");
  const [code, setCode] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>();
  const [verifyStarted, setVerifyStarted] = useState(false);

  // The result only resolves once the questions are done AND (if enabled)
  // contact has been captured — so the lead we record includes their details.
  const showResult = step >= total && (!contactEnabled || contactDone);
  const result: QualResult | null = useMemo(
    () => (showResult ? scoreLead(answers, config.rules) : null),
    [showResult, answers, config.rules],
  );
  const outcome = result ? config.outcomes[result.status] : null;

  // Capture ad attribution the moment the visitor lands, and mint a dedup id
  // for the eventual Meta event (matches the server-side CAPI event_id).
  const attrRef = useRef<Attribution>({});
  const eventIdRef = useRef<string>("");
  const sentRef = useRef(false);
  // The funnel-start beacon fires at most once per visit — a double-tap on the
  // Start button (common on mobile) must not double-count the start event.
  const startBeaconRef = useRef(false);
  useEffect(() => {
    attrRef.current = parseAttribution(new URLSearchParams(window.location.search), {
      cookies: typeof document !== "undefined" ? document.cookie : undefined,
      referrer: typeof document !== "undefined" ? document.referrer : undefined,
      url: window.location.href,
    });
    eventIdRef.current = (globalThis.crypto?.randomUUID?.() ?? `evt-${Date.now()}-${Math.round(Math.random() * 1e9)}`);
    // Top-of-funnel beacon: this visitor viewed the funnel.
    void fetch(`/api/q/${encodeURIComponent(config.slug)}/event`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "view", attribution: attrRef.current }),
    }).catch(() => {});
  }, [config.slug]);

  // Flush any qualified-lead payload a previous visit couldn't deliver (see
  // flushPendingQualified above) — independent of this visit's own event id,
  // so it also catches a drop left over from an earlier session in this
  // browser.
  useEffect(() => { flushPendingQualified(); }, []);

  const beaconStart = () => {
    if (startBeaconRef.current) return; // once per visit — guard against a double-tap
    startBeaconRef.current = true;
    void fetch(`/api/q/${encodeURIComponent(config.slug)}/event`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "start", attribution: attrRef.current }),
    }).catch(() => {});
  };

  // When the funnel finishes, tell the server (which re-scores and fires the
  // Meta QualifiedLead event for genuine qualifieds). "Once" means once it
  // actually lands: postQualifiedWithRetry retries a transient failure, and
  // the guard only flips on a genuine r.ok — a hard failure (or the tab
  // closing mid-attempt) leaves the payload in localStorage for
  // flushPendingQualified to pick up on a later visit instead of losing the
  // lead for good. The result screen above never waits on any of this.
  useEffect(() => {
    if (!result || sentRef.current) return;
    const payload = { slug: config.slug, answers, attribution: attrRef.current, eventId: eventIdRef.current, contact };
    savePendingQualified(eventIdRef.current, payload);
    void postQualifiedWithRetry(payload).then((ok) => {
      if (!ok) return;
      sentRef.current = true;
      clearPendingQualified(eventIdRef.current);
    });
  }, [result, config.slug, answers, contact]);

  // Load open slots the first time the visitor opens the calendar.
  useEffect(() => {
    if (!booking || avail !== null) return;
    let alive = true;
    void fetch(`/api/q/${encodeURIComponent(config.slug)}/availability`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("availability failed"))))
      .then((d: { availability?: DayAvail[] }) => { if (alive) setAvail(d.availability ?? []); })
      .catch(() => { if (alive) setAvailErr(true); });
    return () => { alive = false; };
  }, [booking, avail, config.slug]);

  // When a verification-gated qualified lead opens the calendar, send the code
  // to the contact they gave (email or phone). Runs once per booking session.
  useEffect(() => {
    if (!booking || !needsVerify || verified || verifyStarted) return;
    const destination = verifyChannel === "sms" ? contact.phone : contact.email;
    if (!destination) return;
    setVerifyStarted(true);
    void fetch(`/api/q/${encodeURIComponent(config.slug)}/verify/start`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: verifyChannel, destination }),
    }).then((r) => r.json()).then((d: { id?: string; devCode?: string }) => {
      if (d.id) setVerifyId(d.id);
      if (d.devCode) setDevCode(d.devCode);
    }).catch(() => setVerifyMsg("Couldn't send a code — please try again."));
  }, [booking, needsVerify, verified, verifyStarted, verifyChannel, contact.email, contact.phone, config.slug]);

  const checkCode = useCallback(async () => {
    if (verifyBusy || !verifyId || code.trim().length < 4) return;
    setVerifyBusy(true); setVerifyMsg("");
    try {
      const res = await fetch(`/api/q/${encodeURIComponent(config.slug)}/verify/check`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: verifyId, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data as { ok?: boolean }).ok) { setVerified(true); return; }
      setVerifyMsg((data as { error?: string }).error || "That code isn't right.");
    } catch { setVerifyMsg("Network error — please try again."); }
    finally { setVerifyBusy(false); }
  }, [verifyBusy, verifyId, code, config.slug]);

  const resendCode = useCallback(() => { setVerifyStarted(false); setCode(""); setVerifyMsg(""); setDevCode(undefined); }, []);

  const submitBooking = useCallback(async () => {
    if (!pickedSlot || bookState === "saving") return;
    setBookState("saving"); setBookMsg("");
    try {
      const res = await fetch(`/api/q/${encodeURIComponent(config.slug)}/book`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slot: pickedSlot, answers, attribution: attrRef.current, eventId: eventIdRef.current, contact, verificationId: verifyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // A 409 means the slot filled while we were choosing — reload availability.
        if (res.status === 409) { setAvail(null); setPickedSlot(""); }
        setBookState("error"); setBookMsg((data as { error?: string }).error || "Something went wrong — please try again.");
        return;
      }
      const day = pickedSlot.slice(0, 10);
      const label = avail?.flatMap((d) => d.slots).find((s) => s.start === pickedSlot)?.label || pickedSlot.slice(11);
      setConfirmed({ label, date: day });
      setBookState("done");
    } catch {
      setBookState("error"); setBookMsg("Network error — please try again.");
    }
  }, [pickedSlot, bookState, config.slug, answers, contact, avail, verifyId]);

  const setAnswer = (id: string, value: string | string[]) => setAnswers((a) => ({ ...a, [id]: value }));
  const toggleMulti = (id: string, value: string) => setAnswers((a) => {
    const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
    return { ...a, [id]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] };
  });

  const q = step >= 0 && step < total ? config.questions[step] : null;
  const canNext = q ? (!q.required || answered(q, answers)) : true;
  // Advance from the current question — shared by the Next button and
  // Enter-to-advance on the text/number inputs. A required-but-empty answer
  // surfaces the validation message and keeps the visitor on the question.
  const goNext = () => { if (!canNext) { setShowValidation(true); return; } setStep((s) => s + 1); };

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: "100dvh", background: "#f5f7fa", color: "#13201b", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "6vh 20px 40px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      <div style={{ width: "min(560px, 100%)" }}>
        {step >= 0 && step < total && (
          <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={step + 1}
            aria-valuetext={`Question ${step + 1} of ${total}`}
            style={{ height: 6, borderRadius: 999, background: "#e0eae4", overflow: "hidden", marginBottom: 26 }}>
            {/* Count the CURRENT question as progress, so the bar fills to 100%
                on the last one instead of sitting short right before submit. */}
            <div style={{ height: "100%", width: `${((step + 1) / total) * 100}%`, background: brand, transition: "width .25s ease" }} />
          </div>
        )}
        <div style={{ background: "#fff", border: "1px solid #e0eae4", borderRadius: 18, padding: "30px 28px", boxShadow: "0 20px 50px rgba(20,50,35,.06)" }}>
          {children}
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#626e66" }}>Powered by OneVYRT</div>
      </div>
    </div>
  );

  const primaryBtn = { background: brand, color: "#fff", border: "none", borderRadius: 11, padding: "13px 22px", fontSize: 15, fontWeight: 700, cursor: "pointer" as const };
  const ghostBtn = { background: "transparent", color: "#556158", border: "none", padding: "13px 8px", fontSize: 14, cursor: "pointer" as const };

  // Intro
  if (step === -1) {
    return shell(
      <div>
        <h1 style={{ fontSize: 26, letterSpacing: "-.02em", margin: "0 0 10px" }}>{config.title}</h1>
        {config.intro && <p style={{ fontSize: 16, color: "#556158", lineHeight: 1.55, margin: "0 0 22px" }}>{config.intro}</p>}
        <button style={primaryBtn} onClick={() => { beaconStart(); setStep(0); }}>Start →</button>
      </div>,
    );
  }

  // Booking confirmed
  if (confirmed) {
    return shell(
      <div role="status" aria-live="polite">
        <div aria-hidden="true" style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(10,158,110,.12)", color: brand, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 16 }}>✓</div>
        <h1 style={{ fontSize: 26, letterSpacing: "-.02em", margin: "0 0 10px" }}>You&rsquo;re booked in</h1>
        <p style={{ fontSize: 16, color: "#556158", lineHeight: 1.55, margin: "0 0 8px" }}>
          Your call is confirmed for <strong style={{ color: "#13201b" }}>{prettyDate(confirmed.date)} at {confirmed.label}</strong>.
        </p>
        <p style={{ fontSize: 15, color: "#556158", lineHeight: 1.55, margin: 0 }}>
          {contact.email ? `We'll send the details to ${contact.email}.` : "We'll be in touch with the details shortly."}
        </p>
      </div>,
    );
  }

  // Verification gate (qualified + verification required, before the calendar)
  if (booking && result?.status === "qualified" && needsVerify && !verified) {
    const dest = verifyChannel === "sms" ? contact.phone : contact.email;
    const codeOk = code.trim().length >= 4;
    return shell(
      <div>
        <button style={{ ...ghostBtn, padding: "0 0 12px", marginLeft: -2 }} onClick={() => { setBooking(false); resendCode(); }}>← Back</button>
        <h1 style={{ fontSize: 24, letterSpacing: "-.02em", margin: "0 0 6px" }}>Verify it&rsquo;s you</h1>
        <p style={{ fontSize: 15, color: "#556158", lineHeight: 1.5, margin: "0 0 18px" }}>
          We sent a 6-digit code to <strong style={{ color: "#13201b" }}>{dest}</strong>. Enter it to confirm your {verifyChannel === "sms" ? "number" : "email"} and unlock the calendar.
        </p>
        {devCode && (
          <div style={{ background: "rgba(10,158,110,.08)", border: "1px dashed #0a9e6e", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#0a7d57", marginBottom: 14 }}>
            Dev mode — no messages are sent here. Your code is <strong>{devCode}</strong>.
          </div>
        )}
        <input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          // Enter submits the code (checkCode self-guards on length/busy).
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); void checkCode(); } }}
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 15px", fontSize: 20, letterSpacing: "0.3em", textAlign: "center", borderRadius: 12, border: "1.5px solid #e0eae4", color: "#13201b", marginBottom: 12 }} />
        {verifyMsg && <p role="alert" style={{ color: "#b3261e", fontSize: 14, margin: "0 0 12px" }}>{verifyMsg}</p>}
        <button style={{ ...primaryBtn, width: "100%", opacity: codeOk && !verifyBusy ? 1 : 0.5, cursor: codeOk && !verifyBusy ? "pointer" : "not-allowed" }}
          disabled={!codeOk || verifyBusy} onClick={() => void checkCode()}>{verifyBusy ? "Checking…" : "Verify →"}</button>
        <button style={{ ...ghostBtn, display: "block", margin: "12px auto 0" }} onClick={resendCode}>Resend code</button>
      </div>,
    );
  }

  // Booking calendar (qualified only)
  if (booking && result?.status === "qualified") {
    const days = avail ?? [];
    const contactOk = contact.name.trim() !== "" && /.+@.+\..+/.test(contact.email);
    const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "12px 14px", fontSize: 15, borderRadius: 11, border: "1.5px solid #e0eae4", color: "#13201b", marginBottom: 10 };
    return shell(
      <div>
        <button style={{ ...ghostBtn, padding: "0 0 12px", marginLeft: -2 }} onClick={() => { setBooking(false); setPickedSlot(""); setBookState("idle"); }}>← Back</button>
        <h1 style={{ fontSize: 24, letterSpacing: "-.02em", margin: "0 0 6px" }}>Pick a time</h1>
        <p style={{ fontSize: 15, color: "#556158", lineHeight: 1.5, margin: "0 0 18px" }}>Choose a slot that works for you — all times in the team&rsquo;s local time.</p>

        {availErr && <p role="alert" style={{ color: "#b3261e", fontSize: 14 }}>Couldn&rsquo;t load the calendar. Please refresh and try again.</p>}
        {!availErr && avail === null && <p style={{ color: "#626e66", fontSize: 14 }}>Loading times…</p>}
        {!availErr && avail !== null && days.length === 0 && <p style={{ color: "#626e66", fontSize: 14 }}>No open times in the next two weeks — we&rsquo;ll reach out to schedule.</p>}

        {days.map((d) => (
          <div key={d.date} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#13201b", marginBottom: 8 }}>{prettyDate(d.date)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {d.slots.map((s) => {
                const on = pickedSlot === s.start;
                return (
                  <button key={s.start} onClick={() => setPickedSlot(s.start)}
                    style={{ padding: "9px 13px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: on ? 700 : 500,
                      border: `1.5px solid ${on ? brand : "#e0eae4"}`, background: on ? "rgba(10,158,110,.09)" : "#fff", color: "#13201b" }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {pickedSlot && (
          <div style={{ marginTop: 18, borderTop: "1px solid #eef2ef", paddingTop: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#13201b", marginBottom: 10 }}>Your details</div>
            <input style={inputStyle} placeholder="Full name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />
            <input style={inputStyle} type="email" placeholder="Email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
            <input style={{ ...inputStyle, marginBottom: 14 }} type="tel" placeholder="Phone (optional)" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
            {bookState === "error" && <p role="alert" style={{ color: "#b3261e", fontSize: 14, margin: "0 0 10px" }}>{bookMsg}</p>}
            <button style={{ ...primaryBtn, width: "100%", opacity: contactOk && bookState !== "saving" ? 1 : 0.5, cursor: contactOk && bookState !== "saving" ? "pointer" : "not-allowed" }}
              disabled={!contactOk || bookState === "saving"} onClick={() => void submitBooking()}>
              {bookState === "saving" ? "Booking…" : `Confirm ${prettyDate(pickedSlot.slice(0, 10))}, ${avail?.flatMap((x) => x.slots).find((x) => x.start === pickedSlot)?.label ?? ""}`}
            </button>
          </div>
        )}
      </div>,
    );
  }

  // Contact capture — after the questions, before the result, so every lead
  // carries a name + email. Email is always required; name/phone are opt-in.
  if (step >= total && contactEnabled && !contactDone) {
    const askName = contactCfg?.askName !== false;
    const askPhone = contactCfg?.askPhone !== false;
    const requirePhone = !!contactCfg?.requirePhone;
    const emailOk = /.+@.+\..+/.test(contact.email);
    const nameOk = !askName || contact.name.trim() !== "";
    const phoneOk = !askPhone || !requirePhone || contact.phone.trim() !== "";
    const ok = emailOk && nameOk && phoneOk;
    const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "13px 15px", fontSize: 16, borderRadius: 12, border: "1.5px solid #e0eae4", color: "#13201b", marginBottom: 11 };
    return shell(
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#626e66", marginBottom: 10 }}>Last step</div>
        <h2 style={{ fontSize: 22, letterSpacing: "-.01em", margin: "0 0 8px", lineHeight: 1.25 }}>{contactCfg?.headline || "Where should we send this?"}</h2>
        {contactCfg?.subtext && <p style={{ fontSize: 15, color: "#556158", lineHeight: 1.5, margin: "0 0 18px" }}>{contactCfg.subtext}</p>}
        {askName && <input style={inputStyle} placeholder="Full name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} />}
        <input style={inputStyle} type="email" placeholder="Email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
        {askPhone && <input style={{ ...inputStyle, marginBottom: 16 }} type="tel" placeholder={requirePhone ? "Phone" : "Phone (optional)"} value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button style={ghostBtn} onClick={() => setStep(total - 1)}>← Back</button>
          <button style={{ ...primaryBtn, opacity: ok ? 1 : 0.45, cursor: ok ? "pointer" : "not-allowed" }} disabled={!ok} onClick={() => setContactDone(true)}>See my result →</button>
        </div>
      </div>,
    );
  }

  // Paid step — a qualified visitor paying via the funnel's destination charge.
  // Reachable only from the qualified result's Pay CTA (see below).
  if (paying && result?.status === "qualified") {
    const cfgAmt = config.payment ? formatCents(config.payment.priceCents, config.payment.currency) : "";
    const shownAmt = payAmount ? formatCents(payAmount.cents, payAmount.currency) : cfgAmt;
    return shell(
      <div>
        <button style={{ ...ghostBtn, padding: "0 0 12px", marginLeft: -2 }}
          onClick={() => { setPaying(false); setPayState("idle"); setPayErr(""); stripeRef.current = null; payElementsRef.current = null; }}>← Back</button>
        <h1 style={{ fontSize: 24, letterSpacing: "-.02em", margin: "0 0 6px" }}>{config.payment?.label || "Complete your payment"}</h1>
        <p style={{ fontSize: 15, color: "#556158", lineHeight: 1.5, margin: "0 0 18px" }}>
          {shownAmt ? <>You’ll be charged <strong style={{ color: "#13201b" }}>{shownAmt}</strong>. Card details are handled securely by Stripe.</> : "Preparing a secure payment…"}
        </p>
        {payState === "loading" && <p style={{ fontSize: 14, color: "#626e66" }}>Loading the secure payment form…</p>}
        {payState === "error" && <p role="alert" style={{ color: "#b3261e", fontSize: 14 }}>{payErr}</p>}
        {(payState === "ready" || payState === "confirming") && (
          <>
            <div ref={payMountRef} style={{ margin: "6px 0 16px" }} />
            {payErr && <p role="alert" style={{ color: "#b3261e", fontSize: 14, margin: "0 0 10px" }}>{payErr}</p>}
            <button type="button" style={{ ...primaryBtn, minHeight: 44, opacity: payState === "confirming" ? 0.7 : 1 }}
              disabled={payState === "confirming"} onClick={() => void confirmPay()}>
              {payState === "confirming" ? "Processing…" : shownAmt ? `Pay ${shownAmt}` : "Pay"}
            </button>
          </>
        )}
      </div>,
    );
  }

  // Result
  if (result && outcome) {
    const tone = result.status === "qualified" ? brand : result.status === "nurture" ? "#b06a00" : "#556158";
    const isBookCta = result.status === "qualified" && outcome.ctaHref === "#book";
    // A qualified visitor with a payable funnel pays first; the original CTA
    // (book / link) returns once the charge succeeds.
    const showPayCta = needsPayment && result.status === "qualified" && !paid;
    const payCtaLabel = config.payment?.label || (config.payment ? `Pay ${formatCents(config.payment.priceCents, config.payment.currency)}` : "Pay");
    return shell(
      <div role="status" aria-live="polite">
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: tone, marginBottom: 8 }}>
          {result.status === "qualified" ? "Qualified" : result.status === "nurture" ? "Almost there" : "Thanks"}
        </div>
        <h1 style={{ fontSize: 26, letterSpacing: "-.02em", margin: "0 0 10px" }}>{outcome.heading}</h1>
        <p style={{ fontSize: 16, color: "#556158", lineHeight: 1.55, margin: "0 0 22px" }}>{outcome.body}</p>
        {paid && <p style={{ fontSize: 14, color: brand, fontWeight: 650, margin: "0 0 14px" }}>✓ Payment received — thank you.</p>}
        {showPayCta
          ? <button type="button" style={{ ...primaryBtn }} onClick={() => { setPayState("idle"); setPaying(true); }}>{payCtaLabel}</button>
          : isBookCta
            ? <button type="button" style={{ ...primaryBtn }} onClick={() => setBooking(true)}>{outcome.ctaLabel}</button>
            : /^(https?:|mailto:|tel:)/i.test(outcome.ctaHref || "")
              /* external destination → new tab */
              ? <a href={outcome.ctaHref} target="_blank" rel="noreferrer" style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>{outcome.ctaLabel}</a>
              : /^\//.test(outcome.ctaHref || "")
                /* internal path → same tab, no noreferrer */
                ? <a href={outcome.ctaHref} style={{ ...primaryBtn, display: "inline-block", textDecoration: "none" }}>{outcome.ctaLabel}</a>
                /* No usable destination (missing, or an unfilled placeholder
                   like "#playbook"/"#training") — don't render a dead-anchor
                   button, but never leave the result screen with nothing on
                   it either. An honest status line beats a silent gap. */
                : <p style={{ color: "#626e66", fontSize: 14, margin: 0 }}>We&rsquo;ll follow up with you shortly.</p>}
      </div>,
    );
  }

  // Question
  if (!q) return shell(<div>Loading…</div>);
  return shell(
    <div>
      <div role="status" aria-live="polite" style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "#626e66", marginBottom: 10 }}>
        Question {step + 1} of {total}
      </div>
      <h2 ref={qHeadingRef} tabIndex={-1} style={{ fontSize: 22, letterSpacing: "-.01em", margin: "0 0 18px", lineHeight: 1.25, outline: "none" }}>{q.prompt}</h2>

      {(q.kind === "single" || q.kind === "multi") && (
        <div role={q.kind === "multi" ? "group" : "radiogroup"} aria-label={q.prompt} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(() => {
            const opts = q.options ?? [];
            const isRadio = q.kind === "single";
            const hasSel = isRadio && opts.some((o) => answers[q.id] === o.value);
            return opts.map((opt, oi) => {
              const selected = q.kind === "multi"
                ? Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(opt.value)
                : answers[q.id] === opt.value;
              // WAI-ARIA radiogroup: only the checked radio (or the first when
              // none is chosen) is a tab stop; Arrow keys move selection.
              const roving = isRadio ? (selected || (!hasSel && oi === 0) ? 0 : -1) : undefined;
              return (
                <button key={opt.value} type="button"
                  role={q.kind === "multi" ? "checkbox" : "radio"} aria-checked={selected}
                  tabIndex={roving}
                  onKeyDown={isRadio ? (e) => {
                    if (e.key !== "ArrowDown" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const dir = (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : -1;
                    const n = (oi + dir + opts.length) % opts.length;
                    setAnswer(q.id, opts[n]!.value); setShowValidation(false);
                    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[n]?.focus();
                  } : undefined}
                  onClick={() => { if (q.kind === "multi") toggleMulti(q.id, opt.value); else setAnswer(q.id, opt.value); setShowValidation(false); }}
                  style={{ textAlign: "left", minHeight: 48, padding: "14px 16px", borderRadius: 12, cursor: "pointer", fontSize: 15,
                    border: `1.5px solid ${selected ? brand : "#e0eae4"}`,
                    background: selected ? "rgba(10,158,110,.07)" : "#fff", color: "#13201b", fontWeight: selected ? 650 : 400 }}>
                  {opt.label}
                </button>
              );
            });
          })()}
        </div>
      )}

      {(q.kind === "number" || q.kind === "text") && (
        <input type={q.kind === "number" ? "number" : "text"} placeholder={q.placeholder}
          value={String(answers[q.id] ?? "")} onChange={(e) => { setAnswer(q.id, e.target.value); setShowValidation(false); }}
          // Enter advances (mobile keyboards' "Go"/"Next"). Single-line input, so
          // no multiline concern; skip while an IME/autocomplete composition is
          // being confirmed, where Enter means "accept suggestion", not "advance".
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); goNext(); } }}
          style={{ width: "100%", boxSizing: "border-box", minHeight: 48, padding: "13px 15px", fontSize: 16, borderRadius: 12, border: "1.5px solid #e0eae4", color: "#13201b" }} />
      )}

      {showValidation && !canNext && (
        <p role="alert" style={{ color: "#b3261e", fontSize: 14, margin: "14px 0 0" }}>Please choose an answer to continue.</p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
        <button type="button" style={{ ...ghostBtn, minHeight: 44 }} onClick={() => setStep((s) => s - 1)}>← Back</button>
        {/* Next stays enabled so it explains why it can't proceed (§18) rather
            than silently greying out — a required-but-empty answer shows the
            validation message and keeps the visitor on the question. */}
        <button type="button" style={{ ...primaryBtn, minHeight: 44, opacity: canNext ? 1 : 0.7 }}
          onClick={goNext}>
          {step === total - 1 ? (contactEnabled ? "Almost done →" : "See my result →") : "Next →"}
        </button>
      </div>
    </div>,
  );
}
