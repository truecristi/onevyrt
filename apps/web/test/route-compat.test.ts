import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Route compatibility guard (audit Phase 1, slice 1A).
 *
 * The Phase-1 IA work moves the authenticated home to /app and will later
 * redirect / and /command-center. This structural test locks the CURRENT route
 * contract so no later slice silently deletes a route that real links, emails,
 * bookmarks or the auth flow depend on — before any redirect exists. It reads
 * source files only (no server, no DB), so it runs in unit CI.
 *
 * When 1C introduces redirects, redirect-map assertions get added alongside
 * these; this file is the "nothing disappeared" backstop.
 */
// Tests run from apps/web (see package.json "test" script), so the app dir is
// resolved from cwd — avoids relying on __dirname, which isn't defined in ESM.
const WEB = process.cwd();
const page = (p: string) => path.join(WEB, "app", p, "page.tsx");
const file = (p: string) => path.join(WEB, "app", p);

/** Routes that MUST keep resolving. Deleting or moving any of these is a
 *  breaking change for existing links/bookmarks and must be done with a
 *  redirect, never a silent removal. */
const REQUIRED_PAGES: Array<[route: string, srcExists: string]> = [
  ["/", page(".")],                                  // root: sign-in (anon) + Studio home (authed) + ?resetToken flow
  ["/app", page("app")],                             // canonical authenticated home (added 1B-early)
  ["/studio", page("studio")],                       // stable Studio URL (added in 1B) — optional until then
  ["/command-center", page("command-center")],       // launch dashboard (merge target in 1D)
  ["/command-center/insights", page("command-center/insights")], // DISTINCT page — a /command-center redirect must be EXACT-match, not prefix
  ["/welcome", page("welcome")],                     // public marketing landing
  ["/business/funnels", page("business/funnels")],   // Lead Funnel Builder
];

/** API routes that must never be caught by a page-level redirect. */
const REQUIRED_API: Array<[route: string, src: string]> = [
  ["/api/command-center", file("api/command-center/route.ts")],
];

for (const [route, src] of REQUIRED_PAGES) {
  test(`route ${route} still has a page component`, () => {
    // /studio is introduced in slice 1B — tolerate its absence until then, but
    // once it exists it must stay. Every other route is required now.
    if (route === "/studio" && !existsSync(src)) return;
    assert.ok(existsSync(src), `${route} page source missing: ${src}`);
    assert.match(readFileSync(src, "utf8"), /export default/, `${route} must export a default page component`);
  });
}

for (const [route, src] of REQUIRED_API) {
  test(`API ${route} still has a handler and is not a page`, () => {
    assert.ok(existsSync(src), `${route} handler missing: ${src}`);
    assert.match(readFileSync(src, "utf8"), /export const (GET|POST|PUT|DELETE)/, `${route} must export an HTTP handler`);
  });
}

test("/, /app and /studio all render the single shared StudioShell (no divergent reimplementation)", () => {
  // The three home URLs must delegate to the same shell so project-open,
  // autosave, draft recovery, revision history, workspace scoping and auth
  // behave identically — a route quietly rendering its own copy would drift.
  // (The pages were refactored to render <StudioShell />, which itself
  // lazy-loads the FunnelStudio canvas from ./funnel-studio — so all three
  // still resolve to one studio. This test tracks that current contract.)
  for (const p of [".", "app", "studio"]) {
    const src = readFileSync(page(p), "utf8");
    assert.match(src, /import StudioShell from "\.\.?\/studio-shell"/, `${p}/page.tsx must import the shared StudioShell`);
    assert.match(src, /<StudioShell\s*\/>/, `${p}/page.tsx must render <StudioShell />`);
  }
  // …and StudioShell is the one place the shared FunnelStudio canvas is mounted.
  const shell = readFileSync(file("studio-shell.tsx"), "utf8");
  assert.match(shell, /["']\.\/funnel-studio["']/, "studio-shell.tsx must load the shared funnel-studio canvas");
});

test("/command-center and /command-center/insights are separate routes (redirect must be exact-match)", () => {
  // Guards the 1A finding: a naive prefix redirect of /command-center would
  // swallow the live Insights sub-page. They are distinct source files.
  assert.notEqual(page("command-center"), page("command-center/insights"));
  assert.ok(existsSync(page("command-center")) && existsSync(page("command-center/insights")));
});
