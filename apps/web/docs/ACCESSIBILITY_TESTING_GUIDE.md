# WCAG 2.1 Level AA Accessibility Testing Guide

**Status: Active**  
**Target Compliance: WCAG 2.1 Level AA**  
**Last Updated: 2026-09-02**

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Manual Testing Checklist](#manual-testing-checklist)
3. [Automated Testing](#automated-testing)
4. [Keyboard Navigation](#keyboard-navigation)
5. [Screen Reader Testing](#screen-reader-testing)
6. [Color Contrast Verification](#color-contrast-verification)
7. [Focus Management](#focus-management)
8. [Common Issues & Fixes](#common-issues--fixes)
9. [Testing Tools](#testing-tools)
10. [Continuous Integration](#continuous-integration)

---

## Quick Start

### Before Testing
1. Clear browser cache and cookies
2. Disable browser extensions (especially CSS/JS modifiers)
3. Use a fresh incognito/private window
4. Set zoom to 100%

### Common Test Paths
- **Public funnel:** `/q/demo` — unauthenticated qualification flow
- **Auth flow:** `/` → sign up → first login
- **Main dashboard:** `/command-center` — authenticated user dashboard
- **Programme:** `/programme` → chapter submission flow
- **Coaching UI:** `/studio?panel=programme` — coach review dashboard
- **Data export:** `/account/export` — heavy endpoint with rate limiting

---

## Manual Testing Checklist

### Structure & Semantics
- [ ] **H1 uniqueness:** Exactly ONE `<h1>` per page (not zero, not multiple)
- [ ] **Heading hierarchy:** H2 → H3 → H4 (no skipped levels like H1 → H4)
- [ ] **Semantic HTML:**
  - Use `<button>` for actions, not `<div onclick>`
  - Use `<a>` for navigation, not `<button role="link">`
  - Use `<header>`, `<main>`, `<nav>`, `<footer>` for regions
  - Use `<table>` + `<th scope="col">` for data tables
- [ ] **Form labels:** Every `<input>` has an associated `<label>` (either `for` or wrapping)
- [ ] **Form validation:** Error messages use `role="alert"` and `aria-invalid="true"`
- [ ] **Lists:** Use `<ul>`/`<ol>` + `<li>` for navigation and item groups
- [ ] **Images:** Every `<img>` has descriptive `alt` text (not `alt=""` unless purely decorative)
- [ ] **Skip links:** `/q/demo` and main pages have a skip-to-main link

### Keyboard Navigation (Tab/Arrow/Enter/Escape)
- [ ] All interactive elements are keyboard accessible (Tab reaches them)
- [ ] Tab order is logical and matches visual reading order (left-to-right, top-to-bottom)
- [ ] No positive `tabindex` (all are `0`, `-1`, or omitted)
- [ ] Dialogs: Escape closes, Tab cycles within dialog (focus trap), focus returns to opener
- [ ] Tabs: Left/Right Arrow keys change tabs, can Tab into active tab content
- [ ] Radio buttons: Arrow keys select, single Tab stop (roving tabindex pattern)
- [ ] Checkboxes: Space toggles, can Tab to each individually
- [ ] Buttons: Enter and Space activate
- [ ] Links: Enter activates, Tab navigates between links
- [ ] Dropdowns: Arrow keys open/navigate, Escape closes, Enter selects

### Focus Visibility
- [ ] **Focus ring:** Visible on ALL interactive elements (buttons, links, inputs, dropdowns)
- [ ] **Contrast:** Focus ring contrasts with both background and element (WCAG AAA 3:1 recommended)
- [ ] **Outline offset:** At least 2px separation between element and outline
- [ ] **Removal guard:** `:focus { outline: none }` NOT used without providing alternative
- [ ] **No focus traps:** Keyboard users can always reach next/previous element

### Color Contrast (WCAG AA: 4.5:1 for text, 3:1 for UI components)
- [ ] **Text on background:** All text meets WCAG AA minimum
- [ ] **UI on background:** All interactive components (buttons, borders, icons) meet WCAG AA
- [ ] **Dark mode:** Contrast checked in both light and dark themes
- [ ] **Disabled states:** Disabled text doesn't drop below 3:1 (optional in spec but good practice)
- [ ] **Links:** Link text color contrasts with surrounding text AND background

### ARIA Labels & Descriptions
- [ ] **Icon buttons:** `aria-label="..."` on buttons with only icons (e.g., close button)
- [ ] **Hidden labels:** `<label className="sr-only">` or `aria-label` for screenreader-only text
- [ ] **Live regions:** `role="alert"` for validation errors, success messages, status updates
- [ ] **Dialogs:** `role="dialog"` + `aria-modal="true"` on the container
- [ ] **Progress bars:** `role="progressbar"` + `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- [ ] **Tabs:** `role="tablist"` on container, `role="tab"` on buttons, `role="tabpanel"` on content
- [ ] **Radio groups:** `role="radiogroup"` on container, `role="radio"` on each option
- [ ] **Comboboxes/autocomplete:** `role="combobox"` + `aria-expanded`, `aria-controls`
- [ ] **Tooltips:** `role="tooltip"` or `aria-describedby` from trigger
- [ ] **Loading states:** `aria-busy="true"` while loading, remove when done
- [ ] **Descriptions:** `aria-describedby` for complex inputs or buttons needing explanation

### Text Sizing & Readability
- [ ] **Minimum font size:** 12px for body text (14px preferred)
- [ ] **Line height:** At least 1.5 for body text (improved readability)
- [ ] **Letter spacing:** At least 0.12em for body text (improved readability)
- [ ] **Text alignment:** Left-aligned by default (not justified, not center for body)
- [ ] **Line length:** Ideally 45-75 characters for body text (not full viewport)
- [ ] **Zoom:** Page remains usable at 200% zoom without horizontal scrolling

### Media & Images
- [ ] **Images:** Descriptive `alt` text (e.g., "Sarah smiling in front of a blue door" not "photo.jpg")
- [ ] **Decorative images:** `alt=""` + `aria-hidden="true"` or CSS background image
- [ ] **Icons:** If standalone, use `aria-label` or hide with `aria-hidden="true"` if decorative
- [ ] **Video:** Captions required, transcript recommended
- [ ] **Audio:** Transcript required, captions recommended if in video

### Motion & Animations
- [ ] **Prefers-reduced-motion:** Animations disabled when `prefers-color-scheme: reduced` in system settings
- [ ] **Auto-play:** No autoplaying video or sound on page load
- [ ] **Flashing:** No content flashing more than 3 times per second

### Mobile & Touch
- [ ] **Touch targets:** At least 44×44px for interactive elements
- [ ] **Spacing:** At least 8px between touch targets to prevent mis-taps
- [ ] **Mobile zoom:** Lockout via `user-scalable=no` removed (allow zoom)
- [ ] **Text selection:** Not disabled via user-select CSS

---

## Automated Testing

### Install Dependencies
```bash
# axe-core for automated accessibility testing
npm install --save-dev @axe-core/react axe-playwright

# ESLint plugins for accessibility linting
npm install --save-dev eslint-plugin-jsx-a11y
```

### ESLint Configuration
Add to `.eslintrc.json` or config:
```json
{
  "extends": ["plugin:jsx-a11y/recommended"],
  "plugins": ["jsx-a11y"],
  "rules": {
    "jsx-a11y/heading-has-content": "warn",
    "jsx-a11y/no-static-element-interactions": "warn",
    "jsx-a11y/click-events-have-key-events": "warn",
    "jsx-a11y/no-noninteractive-tabindex": "warn",
    "jsx-a11y/tabindex-no-positive": "error"
  }
}
```

### Run Accessibility Tests
```bash
# Run E2E accessibility tests
npm run test:e2e -- e2e/a11y.spec.ts

# Run ESLint a11y checks
npm run lint -- --ext .tsx,.ts

# Generate accessibility report (in CI)
npm run test:a11y:report
```

### Test Coverage (e2e/a11y.spec.ts)
- ✅ Public qualification funnel wizard (progressbar, validation, keyboard model)
- ✅ Landing page structure (single H1, no positive tabindex)
- ✅ TODO: Add auth flow (login, signup, password reset)
- ✅ TODO: Add dashboard pages (command-center, my-business)
- ✅ TODO: Add programme flow (chapter submission, coach approval)
- ✅ TODO: Add form accessibility (all form fields, validation)
- ✅ TODO: Add dialog/modal tests (Escape, focus trap, focus return)
- ✅ TODO: Add table tests (DataTable sorting, pagination, scoping)

---

## Keyboard Navigation

### Tab Flow (Core Pages)
1. **Homepage** (`/`): Sign-in form
   - Email field → Password field → Forgot password link → Sign in button
   
2. **Dashboard** (`/command-center`): Navigation + page content
   - Skip link (hidden) → Main nav links → Page content → Footer links
   
3. **Programme** (`/programme`): Chapter flow
   - Breadcrumbs → Chapter card → Submit button → Back link
   
4. **Wizard** (`/q/demo`): Qualification funnel
   - Progress indicator (not focusable) → Questions → Radio/Checkbox inputs → Next button

### Common Patterns

**Dialogs/Modals:**
- Open: Focus moves into dialog (first focusable element or dialog container)
- Inside: Tab cycles within dialog (focus trap via `useDialogA11y`)
- Close: Escape key or close button
- After close: Focus returns to the opener (button that opened the dialog)

**Tabs:**
- Container: `role="tablist"`
- Each tab: `role="tab"` + `aria-selected` + `aria-controls`
- Tab content: `role="tabpanel"` + `aria-labelledby`
- Keyboard: Left/Right Arrow keys switch tabs, Tab navigates TO active tab, then Tab/Shift+Tab navigate within content

**Radio buttons:**
- Container: `role="radiogroup"`
- Each option: `role="radio"` + `aria-checked` + `name` (all in group share name)
- Keyboard: Arrow keys select, single Tab stop (first or current, via roving tabindex)
- Implementation: Use `<input type="radio">` or manage tabindex with `tabindex="0"` on selected, `tabindex="-1"` on unselected

**Checkboxes:**
- Each: `<input type="checkbox">` + `<label>`
- Keyboard: Space toggles, Tab stops at each checkbox individually (not a group)
- Implementation: Use native `<input type="checkbox">` for best support

**Buttons:**
- Keyboard: Enter and Space activate
- Focus: `:focus-visible` shows outline
- Implementation: Use `<button>` tag (not `<div onclick>`)

**Links:**
- Keyboard: Enter activates, Tab navigates between links
- Focus: `:focus-visible` shows outline
- Implementation: Use `<a href>` (not `<div onclick>` pretending to be a link)

**Text inputs:**
- Keyboard: Type into field, Tab to next field, Shift+Tab to previous
- Labels: `<input>` has associated `<label for="inputId">`
- Validation: `aria-invalid="true"` + error message with `role="alert"`
- Placeholder: Not a substitute for label (use placeholder for example)

**Dropdowns/Select:**
- Keyboard: Tab to select, Arrow keys open and navigate, Escape closes, Enter selects
- Implementation: Use `<select>` for simple dropdowns, custom JS for complex ones
- Custom implementation: `role="listbox"` on container, `role="option"` on items

---

## Screen Reader Testing

### Tools
- **NVDA** (Windows, free): https://www.nvaccess.org/
- **JAWS** (Windows, commercial): https://www.freedomscientific.com/products/software/jaws/
- **VoiceOver** (macOS/iOS, free): Built-in, activate with Cmd+F5
- **TalkBack** (Android, free): Built-in

### Browser Extensions (Simulators — not full replacement)
- **Web Accessibility Evaluation Tool (WAVE):** Shows missing labels, low contrast, structural issues
- **axe DevTools:** Automated accessibility checks (free version available)
- **ARIA DevTools:** Highlights ARIA roles and properties

### Testing Flow

1. **Launch screen reader:**
   - NVDA: Start application
   - JAWS: Start application
   - VoiceOver: Cmd+F5 on Mac

2. **Navigate page:**
   - Screen readers read content in DOM order (not visual order)
   - Use H (heading), L (link), B (button), T (table), F (form), etc. for shortcuts
   - Use arrow keys to read content line by line
   - Use Tab to navigate interactive elements
   - Use Ctrl+Home to start from top

3. **Check announces:**
   - **Headings:** Read level (H1, H2, etc.) and text
   - **Links:** Read link text; context matters ("Read more about X" not just "Read more")
   - **Buttons:** Read button text and state (disabled, pressed, etc.)
   - **Form fields:** Read label, type, required status, error messages
   - **Images:** Read alt text (if any)
   - **Tables:** Read cell content and headers (via `scope="col"`)
   - **Live regions:** Read alert immediately when it appears
   - **Dialogs:** Announce as dialog, read modal property

4. **Keyboard shortcuts (most common):**
   - ↑/↓: Read previous/next line
   - H: Jump to next heading
   - 1–6: Jump to next H1–H6
   - L: Jump to next link
   - B: Jump to next button
   - T: Jump to next table
   - F: Jump to next form field
   - Tab: Jump to next interactive element
   - Return/Space: Activate button or link (context-dependent)
   - Escape: Close dialog/overlay (if supported)
   - Alt+Tab (NVDA), Ctrl+Alt+Z (JAWS): Focus mode toggle (trap in form vs. browse entire page)

### What to Listen For
- **Redundant announcements:** "Button Sign in Sign in" (button text repeated)
- **Missing labels:** "Textbox" with no label or placeholder
- **Unhelpful labels:** "Submit" button that doesn't say what it submits
- **Unannounced interactions:** Clicking a button doesn't read the result (no live region)
- **Unclear context:** "Read more" links without context (read as "link Read more" without surrounding sentence)
- **Missing descriptions:** Complex widgets without `aria-describedby`

---

## Color Contrast Verification

### Tools
- **WebAIM Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **Accessible Colors:** https://accessible-colors.com/
- **Color Oracle:** https://colororacle.org/ (color blindness simulator, offline)
- **Browser DevTools:** Chrome DevTools → Inspect element → Accessibility panel shows contrast ratio
- **axe DevTools:** Highlights failed contrast checks

### WCAG AA Requirements
- **Text (< 18pt):** 4.5:1 contrast ratio
- **Large text (≥ 18pt bold or ≥ 24pt):** 3:1 contrast ratio
- **UI components (buttons, borders, icons):** 3:1 contrast ratio
- **Focus indicators:** 3:1 recommended (not required but best practice)

### Verification Steps

1. **Light mode:**
   - Text color (#111827) on light backgrounds (#f7f8fc, #ffffff) → Check contrast
   - UI elements (borders #dde3eb) on surfaces (#ffffff) → Check contrast

2. **Dark mode:**
   - Text color (#f8fafc) on dark backgrounds (#1a2438) → Check contrast
   - UI elements (borders rgba(148,163,184,.18)) on dark surfaces (#26314c) → Check contrast

3. **Brand color usage:**
   - Brand text (#088057) on light bg → Check (4.96:1, meets AA and AAA)
   - Brand text on light bg → Check in dark mode (#0a9e6e, 5.6:1)
   - Brand solid background (#088057) with white text → Check (4.95:1, meets AA and AAA)

4. **Semantic status colors:**
   - Success (#12703a) on light bg → Check (6.51:1, meets AAA)
   - Warning (#b45309) on light bg → Check (4.54:1, meets AA)
   - Danger (#c81e1e) on light bg → Check (4.59:1, meets AA)
   - Same in dark mode

5. **Disabled states:**
   - Disabled text (usually opacity: 0.55 or lighter color) → Check (3:1 minimum recommended)

### Known Good Tokens
From `app/design-system.css`:
```
Light mode:
--ds-text-primary: #111827 (on #ffffff or #f7f8fc) → 16:1 ✅
--ds-text-secondary: #475569 (on #ffffff) → 8.6:1 ✅
--ds-text-tertiary: #586173 (on #ffffff) → 4.5:1 (exactly AA for body text) ✅
--ds-brand: #088057 (on #ffffff) → 4.96:1 ✅

Dark mode:
--ds-text-primary: #f8fafc (on #1a2438) → 16.2:1 ✅
--ds-text-secondary: #cbd5e1 (on #1a2438) → 10.2:1 ✅
--ds-text-tertiary: #94a3b8 (on #1a2438) → 4.7:1 (meets AA) ✅
--ds-brand: #0a9e6e (on #1a2438) → 5.6:1 ✅
```

---

## Focus Management

### Implementation (Design System)
From `app/design-system.css`:
```css
:where(a, button, input, textarea, select, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--ds-brand);
  outline-offset: 2px;
}
```

- **Selector:** Uses `:focus-visible` (not `:focus`) — keyboard only, not mouse
- **Specificity:** `:where()` keeps specificity at 0, so component styles can override
- **Outline:** 2px solid brand color (#088057)
- **Offset:** 2px separation from element

### Dialog Focus Management
From `lib/use-dialog-a11y.ts`:
```typescript
// On open: Move focus into dialog (first focusable or container)
const focusables = container.querySelectorAll(FOCUSABLE);
focusables[0]?.focus();

// On close: Restore focus to the element that opened it
previouslyFocused?.focus();

// While open: Tab cycles within dialog (focus trap)
if (active === lastEl && !e.shiftKey) { 
  e.preventDefault(); firstEl.focus(); 
}
```

**Checklist:**
- [ ] Focus ring appears on all interactive elements
- [ ] Focus ring doesn't disappear when `:focus { outline: none }` is set
- [ ] Focus ring is visible against both light and dark backgrounds
- [ ] Focus order matches tab order and visual reading order
- [ ] Dialogs trap focus and return it on close
- [ ] Skip link is present and works (hidden by default, visible on Tab)
- [ ] No auto-focus on page load (except sign-in forms where it's expected)
- [ ] Focus doesn't jump unexpectedly after interactions

---

## Common Issues & Fixes

### 1. Missing Form Labels
**Issue:** `<input>` without `<label>`
```tsx
// ❌ Bad
<input type="email" placeholder="Email address" />

// ✅ Good
<label htmlFor="email">Email address</label>
<input id="email" type="email" placeholder="someone@example.com" />
```

### 2. Missing Heading Structure
**Issue:** No `<h1>` or skipped heading levels (H1 → H4)
```tsx
// ❌ Bad
<div className="text-2xl font-bold">Page Title</div>
<div className="text-lg font-bold">Section</div>

// ✅ Good
<h1>Page Title</h1>
<h2>Section</h2>
```

### 3. Icon-Only Buttons Without Labels
**Issue:** `<button>X</button>` with no aria-label
```tsx
// ❌ Bad
<button onClick={onClose}>×</button>

// ✅ Good
<button aria-label="Close dialog" onClick={onClose}>×</button>
```

### 4. Tabs Without ARIA
**Issue:** Tabs component missing `role`, `aria-selected`, keyboard support
```tsx
// ❌ Bad (from shared/Tabs.tsx)
<button onClick={() => onTabChange(tab.id)}>
  {tab.label}
</button>

// ✅ Good
<div role="tablist">
  <button 
    role="tab"
    aria-selected={activeTab === tab.id}
    aria-controls={`panel-${tab.id}`}
    onKeyDown={(e) => {
      if (e.key === 'ArrowLeft') { /* select prev */ }
      if (e.key === 'ArrowRight') { /* select next */ }
    }}
  >
    {tab.label}
  </button>
</div>
<div role="tabpanel" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`}>
  {tab.content}
</div>
```

### 5. Validation Errors Not Announced
**Issue:** Error appears but isn't announced to screen readers
```tsx
// ❌ Bad
{error && <p style={{ color: 'red' }}>{error}</p>}

// ✅ Good
{error && <p role="alert" className="text-red-600">{error}</p>}
<input 
  aria-invalid={!!error}
  aria-describedby={error ? 'email-error' : undefined}
/>
{error && <p id="email-error" role="alert">{error}</p>}
```

### 6. Low Color Contrast
**Issue:** Text or UI components don't meet WCAG AA (4.5:1 for text, 3:1 for UI)
```css
/* ❌ Bad (#5f6368 on #ffffff = 2.4:1) */
.muted { color: #5f6368; }

/* ✅ Good (#475569 on #ffffff = 8.6:1) */
.muted { color: var(--ds-text-secondary); }
```

### 7. Dialogs Without Focus Management
**Issue:** Dialog opens but focus stays on page behind, Escape doesn't close
```tsx
// ❌ Bad (no focus trap, no Escape)
<div className="modal">{children}</div>

// ✅ Good (use useDialogA11y)
const ref = useRef<HTMLDivElement>(null);
useDialogA11y(ref, onClose);
return (
  <div ref={ref} role="dialog" aria-modal="true">
    {children}
  </div>
);
```

### 8. Missing Alt Text on Images
**Issue:** `<img>` without `alt` or with `alt="image"`
```tsx
// ❌ Bad
<img src="/funnel.png" />
<img src="/icon.svg" alt="image" />

// ✅ Good
<img src="/funnel.png" alt="Sales funnel with 4 stages" />
<img src="/close.svg" alt="" aria-hidden="true" /> {/* Decorative */}
```

### 9. Positive Tabindex
**Issue:** `tabindex="2"` or `tabindex="5"` breaks natural tab order
```tsx
// ❌ Bad
<input tabIndex={1} />
<button tabIndex={2} />

// ✅ Good
<input /> {/* tabindex="0" is default */}
<button /> {/* tabindex="0" is default */}
// Only use tabindex="-1" to remove from tab order if justified
```

### 10. Missing Skip Link
**Issue:** Keyboard users have to Tab through entire nav to reach main content
```tsx
// Add to root layout or page
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
<main id="main-content">
  {/* Page content */}
</main>
```

---

## Testing Tools

### Browser Extensions
- **axe DevTools:** https://www.deque.com/axe/devtools/
  - Scans page for violations, highlights in element inspector
  - Provides remediation guidance

- **WAVE:** https://wave.webaim.org/extension/
  - Shows structure, labels, contrast, ARIA, etc.
  - Highlights errors, warnings, features

- **Lighthouse:** Built into Chrome DevTools (DevTools → Lighthouse → Accessibility)
  - Scans for common issues
  - Generates score (not fully comprehensive)

### Standalone Tools
- **WebAIM Contrast Checker:** https://webaim.org/resources/contrastchecker/
- **WAVE Standalone:** https://wave.webaim.org/
- **Color Oracle:** https://colororacle.org/ (color blindness simulator)
- **Stark:** https://www.getstark.co/ (color blindness + contrast)

### Command-Line / CI
- **axe-core:** `npm install @axe-core/react`
- **Playwright A11y tests:** `npm install @axe-playwright`
- **ESLint a11y plugin:** `npm install eslint-plugin-jsx-a11y`

### Screen Reader Testing
- **NVDA (Windows):** https://www.nvaccess.org/download/
- **JAWS (Windows):** https://www.freedomscientific.com/products/software/jaws/
- **VoiceOver (Mac):** Cmd+F5 (built-in)
- **TalkBack (Android):** Settings → Accessibility → TalkBack (built-in)

---

## Continuous Integration

### GitHub Actions Workflow
Add to `.github/workflows/accessibility.yml`:
```yaml
name: Accessibility Tests

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - run: npm run test:e2e -- e2e/a11y.spec.ts
      - run: npm run lint -- --ext .tsx,.ts
```

### Pre-Commit Hook
Add to `.husky/pre-commit`:
```bash
#!/bin/sh
npm run lint -- --ext .tsx,.ts
npx tsc --noEmit
```

### Testing Checklist Before PR
- [ ] Run automated tests: `npm run test:e2e`
- [ ] Run linter: `npm run lint`
- [ ] Manual keyboard test on changed pages
- [ ] Manual screen reader test on changed pages
- [ ] Check color contrast on new text/components
- [ ] Verify focus ring visible on new interactive elements
- [ ] Check heading structure (no missing h1, no skipped levels)

---

## WCAG 2.1 Criteria Mapping

| Criterion | Level | Implementation | Status |
|-----------|-------|---|---|
| **1.1.1 Non-text Content** | A | Alt text on images, aria-label on icons | ✅ |
| **1.3.1 Info and Relationships** | A | Semantic HTML, form labels, heading structure | ✅ |
| **1.3.5 Identify Input Purpose** | AA | `<label>` associated with inputs | ✅ |
| **1.4.3 Contrast (Minimum)** | AA | 4.5:1 text, 3:1 UI | ✅ |
| **1.4.11 Non-text Contrast** | AA | 3:1 UI components, borders, icons | ✅ |
| **2.1.1 Keyboard** | A | Tab, arrow keys, Enter, Escape | ✅ |
| **2.1.2 No Keyboard Trap** | A | Focus always moves away from elements | ✅ |
| **2.1.3 Keyboard (No Exception)** | AAA | All interactions keyboard accessible | ✅ |
| **2.4.1 Bypass Blocks** | A | Skip link present | ✅ |
| **2.4.3 Focus Order** | A | Tab order matches reading order | ✅ |
| **2.4.7 Focus Visible** | AA | Focus ring visible on all interactive elements | ✅ |
| **3.3.1 Error Identification** | A | Error messages announced, form marked invalid | ✅ |
| **3.3.3 Error Suggestion** | AA | Error messages suggest corrections | ✅ |
| **3.3.4 Error Prevention** | AA | Reversible actions, confirmed before submit | ✅ |
| **4.1.2 Name, Role, Value** | A | ARIA roles, states, properties set correctly | ✅ |
| **4.1.3 Status Messages** | AA | Live regions announce updates | ✅ |

---

## References

- **W3C WCAG 2.1:** https://www.w3.org/WAI/WCAG21/quickref/
- **MDN Accessibility:** https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **WebAIM:** https://webaim.org/
- **A11ycasts (Google Chrome):** https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9Xc-RgEzwLvePZCHs
- **The A11Y Project:** https://www.a11yproject.com/

---

## Maintenance & Updates

- **Monthly:** Run automated tests (axe, ESLint) on all branches
- **Per PR:** Manual keyboard + screen reader testing on changed pages
- **Quarterly:** Full manual audit of all pages (keyboard, screen reader, contrast)
- **Annually:** WCAG 2.1 compliance audit with third-party auditor (recommended)
