/**
 * /dev/ui — the design-system showcase (see Showcase.tsx). This is an internal
 * reference surface, so it's gated: available in non-production builds, or when
 * an operator explicitly opts in with ENABLE_DEV_UI=1. In production without
 * that flag it 404s like any unknown route, so the internal catalogue isn't
 * publicly reachable.
 */
import { notFound } from "next/navigation";
import Showcase from "./Showcase";

export default function DevUiPage() {
  const enabled = process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_UI === "1";
  if (!enabled) notFound();
  return <Showcase />;
}
