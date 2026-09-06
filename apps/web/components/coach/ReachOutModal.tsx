"use client";
/**
 * ReachOutModal — the coach roster's (and admin console's) "reach out to a
 * stalled learner" dialog. Prefills a warm, non-guilt-trippy subject + message
 * from how long the learner has been idle, fully editable before sending.
 * Send POSTs to /api/coach/reach-out, which both emails the learner and
 * leaves an in-app message for them — the coach doesn't have to do both by
 * hand, and it still lands even when there's no mail provider configured.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDialogA11y } from "../../lib/use-dialog-a11y";

interface SentResult { email: boolean; inApp: boolean }

export function ReachOutModal({
  wsId,
  workspaceName,
  daysIdle,
  currentModule,
  onClose,
  onSent,
}: {
  wsId: string;
  workspaceName: string;
  daysIdle?: number | null;
  currentModule?: string | null;
  onClose: () => void;
  onSent?: (result: SentResult) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const liveRef = useRef(true);

  // Prefilled once on mount, then fully editable — not re-derived if props
  // change later, since this dialog is mounted fresh each time it's opened.
  const [subject, setSubject] = useState(() => `A quick check-in on ${workspaceName}`);
  const [body, setBody] = useState(() => {
    const idleClause = daysIdle === null || daysIdle === undefined ? "in a while" : `in ${daysIdle} days`;
    const moduleClause = currentModule ? `, around "${currentModule}"` : "";
    return `Hi — I noticed you haven't been on the platform ${idleClause}${moduleClause}. No pressure at all — just checking in. Is anything blocking you, or is there something I can help with to get you moving again?`;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<SentResult | null>(null);

  // Escape shouldn't abandon a send in flight — guard it the same way the
  // scrim click already is (`!busy`). Wrapped in useCallback (keyed on the
  // values it reads) rather than a fresh closure per render, since
  // useDialogA11y's effect depends on this function identity and a new one
  // every render would re-trigger its "focus the dialog" effect on every
  // keystroke in the fields below.
  const closeUnlessBusy = useCallback(() => { if (!busy) onClose(); }, [busy, onClose]);
  useDialogA11y(dialogRef, closeUnlessBusy);

  useEffect(() => () => { liveRef.current = false; }, []);

  // useDialogA11y focuses the first focusable element in the dialog — that's
  // the subject field, which sits above the body in the layout below. This
  // dialog wants the body focused instead, so claim focus right after.
  useEffect(() => { bodyRef.current?.focus(); }, []);

  const send = async () => {
    if (busy || done) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/coach/reach-out", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ws: wsId, subject, message: body }),
      });
      const d = (await r.json()) as { sent?: SentResult; emailedTo?: string | null; error?: string };
      if (!liveRef.current) return;
      if (!r.ok || !d.sent) {
        setErr(d.error || "Couldn't send — try again.");
        setBusy(false);
        return;
      }
      setDone(d.sent);
      setBusy(false);
      onSent?.(d.sent);
      setTimeout(() => { if (liveRef.current) onClose(); }, 1200);
    } catch {
      if (liveRef.current) { setErr("Network error — try again."); setBusy(false); }
    }
  };

  return (
    <div className="rom-overlay" onClick={() => { if (!busy) onClose(); }}>
      <style>{CSS}</style>
      <div
        ref={dialogRef}
        className="rom-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Reach out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rom-title">Reach out</div>
        <div className="rom-to">To: {workspaceName}</div>

        {done ? (
          <div className="rom-success" role="status" aria-live="polite">
            {done.email
              ? "Sent — emailed the learner and left an in-app note"
              : "Left an in-app message. Email didn't send — no mail provider configured yet."}
          </div>
        ) : (
          <>
            <label className="rom-label" htmlFor="rom-subject">Subject</label>
            <input
              id="rom-subject"
              className="rom-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={busy}
            />

            <label className="rom-label" htmlFor="rom-body">Message</label>
            <textarea
              id="rom-body"
              ref={bodyRef}
              className="rom-textarea"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
              rows={6}
            />

            {err && <div className="rom-err" role="alert">{err}</div>}

            <div className="rom-actions">
              <button type="button" className="rom-btn rom-btn-ghost" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="rom-btn rom-btn-primary" onClick={() => void send()} disabled={busy}>
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.rom-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.55); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
.rom-dialog { width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; box-sizing: border-box; background: var(--ds-surface, #fff); border: 1px solid var(--ds-border-subtle, #e5e7eb); border-radius: var(--ds-radius-lg, 14px); padding: 20px 22px; box-shadow: 0 20px 60px rgba(15,23,42,.25); display: flex; flex-direction: column; }
.rom-title { font-size: 17px; font-weight: 800; color: var(--ds-text-primary, #111827); }
.rom-to { font-size: 12.5px; color: var(--ds-text-secondary, #475569); margin-top: 2px; margin-bottom: 12px; }
.rom-label { font-size: 12px; font-weight: 700; color: var(--ds-text-secondary, #475569); margin: 8px 0 4px; }
.rom-input, .rom-textarea { font: inherit; font-size: 13.5px; color: var(--ds-text-primary, #111827); background: var(--ds-surface, #fff); border: 1px solid var(--ds-border-subtle, #e5e7eb); border-radius: 10px; padding: 9px 11px; width: 100%; box-sizing: border-box; }
.rom-textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
.rom-input:focus, .rom-textarea:focus { outline: 2px solid var(--ds-brand, #088057); outline-offset: 1px; }
.rom-input:disabled, .rom-textarea:disabled { opacity: .65; }
.rom-err { font-size: 12.5px; color: var(--ds-danger, #dc2626); margin-top: 10px; }
.rom-success { font-size: 13.5px; color: var(--ds-brand, #088057); line-height: 1.5; padding: 6px 0 4px; }
.rom-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
.rom-btn { font: inherit; font-size: 13.5px; font-weight: 700; border-radius: 10px; padding: 9px 16px; cursor: pointer; }
.rom-btn-ghost { background: transparent; border: 1px solid var(--ds-border-subtle, #e5e7eb); color: var(--ds-text-primary, #111827); }
.rom-btn-primary { background: var(--ds-brand, #088057); border: none; color: #fff; }
.rom-btn:disabled { opacity: .6; cursor: default; }
.rom-btn:focus-visible { outline: 2px solid var(--ds-brand, #088057); outline-offset: 2px; }
`;
