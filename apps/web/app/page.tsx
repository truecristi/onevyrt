/**
 * Root `/`. For a SIGNED-OUT visitor this renders the auth-aware Funnel Studio,
 * which shows the sign-in surface. A SIGNED-IN, param-less `/` never reaches
 * here — middleware 307s it to the canonical Home `/command-center` (proposal
 * §3). The password-reset `?resetToken=…` flow keeps `/` untouched, so it still
 * renders here while signed out.
 */
import StudioShell from "./studio-shell";

export default function Home() {
  return <StudioShell />;
}
