/** App-wide theme CSS variables and global element styling — injected via a
 *  <style> tag on any screen that renders before the main canvas exists
 *  (the loading screen, the landing page), plus StudioInner itself. Shared
 *  so those screens match the canvas's light/dark theme instead of forcing
 *  a hardcoded look. */
export const THEME_CSS = `
[data-theme="dark"]{--bg:#000000;--surface:#1C1C1E;--surface2:#2C2C2E;--canvas:#000000;--border:#38383A;--border-strong:#636366;--border2:#2C2C2E;--border3:#48484A;--text:#F5F5F7;--muted:#98989F;--dim:#949499;--good-bg:#0C2E1E;--good-border:#30D158;--bad-bg:#3A1512;--bad-border:#FF453A;--bad-text:#FF6961;--warn-bg:#2A2005;--warn-text:#E0A54B;--accent:#30D158;--accent-soft:rgba(48,209,88,0.18);--shadow:0 10px 30px rgba(0,0,0,0.5);--chip:#2C2C2E;--glass-bg:rgba(28,28,30,0.72);--glass-border:rgba(255,255,255,0.1);--shadow-soft:0 20px 48px -12px rgba(0,0,0,0.6),0 2px 8px rgba(0,0,0,0.35);--shadow-panel:0 24px 60px -16px rgba(0,0,0,0.65),0 0 0 1px rgba(255,255,255,0.06);}
[data-theme="light"]{--bg:#F2F2F7;--surface:#ffffff;--surface2:#F2F2F7;--canvas:#F2F2F7;--border:#e2e7f0;--border-strong:#586687;--border2:#edf0f6;--border3:#e2e7f0;--text:#1e2c46;--muted:#586687;--dim:#68686d;--good-bg:#e7f7ef;--good-border:#087f57;--bad-bg:#fdeceb;--bad-border:#FF3B30;--bad-text:#d70015;--warn-bg:#fff4e0;--warn-text:#8a5200;--accent:#088057;--accent-soft:rgba(10,158,110,0.15);--shadow:0 1px 2px rgba(30,44,70,0.04),0 4px 14px rgba(30,44,70,0.07);--chip:#F2F2F7;--glass-bg:rgba(255,255,255,0.48);--glass-border:rgba(255,255,255,0.7);--shadow-soft:0 20px 48px -14px rgba(40,54,90,0.16),0 2px 8px rgba(40,54,90,0.06);--shadow-panel:0 24px 60px -18px rgba(40,54,90,0.2),0 0 0 1px rgba(40,54,90,0.04);}

/* Full-height shells: on mobile browsers 100vh is measured against the tallest
   viewport (address bar hidden), so a 100vh column overflows and the canvas is
   pushed below the fold. 100dvh tracks the *current* visible height. vh first as
   the fallback for anything that doesn't support dvh, dvh wins where it does. */
.gb-fill-min{min-height:100vh;min-height:100dvh;}
.gb-fill-fixed{height:100vh;height:100dvh;}

/* Modern pass: glass floating panels + a calmer, softer button language app-wide.
   Tag selectors (not classes) so every existing inline-styled button/select
   picks this up for free — no need to touch every call site. */
.gb-glass-panel{backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);}
button,select{transition:background-color .15s ease,border-color .15s ease,transform .08s ease,box-shadow .15s ease,opacity .15s ease;}
button:not(:disabled):active{transform:scale(0.97);}
button:not(:disabled):hover{filter:brightness(1.04);}
[data-theme="dark"] button:not(:disabled):hover{filter:brightness(1.15);}

/* Connection points live on four sides and stay fully visible at all times so
   a card's inputs/outputs read at a glance; they still grow sharper on hover.
   Each dot is centred right on the card border, so the edge line reads as an
   unbroken continuation of the card rather than starting mid-air. */
.react-flow__handle{transition:transform .12s ease, opacity .12s ease;z-index:2;}
.react-flow__handle:hover{transform:scale(1.5);opacity:1 !important;}
.react-flow__edge-path{stroke-width:2;}
.react-flow__edge.selected .react-flow__edge-path,
.react-flow__edge:hover .react-flow__edge-path{stroke:var(--muted) !important;}
.react-flow__handle-left{left:5px;}
.react-flow__handle-right{right:5px;}
.react-flow__node:hover .gb-resize{opacity:.9;}
.gb-canvas-toolbar{position:absolute;top:12px;left:12px;z-index:5;display:flex;flex-direction:column;gap:2px;background:var(--glass-bg);backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);border:1px solid var(--glass-border);border-radius:21px;box-shadow:var(--shadow-soft);padding:6px;max-width:220px;}
.gb-canvas-tool-header{display:flex;align-items:center;justify-content:space-between;padding:4px 10px 5px;font-size:10px;letter-spacing:0.6px;font-weight:700;color:var(--dim);}
.gb-canvas-tool-collapse{width:26px;height:26px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;color:var(--dim);cursor:pointer;font-size:12px;border-radius:8px;}
.gb-canvas-tool-collapse:hover{background:var(--surface2);color:var(--text);}
.gb-canvas-toolbar-reopen{position:absolute;top:12px;left:12px;z-index:5;background:var(--glass-bg);backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);border:1px solid var(--glass-border);border-radius:13px;box-shadow:var(--shadow-soft);padding:9px 13px;font-size:13px;color:var(--text);cursor:pointer;min-height:36px;}
.gb-canvas-toolbar-reopen:hover{background:var(--surface2);}
/* Real touch targets (min-height 36px, was ~26px) — this is the floating
   palette open constantly while building, so it's worth more room than a
   rarely-opened dropdown. */
.gb-canvas-tool{display:flex;align-items:center;gap:9px;width:100%;text-align:left;background:transparent;border:1px solid transparent;border-radius:13px;padding:9px 10px;min-height:36px;font-size:13px;color:var(--text);cursor:pointer;white-space:nowrap;transition:background .12s ease;}
.gb-canvas-tool:hover{background:var(--surface2);}
.gb-canvas-tool-sep{height:1px;background:var(--border2);margin:4px 5px;}

/* ToolsHub tiles: a soft lift on hover is the one flourish that turns a
   grid of buttons into something that feels alive rather than a form. */
.gb-hub-tile{transition:transform .12s ease, box-shadow .12s ease, border-color .12s ease;}
.gb-hub-tile:hover{transform:translateY(-2px);box-shadow:var(--shadow-soft);border-color:var(--border3);}

/* Glossary: the native "help" cursor is the whole discoverability
   affordance for shift+click-to-define — no extra badge or icon needed
   on every one of the hundreds of tagged labels. */
[data-term]:hover{cursor:help;}

/* Command Centre grid: a plain inline gridColumn:"span N" has no way to
   become "span 1" on mobile without a real media query, which is exactly
   what previously forced this grid — and the whole page — wider than a
   phone screen could ever shrink to. Column count steps down at two
   breakpoints; span classes step down to match so no card ever demands
   more columns than actually exist at that width. */
.gb-home-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.gb-home-full{grid-column:1 / -1;}
.gb-span-2{grid-column:span 2;}
@media (max-width:900px){
  .gb-home-grid{grid-template-columns:repeat(2,1fr);}
}
@media (max-width:560px){
  .gb-home-grid{grid-template-columns:1fr;}
  .gb-span-2{grid-column:1 / -1;}
}
/* Mobile/tablet reflow for the canvas studio (audit Phase 2 mobile: "full-screen
   canvas; Blocks and Inspector open as modal sheets, not squeezed columns").
   Desktop (>820px) keeps the docked three-pane layout, untouched. At <=820px the
   two side panels — which are closed by default on narrow screens (libOpen /
   inspectorOpen init on innerWidth) — become full-height overlay SHEETS when
   opened, so the canvas keeps the full width instead of being crushed beside a
   150px column. Each panel already has its own close control (the library's
   hide-arrow, the inspector's hide-arrow), so the sheet is dismissable. */
@media (max-width:820px){
  [data-tour="blocks"], [data-tour="inspector"]{
    position:fixed !important; top:0; bottom:0; z-index:45;
    width:min(88vw,320px) !important; max-width:none !important;
    box-shadow:var(--shadow-panel);
  }
  [data-tour="blocks"]{left:0;}
  [data-tour="inspector"]{right:0;}
  .gb-canvas-toolbar{max-width:180px;}
}

/* macOS-borrowed polish, applied app-wide so every screen feels like one
   product. A single accent focus ring for keyboard users (power users live on
   the keyboard); frosted-glass, rounded React Flow chrome so the canvas
   Controls and MiniMap match the floating toolbar; and a softer attribution. */
button:focus-visible,select:focus-visible,input:focus-visible,textarea:focus-visible,a:focus-visible,[tabindex]:focus-visible{
  outline:2px solid rgba(10,158,110,0.7);outline-offset:2px;border-radius:8px;
}
.react-flow__controls{border-radius:13px;overflow:hidden;box-shadow:var(--shadow-soft);border:1px solid var(--glass-border);}
.react-flow__controls-button{
  background:var(--glass-bg);backdrop-filter:blur(26px) saturate(1.7);-webkit-backdrop-filter:blur(26px) saturate(1.7);
  border-bottom:1px solid var(--glass-border);
}
.react-flow__controls-button:hover{background:var(--surface2);}
.react-flow__controls-button svg{fill:var(--muted);}
.react-flow__minimap{border-radius:13px;overflow:hidden;box-shadow:var(--shadow-soft);border:1px solid var(--glass-border);}
.react-flow__attribution{background:transparent;font-size:9px;opacity:0.45;}

/* Skeleton placeholders — a soft shimmering block shown while real content
   loads, instead of bare "Loading…" text. The shimmer sweep is an animation,
   so prefers-reduced-motion (globals.css) collapses it to a calm static block;
   the base fill still reads as a placeholder either way. */
.gb-skel{position:relative;overflow:hidden;background:var(--surface2);border-radius:8px;}
.gb-skel::after{content:"";position:absolute;inset:0;transform:translateX(-100%);background:linear-gradient(90deg,transparent,var(--glass-border),transparent);animation:gb-shimmer 1.3s ease-in-out infinite;}
@keyframes gb-shimmer{100%{transform:translateX(100%);}}

/* Experience level (see lib/ui-mode.ts). Guided = beginner-friendly, shows the
   hints and hides advanced tools; Pro = denser, hides hand-holding and reveals
   every tool. Default to guided when the attribute is absent. */
[data-uimode="pro"] .gb-guided-only{display:none !important;}
.gb-pro-only{display:none;}
[data-uimode="pro"] .gb-pro-only{display:revert;}
/* Segmented Guided/Pro switch. */
.gb-mode-switch{display:inline-flex;align-items:center;gap:2px;padding:2px;border-radius:13px;background:var(--surface2);border:1px solid var(--border2);}
.gb-mode-switch button{border:none;background:transparent;color:var(--muted);font-size:12px;font-weight:500;padding:5px 11px;border-radius:11px;cursor:pointer;min-height:30px;display:flex;align-items:center;gap:5px;}
.gb-mode-switch button[aria-pressed="true"]{background:var(--surface);color:var(--good-border);box-shadow:0 1px 2px rgba(40,54,90,0.12);}
`;
