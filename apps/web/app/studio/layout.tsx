import type { ReactNode } from "react";
import { AppNav } from "../../components/AppNav";
import { ToastProvider } from "../../components/Toast";

// Mounts the shared AppNav above the Studio, ending its "nav island" status —
// audit P0: the app's highest-dwell surface had no global nav, leaving ~2/3 of
// the product unreachable from inside it. The Studio keeps its own toolbar
// below (workspace switcher, modes); this adds the same persistent primary nav
// every other section mounts (see app/programme/layout.tsx). The canvas fills
// via min-height (.gb-fill-min), not a fixed 100vh, so stacking a bar above it
// is safe — the shell just sits below the nav like every other page.
export default function SectionLayout({ children }: { children: ReactNode }) {
  return <ToastProvider><AppNav /><main id="main-content" tabIndex={-1}>{children}</main></ToastProvider>;
}
