import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Numbers pillar (pillar 2 — does it work?). Shared AppNav + Toast shell.
export default function NumbersLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
