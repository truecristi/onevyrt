/**
 * `/app` is a legacy alias for the Funnel Studio — it renders the exact same
 * FunnelStudio component as `/studio`, kept so old `/app` bookmarks keep working.
 * The canonical Studio URL is `/studio`; the signed-in Home is `/command-center`
 * (proposal §3). This route is intentionally NOT the Home — it opens the canvas.
 */
import StudioShell from "../studio-shell";

export default function AppHome() {
  return <StudioShell />;
}
