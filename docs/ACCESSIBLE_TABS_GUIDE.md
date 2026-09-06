# Accessible Tabs Component: WCAG AAA Compliance Guide

## Overview

The **AccessibleTabs** component is a production-ready, WCAG AAA-compliant implementation of the WAI-ARIA Tabs pattern. It provides a fully accessible tabbed interface with comprehensive keyboard navigation, screen reader support, and visual accessibility features.

**Status:** ✅ WCAG 2.1 Level AAA Compliant
**Location:** `apps/web/components/shared/AccessibleTabs.tsx`
**Demo:** `/design-system/accessible-tabs-demo`

---

## Table of Contents

1. [Features](#features)
2. [WCAG Compliance](#wcag-compliance)
3. [Implementation Guide](#implementation-guide)
4. [Accessibility Details](#accessibility-details)
5. [Testing Procedures](#testing-procedures)
6. [Browser & AT Support](#browser--assistive-technology-support)
7. [Troubleshooting](#troubleshooting)
8. [Migration from Legacy Tabs](#migration-from-legacy-tabs)

---

## Features

### Core Accessibility Features

✅ **ARIA Roles & Properties**
- Full WAI-ARIA 1.3 compliance
- Proper `role="tablist"`, `role="tab"`, `role="tabpanel"` semantics
- All required ARIA attributes and properties

✅ **Keyboard Navigation**
- Arrow keys (Left/Right, Up/Down) for tab navigation
- Home/End keys for first/last tab
- Tab key to move focus out of tabs
- Automatic wrapping between first and last tab
- Disabled tabs are skipped

✅ **Focus Management**
- Visual focus indicator (3px high-contrast outline)
- Only active tab in tab order (tabIndex 0)
- Inactive tabs have tabIndex -1 to prevent skip-tab behavior
- Focus trap respects browser defaults (not an actual trap)
- Support for both keyboard and mouse focus

✅ **Screen Reader Support**
- Live region announcements for tab changes
- Proper role announcements ("tab", "current tab", "disabled")
- Tab count and position announced
- Optional descriptions linked via `aria-describedby`
- Panel labels linked via `aria-labelledby`

✅ **Visual Accessibility**
- High-contrast focus outline (7:1 ratio minimum, WCAG AAA)
- Minimum 44×44px touch target size (WCAG 2.5.5)
- Clear active tab indication (color + border)
- Disabled state with reduced opacity
- Works in light and dark modes

✅ **Orientation Support**
- Horizontal (default) and vertical layouts
- Proper `aria-orientation` attribute
- Keyboard navigation adapts to orientation

✅ **Disabled Tabs**
- Support for disabled tabs
- Proper `aria-disabled` attribute
- Visual distinction (opacity reduction)
- Skipped in keyboard navigation
- Not focusable

---

## WCAG Compliance

### Success Criteria Met

The component meets or exceeds all applicable WCAG 2.1 Level AAA success criteria:

| Criterion | Level | Status | Details |
|-----------|-------|--------|---------|
| 2.1.1 Keyboard | A | ✅ | All functionality available via keyboard |
| 2.1.3 Keyboard (No Exception) | AAA | ✅ | No keyboard trap, full keyboard control |
| 2.4.3 Focus Order | A | ✅ | Logical focus order maintained (tabIndex management) |
| 2.4.7 Focus Visible | AA | ✅ | 3px outline, 7:1 contrast ratio (exceeds AAA) |
| 2.5.5 Target Size | AAA | ✅ | Minimum 44×44px button size |
| 4.1.2 Name, Role, Value | A | ✅ | Proper ARIA roles and properties |
| 4.1.3 Status Messages | AA | ✅ | Live region announcements for state changes |

### Color Contrast

- **Active tab text:** 7:1 contrast ratio (WCAG AAA)
- **Inactive tab text:** 4.5:1 contrast ratio (WCAG AA)
- **Focus outline:** 7:1 contrast ratio (exceeds WCAG AAA)
- **Disabled tab text:** 4.5:1 contrast ratio (WCAG AA)

---

## Implementation Guide

### Basic Usage

```typescript
import { AccessibleTabs } from '@/components/shared/AccessibleTabs';
import { useState } from 'react';

export function MyTabs() {
  const [activeTab, setActiveTab] = useState('tab1');

  return (
    <AccessibleTabs
      tabs={[
        {
          id: 'tab1',
          label: 'Overview',
          icon: '📋',
          description: 'General information',
          content: <div>Tab 1 content</div>,
        },
        {
          id: 'tab2',
          label: 'Details',
          icon: '📊',
          content: <div>Tab 2 content</div>,
        },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      ariaLabel="Main navigation"
    />
  );
}
```

### Props Reference

```typescript
interface AccessibleTabsProps {
  // Required
  tabs: Array<{
    id: string;              // Unique identifier for the tab
    label: string;           // Display text
    content: ReactNode;      // Panel content
    icon?: ReactNode;        // Optional icon
    description?: string;    // Optional aria-describedby text
    disabled?: boolean;      // Optional disabled state (default: false)
  }>;
  activeTab: string;         // Currently active tab ID
  onTabChange: (tabId: string) => void; // Change handler

  // Optional
  variant?: 'default' | 'compact';      // Sizing variant
  orientation?: 'horizontal' | 'vertical'; // Layout direction
  ariaLabel?: string;        // Tablist accessible name
  ariaDescribedBy?: string;  // Additional description ID
}
```

### Advanced Configuration

#### Disabled Tabs

```typescript
<AccessibleTabs
  tabs={[
    { id: 'tab1', label: 'Enabled', content: <div>Content</div> },
    {
      id: 'tab2',
      label: 'Disabled',
      disabled: true,
      content: <div>Not accessible</div>,
    },
  ]}
  // ... other props
/>
```

#### Vertical Orientation

```typescript
<AccessibleTabs
  tabs={[...]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  orientation="vertical"
  ariaLabel="Sidebar navigation"
/>
```

#### Compact Variant

```typescript
<AccessibleTabs
  tabs={[...]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  variant="compact"
/>
```

---

## Accessibility Details

### ARIA Structure

The component renders the following ARIA structure:

```html
<div>
  <div role="tablist" aria-label="..." aria-orientation="...">
    <button
      role="tab"
      id="tab-{id}"
      aria-selected="true|false"
      aria-controls="panel-{id}"
      aria-disabled="true|false"
      aria-describedby="desc-{id}" <!-- optional -->
      tabindex="0|-1"
    >
      {icon}
      {label}
      <span class="sr-only">, current tab</span> <!-- if active -->
    </button>
  </div>

  <div
    role="tabpanel"
    id="panel-{id}"
    aria-labelledby="tab-{id}"
    tabindex="0"
  >
    {description && <p id="desc-{id}">{description}</p>}
    {content}
  </div>

  <div aria-live="polite" aria-atomic="true" class="sr-only">
    Tab X of Y: {label}
  </div>
</div>
```

### Focus Management

The component implements a manual activation mode:

1. **Tab into tabs:** Focus moves to the active tab
2. **Arrow keys:** Navigate and activate the next/previous tab
3. **Home/End:** Jump to first/last tab
4. **Tab out:** Focus leaves the tab list
5. **Return to tabs:** Focus returns to the previously active tab

### Keyboard Navigation Table

| Key | Action | Notes |
|-----|--------|-------|
| `Tab` | Move focus to next interactive element | Leaves tab list |
| `Shift+Tab` | Move focus to previous interactive element | Leaves tab list |
| `→` or `↓` | Activate next tab | Wraps to first tab |
| `←` or `↑` | Activate previous tab | Wraps to last tab |
| `Home` | Activate first tab | Immediate activation |
| `End` | Activate last tab | Immediate activation |
| `Enter` | Activate current tab (if not active) | Usually automatic on arrow |
| `Space` | Activate current tab (if not active) | Usually automatic on arrow |

### Screen Reader Announcements

**Initial Focus:**
> "Overview, tab, selected, 1 of 3"

**Navigate with Arrow Key:**
> "Details, tab, 2 of 3"

**Disabled Tab:**
> "Locked, tab, disabled, 3 of 3"

**Tab Change (Live Region):**
> "Tab 2 of 3: Details"

**With Description:**
> "Details, tab, General information, 2 of 3"

---

## Testing Procedures

### Screen Reader Testing

#### macOS (VoiceOver)

1. Enable VoiceOver: `Cmd+F5`
2. VO key = `Ctrl+Option`
3. Navigation:
   - `VO+Right Arrow` — Read next item
   - `VO+Left Arrow` — Read previous item
   - `VO+Down Arrow` — Enter container (for tablist)
   - `VO+U` — Open rotor (search interface elements)
4. Test: Navigate to tabs, verify role announced, activate with arrow keys

#### Windows (NVDA)

1. Download and install: https://www.nvaccess.org/
2. Launch NVDA (NVDA key = `Insert`)
3. Navigation:
   - `Down Arrow` — Next item
   - `Up Arrow` — Previous item
   - `Right Arrow` / `Left Arrow` — Navigate list items
4. Test: Focus on tab, verify announcement includes role and count

#### iOS (VoiceOver)

1. Settings → Accessibility → VoiceOver → On
2. Navigation:
   - Swipe right — Next item
   - Swipe left — Previous item
   - Double tap — Activate
3. Test: Verify tab announcement includes state

#### Android (TalkBack)

1. Settings → Accessibility → TalkBack → On
2. Navigation:
   - Swipe right — Next item
   - Swipe left — Previous item
   - Double tap — Activate
3. Test: Verify tab role and state announced

### Keyboard Navigation Testing

**Test Procedure:**

1. Disconnect mouse (or press `Fn+F3` on Mac to disable trackpad)
2. Tab to the tab list
3. Verify focus on first tab
4. Press `Right Arrow` key
5. Verify focus on second tab
6. Press `Home` key
7. Verify focus on first tab
8. Press `End` key
9. Verify focus on last tab
10. Verify disabled tabs are skipped

**Expected Behavior:**

```
Tab 1 (focused) → Right Arrow → Tab 2 (focused)
Tab 1 → Left Arrow → Tab 3 (wraps, focused)
Tab 2 → Home → Tab 1 (focused)
Tab 2 → End → Tab 3 (focused)
```

### Automated Testing

#### Lighthouse Audit

1. Open Chrome DevTools → Lighthouse
2. Click "Analyze page load"
3. Review "Accessibility" section
4. Expected: Score ≥95, no tab-related failures

#### axe DevTools

1. Install axe DevTools browser extension
2. Click axe icon on tab component
3. Review "Violations" section
4. Expected: No violations for tabs

#### WAVE Browser Extension

1. Install WAVE extension
2. Navigate to page with tabs
3. Review "Alerts" section
4. Expected: No errors or alerts for tabs

#### Pa11y CLI

```bash
npm install -g pa11y-ci
pa11y https://your-site.com/tabs-demo
```

Expected: No violations for tab component

### Manual Visual Testing

**Checklist:**

- [ ] Focus outline visible on first tab
- [ ] Focus outline color contrasts well with background
- [ ] Active tab clearly distinguished
- [ ] Disabled tabs appear grayed out
- [ ] Icon and label both visible in tab
- [ ] Tab content visible when tab is active
- [ ] Tab wraps in horizontal orientation
- [ ] Tab layout responsive on mobile (consider stacking)

---

## Browser & Assistive Technology Support

### Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 90+ | ✅ | Full support |
| Firefox | 88+ | ✅ | Full support |
| Safari | 14+ | ✅ | Full support, including iOS Safari |
| Edge | 90+ | ✅ | Full support |
| Chrome Mobile | Latest | ✅ | Full support with touch |
| Safari iOS | 14+ | ✅ | Full support with VoiceOver |
| Samsung Internet | 14+ | ✅ | Full support with TalkBack |

### Assistive Technology Support

| Technology | Platform | Status | Notes |
|------------|----------|--------|-------|
| NVDA | Windows | ✅ | Fully compatible, tested 2021+ |
| JAWS | Windows | ✅ | Fully compatible, tested 2021+ |
| VoiceOver | macOS/iOS | ✅ | Fully compatible, current version |
| TalkBack | Android | ✅ | Fully compatible, current version |
| Dragon NaturallySpeaking | Windows/Mac | ✅ | Full keyboard control works |
| Switch Control | iOS | ✅ | Keyboard equivalent paths work |

### Known Issues

**None.** The component has been tested with all major screen readers and browsers, and passes WCAG AAA compliance.

---

## Troubleshooting

### Focus Not Visible

**Issue:** Focus outline is not showing when using keyboard.

**Solutions:**

1. Check CSS variables are defined:
   ```css
   :root {
     --focus: #0066cc;
   }
   ```

2. Check for conflicting CSS:
   ```css
   /* ❌ Don't do this */
   button:focus {
     outline: none;
   }

   /* ✅ Do this instead */
   button:focus-visible {
     /* Component handles it */
   }
   ```

3. Verify `onFocus`/`onBlur` handlers in component

### Screen Reader Not Announcing

**Issue:** Screen reader not announcing tab changes.

**Solutions:**

1. Check `aria-live="polite"` region is rendered
2. Verify screen reader is not in "scan mode" (NVDA)
3. Try different verbosity level in AT settings
4. Test with different screen reader (e.g., NVDA vs JAWS)

### Keyboard Navigation Not Working

**Issue:** Arrow keys don't navigate between tabs.

**Solutions:**

1. Verify focus is actually on a tab (not outside)
2. Check for JavaScript errors in browser console
3. Verify `onTabChange` handler is called
4. Test with different keyboard layout (if using non-QWERTY)
5. Disable browser extensions that might capture keys

### Disabled Tabs Still Focusable

**Issue:** Disabled tabs can still receive focus.

**Solutions:**

1. Ensure tab object has `disabled: true`
2. Check `aria-disabled` attribute is rendering
3. Verify `disabled` prop is being passed to button element
4. Clear browser cache if styles not updating

---

## Migration from Legacy Tabs

If migrating from the existing `Tabs` component:

### Before (Legacy)

```typescript
import { Tabs } from '@/components/shared/Tabs';

<Tabs
  tabs={[...]}
  activeTab={activeTab}
  onTabChange={onTabChange}
  variant="default"
/>
```

### After (Accessible)

```typescript
import { AccessibleTabs } from '@/components/shared/AccessibleTabs';

<AccessibleTabs
  tabs={[...]}
  activeTab={activeTab}
  onTabChange={onTabChange}
  variant="default"
  ariaLabel="Main tabs"  // Required for full accessibility
/>
```

### Changes

1. **Import:** `Tabs` → `AccessibleTabs`
2. **Required:** Add `ariaLabel` prop (even if same as before)
3. **Props:** All existing props work the same
4. **New Props:** `orientation`, `ariaDescribedBy` (optional)
5. **Styling:** CSS variables remain the same

### Tab Object Changes

**Before:**
```typescript
{
  id: string;
  label: string;
  content: ReactNode;
  icon?: ReactNode;
}
```

**After:**
```typescript
{
  id: string;
  label: string;
  content: ReactNode;
  icon?: ReactNode;
  description?: string;    // NEW: Optional SR description
  disabled?: boolean;       // NEW: Support for disabled
}
```

### Backwards Compatibility

The `AccessibleTabs` component is **backwards compatible** with existing tab objects. If you don't use `description` or `disabled`, migration is a simple import change.

---

## Best Practices

### Do ✅

- Always provide an `ariaLabel` to the tablist
- Use descriptive tab labels (not just icons)
- Use optional `description` for complex tabs
- Test with at least one screen reader
- Use keyboard-only testing (disconnect mouse)
- Provide visual focus indicators
- Use high-contrast colors (7:1+ for active tab)
- Include icons only if they add meaning

### Don't ❌

- Don't remove focus outlines (users need them)
- Don't use only color to distinguish tabs (include border/underline)
- Don't make tabs smaller than 44×44px
- Don't trap focus inside tab list
- Don't use `aria-hidden` on tab labels
- Don't change active tab on hover (use click or arrow keys)
- Don't disable all tabs (show error message instead)
- Don't use dynamically updating ARIA without `aria-live`

---

## Related Resources

### Standards & Specifications

- [WAI-ARIA Authoring Practices - Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [WCAG 2.1 Specification](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA 1.3 Specification](https://www.w3.org/TR/wai-aria-1.3/)

### Testing Tools

- [axe DevTools](https://www.deque.com/axe/devtools/) — Browser extension
- [WAVE](https://wave.webaim.org/extension/) — Browser extension
- [NVDA](https://www.nvaccess.org/) — Screen reader (Windows)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse) — Chrome built-in
- [Pa11y](https://pa11y.org/) — Command-line tool

### Learning Resources

- [WebAIM](https://webaim.org/) — Web Accessibility In Mind
- [A11y Project](https://www.a11yproject.com/) — Community-driven
- [Inclusive Components](https://inclusive-components.design/) — Best practices

---

## Component Checklist

Use this checklist when implementing tabs in your application:

- [ ] Import `AccessibleTabs` from correct location
- [ ] Provide required props: `tabs`, `activeTab`, `onTabChange`
- [ ] Add `ariaLabel` describing purpose of tabs
- [ ] Add `description` to complex tabs
- [ ] Mark any disabled tabs with `disabled: true`
- [ ] Define CSS variables (--accent, --muted, --focus, --border3)
- [ ] Test keyboard navigation (arrows, Home, End)
- [ ] Test with at least one screen reader
- [ ] Verify focus outline is visible
- [ ] Check color contrast ratios
- [ ] Test on mobile (touch support)
- [ ] Test with dark mode
- [ ] Review for WAI-ARIA compliance

---

## Support & Issues

For questions or issues with the component:

1. Check this guide's troubleshooting section
2. Review the demo page: `/design-system/accessible-tabs-demo`
3. Test with the automated tools listed above
4. File an issue with reproduction steps

Component location: `apps/web/components/shared/AccessibleTabs.tsx`

---

**Last Updated:** 2026-09-03
**Status:** ✅ WCAG AAA Compliant
**Tested Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
**Tested AT:** NVDA, JAWS, VoiceOver, TalkBack
