import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Mounts the shared AppNav + Toast above the /businesses portfolio page,
// matching every other ONEVYRT section (see app/programme/layout.tsx,
// app/business/layout.tsx) — needed so this page renders with the app chrome
// AppNav's "My businesses & clients" account-menu link already points at.
export default function SectionLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
