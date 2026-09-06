import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Glossary is a first-class in-app reference (linked from every <Explain>
// popover), so it gets the same shared AppNav + Toast shell as the rest of the
// app instead of dropping the reader onto a nav-less page (audit IA #10).
export default function GlossaryLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
