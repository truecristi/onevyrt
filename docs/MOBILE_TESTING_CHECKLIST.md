# Mobile-First Responsive Design Testing Checklist

## Overview

This checklist ensures ONEVYRT delivers an excellent experience across all device sizes, from small phones (375px) to tablets (768px+) to desktop (1024px+).

## Viewport Dimensions

- **Mobile Small:** 375px (iPhone SE, iPhone 6/7/8)
- **Mobile Standard:** 390px (iPhone 12/13/14)
- **Mobile Large:** 430px (iPhone 15 Pro Max)
- **Tablet:** 768px (iPad, Android tablets)
- **Desktop:** 1024px+ (laptops, desktops)

## Critical UI Elements: Touch Targets

All interactive elements must meet minimum 44px tap target (CSS: `min-width: 44px; min-height: 44px;`).

### Pages to Test

#### Core Navigation
- [ ] AppNav (primary navigation) at 375px
  - [ ] Logo visibility and size
  - [ ] Menu items stack on mobile
  - [ ] Hamburger menu (if added) functional
  - [ ] Account menu accessible and clickable
  - [ ] Theme toggle hit target 44px+
  - [ ] No horizontal scroll

- [ ] Lesson Context Strip (when present)
  - [ ] Back button at 44px+ height
  - [ ] Text wraps properly
  - [ ] Padding appropriate for thumb reach

#### Programme Journey Page
- [ ] `/programme`
  - [ ] Header scales down (clamp font sizes)
  - [ ] Arc/state indicators don't wrap awkwardly
  - [ ] Live status band responsive
  - [ ] Progress bar readable
  - [ ] Modules stack in single column
  - [ ] Pills and labels don't overflow
  - [ ] Chapter gates stack properly
  - [ ] Submit button hit target 44px+
  - [ ] Form inputs full width (min-width: 44px height)

#### Business Pages
- [ ] `/business/*` pages
  - [ ] Navigation tabs don't horizontal scroll
  - [ ] Page content single column
  - [ ] Cards stack vertically
  - [ ] Tables stack (see "Responsive Tables" below)

#### Coaching & Studio
- [ ] `/coaching/*` pages
  - [ ] Submission list responsive
  - [ ] Review panels readable
  - [ ] Action buttons 44px+

#### Campaign Studio
- [ ] `/campaign-studio/*`
  - [ ] Form inputs full width
  - [ ] Rich text editor usable on mobile
  - [ ] Sidebar collapses (if present)
  - [ ] Drag-drop touch-friendly (see "Mobile Touch Interactions")

#### Community
- [ ] `/community`
  - [ ] Feed cards stack
  - [ ] Action buttons 44px+
  - [ ] Author details visible

#### My Business Dashboard
- [ ] `/my-business`
  - [ ] Cards responsive
  - [ ] Charts readable (legends, labels)
  - [ ] Export button accessible

#### Reports
- [ ] `/account/transformation-report`
  - [ ] PDF layout readable
  - [ ] Share buttons accessible
  - [ ] Print layout optimized

#### Forms (Global)
- [ ] Login/signup forms
  - [ ] Inputs min-height 44px
  - [ ] Single column layout
  - [ ] Password visibility toggle hit target
  - [ ] Error messages visible and readable
  - [ ] Labels above inputs (not inline)

- [ ] Chapter submission forms
  - [ ] Textareas full width, min-height 44px per line
  - [ ] Submit/cancel buttons 44px+ tall
  - [ ] Error feedback inline and clear

- [ ] Funnel/project edit forms
  - [ ] All inputs stack vertically
  - [ ] File uploads touch-friendly
  - [ ] Select dropdowns readable

## Responsive Tables

All data tables must adapt for mobile:

### Pattern 1: Horizontal Scroll (Preferred for Dense Data)
```
<div style="overflow-x: auto; width: 100%;">
  <table style="min-width: 500px;">...</table>
</div>
```
- Indicate horizontal scroll capability (e.g., visual cue or brief hint text)

### Pattern 2: Stacked Cards (Preferred for < 5 Columns)
- Hide table, show card grid on mobile
- Each row becomes a card: "Label: Value"
- Works well for lead lists, activity logs

### Checklist for Tables
- [ ] No forced horizontal scroll on page body
- [ ] Column count reduced on mobile (hide non-essential columns)
- [ ] Headers remain readable
- [ ] Data density reduced (larger padding/margins)
- [ ] Action buttons within reach (no tiny 24px icons)

### Specific Tables to Test
- [ ] Leads table (`/business/leads`)
- [ ] Funnel projects list (`/business/funnels`)
- [ ] Campaign list (`/campaign-studio/campaigns`)
- [ ] Webhook logs (admin)
- [ ] Learner list (coaching view)
- [ ] Activity log

## Mobile Touch Interactions

### Hamburger Menu (If Implemented)
- [ ] Menu icon is 44px+ square
- [ ] Menu opens/closes smoothly
- [ ] Backdrop dismisses menu
- [ ] Keyboard: Escape closes menu
- [ ] Focus trap inside menu when open
- [ ] No body scroll when menu open
- [ ] Animation respects `prefers-reduced-motion`

### Drag-and-Drop (Funnel Builder, Campaign Composer)
- [ ] Mouse drag works (desktop)
- [ ] Touch drag works (mobile)
- [ ] Visual feedback during drag
- [ ] Drop zones clearly indicated
- [ ] Fallback: Buttons for users who can't drag
- [ ] No long-press context menu interference

### Modals & Drawers
- [ ] Full viewport height on mobile (no cutoff)
- [ ] Close button 44px+ and top-right positioned
- [ ] Form inputs inside modals full width
- [ ] Scrollable content inside modal
- [ ] No body scroll when modal open

### Bottom Sheets (If Used)
- [ ] Swipe down to dismiss
- [ ] Drag handle visible at top
- [ ] Content doesn't extend under safe area

## Responsive Typography

### Font Size Scaling
- [ ] Page titles use `clamp()` to scale (e.g., `clamp(20px, 4vw, 38px)`)
- [ ] Body text remains readable (min 14px, ideally 16px on mobile)
- [ ] Line height 1.5+ for readability
- [ ] Letter spacing readable at small sizes
- [ ] No text overflow due to long words/URLs

### Text Wrapping & Truncation
- [ ] Multi-line text wraps naturally
- [ ] Single-line text truncates with ellipsis when needed
- [ ] URLs don't force page width (word-break: break-word)
- [ ] Email addresses readable in lists

## Spacing & Padding

### Global Spacing
- [ ] Base padding: 12px on mobile, 20px+ on desktop
- [ ] Gap between sections: 16px mobile, 24px desktop
- [ ] Touch-friendly padding inside buttons (8px min on mobile)

### Safe Areas (iOS Notch/Dynamic Island)
- [ ] Viewport meta tag includes `viewport-fit=cover`
- [ ] Content avoids notch area (use `safe-area-inset-*` CSS)
- [ ] Bottom safe area respected for sticky footers/CTAs

## Keyboard Navigation & Accessibility

- [ ] Tab order is logical (left-to-right, top-to-bottom)
- [ ] Focus visible on all interactive elements (outline or highlight)
- [ ] Form labels associated with inputs (`<label for="id">`)
- [ ] Error messages linked to inputs (`aria-describedby`)
- [ ] Skip link visible on focus (jump to main content)
- [ ] No keyboard traps (can Tab out of all areas)

## Viewport Meta Tag

Every page must have the correct viewport meta tag:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- [ ] Next.js `viewport` export in layout.tsx (already set, double-check)
- [ ] No `maximum-scale=1` (prevents zoom on iOS)
- [ ] No `user-scalable=no` (accessibility violation)

## Performance on Mobile

- [ ] Bundle size optimized (code-split, lazy-load)
- [ ] Images optimized (responsive, WebP, size hints)
- [ ] CSS-in-JS or inline styles don't block render
- [ ] No layout thrashing (DOM writes/reads in loops)
- [ ] Touch interactions < 100ms latency

## Test on Real Devices

Before shipping, test on actual phones and tablets:

### iOS
- [ ] iPhone SE (375px)
- [ ] iPhone 12/13 (390px)
- [ ] iPhone 15 Pro Max (430px)
- [ ] iPad (768px)
- [ ] iOS 16+ Safari
- [ ] Chrome on iOS (uses Safari engine)

### Android
- [ ] Google Pixel 5/6 (412px)
- [ ] Samsung Galaxy S21 (360px)
- [ ] OnePlus 11 (412px)
- [ ] Tablet 10" (600px+)
- [ ] Android 12+ Chrome
- [ ] Firefox on Android

### Testing Tools
- [ ] Chrome DevTools (Responsive Design Mode)
  - Throttle to slow 4G
  - Throttle CPU 4x
  - Test with various device presets
- [ ] Safari DevTools (remote debugging to real iPhone)
- [ ] BrowserStack (real cloud devices)
- [ ] Local device testing (most important)

## Design System Tokens

Ensure all responsive breakpoints align:

```css
/* Tailwind defaults (used in this project) */
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

For custom CSS, use consistent breakpoints:
- Mobile: 0–374px (extra small)
- Mobile: 375–639px (small devices)
- Tablet: 640–767px (landscape mobile/small tablet)
- Tablet: 768–1023px (tablet portrait)
- Desktop: 1024px+ (desktop)

## Checklist Completion

- [ ] All pages tested at 375px, 768px, 1024px
- [ ] All touch targets 44px+
- [ ] No horizontal scroll on body
- [ ] Forms optimized for mobile
- [ ] Tables responsive (scroll or stack)
- [ ] Navigation mobile-friendly (no overflow)
- [ ] Viewport meta tags correct
- [ ] Real device testing completed
- [ ] Keyboard navigation verified
- [ ] Dark mode works on mobile (toggle visible)
- [ ] Print layout mobile-optimized

## Known Issues Tracking

Use this section to track issues found during testing:

### Issue Template
- **Component:** [Component name]
- **Device:** [375px / 768px / real device]
- **Issue:** [Description]
- **Status:** [Open / Fixed / Deferred]
- **Commit:** [If fixed, link to commit]

### Current Issues
(None initially; populate during testing)

---

## Resources

- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [WCAG 2.1: Touch Target Size (2.5.5)](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Web.dev: Responsive Web Design Basics](https://web.dev/responsive-web-design-basics/)
- [Apple Human Interface Guidelines: Layout](https://developer.apple.com/design/human-interface-guidelines/foundations/layout)
- [Material Design: Layout on Mobile](https://m3.material.io/foundations/layout/understanding-layout)
