import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Mounts the shared AppNav + Toast above every /coaching page, matching every
// other ONEVYRT section (see app/programme/layout.tsx).
export default function CoachingLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
