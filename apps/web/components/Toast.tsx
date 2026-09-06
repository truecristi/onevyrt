"use client";
/**
 * Toast — one lightweight, app-wide notifier so actions get consistent,
 * non-blocking feedback instead of each surface inventing its own inline
 * "Saved" text. Mounted once per section (via the layouts that already mount
 * AppNav); call const toast = useToast(); toast("Saved"); toast("Failed",
 * "error"). Self-contained styles, theme-aware via [data-theme], stacks at the
 * bottom-centre, auto-dismisses, and respects prefers-reduced-motion.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; message: string; kind: ToastKind; }
type Push = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<Push>(() => {});
export function useToast(): Push { return useContext(ToastContext); }

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const push = useCallback<Push>((message, kind = "success") => {
    const id = ++seq;
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="ov-toaster">
        <style>{CSS}</style>
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`ov-toast ${t.kind}`}
            role={t.kind === "error" ? "alert" : "status"}
            aria-live={t.kind === "error" ? "assertive" : "polite"}
          >
            <span className="ov-toast-dot" />
            <span className="ov-sr-only">{t.kind === "error" ? "Error: " : ""}</span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const CSS = `
.ov-toaster{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:max-content;max-width:92vw;}
.ov-toast{display:flex;align-items:center;gap:9px;background:var(--ds-surface,#fff);color:var(--ds-text-primary,#111827);border:1px solid var(--ds-border-default,#dde3eb);border-radius:12px;padding:11px 16px;font-size:13.5px;font-weight:500;font-family:var(--ds-font,system-ui,-apple-system,Segoe UI,Roboto,sans-serif);box-shadow:0 12px 30px -10px rgba(15,23,42,.28);animation:ov-toast-in .22s cubic-bezier(.2,.7,.3,1);}
.ov-toast-dot{width:8px;height:8px;border-radius:50%;background:var(--ds-success,#15803d);flex:none;}
.ov-toast.error .ov-toast-dot{background:var(--ds-danger,#c81e1e);}
.ov-toast.info .ov-toast-dot{background:var(--ds-brand,#0a9e6e);}
@keyframes ov-toast-in{from{opacity:0;transform:translateY(8px) scale(.98);}to{opacity:1;transform:none;}}
@media(prefers-reduced-motion:reduce){.ov-toast{animation:none;}}
.ov-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
`;
