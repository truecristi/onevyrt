"use client";
/**
 * Modal — one focus-trapped, theme-aware dialog for the whole product, so
 * confirms and composers stop each reinventing an overlay. Pairs with the Toast
 * notifier. Self-contained styles, closes on Escape / backdrop click, restores
 * focus to the trigger, locks body scroll, and traps Tab within the dialog.
 *
 * Usage:
 *   <Modal open={open} onClose={() => setOpen(false)} title="Delete funnel?">
 *     …body…
 *     <ModalActions>…buttons…</ModalActions>
 *   </Modal>
 * Or the imperative confirm: const ok = await confirmDialog({ … }).
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

export function Modal({ open, onClose, title, children, width = 480 }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key === "Tab" && ref.current) {
      const f = ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])');
      if (f.length === 0) return;
      const first = f[0]!, last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    prevFocus.current = document.activeElement as HTMLElement;
    document.addEventListener("keydown", onKey, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // focus the first focusable, or the dialog
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>('a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])');
      (el ?? ref.current)?.focus();
    });
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prevOverflow;
      prevFocus.current?.focus?.();
    };
  }, [open, onKey]);

  if (!open) return null;
  return (
    <div className="ov-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <style>{CSS}</style>
      <div className="ov-modal" role="dialog" aria-modal="true" aria-labelledby={title ? titleId : undefined} ref={ref} tabIndex={-1} style={{ maxWidth: width }}>
        {title && <div className="ov-modal-title" id={titleId}>{title}</div>}
        <div className="ov-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ModalActions({ children }: { children: ReactNode }) {
  return <div className="ov-modal-actions">{children}</div>;
}

/**
 * Imperative confirm dialog — resolves true/false. Mounts itself and cleans up.
 *
 * For destructive actions, pass `requireType` with a phrase the user must type
 * exactly to arm the confirm button (paste and drop are blocked, so they can't
 * shortcut it) — the "type DELETE to confirm" safety used across the app. Omit
 * it for an ordinary one-click confirm; every existing call is unaffected.
 */
export function confirmDialog(opts: { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; requireType?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const cleanup = (v: boolean) => { root.unmount(); host.remove(); resolve(v); };
    function Wrapper() {
      const [open, setOpen] = useState(true);
      const [typed, setTyped] = useState("");
      const need = opts.requireType?.trim();
      const armed = !need || typed.trim() === need;
      const done = (v: boolean) => { setOpen(false); cleanup(v); };
      return (
        <Modal open={open} onClose={() => done(false)} title={opts.title}>
          {opts.message && <div className="ov-modal-msg">{opts.message}</div>}
          {need && (
            <div style={{ marginTop: 12 }}>
              <div className="ov-modal-msg" style={{ marginBottom: 6 }}>To confirm, type <b>{need}</b> below. Pasting is disabled.</div>
              <input className="ov-minput" value={typed} aria-label={`Type ${need} to confirm`}
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} autoFocus
                onChange={(e) => setTyped(e.target.value)}
                onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}
                onKeyDown={(e) => { if (e.key === "Enter" && armed) { e.preventDefault(); done(true); } }} />
            </div>
          )}
          <ModalActions>
            <button className="ov-mbtn" onClick={() => done(false)}>{opts.cancelLabel ?? "Cancel"}</button>
            <button className={`ov-mbtn ${opts.danger ? "danger" : "primary"}`} disabled={!armed} onClick={() => done(true)}>{opts.confirmLabel ?? "Confirm"}</button>
          </ModalActions>
        </Modal>
      );
    }
    root.render(<Wrapper />);
  });
}

/** Imperative text-prompt dialog — the accessible replacement for window.prompt.
 *  Resolves the trimmed input, or null when cancelled/dismissed. Enter submits;
 *  Escape / backdrop / Cancel dismiss. Mounts itself and cleans up. */
export function promptDialog(opts: { title: string; message?: ReactNode; defaultValue?: string; placeholder?: string; confirmLabel?: string; cancelLabel?: string; inputType?: string }): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const cleanup = (v: string | null) => { root.unmount(); host.remove(); resolve(v); };
    function Wrapper() {
      const [open, setOpen] = useState(true);
      const [val, setVal] = useState(opts.defaultValue ?? "");
      const submit = () => { setOpen(false); cleanup(val.trim() ? val.trim() : null); };
      return (
        <Modal open={open} onClose={() => { setOpen(false); cleanup(null); }} title={opts.title}>
          {opts.message && <div className="ov-modal-msg" style={{ marginBottom: 12, whiteSpace: "pre-line" }}>{opts.message}</div>}
          <input className="ov-minput" type={opts.inputType ?? "text"} value={val} placeholder={opts.placeholder}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
          <ModalActions>
            <button className="ov-mbtn" onClick={() => { setOpen(false); cleanup(null); }}>{opts.cancelLabel ?? "Cancel"}</button>
            <button className="ov-mbtn primary" onClick={submit}>{opts.confirmLabel ?? "OK"}</button>
          </ModalActions>
        </Modal>
      );
    }
    root.render(<Wrapper />);
  });
}

/** Imperative alert dialog — the accessible replacement for window.alert.
 *  A single OK button; resolves when dismissed. Mounts itself and cleans up.
 *  Escape / backdrop / OK all close it. */
export function alertDialog(opts: { title: string; message?: ReactNode; confirmLabel?: string }): Promise<void> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const cleanup = () => { root.unmount(); host.remove(); resolve(); };
    function Wrapper() {
      const [open, setOpen] = useState(true);
      const done = () => { setOpen(false); cleanup(); };
      return (
        <Modal open={open} onClose={done} title={opts.title}>
          {opts.message && <div className="ov-modal-msg" style={{ whiteSpace: "pre-line" }}>{opts.message}</div>}
          <ModalActions>
            <button className="ov-mbtn primary" onClick={done}>{opts.confirmLabel ?? "OK"}</button>
          </ModalActions>
        </Modal>
      );
    }
    root.render(<Wrapper />);
  });
}

const CSS = `
.ov-modal-backdrop{position:fixed;inset:0;z-index:1100;background:rgba(15,23,42,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;animation:ov-fade .15s ease;}
.ov-modal{width:100%;background:var(--ds-surface,#fff);color:var(--ds-text-primary,#111827);border:1px solid var(--ds-border-default,#dde3eb);border-radius:22px;box-shadow:0 24px 60px -12px rgba(15,23,42,.4);font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);animation:ov-pop .18s cubic-bezier(.2,.7,.3,1);max-height:88vh;overflow:auto;}
.ov-modal-title{font-size:16px;font-weight:700;padding:18px 20px 0;letter-spacing:-.2px;}
.ov-modal-body{padding:14px 20px 18px;}
.ov-modal-msg{font-size:13.5px;color:var(--ds-text-secondary,#475569);line-height:1.55;}
.ov-minput{width:100%;box-sizing:border-box;border:1px solid var(--ds-border-strong,#cbd5e1);background:var(--ds-surface,#fff);color:var(--ds-text-primary,#111827);border-radius:9px;padding:10px 12px;font-size:14px;font-family:inherit;}
.ov-minput:focus{outline:none;border-color:var(--ds-brand,#0a9e6e);box-shadow:0 0 0 3px var(--ds-brand-soft,rgba(10,158,110,.15));}
.ov-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;flex-wrap:wrap;}
.ov-mbtn{border:1px solid var(--ds-border-strong,#cbd5e1);background:var(--ds-surface,#fff);color:var(--ds-text-primary,#111827);border-radius:11px;padding:9px 15px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;}
.ov-mbtn:hover{background:var(--ds-surface-subtle,#fafbfc);}
.ov-mbtn:disabled{opacity:.5;cursor:not-allowed;}
.ov-mbtn.primary:disabled:hover,.ov-mbtn.danger:disabled:hover{background:var(--ds-brand,#0a9e6e);}
.ov-mbtn.danger:disabled:hover{background:var(--ds-danger,#c81e1e);}
.ov-mbtn.primary{background:var(--ds-brand,#0a9e6e);border-color:var(--ds-brand,#0a9e6e);color:#fff;}
.ov-mbtn.danger{background:var(--ds-danger,#c81e1e);border-color:var(--ds-danger,#c81e1e);color:#fff;}
@keyframes ov-fade{from{opacity:0;}to{opacity:1;}}
@keyframes ov-pop{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.ov-modal-backdrop,.ov-modal{animation:none;}}
`;
