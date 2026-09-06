/**
 * Stable Studio URL (audit Phase 1, slice 1B). `/studio` renders the exact same
 * FunnelStudio component as `/` and `/app` — it is NOT a reimplementation, so
 * project opening, autosave, local-draft recovery, revision history, workspace
 * scoping and authentication all behave identically (the component reads no
 * route-specific state; workspace comes from the API, and the only URL param it
 * reads — ?resetToken — works the same on any path).
 *
 * Purpose: give legacy "open the Studio" links a durable home of their own once
 * `/` later becomes the public marketing page. Additive and non-destructive —
 * `/` and `/command-center` keep working unchanged.
 */
import StudioShell from "../studio-shell";

export default function StudioPage() {
  return <StudioShell />;
}
