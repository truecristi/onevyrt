import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Psychology pillar (pillar 1 — how you sell). Same shared AppNav + Toast shell
// as the other ONEVYRT sections.
export default function PsychologyLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
