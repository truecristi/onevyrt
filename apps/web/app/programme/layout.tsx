import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Mounts the shared AppNav + Toast above the Programme page, matching every
// other ONEVYRT section (see app/business/layout.tsx).
export default function SectionLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
