# Dark Mode Implementation Guide

## Overview

OneVYRT supports a complete light/dark theme system using explicit theme switching (not `prefers-color-scheme`). This ensures predictable behavior across public and authenticated pages.

## Architecture

### Theme Declaration
- **Light mode**: Default applied to all pages
- **Dark mode**: Applied only when `<html data-theme="dark">` is set
- **No flash**: Inline script in `layout.tsx` applies saved preference before first paint

### Storage
- **Key**: `gb-theme` in localStorage
- **Values**: `"light"` or `"dark"`
- **Default**: `"light"` (deterministic for unauthenticated pages)
- **Fallback**: Gracefully handles private browsing, quota exceeded, etc.

### CSS Variables

#### Light Mode (`:root`)
All `--ds-*` and `--gear-*` variables are defined in light mode defaults.

**Key tokens:**
- `--ds-bg-app`: `#f7f8fc` — main background
- `--ds-surface`: `#ffffff` — cards, panels
- `--ds-text-primary`: `#111827` — primary text (4.5:1 contrast)
- `--ds-border-subtle`: `#e8ecf2` — soft borders
- `--ds-brand`: `#088057` — brand accent (4.96:1 contrast)

#### Dark Mode (`:root[data-theme="dark"]`)
Redefines all tokens for dark surfaces with proper contrast ratios.

**Key tokens:**
- `--ds-bg-app`: `#1a2438` — navy-grey background
- `--ds-surface`: `#26314c` — lifted dark cards
- `--ds-text-primary`: `#f8fafc` — light text
- `--ds-border-subtle`: `rgba(148, 163, 184, 0.12)` — translucent borders
- `--ds-brand`: `#0a9e6e` — brighter green for dark surfaces (5.6:1 contrast)

See `/app/design-system.css` for complete token list and WCAG AA contrast verification.

## User Interface

### Theme Toggle
**Location**: Account Settings → Preferences tab
- Two radio buttons: "Light" and "Dark"
- Changes apply immediately across the entire app
- Preference persists via localStorage

### Navigation Bar
- Theme toggle button in top-right (sun/moon icon)
- Also triggers immediate theme switch
- Icon updates to reflect current theme

## Implementation Details

### Library: `lib/theme-mode.ts`
Core utilities for theme management:

```typescript
// Load user's saved preference (defaults to "light")
loadThemeMode(): ThemeMode

// Save preference to localStorage
saveThemeMode(theme: ThemeMode): void

// Apply theme to DOM
applyThemeMode(theme: ThemeMode): void

// Toggle between light and dark
toggleThemeMode(): ThemeMode

// Get currently applied theme
getCurrentTheme(): ThemeMode
```

### Component Integration
Import and use in React components:

```typescript
import { loadThemeMode, saveThemeMode, applyThemeMode } from "../lib/theme-mode";

// On mount
const [theme, setTheme] = useState(() => loadThemeMode());

// On toggle
const toggle = () => {
  const next = theme === "dark" ? "light" : "dark";
  setTheme(next);
  saveThemeMode(next);
  applyThemeMode(next);
};
```

## Styling Patterns

### Use CSS Variables (Preferred)
```css
.my-component {
  background: var(--ds-surface);
  color: var(--ds-text-primary);
  border: 1px solid var(--ds-border-subtle);
}
/* Dark mode automatically applied via var() — no additional CSS needed */
```

### Scoped Dark Mode (When Necessary)
```css
/* Only when component-specific dark handling is needed */
:root[data-theme="dark"] .my-special-case {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
```

### Avoid Hardcoded Colors
❌ **Don't**:
```jsx
<div style={{ background: "#f1f5f9", color: "#111827" }}>
```

✅ **Do**:
```jsx
<div style={{ background: "var(--ds-bg-subtle)", color: "var(--ds-text-primary)" }}>
```

## Testing Checklist

### Visual Audit
- [ ] Light mode: All text meets WCAG AA contrast (4.5:1 minimum)
- [ ] Dark mode: All text meets WCAG AA contrast (4.5:1 minimum)
- [ ] No "invisible" text in either theme
- [ ] Focus rings are visible in both themes

### Component Testing
- [ ] Buttons (primary, secondary, ghost, danger)
- [ ] Form inputs (text, select, checkbox, radio)
- [ ] Cards and panels
- [ ] Status badges (success, warning, danger, info)
- [ ] Tables and data grids
- [ ] Code blocks and syntax highlighting
- [ ] Illustrations and images
- [ ] Charts and graphs
- [ ] Modals and overlays

### Page Testing
- [ ] Authentication pages (login, signup, password reset)
- [ ] Dashboard and command centre
- [ ] Programme (lessons, chapters, progress)
- [ ] Studio (projects, campaigns, analytics)
- [ ] Account settings
- [ ] Coaching centre
- [ ] Community pages
- [ ] Public funnel pages (test with `?_vt_debug` if needed)

### Browser Testing
- [ ] Chrome/Edge (Windows, macOS, Linux)
- [ ] Firefox (Windows, macOS, Linux)
- [ ] Safari (macOS, iOS)
- [ ] Mobile browsers (iOS Safari, Chrome Android)

### OS Settings Testing
- [ ] System dark mode OFF → light mode applied
- [ ] System dark mode ON → light mode applied (explicit choice wins)
- [ ] User sets dark mode → dark mode persists on reload
- [ ] User sets dark mode → theme respects across tabs/windows

## Known Issues & Workarounds

### Shared Reports
Transformation Report HTML is generated with light-mode colors. Users viewing in dark mode will see light-themed reports. **Workaround**: Reports use sufficient contrast ratios (neutral greys on white) that they remain readable.

### Embedded Content
- Iframes and embedded scripts may not respect app theme
- **Workaround**: Test thoroughly with your third-party integrations

### Images & Illustrations
Some illustrations may have reduced contrast in dark mode. **Solution**: Use SVG illustrations with CSS class-based theming instead of embedded raster images.

## Color Accessibility

### Contrast Ratios
All foreground-background pairs are tested and verified:
- **Primary text on surfaces**: 4.5:1 or better (WCAG AA)
- **Secondary text on surfaces**: 4.5:1 or better
- **Brand accent text**: 4.5:1 or better (AA standard)
- **Brand solid buttons**: 4.95:1 (AA, accounts for button fills)

### Color-Blind Accessibility
- Status colors use patterns + color (not color alone)
  - Success: Green + checkmark
  - Warning: Amber/orange + triangle
  - Danger: Red + X or alert icon
  - Info: Blue + info circle

### Testing Tools
- Chrome DevTools Lighthouse (Accessibility audit)
- WAVE browser extension
- axe DevTools
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/

## Migration Path

### Existing Components
The design system supports both patterns:

1. **Gear-style (legacy)**: Uses `--gear-*` variables (already dark-aware)
2. **DS-style (modern)**: Uses `--ds-*` variables (recommended)

New components should use `--ds-*` variables. Legacy `--gear-*` variables will remain for backward compatibility until migrated.

### Steps to Migrate a Component
1. Replace hardcoded colors with CSS variables
2. Use `--ds-*` tokens instead of `--gear-*`
3. Test in both light and dark modes
4. Verify WCAG AA contrast
5. Document any component-specific dark mode handling

## Related Files

- `/app/globals.css` — Global theme variables and base styles
- `/app/design-system.css` — Design system token definitions
- `/lib/theme-mode.ts` — Theme management utilities
- `/components/AccountSettingsModal.tsx` — Theme toggle UI
- `/components/AppNav.tsx` — Navigation bar with theme button
- `/tailwind.config.cjs` — Tailwind color extensions

## Debugging

### Check Current Theme
```javascript
// In browser console
document.documentElement.getAttribute("data-theme")
localStorage.getItem("gb-theme")
```

### Force a Theme
```javascript
// Override current setting temporarily
document.documentElement.setAttribute("data-theme", "dark")
localStorage.setItem("gb-theme", "dark")
```

### Monitor Changes
```javascript
// Watch for theme changes across app
const obs = new MutationObserver((mutations) => {
  mutations.forEach((m) => {
    if (m.attributeName === "data-theme") {
      console.log("Theme changed to:", document.documentElement.getAttribute("data-theme"));
    }
  });
});
obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
```

## Performance Considerations

### CSS Variable Lookup
Modern browsers optimize CSS variable lookups. The slight overhead is negligible for app-scale applications.

### Theme Script
The no-flash init script in `layout.tsx` is **inline and synchronous**, ensuring:
- No layout shift on page load
- No theme flash before first paint
- <5ms execution time

### LocalStorage
- Read on component mount only (not on every render)
- Write batched or debounced if updated frequently
- Catches exceptions gracefully (private mode, quota, etc.)

## Future Enhancements

### Potential Additions
- [ ] "Auto" theme option (follow system `prefers-color-scheme`)
- [ ] Scheduled theme switching (dark mode at sunset, light at sunrise)
- [ ] Custom color themes (brand colors, high contrast, etc.)
- [ ] Theme sync across browser tabs
- [ ] Server-side theme preference storage (when user DB schema allows)

## Support & Questions

For issues or questions about dark mode:
1. Check contrast with WAVE or axe DevTools
2. Verify CSS variables are correctly scoped
3. Ensure `data-theme` attribute is being applied
4. Review this guide's Testing Checklist
5. File an issue with theme reproduction steps
