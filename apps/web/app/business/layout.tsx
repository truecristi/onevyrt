import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Mounts the shared AppNav + app-wide Toast notifier above every page in this
// section, so navigation and feedback are consistent across the ONEVYRT
// surfaces (see components/AppNav, components/Toast).
export default function SectionLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
