# Accessibility Component Development Checklist

**Target: WCAG 2.1 Level AA Compliance**

Use this checklist when creating new components or updating existing ones to ensure accessibility compliance.

---

## Before Starting

- [ ] Read the relevant WCAG 2.1 criterion (see "Common WCAG Criteria" section below)
- [ ] Check existing components in `components/ui/` for patterns
- [ ] Review `app/design-system.css` for tokens and focus ring implementation
- [ ] Familiarize yourself with `lib/use-dialog-a11y.ts` for dialog patterns

---

## Common Component Patterns

### Buttons

```tsx
// ✅ Good
<button className="ds-btn ds-btn--primary" onClick={handleClick}>
  Save changes
</button>

// ✅ Good — icon-only buttons MUST have aria-label
<button className="ds-btn ds-btn--icon" aria-label="Close dialog" onClick={handleClose}>
  ×
</button>

// ❌ Bad — no label for icon button
<button className="ds-btn ds-btn--icon" onClick={handleClose}>
  ×
</button>

// ❌ Bad — disabled state without clear indication
<button disabled>Save</button> {/* Good, browser announces disabled */}
```

**Checklist:**
- [ ] Use native `<button>` tag (not `<div>` with `onClick`)
- [ ] Icon-only buttons have `aria-label` with clear action
- [ ] Disabled state is clear (browser handles this with `disabled` attribute)
- [ ] Focus ring is visible (use `:focus-visible` in design-system.css)
- [ ] Touch target is at least 44×44px (checked via DataTable tests)

---

### Links

```tsx
// ✅ Good
<a href="/page">Read more about features</a>

// ✅ Good — if icon-only, provide label context
<a href="/settings" aria-label="Go to settings">
  <SettingsIcon />
</a>

// ❌ Bad — vague link text (what will you learn?)
<a href="/docs">Click here</a>

// ❌ Bad — button pretending to be a link
<button onClick={() => navigate("/page")}>Go to page</button>
```

**Checklist:**
- [ ] Use native `<a href>` tag (not `<button>` or `<div>`)
- [ ] Link text describes destination or action clearly
- [ ] If icon-only, provide `aria-label`
- [ ] Focus ring is visible
- [ ] No `onClick` handlers on links (use `href` for navigation)

---

### Form Fields

```tsx
// ✅ Good — label associated via htmlFor
<div className="ds-field">
  <label htmlFor="email-input" className="ds-label">
    Email address
  </label>
  <input
    id="email-input"
    type="email"
    className="ds-input"
    placeholder="name@example.com"
    aria-required="true"
  />
  <p className="ds-help">We'll never share your email.</p>
</div>

// ✅ Good — label wrapping input
<label className="ds-label">
  Subscribe to updates
  <input type="checkbox" />
</label>

// ✅ Good — error state with aria-invalid
{error && (
  <>
    <input
      aria-invalid="true"
      aria-describedby="email-error"
    />
    <p id="email-error" role="alert" className="text-danger">
      {error}
    </p>
  </>
)}

// ❌ Bad — no label
<input type="email" placeholder="Email" />

// ❌ Bad — placeholder as label substitute
<input type="email" placeholder="Email address" />

// ❌ Bad — error not announced
{error && <p style={{ color: "red" }}>{error}</p>}
```

**Checklist:**
- [ ] Every `<input>` has an associated `<label>` (via `htmlFor` or wrapping)
- [ ] Placeholder is NOT used as a substitute for label
- [ ] Errors use `role="alert"` and `aria-invalid="true"`
- [ ] Required fields use `aria-required="true"`
- [ ] Help text uses `aria-describedby` if needed
- [ ] Focus ring is visible
- [ ] Touch target is at least 44×44px

---

### Tabs

```tsx
// ✅ Good — uses Tabs component with ARIA
<Tabs
  tabs={[
    { id: "tab1", label: "Overview", content: <OverviewPanel /> },
    { id: "tab2", label: "Details", content: <DetailsPanel /> },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>

// Rendered as:
// <div role="tablist">
//   <button role="tab" aria-selected="true" aria-controls="panel-tab1">Overview</button>
//   <button role="tab" aria-selected="false" aria-controls="panel-tab2">Details</button>
// </div>
// <div role="tabpanel" id="panel-tab1" aria-labelledby="tab-tab1">...</div>
```

**Checklist:**
- [ ] Container has `role="tablist"`
- [ ] Each tab button has `role="tab"` + `aria-selected` + `aria-controls`
- [ ] Content container has `role="tabpanel"` + `aria-labelledby`
- [ ] Arrow keys (Left/Right/Up/Down) navigate between tabs
- [ ] Tab key enters active tab, then navigates within content
- [ ] Roving tabindex: only active tab is in tab order

---

### Dialogs / Modals

```tsx
// ✅ Good — uses useDialogA11y hook
const ref = useRef<HTMLDivElement>(null);
useDialogA11y(ref, onClose);

return (
  <div ref={ref} role="dialog" aria-modal="true">
    <h2>Confirm Action</h2>
    <p>Are you sure?</p>
    <button onClick={onClose}>Cancel</button>
    <button onClick={handleConfirm}>Confirm</button>
  </div>
);

// ❌ Bad — no focus management
<div className="modal-overlay" onClick={closeModal}>
  <div className="modal">
    {/* Dialog content */}
  </div>
</div>
```

**Checklist:**
- [ ] Container has `role="dialog"` + `aria-modal="true"`
- [ ] Use `useDialogA11y` hook for focus management
- [ ] Escape key closes the dialog
- [ ] Focus is trapped inside dialog (Tab cycles within)
- [ ] Focus returns to opener when dialog closes
- [ ] Modal overlay blocks interaction with page behind (optionally via `inert` attribute)
- [ ] Dialog has a heading or aria-label for context

---

### Radio Groups

```tsx
// ✅ Good — semantic radio group with roving tabindex
<fieldset>
  <legend>Frequency</legend>
  <div role="radiogroup">
    <label>
      <input
        type="radio"
        name="frequency"
        value="daily"
        checked={value === "daily"}
        onChange={(e) => setValue(e.target.value)}
      />
      Daily
    </label>
    <label>
      <input
        type="radio"
        name="frequency"
        value="weekly"
        checked={value === "weekly"}
        onChange={(e) => setValue(e.target.value)}
      />
      Weekly
    </label>
  </div>
</fieldset>

// ✅ Good — custom radio group with ARIA
<div role="radiogroup" aria-label="Notification frequency">
  {options.map((option) => (
    <label key={option.value}>
      <input
        type="radio"
        name="frequency"
        value={option.value}
        checked={value === option.value}
        onChange={(e) => setValue(e.target.value)}
      />
      {option.label}
    </label>
  ))}
</div>

// ❌ Bad — using checkboxes for single selection
<label><input type="checkbox" /> Option 1</label>
<label><input type="checkbox" /> Option 2</label>
```

**Checklist:**
- [ ] Use native `<input type="radio">` or custom with proper ARIA
- [ ] Container has `role="radiogroup"` (if not using native `<fieldset>`)
- [ ] All radios share the same `name` attribute
- [ ] Only one radio can be `:checked` at a time
- [ ] Arrow Up/Down keys navigate and select
- [ ] Single Tab stop (roving tabindex, if custom implementation)
- [ ] Wrapping `<label>` or associated via `htmlFor`

---

### Checkboxes

```tsx
// ✅ Good
<label className="ds-field">
  <input
    type="checkbox"
    checked={isChecked}
    onChange={(e) => setIsChecked(e.target.checked)}
  />
  Subscribe to marketing emails
</label>

// ✅ Good — group with fieldset
<fieldset>
  <legend>Select your interests</legend>
  {interests.map((interest) => (
    <label key={interest}>
      <input
        type="checkbox"
        value={interest}
        checked={selected.includes(interest)}
        onChange={(e) => toggleInterest(interest)}
      />
      {interest}
    </label>
  ))}
</fieldset>

// ❌ Bad — no label
<input type="checkbox" />
```

**Checklist:**
- [ ] Use native `<input type="checkbox">` (not custom)
- [ ] Each checkbox has an associated `<label>`
- [ ] Groups use `<fieldset>` + `<legend>`
- [ ] Space key toggles the checkbox
- [ ] Each checkbox is a separate Tab stop (unlike radio groups)
- [ ] Indeterminate state uses `aria-checked="mixed"` if needed

---

### Tables (DataTable)

```tsx
// ✅ Good
<DataTable
  columns={[
    { key: "name", header: "Name", render: (row) => row.name },
    { key: "email", header: "Email", render: (row) => row.email },
  ]}
  rows={users}
  rowKey={(row) => row.id}
  caption="Active users"
  onRowClick={(row) => navigate(`/users/${row.id}`)}
/>

// ❌ Bad — no caption, no semantic structure
<table>
  <tr>
    <td>Name</td>
    <td>Email</td>
  </tr>
  {/* rows */}
</table>
```

**Checklist:**
- [ ] Use DataTable component (not custom `<table>`)
- [ ] `<th scope="col">` for column headers
- [ ] Optional `<caption>` for table description
- [ ] Rows have `tabIndex={0}` and keyboard support (Enter/Space) if clickable
- [ ] Container has `role="region"` for scrollable tables
- [ ] Mobile hint "↔ Swipe to scroll" visible on small screens
- [ ] 44px minimum row height for touch targets

---

### Images

```tsx
// ✅ Good — descriptive alt text
<img
  src="/funnel-diagram.png"
  alt="4-stage funnel: Traffic → Leads → Customers → Revenue"
/>

// ✅ Good — decorative image marked as such
<img
  src="/decorative-line.svg"
  alt=""
  aria-hidden="true"
/>

// ✅ Good — icon with context
<a href="/settings">
  <SettingsIcon aria-label="Go to settings" />
  Settings
</a>

// ❌ Bad — missing alt text
<img src="/funnel.png" />

// ❌ Bad — uninformative alt text
<img src="/funnel.png" alt="image" />

// ❌ Bad — decorative image not marked
<img src="/decorative-line.svg" />
```

**Checklist:**
- [ ] Every `<img>` has an `alt` attribute
- [ ] Alt text is descriptive (not `alt="image"`)
- [ ] Decorative images have `alt=""` + `aria-hidden="true"`
- [ ] Icons have `aria-label` if standalone, or inherit context from surrounding text
- [ ] Long descriptions for complex images (charts, diagrams) use `aria-describedby`

---

### Headings

```tsx
// ✅ Good — proper hierarchy
<h1>Home</h1>
<h2>Features</h2>
<h3>Feature A</h3>
<h3>Feature B</h3>
<h2>Pricing</h2>

// ✅ Good — skip heading levels when structure allows
<h1>Dashboard</h1>
<h3>Quick Stats</h3> {/* Skipping H2 is fine if it's logical */}

// ❌ Bad — multiple H1s on one page
<h1>Dashboard</h1>
<h1>Activity Feed</h1>

// ❌ Bad — skipped levels
<h1>Dashboard</h1>
<h4>Activity Feed</h4> {/* Should be H2 or H3 */}
```

**Checklist:**
- [ ] Exactly ONE `<h1>` per page (not zero, not multiple)
- [ ] Heading hierarchy is logical (no skipped levels like H1 → H4)
- [ ] Headings describe section content (not "Intro", but "Funnel Performance")
- [ ] Don't use headings for styling (use CSS instead)
- [ ] Avoid using `<div className="text-2xl font-bold">` as headings

---

### Lists

```tsx
// ✅ Good — unordered list
<ul>
  <li>Set your pricing</li>
  <li>Launch your campaign</li>
  <li>Track results</li>
</ul>

// ✅ Good — ordered list
<ol>
  <li>Sign up for an account</li>
  <li>Verify your email</li>
  <li>Start your first funnel</li>
</ol>

// ✅ Good — navigation lists
<nav>
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/docs">Docs</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>

// ❌ Bad — divs instead of semantic list
<div>
  <div>Set your pricing</div>
  <div>Launch your campaign</div>
  <div>Track results</div>
</div>
```

**Checklist:**
- [ ] Use `<ul>` for unordered lists, `<ol>` for ordered lists
- [ ] Navigation menus use `<nav>` + `<ul>` + `<li>`
- [ ] Each list item is a `<li>` (not `<div>`)
- [ ] Nested lists are semantically nested: `<ul><li><ul>...</ul></li></ul>`

---

### Skip Links

```tsx
// ✅ Good — skip link component
<SkipLink href="#main-content" />
<main id="main-content">
  {/* Page content */}
</main>

// ✅ Good — manual skip link
<a href="#main" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// ❌ Bad — no skip link
{/* No skip link, keyboard users tab through entire nav */}
```

**Checklist:**
- [ ] Skip link present on pages with nav/chrome
- [ ] First element in Tab order is skip link
- [ ] Skip link jumps to `<main id="main-content">` or similar
- [ ] Skip link is hidden by default (`.sr-only` class)
- [ ] Skip link becomes visible on Tab (`:focus`)

---

### Live Regions (Status Updates)

```tsx
// ✅ Good — alert for validation errors
{error && (
  <div role="alert" className="error-message">
    {error}
  </div>
)}

// ✅ Good — polite announcement for non-critical updates
<div role="status" aria-live="polite">
  {message && <p>{message}</p>}
</div>

// ✅ Good — busy state while loading
<div aria-busy="true" aria-label="Loading data...">
  <Spinner />
</div>

// ❌ Bad — error not announced
{error && <p style={{ color: "red" }}>{error}</p>}

// ❌ Bad — announcement not marked as live region
<p>{status}</p>
```

**Checklist:**
- [ ] Errors use `role="alert"` (assertive, read immediately)
- [ ] Status updates use `role="status"` + `aria-live="polite"` (less intrusive)
- [ ] Loading states use `aria-busy="true"` + `aria-label`
- [ ] Success messages are announced via live region
- [ ] Changes in DOM (additions, removals, text) are announced if important

---

## Contrast & Color

**WCAG AA Requirements:**
- Text < 18pt: 4.5:1 contrast ratio
- Large text ≥ 18pt bold or ≥ 24pt: 3:1 contrast ratio
- UI components (buttons, borders, icons): 3:1 contrast ratio

**Verification:**
- Use WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Use browser DevTools: Inspect element → Accessibility panel
- Use axe DevTools browser extension

```tsx
// ✅ Good — uses design system tokens
<p className="ds-body">{text}</p> {/* ds-text-secondary on white = 8.6:1 */}

// ✅ Good — custom color checked for contrast
<p style={{ color: "#475569" }}>{text}</p> {/* 8.6:1 on white, meets AAA */}

// ❌ Bad — low contrast
<p style={{ color: "#94a3b8" }}>{text}</p> {/* 3.8:1 on white, fails AA for normal text */}
```

**Checklist:**
- [ ] Text color meets WCAG AA (4.5:1 for body text)
- [ ] UI components (buttons, borders, icons) meet WCAG AA (3:1)
- [ ] Focus ring contrasts with both background and element
- [ ] Contrast verified in both light and dark themes
- [ ] Use design system tokens (they're pre-checked for contrast)

---

## Focus Management

**Default focus ring provided by design-system.css:**
```css
:where(a, button, input, textarea, select, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--ds-brand);
  outline-offset: 2px;
}
```

**Checklist:**
- [ ] All interactive elements have `:focus-visible` outline
- [ ] Focus ring is visible against both light and dark backgrounds
- [ ] Focus order matches reading order (left-to-right, top-to-bottom)
- [ ] No positive `tabindex` (use 0 or -1 only)
- [ ] No focus traps (keyboard users can always move away)
- [ ] For dialogs, use `useDialogA11y` hook for focus trap + return

---

## Motion & Animation

**WCAG Success Criterion 2.3.3 (Animation from Interactions):**
- Respect `prefers-reduced-motion: reduce` system setting
- Disable animations for users who set this preference

```tsx
// ✅ Good — respects prefers-reduced-motion
<style>{`
  .slide-in {
    animation: slideIn 0.3s ease-out;
  }
  @media (prefers-reduced-motion: reduce) {
    .slide-in {
      animation: none;
      opacity: 1;
    }
  }
`}</style>

// ✅ Already handled in globals.css for entire site
// (See @media (prefers-reduced-motion: reduce) section)
```

**Checklist:**
- [ ] All animations/transitions wrapped in `@media (prefers-reduced-motion: reduce)`
- [ ] Motion animations disabled for reduced-motion users
- [ ] Loading spinners are exempt (frozen spinner looks stuck)
- [ ] No autoplaying video or sound on page load

---

## Keyboard Navigation

**Tab order should be:**
1. Skip link (hidden, first on Tab)
2. Navigation links/buttons
3. Main content interactive elements
4. Footer links/buttons

**Keyboard shortcuts:**
- Tab / Shift+Tab: Navigate forward/backward
- Enter: Activate button or link
- Space: Toggle checkbox, activate button
- Arrow keys: Navigate radio buttons, tabs, menus
- Escape: Close dialogs, drop-down menus

```tsx
// ✅ Good — native elements handle keyboard automatically
<button onClick={handleClick}>Action</button>
<a href="/page">Link</a>
<input type="text" />

// ✅ Good — custom component with keyboard support
<div
  role="button"
  tabIndex={0}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAction();
    }
  }}
  onClick={handleAction}
>
  Custom Button
</div>

// ❌ Bad — no keyboard support
<div onClick={handleClick}>Not a button</div>

// ❌ Bad — positive tabindex (breaks natural order)
<button tabIndex={5}>Wrong</button>
```

**Checklist:**
- [ ] All interactive elements are keyboard accessible (Tab reaches them)
- [ ] Tab order matches visual reading order
- [ ] No positive `tabindex` values
- [ ] Dialogs trap focus (Tab cycles within, Escape closes)
- [ ] Custom widgets (tabs, radio groups, comboboxes) support arrow keys
- [ ] No keyboard traps (users can always Tab away)

---

## WCAG Criteria Quick Reference

| Criterion | Level | Implementation | Status |
|-----------|-------|---|---|
| 1.1.1 Non-text Content | A | Alt text on images | ✅ |
| 1.3.1 Info and Relationships | A | Semantic HTML, form labels | ✅ |
| 1.3.5 Identify Input Purpose | AA | `<label>` on inputs | ✅ |
| 1.4.3 Contrast (Minimum) | AA | 4.5:1 text, 3:1 UI | ✅ |
| 1.4.11 Non-text Contrast | AA | UI components, borders, icons | ✅ |
| 2.1.1 Keyboard | A | Tab, arrows, Enter, Escape | ✅ |
| 2.1.2 No Keyboard Trap | A | Focus always moves | ✅ |
| 2.4.3 Focus Order | A | Logical tab order | ✅ |
| 2.4.7 Focus Visible | AA | Visible outline on all elements | ✅ |
| 3.3.1 Error Identification | A | Error messages announced | ✅ |
| 3.3.3 Error Suggestion | AA | Error messages with suggestions | ✅ |
| 4.1.2 Name, Role, Value | A | ARIA roles, states, properties | ✅ |
| 4.1.3 Status Messages | AA | Live regions announce updates | ✅ |

---

## Testing Before Commit

### Manual Testing
- [ ] Keyboard navigation: Tab through entire page
- [ ] Screen reader test: Read page with NVDA or VoiceOver
- [ ] Contrast: Check all text with WebAIM Contrast Checker
- [ ] Focus ring: Verify visible on all interactive elements
- [ ] Heading hierarchy: No skipped levels, single H1

### Automated Testing
- [ ] Run ESLint: `npm run lint -- --ext .tsx,.ts`
- [ ] Run Playwright a11y tests: `npm run test:e2e -- e2e/a11y.spec.ts`
- [ ] Use browser axe DevTools extension
- [ ] Use browser WAVE extension

### Git Commit Message
```
feat(components): improve accessibility of [ComponentName]

- Add proper ARIA roles and labels
- Implement keyboard navigation (arrows, Tab, Enter, Escape)
- Ensure focus ring is visible
- Verify color contrast meets WCAG AA
- Add screen-reader test coverage

Fixes: #123 (if related to issue)
```

---

## Resources

- **WCAG 2.1 Quick Reference:** https://www.w3.org/WAI/WCAG21/quickref/
- **MDN Accessibility:** https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **WebAIM:** https://webaim.org/
- **Web Accessibility Evaluation Tool (WAVE):** https://wave.webaim.org/
- **A11ycasts by Google Chrome:** https://www.youtube.com/playlist?list=PLNYkxOF6rcICWx0C9Xc-RgEzwLvePZCHs

---

## Questions?

Refer to:
- `docs/ACCESSIBILITY_TESTING_GUIDE.md` — comprehensive testing procedures
- `lib/use-dialog-a11y.ts` — dialog focus management example
- Existing components in `components/ui/` — patterns to follow
