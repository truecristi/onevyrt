import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// /app is the legacy alias for the Studio (see page.tsx) — give it the same
// global AppNav chrome as /studio so old bookmarks land on a navigable page.
export default function SectionLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
