import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Start (the guided journey) is a first-class in-app surface, so it gets the
// same shared AppNav + Toast shell as every other section — previously it was
// orphaned with no way back into the rest of the app (audit IA #10).
export default function StartLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
