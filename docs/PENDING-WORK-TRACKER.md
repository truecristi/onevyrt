# ONEVYRT Pending Work Tracker

**Last Updated:** 2026-09-03  
**Status:** Phase 1 & 2 Completed, Phase 3-5 Pending  
**Branch:** `claude/works-f7cor7`

---

## 📋 Executive Summary

All tasks below are **NOT YET EXECUTED**. This document tracks:
- ✅ What's been completed (design system, prototypes, documentation)
- 🔄 What's ready to implement (code written, awaiting deployment)
- ⏳ What's queued for development (high priority, architectural)

---

## 🚀 Priority 1: Funnel Builder UI Restructuring

### Status: Interactive Prototypes Complete → React Components Pending

**What's Done:**
- ✅ 3 interactive HTML prototypes published as live artifacts
- ✅ Collapsible Panels approach (metrics expand/collapse, drawer sidebar)
- ✅ Tabbed Layout approach (Canvas | Metrics | Blocks tabs)
- ✅ Split-View approach (70/30 canvas + toggleable sidebar)
- ✅ Full dark mode, responsive design, smooth animations on all 3
- ✅ Comparison matrix with pros/cons per approach

**What's NOT Done:**
- 🔄 Convert prototypes to production React components (Tailwind CSS + TypeScript)
- 🔄 Select preferred UI approach (Collapsible, Tabs, or Split-View)
- 🔄 Integrate into `apps/web/components/studio/FunnelCanvasBuilder.tsx`
- 🔄 Test mobile responsiveness in live app
- 🔄 Wire up state management (metrics visibility, sidebar collapse, etc.)

**Estimated Effort:** 4-6 hours (depends on selected approach)

**Files to Modify:**
- `apps/web/components/studio/FunnelCanvasBuilder.tsx`
- `apps/web/components/studio/MetricsBar.tsx`
- `apps/web/components/studio/BlocksLibrary.tsx`
- `apps/web/components/studio/FunnelNode.tsx`
- `apps/web/styles/studio.css`

**Next Action:**
```
User selects: Collapsible | Tabs | Split-View
↓
Generate production React components
↓
Integration guide created
↓
Test in /studio
```

**Interactive Prototypes:**
- 🔗 Collapsible: [Published Artifact](#)
- 🔗 Tabs: [Published Artifact](#)
- 🔗 Split-View: [Published Artifact](#)

---

## 🎨 Priority 2: Lesson Visual Enhancements

### Status: Proof-of-Concept Complete → Scale to All Lessons Pending

**What's Done:**
- ✅ Marketing System Lesson visuals proof-of-concept
  - Channel Comparison Chart (3 channels with cost-per-visitor bars)
  - Process Flow Diagram (3-stage funnel with decision rules)
  - Decision Framework (2x2 matrix: High/Low Spend × High/Low Visitors)
- ✅ `components/lessons/MarketingSystemVisuals.tsx` created
- ✅ `docs/LESSON-VISUALS-TEMPLATE.md` (reusable template for other lessons)
- ✅ Design system integration (ONEVYRT colors, typography, spacing)

**What's NOT Done:**
- 🔄 Create visuals for Phase 1 priority lessons:
  - Business Definition (positioning map visualization)
  - Sales Funnel (funnel stage diagram)
  - Financial Dashboard (KPI cards + revenue/cost charts)
- 🔄 Create visuals for Phase 2 lessons (Funnel, Dashboard, etc.)
- 🔄 Scale to all 25+ lessons (weeks 3-4)
- 🔄 Export capability (PDF/PNG of visuals for worksheets)
- 🔄 Integrate visuals into lesson content flow

**Estimated Effort:**
- Phase 1 visuals: 8-12 hours
- Phase 2 visuals: 6-8 hours
- Full scaling (25+ lessons): 20-30 hours

**Reusable Template:** `docs/LESSON-VISUALS-TEMPLATE.md`  
Provides pattern for:
- SVG-based diagrams (scalable, no images)
- Dark mode support
- Responsive sizing
- Tailwind CSS integration

**Next Action:**
```
Pick 1 Phase 1 lesson (Business Definition, Sales Funnel, Financial Dashboard)
↓
Generate visuals following template
↓
Integrate into /programme/lesson/[id]
↓
Test in browser + mobile
↓
Repeat for other lessons
```

---

## 🎨 Priority 3: UI Component Beautification (CSS Patches)

### Status: 13 Patches Documented → Ready to Apply

**What's Done:**
- ✅ 13 CSS beautification patches fully documented
- ✅ Risk assessment: Very Low (CSS only, no logic changes)
- ✅ QA checklist created (component sampling matrix)
- ✅ Implementation guide ready

**Patches Summary:**
1. **Visual Hierarchy Refinement** — Refine spacing, sizing, line-heights on 160+ components
2. **Enhanced Shadow System** — 4→5 elevation levels for better depth perception
3. **Button Feedback** — Color + shadow + elevation on hover
4. **Card Elevation** — Subtle baseline + enhanced hover states
5. **Badge Styling** — Refined padding, font-weight, border-radius
6. **Input Field States** — Focus ring refinement + error state colors
7. **Dropdown Menu** — Enhanced shadow, better spacing
8. **Modal Overlay** — Refined backdrop blur + transition timing
9. **Tooltip Styling** — Better visibility, arrow positioning
10. **Progress Indicator** — Enhanced animation + color contrast
11. **Navigation Active State** — Clearer indication of current page
12. **Form Label Spacing** — Better visual connection to inputs
13. **Dark Mode Refinements** — Adjusted contrast across all components

**What's NOT Done:**
- 🔄 Apply patches to codebase
- 🔄 QA testing (160+ components, 2-3 hours)
- 🔄 Screenshot comparisons (before/after)

**Estimated Effort:** 2-3 hours implementation + 4-6 hours QA

**Files to Patch:**
- `apps/web/app/design-system.css` (primary)
- `apps/web/styles/*.css` (component-specific)
- 160+ React components (Tailwind class updates)

**Next Action:**
```
Review patches in: docs/BEAUTIFICATION-PATCHES.md
↓
Pick batch (e.g., "Form Components" or "Cards + Buttons")
↓
Apply CSS changes
↓
Run QA checklist
↓
Screenshot comparison
↓
Repeat for remaining patches
```

---

## 🔓 Priority 4: Free-Access Mode Deployment

### Status: Code Ready → Awaiting Deployment

**What's Done:**
- ✅ Database migration: `migrations/1788378476000_add-free-access-mode.js`
- ✅ Admin endpoint: `app/api/admin/enable-free-access/route.ts`
- ✅ Direct control: `app/api/admin/workspaces/[id]/free-access/route.ts`
- ✅ Query helper: Enrollments respect `free_access_mode = true`

**What Free-Access Mode Does:**
- ✅ Unlocks all lessons and chapters
- ✅ Bypasses all prerequisite gates
- ✅ Auto-approves all submissions
- ✅ Perfect for demo/trial workspaces

**What's NOT Done:**
- 🔄 Enable for `goldmanadvertising` workspace (awaiting production deployment)
- 🔄 UI toggle in admin dashboard (if desired)
- 🔄 Audit logging (who enabled it, when)

**SQL Command (if direct DB access):**
```sql
UPDATE workspaces 
SET free_access_mode = true 
WHERE LOWER(name) LIKE '%goldmanadvertising%';
```

**API Call (via endpoint):**
```bash
curl -X POST https://onevyrt.masteryresearch.com/api/admin/workspaces \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

**Next Action:**
```
Option A: Call API endpoint (recommended)
Option B: Direct SQL query (if DB access available)
↓
Verify goldmanadvertising can access all lessons
↓
Test trial flow without coaching gates
```

---

## 📚 Phase Implementation Timeline

### Phase 1: Design System & Documentation ✅ COMPLETE
- Design Tokens (60+ colors, spacing, typography, shadows)
- Design System CSS
- Icon System (Chapter, Status, Action icons)
- Documentation (4 guides, 78KB)
- **Timeline:** Completed

### Phase 2: UI Component Beautification 🔄 READY TO START
- Visual Hierarchy Refinement
- Shadow + Elevation System
- Button + Card States
- Component QA
- **Timeline:** 2-3 hours implementation + 4-6 hours QA

### Phase 3: Lesson Visual Enhancements 🔄 PROOF-OF-CONCEPT DONE
- Phase 1 visuals: Business Definition, Sales Funnel, Financial Dashboard
- Phase 2 visuals: Funnel, Dashboard, etc.
- Full scaling to 25+ lessons
- **Timeline:** 8-12 hours Phase 1 + 6-8 hours Phase 2 + 20-30 hours scaling

### Phase 4: Funnel Builder UI Restructuring 🔄 PROTOTYPES DONE
- Select preferred approach (Collapsible | Tabs | Split-View)
- Generate React components (Tailwind + dark mode)
- Integration testing
- Mobile responsiveness validation
- **Timeline:** 4-6 hours implementation + 2-3 hours testing

### Phase 5: Testing & Deployment 📋 QUEUED
- E2E test coverage (auth, funnel, submissions, deletion)
- Performance monitoring
- Bundle size optimization
- Production deployment
- **Timeline:** 6-8 hours

---

## 🗂️ File Reference

### New Files Created (Not Yet in Codebase)
```
apps/web/
├── components/
│   ├── lessons/
│   │   └── MarketingSystemVisuals.tsx          ← Proof-of-concept (ready to use)
│   └── studio/
│       └── FunnelBuilderRestructured.tsx       ← React version (pending)
└── migrations/
    └── 1788378476000_add-free-access-mode.js   ← Migration ready

docs/
├── LESSON-VISUALS-TEMPLATE.md                  ← Reusable template
├── BEAUTIFICATION-PATCHES.md                   ← 13 CSS patches (pending)
├── PENDING-WORK-TRACKER.md                     ← This file
└── FUNNEL-BUILDER-RESTRUCTURING.md             ← Approach docs
```

### Artifacts (Published, Ready to Review)
- 🔗 Collapsible Panels Prototype
- 🔗 Tabbed Layout Prototype
- 🔗 Split-View Prototype
- 🔗 Design Token System (reference)
- 🔗 Lesson Visuals Template (reference)

---

## ✅ Quick Decision Matrix

**Question: What should we do first?**

| If Goal Is… | Start With | Effort | Impact |
|---|---|---|---|
| Better funnel builder UX | Priority 1: UI Restructuring | 4-6h | High |
| More engaging lessons | Priority 3: Visuals | 8-12h | Medium-High |
| Polished visual design | Priority 2: Beautification | 2-3h | Medium |
| Demo/trial workspace | Priority 4: Free-Access | <30min | High |

**Recommended Sequence:**
1. ✅ Free-Access Mode (quick win, enables trial usage)
2. 🔄 Funnel Builder UI (highest impact on user experience)
3. 🔄 Lesson Visuals (engagement + learning outcomes)
4. 🔄 Beautification (polish & refinement)

---

## 📞 Next Steps

**Immediate (Today):**
- [ ] Review the 3 interactive UI prototypes
- [ ] Select preferred Funnel Builder approach (Collapsible | Tabs | Split-View)
- [ ] Decide: Start with UI restructuring or free-access mode?

**This Week:**
- [ ] Implement selected funnel builder UI approach (React components)
- [ ] Deploy free-access mode for goldmanadvertising
- [ ] Create Phase 1 lesson visuals (Business Definition)

**Next Week:**
- [ ] Apply CSS beautification patches
- [ ] Expand lesson visuals to Phase 2 lessons
- [ ] Mobile testing & refinement

**Future (Weeks 3-4):**
- [ ] Scale lesson visuals to all 25+ lessons
- [ ] E2E testing suite
- [ ] Performance optimization
- [ ] Final QA + production deployment

---

## 🔗 Related Documentation

- `docs/DESIGN-TOKENS.md` — Design system reference
- `docs/DESIGN-SYSTEM-INTEGRATION.md` — Component integration guide
- `docs/LESSON-VISUALS-TEMPLATE.md` — Template for visual components
- `docs/ICON-SYSTEM.md` — Icon catalog and usage
- `apps/web/CLAUDE.md` — Project overview and architecture

---

## 📝 Notes

- All interactive prototypes support dark mode toggle (bottom-right button)
- All prototypes are responsive (resize browser to test mobile)
- All 3 UI approaches maintain existing functionality
- CSS patches are low-risk (style only, no logic changes)
- Lesson visuals use SVG (scalable, works in all browsers)
- Free-access mode is backward compatible (existing workspaces unaffected)

---

**Questions?** Review the detailed documentation files or refer to the interactive prototypes for visual reference.
