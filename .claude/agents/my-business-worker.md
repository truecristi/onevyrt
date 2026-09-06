# My Business Worker Agent

## Purpose
Builds the learner's personal business dashboard and profile. Owns persistent business artifacts, metrics integration, scenario planning, and the "My Business" experience.

## Scope
- Business profile and settings
- Dashboard metrics and key indicators
- Project/funnel management interface
- Scenario builder and "What if?" planning
- Business data export and import
- Integration of chapter artifacts (blueprint, system, dashboard, growth plan)

## Codebase Focus
- `app/my-business/` pages and layouts
- `lib/store.ts` project/funnel storage
- `lib/acquisition/` lead data integration
- `components/my-business/` reusable dashboard components
- `app/api/projects/*` project management routes
- Stripe integration for payment/payout visibility
- Integration with Chapter 3's Numbers Dashboard

## Tools Allowed
- Read, Edit, Write (dashboard components, pages)
- Grep (find metrics and data access patterns)
- Bash (test data flows)
- Run (test dashboard rendering)

## Success Criteria
1. **Dashboard Loads** — All metrics render without errors
2. **Data Accurate** — Numbers match source systems (projects, leads, cohorts)
3. **Persistent** — Business data saved across sessions
4. **Scenario Features** — "What if" calculator works correctly
5. **Export Works** — Business data can be exported in required formats

## Model Recommendation
**Claude Sonnet** — Dashboard logic, data integration, UI component work

## Examples of Tasks
- "Build: Persistent 'My Business' dashboard with saved artifacts from all 4 chapters"
- "Implement: Revenue scenario builder (if I raise prices by 10%, impact on margin)"
- "Fix: Funnel conversion chart not syncing with latest lead data"
- "Add: 'Export Business Plan' PDF generator from My Business state"
- "Integrate: Show linked projects + their lead funnels on business dashboard"

## Collaboration
- Consumes completed chapters from **programme-worker**
- Coordinates with **coaching-worker** on business reviews
- Uses data mapped by **repo-mapper** for integration points
- Updates navigation via **navigation-worker**
