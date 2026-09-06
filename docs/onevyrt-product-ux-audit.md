# ONEVYRT Product & UX Audit (21 August 2026)

> Source-of-record copy of the product/UX audit, committed so it travels with the code.
> Extracted from the original .docx (table layout flattened to lines). Section numbers (e.g. §17 roadmap, §255 save consolidation) are referenced in PR/commit messages.

PRODUCT · UX · FLOW · LOGIC · DESIGN · ACCESSIBILITY
ONEVYRT Product and Application Audit
A source-grounded review of the user journey, information architecture, interaction logic, presentation, controls, mobile behaviour, accessibility, reliability and product maintainability
Audit item
Detail
Application reviewed
onevyrt-master (1).zip
Audit date
21 August 2026
Codebase scope
42 page routes · 144 API routes · 57 React components · 161 web library modules · 113 unit-test files · 4 browser-test specs
Review method
Source inspection, route and flow mapping, component/design-system analysis, logic checks, accessibility heuristics, test/CI review and concrete code evidence
Important limitation
The uploaded archive did not include installed dependencies or an environment database, so this audit does not claim a live-browser visual or production-data verification. Findings marked ‘confirmed’ are directly evidenced in source; visual recommendations are source-informed.
VERDICT  ONEVYRT is a strong product engine inside an over-complicated cockpit. It already contains unusually deep planning, modelling, acquisition, execution, learning and operational capability. The fastest improvement is not adding more features: it is choosing one canonical journey, removing duplicated homes and names, simplifying the Funnel Studio shell, standardising the design system, and fixing a small set of misleading logic and state signals.
Recommended decision
Keep the underlying capabilities. Redesign the product around one clear outcome journey: Define → Offer → Numbers → Build → Launch → Leads → Improve. Treat Psychology / Numbers / Execution as supporting categories, not the main way a new user must understand the product. Make one dashboard the real home, one checklist the real onboarding path, and one save model the truth.
Top ten actions
Choose one signed-in home. Merge the root Studio home and /command-center into a single canonical dashboard.
Rename the two funnel concepts so users cannot confuse the visual financial model with the public lead-qualification funnel.
Replace the current multi-layer navigation with one persistent product shell and a contextual sub-navigation.
Make the guided journey the only onboarding source of truth; remove or merge the second library checklist and tour prompts.
Separate save state from simulation state; never show ‘Saved’ because the calculation happened to succeed.
Correct the qualification funnel’s maximum-score calculation and validate unreachable thresholds.
Rebuild the Studio header into one calm toolbar with progressive disclosure and a single primary action.
Create and enforce shared Button, Field, Card, PageShell, EmptyState, Status, Modal and Toast components.
Design a real mobile Studio: canvas full-screen, block library and inspector as drawers, not three squeezed columns.
Put browser, mobile and accessibility tests into CI and test the canonical journey end to end.
1. Audit scorecard
Area
Score
Assessment
Core product value
8/10
The engine is differentiated: modelling, actual-vs-plan, decisions, risks, goals, tracking, qualification, campaigns and learning.
Feature completeness
9/10
Very broad capability and substantial real backend support.
Information architecture
4/10
Multiple homes, overlapping ‘OS’ products, two funnel builders and several competing journeys.
New-user flow
5/10
Good guidance exists, but it is split across Your Plan, Launch Studio, Studio Home, onboarding checklist and guided tour.
Core Studio usability
5/10
Powerful but crowded; too many modes, bars, menus, layers and side panels are visible together.
Visual presentation
6/10
Modern tokens and polish exist, but page-local CSS, hard-coded colours and emojis fragment the visual language.
Design-system consistency
4/10
A shared design system exists, yet at least 28 page-local .btn definitions and 1,998+ inline style objects undermine it.
Mobile readiness
3/10
Most content pages adapt, but the core canvas remains a squeezed desktop three-pane workspace.
Accessibility
4/10
Focus styling and skip links are good; public forms, custom clickable divs, icon controls and canvas interactions need semantic work.
Reliability and recovery
7/10
Autosave, drafts, history, soft-delete bins, account sessions and backups are strong; visible save feedback is misleading and many errors are swallowed.
Security and trust
8/10
2FA, session revocation, workspace scoping, server re-scoring, encrypted AI keys, audit logs and typed destructive confirmations are strong foundations.
Maintainability
4/10
The 4,854-line Studio component, 774 inline styles in one file and legacy Gearbox naming create a high change cost.
QA coverage
6/10
113 unit-test files are a major strength, but only four browser specs exist, E2E is not in CI, and coverage is desktop Chromium only.
2. What is already strong
The product has a real operating loop. Plan, actuals, variance, calibration, simulation, decisions and reports are not decorative screens; they are connected domain logic. That is more defensible than a generic dashboard.
The system uses real signals. Journey completion, acquisition milestones, programme progress, readiness, tracking health and experiment state are derived from saved or measured data rather than manually ticked vanity progress.
Recovery is unusually thoughtful. Local draft recovery, cloud autosave, revision history, soft-delete bins and 30-day restore paths reduce fear and support experimentation.
Tenant and security architecture is mature. Workspace scoping, roles, session management, 2FA, lockouts, rate limiting, server-side verification and audit records are visible throughout the source.
The acquisition loop is coherent. A published qualification funnel can score, capture, verify, book, attribute, feed a leads inbox, segment contacts and send broadcasts.
The app includes honest empty and partial states. Many screens distinguish untouched, loading, incomplete and genuinely computed states. The Numbers viability guard is a good example.
The project has meaningful automated tests. The breadth of unit coverage across scoring, storage, billing, security, acquisition and business logic is a major asset.
The design has useful foundations. Theme tokens, shared AppNav, keyboard focus rings, reduced-motion support, skeletons, reusable modals and plain-English helper layers are all good directions.
3. The central product problem: five competing mental models
A new user is asked to understand several different structures at the same time. Each structure makes sense alone, but together they compete for the role of ‘how ONEVYRT works’. This is the principal reason the product can feel larger and harder than it needs to.
Current model
What it says
Problem created
Start / Run / Improve
Three Studio sections
Does not map directly to the three global pillars or the 6-stage launch journey.
Plan / Build / Launch / Convert / Measure / Grow
Launch Studio stages
A second end-to-end journey with different names and counts.
Psychology / Numbers / Execution
Global pillars
Useful categorisation, but abstract for a novice trying to complete a concrete task.
Reality / Drivers / Constraint / Execution / Launch / Review
Business OS workflow
A third operating loop, partly nested inside Numbers despite containing execution and launch.
Plan / Actual / Review / Simulate / Decide
Studio reality loop
Power-user model that becomes another top-level navigation language.
RECOMMENDATION  Use one public product journey everywhere: Define → Offer → Numbers → Build → Launch → Leads → Improve. Keep specialist loops inside their tools. A user should never need to know which ‘OS’ owns a task before they can do it.
4. Proposed information architecture
Primary navigation
Nav item
Purpose
Contains
Home
What matters now
One next action, business health, current funnel/campaign, alerts, recent activity
Plan
Define what and why
Message, offer, positioning, economics, reality, drivers, constraint
Build
Create customer-facing assets
Live funnels, Funnel Model, pages, brand, creative
Reach
Bring people in
Campaigns, audiences, content, outreach, connections
Leads
Convert and follow up
Lead inbox, verification, booking, broadcasts, attribution
Improve
Measure and decide
Insights, actual-vs-plan, experiments, risks, decisions, review
Learning Programme, Community, Settings and Admin should sit in the account/help area, not compete with the work navigation. Psychology / Numbers / Execution can remain as explanatory labels on hub cards or programme lessons, but should not be the only way to find work.
The hierarchy the product needs
The desired experience is not another dashboard or another horizontal tab bar. It is progressive disclosure through a stable tree: open ONEVYRT, understand the major branches, open one branch, understand its children, then open a task. Each level explains what it contains before asking the user to act. The location, parent and next step remain visible at all times.
Level 1 branch
Level 2 sections
Level 3 examples
Foundation
Message · Customer · Offer · Brand
One-liner, pains, positioning, objections, proof, assets
Check the business
Costs · Pricing · Funnel Model · Targets
Break-even, conversion assumptions, scenarios, constraint
Launch
Lead Funnel · Campaigns · Outreach · Tracking
Questions, scoring, ads, content, connections, attribution
Sell
Leads · Booking · Follow-up · Audiences
Verification, pipeline, calendar, broadcasts, segments
Improve
Results · Experiments · Decisions · Review
Actual vs plan, risks, learnings, next constraint
Learn
Programme · Glossary · Community
Lessons and explanations that support the work, not a parallel workflow
CORE RULE  Psychology, Numbers and Execution should become explanatory lenses inside the tree—not three destinations that force the user to jump between product languages. A task stays under one stable parent even when its explanation uses another lens.
How opening a branch should work
Home shows one recommended next action plus the six collapsed branches. It does not expose every tool at once.
Opening a branch replaces the centre panel with a short explanation, its outcome, progress and only its immediate children. Other branches stay visible but collapsed.
Opening a child reveals its tasks and examples. A breadcrumb such as Home / Foundation / Offer / Objections and the local tree remain visible.
Completing a task returns to the parent summary, marks the node complete and offers one explicit next recommendation. It never silently transports the user into another subsystem.
Advanced tools, reports and settings remain available under More, but do not appear in the novice path until relevant.
Search can jump directly to a tool, but the destination must still show where that tool lives in the hierarchy.
What the screenshots confirm
The current Home combines Start / Run / Improve, Personal, Guided, Pro, Campaign Studio, Business OS and Admin in the same header before the main next-action card. The hierarchy is being presented as a collection of modes and products.
The Funnel Model adds further stacked layers: Start / Run / Improve; Plan / Actual; Business Intelligence / Model / Saved Scenarios / Goal Solver; then Guided / Pro, metrics and canvas tools. Individually useful controls become an orientation problem when visible simultaneously.
The profile menu mixes member management, account settings and subscription with Campaign Studio, Business OS, Driver Tree, Growth Constraint, Execution Centre, Launch OS and Review. Product navigation should not live inside an account menu.
A second shell uses Home / Psychology / Numbers / Execution / Community. Pages labelled Psychology can send the user back to Business OS, while Business OS itself spans strategy, execution, launch and review. The active top-level label therefore stops describing the user's actual location.
Business OS already demonstrates the right interaction pattern—a numbered, vertical sequence with one Continue here marker. Make that calm hierarchy global, then nest its supporting tools beneath each step.
Brand Brain, Campaigns and Asset Writer are visually cleaner, but feel like separate destinations rather than children of one launch branch. Add the persistent branch tree, breadcrumb and parent summary.
Canonical signed-in home
Make /app or /home the authenticated home. Keep / as the public marketing page and authentication entry.
Merge the useful cards from the embedded Studio Home and /command-center. Redirect the redundant route.
Show one prominent next action, then three supporting areas: performance, attention, recent work.
Move Projects to a persistent sidebar/recent-work switcher instead of a separate conceptual home.
Remember the last workspace and last opened project, but always provide a safe Home escape.
Terminology changes
Current name
Recommended name
Reason
Funnel Studio
Funnel Model
It models economics and flow; it is not the published lead-capture funnel.
Funnel Builder
Lead Funnel Builder
Makes the public qualification and booking outcome explicit.
Program Centre
Business Plan
Avoids collision with the learning Programme.
Programme Centre
Learning Programme
Separates course/coaching from business planning.
Launch Studio / Command Center
Home
The dashboard should not require another branded subsystem name.
Business OS
Strategy
Plain task language is easier to predict and scan.
Acquisition OS
Leads & Campaigns
Describes the work instead of inventing another product layer.
5. Onboarding and first-use flow
The code contains at least five first-use mechanisms: the marketing landing page, auth flow, Studio Home next action, /start dated journey, project-library setup checklist and a five-step canvas tour. The solution is not to improve all five independently; it is to establish one source of truth and let every surface read it.
Recommended first session
Create account: ask only email/password. Do not introduce workspaces, modes or plans yet.
Outcome choice: ‘What are you trying to achieve first?’ — validate an offer, build a lead funnel, improve an existing funnel, or run the full plan.
Business basics: name, what you sell, who it is for, currency and whether the business is already live.
Create a starter workspace and starter plan automatically. Do not make ‘create workspace’ an onboarding task when registration already creates one.
Land on Home with exactly one primary task and a progress drawer that can be opened when wanted.
When entering the Funnel Model for the first time, use a short contextual coachmark; do not launch a tour before intent is clear.
Confirmed onboarding inconsistencies
The /start journey starts with Message, Offer and Numbers, while the project-library checklist starts with workspace, map, KPI, tracking and goals. They measure different definitions of ‘set up’. Merge them.
The setup checklist’s ‘Create your first workspace’ will commonly be complete automatically, which wastes the first progress item.
The clickable setup cards are div elements with mouse handlers, so keyboard users cannot activate them.
Pace changes create deadlines but do not show the actual due date in the list; display both relative and calendar date, and allow pause/reset.
Optional AI is placed early in the dated journey. Keep it visible, but offer it contextually when the user first presses an AI action.
Progress logic improvements
Use milestones based on meaningful outcomes, not field touch alone: message approved, offer price present, economics coherent, funnel published, tracking verified, first lead, first booking.
Allow ‘Not relevant’ for steps such as booking calls when the business sells directly online.
Branch the journey by business model: service/appointment, ecommerce, subscription/SaaS, course/info product and local business.
Show why a step is considered incomplete and which exact field is missing.
Do not penalise a returning user with overdue language when the product has no evidence they committed to the schedule; ask before starting the clock.
6. Home and command centre
Both current homes contain good material. The embedded Studio Home is stronger for project economics and risk; /command-center is stronger for the launch journey and acquisition momentum. Combine them into a single role-aware dashboard.
Keep
Change
One next action with rationale
Never show another competing next-action banner lower on the same page.
Business readiness and real acquisition data
Use outcome labels, not unexplained composite scores without drill-down.
Attention, experiment and recent activity
Collapse empty cards into one setup state instead of a dashboard full of ‘nothing yet’.
Recent projects
Show last edited, owner, saved state and primary action; do not make every card equal weight.
Weekly plan
Make actions checkable or measurable and preserve progress during the week.
7. Funnel Model / Studio audit
CORE UX ISSUE  The Studio simultaneously displays global navigation, Start/Run/Improve, Guided/Pro, a five-step loop, a next-move coach, KPI/tool modes, file/project controls, layers, tracking, comments, tools, workspace controls, block library, canvas and inspector. Each control has a reason, but the combined shell is too cognitively expensive.
Recommended Studio shell
Area
Recommended content
Top app bar
Back/Home · project name · workspace · save status · Share · account
Context bar
Plan / Actual / Improve, with a single compact result summary
Left rail
Blocks and templates; search first; categories collapsible
Canvas
Primary work surface; zoom/fit/minimap; contextual empty state
Right drawer
Selected block details; opens on selection; closed by default on narrow screens
Coach
A dismissible bottom or side drawer, not a permanent full-width bar
Advanced
Risks, constraints, history, comments, API, tracking and export grouped in one More/Tools area
Header and button changes
Remove the gradient Campaign Studio and Business OS buttons from the Studio header; they compete with the current work. Put them in global navigation.
Move Guided/Pro to preferences. A persistent toggle suggests the interface may change unpredictably while working.
Replace icon-only emoji buttons with the shared icon system and accessible labels. Use tooltips as help, never as the only label.
Show one prominent action: Share or Publish. Saving should be automatic and informational, not a primary button.
Consolidate Save local, Save to library, autosave and revision snapshots. Recommended model: cloud autosave by default; named checkpoints in History; Export JSON under More; browser-only recovery hidden from normal users.
Reduce seven inspector tabs to Basics, Numbers and Advanced. Show tabs only when their content applies to the selected block and current mode.
Confirmed save-state defect
The visible Studio label renders ‘✓ Saved’ whenever the simulation result is valid, and ‘⚠ Error’ when the simulation fails. The actual autosave message is placed only in the title tooltip. This couples two unrelated states: a user can see ‘Saved’ after an autosave failure, or ‘Error’ because of modelling validation when persistence is fine. Source: apps/web/app/funnel-studio.tsx lines 3485–3488.
FIX  Maintain explicit persistence states: idle, dirty, saving, saved(at), offline, failed(retry). Display model errors separately beside the model/validation controls. Never infer persistence from sim.ok.
Canvas interactions
Clicking a block should open the inspector and keep the block centred/visible. Escape closes the inspector; Enter edits the label; Delete uses undoable history.
Add a quick-add connector: drag from a handle to empty space and choose the next block type.
Explain connection direction and invalid connections inline. Avoid silent no-op drops.
Add canvas validation badges for orphaned steps, cycles, unreachable offers, missing traffic and impossible conversions.
Provide a clear difference between decorative annotations and simulated nodes.
Add Find on canvas and an outline/list view for large models.
Persist panel open state per device, but offer Reset layout.
Use a non-canvas table/list editor on mobile and for accessibility; canvas should not be the only way to edit the model.
Mobile Studio
The code itself describes the Studio as a desktop-first three-pane layout and only narrows the fixed side panels at 820px and 560px. That cannot produce a good phone experience; it leaves as little as 150px for the block library while the inspector can consume 80vw. Source: apps/web/lib/studio/theme-css.ts lines 70–82.
Phone: full-screen canvas; bottom toolbar; Blocks and Inspector open as modal sheets; KPI summary collapses to one row.
Tablet: canvas plus one docked panel at a time; never both side panels simultaneously.
Add touch-sized 44px controls, long-press context menu and clear handle hit areas.
Provide a structured list mode for editing rates and prices without precise dragging.
8. Lead Funnel Builder and public qualification flow
Confirmed scoring defect
The displayed maximum score adds every positive option’s points for every question. For a single-choice question, only the highest scoring option can be selected; summing all options inflates the maximum. In the starter funnel, the interface can therefore show a maximum much higher than any visitor can obtain. This distorts the score bar and makes threshold setting unreliable. Source: apps/web/app/business/funnels/page.tsx lines 33–36.
FIX  For single-choice questions add max(positive option points); for multi-choice add the sum of positive options; for non-scored question types add zero. Move this calculation into the shared qualification domain module and unit-test it.
Confirmed validation gap
Funnel validation checks that qualified ≥ nurture, but it does not reject negative thresholds, thresholds above the attainable maximum, non-finite values, or a qualified range with zero width. A funnel can save successfully even when nobody can ever qualify. Source: apps/web/lib/studio/funnel-builder.ts lines 111–118.
Validate 0 ≤ nurture ≤ qualified ≤ attainable maximum and reject NaN/Infinity.
Show an interactive score simulator with 3–5 example answer combinations and their outcome.
Warn when a hard disqualifier conflicts with a high-scoring option.
Show estimated outcome distribution after real traffic exists; suggest threshold changes but never apply them automatically.
Add Draft / Published states. Current save posts published:true, so ‘Save’ and ‘Publish’ are not meaningfully separate.
Add preview modes: mobile, desktop, qualified, nurture, unqualified, verification, booking and payment.
Give every funnel a publish checklist: contact destination, CTA links, calendar availability, verification provider, tracking, privacy text and test submission.
Public visitor flow
Make question choices a semantic radio group or checkbox group with aria-checked, keyboard navigation and a visible selected indicator.
Use persistent labels for name, email, phone and code. Placeholders disappear and are not sufficient labels.
Expose the progress bar with role=progressbar and accessible current/maximum values.
Announce validation errors, verification responses, booking conflicts and successful completion with aria-live.
Do not force name + email a second time at booking if already collected; the current fields are prefilled, but make the relationship explicit and allow correction once.
Show the actual timezone name and UTC offset, not ‘the team’s local time’. This is essential for remote leads.
When no slots exist, present a fallback form/CTA rather than only promising ‘we’ll reach out’. Record the intent explicitly.
Add consent text and links immediately beside contact submission, including channel-specific consent when SMS follow-up is enabled.
Preserve answers if the page refreshes or verification must be retried, with a privacy-safe session expiry.
9. Business planning, Psychology, Numbers and Execution
Message and Offer
Excellent choice for the start of the journey. Add a clear ‘Done for now’ state and version history; do not require a perfect score before progress.
Keep AI drafting optional and show exactly what source fields it uses.
Unify Offer and Positioning visually if they remain on one page, but keep two completion badges because the journey treats them separately.
Numbers
Keep the honest incomplete-state guard. Extend it to show units, period and currency beside every figure.
Replace generic score emphasis with contribution margin, break-even units and the one variable with greatest sensitivity.
Add data provenance: manual, imported, tracked, Stripe, estimate.
Business strategy
The Reality → Drivers → Constraint → Execution → Launch → Review loop is coherent for advanced users. Present it as a Strategy workspace, not a second product home.
Carry the chosen constraint automatically into execution focus and review; show that link visibly.
Avoid repeated local ‘Home / Overview / Driver / Constraint / Execution / Review’ button rows because the global shell should own navigation.
Execution
Add owners, due dates, status and definition of done consistently, then provide filters for My tasks, This week, Blocked and Done.
Confirm removal of goals, sprints and tasks or make every removal undoable.
Connect tasks to the active constraint, launch and experiment so work is traceable to an outcome.
10. Leads, audiences, campaigns and community
Leads
Add lifecycle status: New, Contacted, Qualified, Booked, Won, Lost, Nurture, Unsubscribed.
Provide owner/assignee, next action and due date. A leads inbox without follow-up state becomes a reporting list rather than a working inbox.
Deduplicate by normalised email/phone while preserving separate submissions and attribution history.
Show answer summary, source, verification, funnel, score reason and activity timeline in one lead drawer.
Add bulk assign, bulk status, export and safe deletion; keep consent/suppression state visible.
Audiences and campaigns
Separate audience definition from message composition. Show estimated reachable count, excluded/suppressed count and missing-channel count before composing.
Add a mandatory review step before send: audience, channel, sender, schedule, test send, links, opt-out and estimated cost.
Replace ‘Send to N’ as the only safeguard with a summary confirmation and typed confirmation for unusually large sends.
Show delivery state honestly: recorded, queued, sent, delivered, bounced, failed and provider not configured.
Provide campaign duplication, scheduling, cancellation window and post-send performance summary.
Community
Require a preview, category, description and confirmation before publishing a funnel template publicly.
Strip personal identifiers, tracking IDs, webhook URLs and private notes when creating a shared template.
Add report/flag, moderation status, version, compatibility and clear ‘what will be copied’ messaging.
Use credible proof such as verified uses and author profile, but avoid popularity counts when the gallery is small.
11. Learning Programme, account, billing and admin
Learning Programme
Present learning as a separate destination with curriculum, progress, submissions and coach feedback. Do not open a very large modal over the Studio.
Deep-link lessons to the exact field/tool and return the learner to the lesson with completion captured.
Use one spelling and one label throughout: ‘Learning Programme’ for user-facing UK English; reserve ‘program’ for code only if needed.
Show locked-stage reasons and next unlock criteria before the learner clicks.
Account and billing
Keep profile, security, workspace and billing in a full settings area rather than stacking large modals over a complex canvas.
Show current plan, renewal date, usage, included limits and what happens after cancellation in one place.
Use one currency strategy. The marketing page mixes dollar language with £79/£149 plans and supports many model currencies; localise or clearly state billing currency.
Make export and account deletion progress durable and email a completion link for large exports.
Admin
Replace native alert/confirm/prompt calls with the shared modal/toast system for consistency, accessibility and auditability.
Require typed confirmation and server-side re-authentication for permanent user/workspace deletion and ownership transfer.
Add search, filters, pagination and clear empty/error states as data grows.
Keep impersonation visibly persistent across every route, not only the Studio shell.
12. Design system and presentation
The codebase contains a shared design-system.css and reusable primitives, but most pages still embed their own CSS strings and redefine .btn. The visual result can look related without behaving as one system. This also makes global improvement slow and risky.
Design-system priorities
Create one AppShell and PageShell with fixed content widths, page padding, heading blocks, breadcrumbs and responsive rules.
Adopt shared Button variants: primary, secondary, ghost, danger, icon; sizes 32/40/44; consistent loading, disabled and focus states.
Adopt shared Field components with visible label, hint, error, required/optional, unit prefix/suffix and semantic IDs.
Adopt shared Card, EmptyState, Banner, Badge, Score, Tabs, Drawer, Modal and DataTable patterns.
Replace hard-coded semantic colours with tokens: success, warning, critical, info, muted, focus and on-accent.
Replace emojis used as product icons with the existing MarketingIcon system or one coherent icon library. Keep emoji only for deliberate celebration/tone.
Standardise typography: page title 28–32, section 20–24, card 15–17, body 14–16, metadata no smaller than 12 with sufficient contrast.
Reduce glass/blur on dense working screens; reserve it for overlays and marketing surfaces. Dense tools benefit from crisp, stable surfaces.
Evidence of visual fragmentation
At least 28 pages define their own .btn rule, often with slightly different radius, padding, weight and border.
The Studio alone contains approximately 774 inline style objects; ProgramCentre contains approximately 437.
Hard-coded status colours are repeated hundreds of times, making contrast and dark-theme corrections inconsistent.
The inspected React surfaces contain roughly 710 emoji/symbol glyph occurrences used in labels or controls.
Legacy Gearbox naming remains in package names, storage keys, emails and internal text, increasing migration and brand-consistency risk.
Button hierarchy rules
Rule
Application
One primary per region
A screen or modal gets one dominant next action. Additional actions are secondary or in More.
Verb + object
Use ‘Save message’, ‘Publish funnel’, ‘Send test’, ‘Delete project’; avoid vague ‘Continue’ where context can be lost.
State in the button
Loading text and spinner, disabled reason, success confirmation outside the button.
Icon discipline
Icons support a visible label; icon-only controls require an accessible name and tooltip.
Danger discipline
Danger colour only for destructive actions; irreversible actions require typed confirmation and consequence text.
Touch target
Minimum 44×44 on mobile/public flows and 40×40 in dense desktop tools.
13. Accessibility
CONTRAST  The light-theme --dim colour #8E8E93 on white has an approximate contrast ratio of 3.26:1. It is widely used at 10.5–13px, which is below the 4.5:1 requirement for normal text. The green #0A9E6E on white is approximately 3.43:1 and should not be used for small text. Use #087F57 or a darker token for text.
Run axe-core and keyboard tests on every public and authenticated primary flow.
Convert clickable divs to buttons/links; add keyboard equivalents for resizing, drag/drop, reordering and canvas selection.
Associate every input with a visible label and programmatic description/error.
Add aria-live to save status, toasts, validation errors, AI completion, booking and send results.
Use aria-pressed/aria-selected for toggle buttons and tabs; use fieldset/legend for option groups.
Ensure modals trap focus, restore focus, close on Escape and have labelled title/description.
Add a non-visual table/list representation for funnel graphs and charts.
Do not encode state by colour alone; retain text/icon/state labels.
Test at 200% zoom and with Windows high-contrast mode, VoiceOver/NVDA and reduced motion.
14. Logic, state and reliability
Finding
Severity
Recommendation
Visible ‘Saved’ state is derived from simulation success
Critical
Separate persistence and model state machines.
Maximum qualification score is inflated for single-choice questions
High
Correct shared calculation and add unit tests.
Threshold validation allows unattainable configurations
High
Validate against attainable max and finite non-negative values.
Root route serves marketing, auth, dashboard and Studio
High
Separate public / from authenticated /app or /home.
Two dashboard implementations
High
Merge and redirect.
255 client fetch calls but only two AbortController usages
Medium
Create a shared query/mutation layer with cancellation, retry and stale-response protection.
Approximately 243 best-effort/empty catches in React surfaces
Medium
Classify errors: user-visible, retryable, telemetry-only, or intentionally ignored.
Many removals are immediate and inconsistent
Medium
Undo or confirm; standardise by consequence.
Local and server state coexist under legacy keys
Medium
Define source-of-truth and migration/version policy for client storage.
Published/draft semantics vary by feature
Medium
Use a shared lifecycle model and status vocabulary.
State architecture recommendations
Use a shared request layer that exposes loading, empty, error, stale, retry and offline states consistently.
Add optimistic updates only where rollback is implemented and visible.
Version all persisted document schemas and provide explicit migrations for local and server documents.
Track dirty state at the document level and block accidental navigation only when unsaved server persistence genuinely exists.
Keep network errors visible until resolved; a transient toast alone is insufficient for failed saves or sends.
Make idempotency keys standard for sends, bookings, payments, imports and AI-apply operations.
15. Performance and maintainability
Split the 4,854-line funnel-studio.tsx into a Studio route shell plus focused state hooks and panels. The current file owns hundreds of state values and concerns.
Move inline style objects to typed tokens/components so React does less object recreation and product-wide changes are possible.
Lazy-load heavy Studio-only dependencies such as React Flow, jsPDF/reporting, programme and AI panels after the relevant route/action.
Separate public marketing/auth bundles from the authenticated Studio bundle. The root route currently owns all three experiences.
Add server-side pagination/virtualisation for leads, activity, projects, community and admin tables before data volume grows.
Measure Web Vitals, route bundle size, API p95 latency, database pool saturation and client error rate by release.
Remove or migrate legacy Gearbox brand keys deliberately; do not rename storage keys without a compatibility migration.
16. Testing and release quality
Run the four Playwright specs in CI. The current CI runs engine tests, typecheck and web unit tests, but not test:e2e.
Add mobile Chromium and WebKit projects for public funnels, auth, Home, Message, Offer, Funnel Builder, leads and core Studio smoke.
Add an automated accessibility suite with axe and keyboard tab-order assertions.
Add visual regression snapshots for AppNav, Home, forms, public funnel states and Studio at 1440, 1024, 768 and 390 widths.
Add tests for corrected max score, impossible thresholds, save failure, offline recovery, duplicate send, booking conflict and stale response ordering.
Use a dedicated isolated CI database or per-run schema instead of a shared long-lived test database as concurrency grows.
Gate production deploys on browser smoke for registration → message → offer → live funnel → test lead → booking → inbox.
17. Prioritised implementation roadmap
Phase
Goal
Work
Exit criteria
0 · Immediate1–3 days
Remove misleading behaviour
Fix save-state label; fix max score; validate thresholds; add regression tests; correct any stale E2E copy selectors.
No false ‘Saved’; impossible funnels cannot publish; tests prove both.
1 · Clarity1–2 weeks
One product map
Choose canonical Home; separate public/auth/app routes; rename funnel concepts; merge onboarding truth; simplify global nav labels.
A new user can describe where to start and distinguish both funnel tools in usability testing.
2 · Studio shell2–4 weeks
Reduce cockpit overload
New top bar; contextual mode bar; coach drawer; consolidated save/history/export; inspector grouping; shared icon buttons.
Core create/edit/save/share tasks complete without opening more than one overflow menu.
3 · Design system3–6 weeks
Consistent presentation
Shared Button/Field/Card/PageShell/EmptyState/Status/Modal/DataTable; migrate high-traffic routes first.
No page-local .btn in migrated routes; contrast and interaction states pass audit.
4 · Mobile & a11y4–8 weeks
Reach more users
Studio drawers/list view; public funnel semantics; keyboard/ARIA; responsive and visual tests.
Primary journey works at 390px and keyboard-only; axe has no serious/critical issues.
5 · Operational depth6–12 weeks
Make acquisition actionable
Lead lifecycle, assignment, follow-up tasks, send review, consent, campaign analytics, experimentation links.
Teams can operate leads and campaigns daily without external spreadsheets.
18. Detailed backlog
Priority
Area
Backlog item
P0
Save truth
Create a persistence state machine and separate model validity.
P0
Scoring
Correct attainable maximum for single vs multi questions.
P0
Validation
Block negative, non-finite and unreachable thresholds.
P1
Routing
Make / public only and create canonical authenticated Home.
P1
IA
Merge /command-center and embedded Studio Home.
P1
Naming
Rename Funnel Studio and Funnel Builder to distinct outcome names.
P1
Onboarding
Use /start journey as the single progress source; merge library checklist.
P1
Navigation
Replace OS/pillar ambiguity with task-oriented primary nav.
P1
Studio
Reduce header to app bar + context bar.
P1
Studio
Move coach to dismissible drawer and Tools to one menu.
P1
Saving
Default to cloud autosave; rename manual save to Create checkpoint.
P1
Publishing
Separate Draft, Preview and Publish for live funnels.
P1
Public funnel
Add labels, semantic options, accessible progress and live errors.
P1
Timezone
Display booking timezone name/offset and visitor conversion.
P1
Testing
Run browser smoke in CI.
P2
Design system
Migrate shared buttons, fields, cards and page shells.
P2
Icons
Replace interface emojis with coherent vector icons.
P2
Contrast
Darken small muted/accent text tokens.
P2
Mobile
Use drawers for Studio panels and add structured list editor.
P2
Inspector
Group seven tabs into Basics, Numbers, Advanced.
P2
Canvas
Add outline/search and validation issue navigator.
P2
Leads
Add lifecycle, assignment, next action and deduped identity.
P2
Campaigns
Add review/test/schedule/cancel states and delivery status.
P2
Community
Sanitise shared templates and add moderation/reporting.
P2
Settings
Move account/billing/programme out of large Studio modals.
P2
Admin
Replace native dialogs and add filters/pagination.
P2
Data
Show provenance on every important metric.
P2
Errors
Replace empty catches with classified feedback/telemetry.
P2
Network
Add request cancellation and stale-response protection.
P3
Personalisation
Branch the guided journey by business model.
P3
Experiments
Link experiments to funnel nodes, campaigns and decisions.
P3
Analytics
Instrument activation, time-to-value and funnel drop-off.
P3
Performance
Lazy-load Studio, PDF and programme surfaces.
P3
Migration
Plan legacy Gearbox naming/storage migration.
19. Acceptance criteria for the redesign
A first-time user can reach the first meaningful saved output in under five minutes without choosing between multiple homes or OS products.
Five out of five test users can explain the difference between the Funnel Model and Lead Funnel Builder after seeing the navigation once.
Every page has one clear primary action and no more than one persistent global navigation system.
A failed autosave is visible within one second, remains visible, offers retry and never displays ‘Saved’.
A qualification funnel with unreachable thresholds cannot be published.
The public funnel, booking and verification flow pass keyboard-only and screen-reader smoke tests.
The primary product journey works at 390px, 768px, 1024px and 1440px without horizontal page overflow.
No serious or critical automated accessibility violations on the canonical journey.
Browser smoke runs on every production deploy and covers account creation through first captured lead.
At least 80% of high-traffic pages use shared Button, Field, Card and PageShell components before adding new visual features.
20. Product metrics to watch
Metric
Why it matters
Suggested definition
Activation
Measures first real value
Message saved + viable economics + one funnel published within 7 days
Time to first value
Measures onboarding friction
Registration to first saved/published useful output
Journey completion
Finds step drop-off
Completion rate and median time for each canonical step
Funnel launch quality
Prevents dead launches
% published with contact, CTA, timezone, tracking and test submission verified
Lead response time
Directly affects conversion
Median first action after a new lead
Booked-call rate
Measures acquisition effectiveness
Bookings / qualified leads by funnel and source
Save failure rate
Measures trust
Failed persistence attempts / attempted saves, by route and release
Recovery success
Measures resilience
% draft/version restores completed successfully
Mobile task success
Measures real usability
Completion of the top five tasks at ≤480px
Support search terms
Reveals language mismatch
Command palette/glossary searches with no result or repeated reformulation
21. Source evidence appendix
Evidence
Location / observation
Scope
42 page routes under apps/web/app; 144 API route handlers; 113 unit test files; four Playwright specs.
Two homes
apps/web/app/funnel-studio.tsx view='home' and apps/web/app/command-center/page.tsx.
Global IA
apps/web/components/AppNav.tsx lines 30–35 maps Home, Psychology, Numbers, Execution and Community.
Guided journey
apps/web/lib/studio/journey.ts lines 54–63 defines nine steps from Message to first booking.
Second onboarding
apps/web/lib/onboarding.ts defines workspace, map, KPI, tracking and goal steps.
Overloaded Studio header
apps/web/app/funnel-studio.tsx lines 2710 onward and 3310 onward contain multiple navigation/control bands.
Save defect
apps/web/app/funnel-studio.tsx lines 3485–3488 renders Saved/Error from sim.ok.
Score defect
apps/web/app/business/funnels/page.tsx lines 33–36 sums all positive options.
Threshold gap
apps/web/lib/studio/funnel-builder.ts lines 111–118 validates ordering but not attainable range.
Mobile limitation
apps/web/lib/studio/theme-css.ts lines 70–82 documents desktop-first panes and applies width trims only.
Keyboard issue
apps/web/components/OnboardingChecklist.tsx lines 31–34 uses clickable divs with mouse hover handlers.
Public form labels
apps/web/components/qualify/QualificationWizard.tsx uses placeholder-only name/email/phone inputs and button-based answer choices.
Design fragmentation
Page-local CSS contains at least 28 .btn definitions; funnel-studio.tsx contains about 774 inline style objects.
Error handling
Static scan found about 255 client fetch calls, two AbortController occurrences and about 243 empty/best-effort catch blocks across app/components.
E2E release gap
.github/workflows/ci.yml does not call pnpm --filter web test:e2e; apps/web/playwright.config.ts defines desktop Chromium only.
Final assessment
ONEVYRT should not be simplified by deleting its differentiating engine. It should be simplified by controlling when and how capability appears. The product already has enough depth for a serious operating platform; the next design phase should make that depth feel calm, progressive and trustworthy. If the team implements only the first two roadmap phases, the app will feel materially smaller, faster and easier without losing any core power.
Master proposal for improving ONEVYRT
My proposal is a controlled product and UX restructure, not a rebuild.
The engine, calculations, funnels, reports, persistence, schemas, APIs and existing features should remain. We should reorganise how users enter, navigate and understand the product.
The customer-facing product should be ONEVYRT. The simulation engine can remain internally named GEAR 2.0.
1. Non-negotiable rules
Before changing screens, establish these rules:
Preserve the deterministic GEAR 2.0 engine.
Preserve every existing calculation and report.
Preserve project JSON compatibility.
Preserve database records and API contracts.
Preserve existing canvas functionality:
Click to add blocks.
Exact-position drag and drop.
Two-column block library.
Search and category filters.
Connecting nodes and edge insertion.
Multi-selection.
Duplicate and copy/paste.
Delete.
Locking and grouping.
Auto-layout.
20×20 snapping.
PNG, JSON, CSV and PDF exports.
Preserve Guided and Pro modes, but simplify how they are presented.
Preserve the approved simplified platform glyphs; do not replace them with copied official logos or inconsistent emoji.
Keep the light, Google-style direction:
Thin typography.
Smaller headings.
Compact desktop controls.
Dense but readable content.
Narrower content panels.
Light canvas.
Subtle borders.
Mobile can use larger touch targets without making desktop oversized.
Do not add another major feature until the first-user flow is trustworthy.
2. Establish one product structure
ONEVYRT currently presents several overlapping products:
Launch Studio
Business OS
Acquisition OS
Funnel Studio
Campaign Studio
Growth Program
Command Centre
These should become areas inside one product, not competing product identities.
Proposed structure
Public area
ONEVYRT landing page
Sign in
Create account
Pricing
Public qualification funnels
Privacy and terms
Signed-in application
Home
Psychology
Numbers
Execution
Community
Specialist workspace
Funnel Studio
Account tools
Workspace
Subscription
Profile
AI connections
Notifications
Help
Admin, when authorised
Recommended global navigation
ONEVYRT | Home | Psychology | Numbers | Execution | Community | Search | Workspace | Account
Every private page should use this navigation, including:
Your Plan
Brand Brain
Campaigns
Business Reality
Funnel Builder
Leads
Start plan
Insights
The Funnel Studio can use a reduced full-screen version, but it should still provide an obvious route back to Home and retain the same workspace identity.
3. Create one Home
There are currently two separate Home experiences:
The authenticated / Studio dashboard.
/command-center.
Proposal
Make /command-center the only Home.
When an authenticated user visits /, redirect them to /command-center.
Move the Studio itself to a dedicated route such as:
/studio
The ONEVYRT logo should always return to Home, not unexpectedly enter the Studio.
New Home layout
Section 1: Page heading
Greeting.
Workspace name.
Short status sentence.
Studio button as a secondary action.
Example:
Good afternoon, CristianHere is where your business stands and the one thing to do next.
Section 2: One next move
One large, authoritative next-action card.
Example:
Write your MessageCreate the one sentence that everything else will use.
Button:
Continue with Message
Do not show the same action elsewhere on the first screen.
Section 3: Three business pillars
Show compact summaries:
Psychology score
Numbers readiness
Execution progress
Each card should show:
Current state.
Biggest gap.
One link.
Section 4: Real business results
Only show this when real information exists:
Leads
Qualified leads
Calls booked
Revenue
Cost per qualified lead
Actual profit
If no real data exists, show:
No live results yet. Publish your first funnel to begin measuring.
Never substitute demonstration data here.
Section 5: Recent activity
Show only meaningful events:
Funnel published.
Lead received.
Campaign sent.
Actual numbers entered.
Decision recorded.
Project updated.
Section 6: Full plan
The full journey can be collapsed under:
View your complete plan
Do not permanently display the entire long journey on Home.
Remove from Home
Repeated “Write your Message” cards.
Separate welcome box after onboarding.
Duplicate progress systems.
Eleven “Jump Anywhere” cards.
Empty metric boxes without meaning.
Separate Launch Studio naming.
The command palette already provides fast access to every tool.
4. Use one lifecycle
The application currently exposes too many processes:
Psychology → Numbers → Execution
Start → Run → Improve
Plan → Actual → Review → Test a Fix → Decide
Message → Plan → Build → Launch → Convert → Measure → Grow
A separate nine-step sales plan
Proposal
Use two concepts only:
Functional navigation
Psychology
Numbers
Execution
These answer:
What part of the business am I working on?
Reality Loop
Plan
Actual
Review
Test a Fix
Decide
This answers:
What stage of improvement am I in?
Remove the persistent Start / Run / Improve navigation from the Studio. It adds another layer without providing a distinct function.
Recommended journey
Define the business.
Write the Message.
Build the Offer.
Check Presentation.
Check the Numbers.
Build and publish the Funnel.
Get the first Lead.
Book the first Call.
Enter Actual results.
Review the difference.
Test a fix.
Record the decision.
“Connect AI” remains optional and should never block progress.
5. Repair the new-account experience
This is the most urgent product change.
Current problem
A new empty workspace immediately shows sample funnel values and tells the user to enter actual results.
Proposed first-use state
When there are no projects
Show:
Create your first business plan
Offer four clear choices:
Guided Setup — recommended.
Start from a playbook.
Start from a blank map.
Explore the read-only demo.
Do not show profit, revenue, visitors or Actual-stage instructions.
Guided Setup
Keep the existing three-step modal because it is good.
Improve it as follows:
Step 1: The business
Required:
Business name.
Who do you serve?
What do they buy?
The Next button should remain disabled until the required fields contain meaningful text.
Step 2: Starting model
Cards:
High-Ticket Service
E-commerce
Webinar
Lead Generation
Recurring Membership
Generic Starter Funnel
Make it visually obvious that every card is clickable.
Replace “Golden funnel” with a plain explanation:
Generic Starter FunnelTraffic → Landing page → Main offer
Step 3: Review
Show what ONEVYRT will create:
Business definition.
Starter funnel.
Initial action plan.
Recommended first task.
Button:
Create my business plan
After creation
Land on:
Step 1: Review your business definition
Do not land on:
Step 2: Enter actual numbers
Example data policy
There must be a strict distinction between:
Real workspace.
Template values.
Demonstration project.
If template assumptions are loaded, show a persistent banner:
Example assumptions — replace these with your numbers.
Provide:
Replace example values
Once the user changes a value, mark it as user-entered.
Never display example results as if they belong to the business.
6. Correct scoring behaviour
Offer Strength
An empty offer currently starts at 23.
Change states to:
No meaningful fields: “Not started,” no numerical score.
First meaningful field: start scoring.
Incomplete: 1–49.
Developing: 50–79.
Strong: 80–100.
An empty form should not appear 23% complete.
Positioning score
Likewise, an empty positioning section should show:
Not started
It should not show 62 or another inflated score.
Readiness scores
Each score needs:
What it measures.
Why the score changed.
What action improves it.
Whether it uses real or example data.
Score colours
Use:
Grey: not started.
Blue: in progress/informational.
Amber: needs attention.
Green: ready or healthy.
Red: only for an actual problem.
Do not use red simply because a user has not begun.
7. Rebuild the Studio header
The Studio is powerful, but its header contains too many competing controls.
Proposed Studio header
Row 1: Product and project context
Left:
Back to Home.
ONEVYRT.
Studio.
Centre:
Project name.
Workspace.
Right:
Saved status.
Share.
Account menu.
Row 2: Reality Loop
Plan
Actual
Review
Test a Fix
Decide
The active stage should be unmistakable.
Advanced tools can sit behind:
More tools
Containing:
Business Intelligence
Model
Saved Scenarios
Goal Solver
Reports
Tracking
Integrations
Row 3: Contextual actions
Only show actions relevant to the current mode.
For example, Plan mode:
Add block.
Fit view.
Tidy layout.
Undo.
Redo.
More.
Actual mode:
Date period.
Import actuals.
Enter results.
Do not show every possible tool simultaneously.
8. Improve the Studio canvas
Block Library
Preserve the existing two-column library.
Improve:
Keep two equal columns.
Restore consistent 20×20 grid snapping.
Add clearer selected category styling.
Keep search at the top.
Add Recently Used.
Add Favourites later only if genuinely useful.
Use platform glyphs consistently.
Show concise tooltips.
Do not use tiny emoji.
Make each block keyboard focusable.
Announce the block name and type to screen readers.
Canvas states
Empty canvas
Show three choices in the canvas:
Add the first block.
Use a template.
Build with Guided Setup.
Existing canvas
The canvas itself should remain the visual focus.
Side panels should not permanently consume most of the width.
Canvas toolbar grouping
View
Fit all.
Zoom to selection.
Reset view.
Arrange
Tidy layout.
Snap on/off.
Align.
Distribute.
Group/ungroup.
Lock/unlock.
Add
Email sequence.
Sticky note.
Text label.
New block.
Edit
Duplicate.
Copy.
Paste.
Delete.
Advanced
Export.
Tracking.
Webhooks.
API.
Integrations.
Inspector
Keep the right inspector, but:
Default width around 320–360px.
Allow resizing.
Remember width.
Close by default on small screens.
Use tabs only when necessary.
Keep Save behaviour automatic.
Do not repeat information already shown on the node.
Node graphics
Use consistent node dimensions.
Keep readable mock page cues.
Reduce decoration that does not communicate status.
Use status colours rather than a different colour for every metric.
Clearly distinguish traffic, page, offer, decision and annotation nodes.
Keep connection handles visible enough to discover without dominating the card.
Saving
Primary model:
Autosaved to workspace · 10 seconds ago
The File menu should contain:
Rename project.
Duplicate project.
Export.
Import.
Project history.
Archive.
Delete.
Move “Save local,” raw JSON and view-only HTML under:
Advanced export
Users should not have to understand several competing save locations.
9. Mobile Studio redesign
The Studio needs an intentional mobile experience.
Mobile top bar
Show:
Back.
Project name.
Save status.
More menu.
Do not wrap the desktop header into three or four rows.
Reality Loop
Use a horizontally scrollable labelled stage row:
Plan
Actual
Review
Test
Decide
The active stage should automatically scroll into view.
Block Library
Open it as a bottom sheet:
Add a block
Inside:
Search.
Categories.
Two-column block grid.
Close handle.
Inspector
Open selected-node settings as a bottom sheet.
Suggested heights:
Collapsed: summary.
Half-screen: common settings.
Full-screen: all settings.
Canvas actions
Use a floating action button:
Tapping opens:
Add block.
Add note.
Add text.
Add sequence.
Touch requirements
At phone widths:
Minimum button height: 44px.
Minimum icon button: 44×44px.
Minimum spacing between destructive actions.
No hidden essential action dependent on hover.
No horizontal document overflow at 320px, 360px or 390px.
10. Global mobile navigation
The current mobile navigation hides labels and clips later tabs.
Recommended solution
Use a bottom navigation:
Home
Psychology
Numbers
Execution
More
Inside More:
Community
Studio
Your Plan
Glossary
Settings
Every item retains a visible text label.
Alternatively, keep the top navigation but show:
Logo.
Current section.
Search.
Menu.
Do not use an invisible horizontally scrolling icon-only tab bar.
11. Psychology improvements
The Psychology hub is one of the best screens. Preserve its structure.
Keep
Clear headline.
Progress summary.
Two-column tool cards.
Next/previous pillar flow.
Whole-card navigation.
Improve
Reduce colour-contrast failures.
Increase mobile target sizes.
Use consistent card heights.
Clearly mark which tools require AI.
Avoid placing “AI” badges on every card if AI is merely optional.
Show the most important next tool first.
Explain why a score is zero.
Message tool
Make one-liner creation the obvious first action.
Show live preview.
Save automatically.
Offer examples separately from inputs.
Do not pre-populate real fields with examples.
Offer Builder
Keep:
Live strength feedback.
Worked examples.
“Make it stronger.”
AI draft.
Objection builder.
Change:
Empty score to Not started.
Use neutral placeholders.
Prevent placeholders from looking like saved values.
Keep the sticky Save bar from covering fields.
Show save status near the heading.
Allow “Use this example” explicitly.
Keep currency connected to workspace currency.
Rename “Price Anchor” help in plain language:
What would the customer compare this price with?
Presentation
Turn the checklist into grouped sections:
Clarity.
Trust.
Proof.
Risk reversal.
Mobile.
Call to action.
Show completed count per group.
Explain failures with a direct recommended action.
12. Numbers improvements
Numbers hub
Keep the current card-based layout.
Group tools into:
Understand today
Business Reality.
Break-even.
Funnel economics.
Find the constraint
Driver Tree.
Constraint.
Insights.
Test tomorrow
Model.
Scenarios.
Goal Solver.
Break-even
Current default values can be mistaken for real data.
Change to:
Read price from the saved Offer.
Read currency from the workspace.
Leave other fields empty until entered.
If examples are useful, add a button:
Load an example
Clearly label example mode.
Display results only when the required inputs are present:
Price.
Variable cost.
Fixed costs.
Business Reality
Remove the second navigation row containing:
AI.
Driver Tree.
Constraint.
Execution Centre.
Review.
Overview.
Home.
These destinations already belong in global or local structured navigation.
Use a clean step sequence:
What business are you in?
Where are you now?
Where do you want to be?
What is the gap?
Save and continue.
Fix the sticky bar so it never covers the next section.
Currency
Create one workspace-level currency setting.
All these must use it:
Studio.
Break-even.
Offer.
Business Reality.
Reports.
Home.
Goal Solver.
Campaign economics.
Community copies of funnels.
A project can override the workspace currency when required.
13. Execution improvements
Execution hub
Keep the clean card style.
Recommended order:
Funnels.
Leads and Bookings.
Audiences.
Campaigns.
Tracking and Actuals.
“Launch Studio & 90-day” should become:
Your Plan
Do not present it as another Studio product.
Funnel Builder
Its empty state is already good.
Improve the New Funnel flow:
Funnel name.
Purpose.
Template or blank.
Questions.
Scoring.
Outcome screens.
Contact capture.
Calendar.
Review.
Publish.
Show persistent statuses:
Draft.
Ready.
Published.
Paused.
Qualification Wizard
Fix:
Current lint error.
Back button behaviour on the first question.
Keyboard selection for choices.
Focus after moving to the next question.
Announcements such as “Question 2 of 5.”
At least 44px answer targets.
Validation message when no answer is selected.
Proper internal links versus new-tab external links.
Leads and booking
The central lead view should show:
New.
Qualified.
Nurture.
Booked.
Won.
Lost.
Each lead should provide:
Source creative.
Source funnel.
Qualification answers.
Score.
Contact permission.
Booking.
Timeline.
Notes.
Follow-up actions.
Avoid making the user visit several tools to understand one lead.
Campaign ownership
Split Campaign Studio navigation logically:
Psychology owns
Brand Brain.
Brand Voice.
Creative generation.
Copy.
Angles.
Execution owns
Campaign creation.
Audience selection.
Sending.
Scheduling.
Connections.
Delivery reporting.
Do not mark the entire /campaign-studio route as Psychology.
Use explicit route matching for individual pages.
14. Brand Brain improvements
Keep the three-step structure:
Brand Info.
Brand Voice.
Products and Proof.
Changes
Replace broken emoji with existing vector icons.
Use proper form labels for every field.
Make required fields clear.
Validate before Continue.
Fix the sticky action bar overlap.
Show autosave status.
Explain which ONEVYRT tools consume each field.
Keep website autofill optional.
Show extracted information for review before overwriting existing information.
Never silently replace user-entered brand fields.
Provide Undo after AI autofill.
Store colour names separately from hex values.
Add preview:
Logo.
Primary colour.
Secondary colour.
Brand voice sample.
15. Community improvements
The current empty page appears unfinished.
Empty state
Show:
No community items have been shared yet.
Then provide:
Browse built-in examples.
Publish your first funnel.
Share a creative.
Learn how sharing works.
Starter content
Use clearly labelled built-in examples, not fabricated user posts.
Sections:
Featured funnels.
Popular offer structures.
Creative examples.
Recently shared.
Saved by you.
Community cards
Show:
Item type.
Creator.
Purpose.
Funnel stages.
Industry.
Date updated.
Preview.
Copy to workspace.
Save.
Comments/reactions if active.
Before copying, display exactly what will be imported.
16. Landing page improvements
The current landing page looks attractive but no longer represents the complete application.
Proposed positioning
Headline direction:
Know what makes money, what is leaking, and what to do next.
Supporting text:
ONEVYRT connects your message, offer, numbers, funnel, leads and real results in one operating system.
Page sections
Hero.
The three pillars.
The Reality Loop.
What ONEVYRT connects.
Interactive product preview.
Guided setup.
Pricing.
Questions.
Final CTA.
Hero actions
Use two truthful buttons:
Create free account.
View the demo.
“View the demo” should open the demo.
Pricing actions
Free: View demo.
Pro: Create account.
Business: Create account.
Performance: Contact sales.
“Contact sales” should open a contact form or email workflow, not registration.
Currency
Use one market currency per pricing page.
For the UK page:
£0
£79
£149
Do not mix $0 with GBP plans.
Graphics
Replace emoji feature icons with the approved ONEVYRT glyph system.
Use real interface excerpts for:
Message.
Offer score.
Funnel canvas.
Actual versus Plan.
Decision.
The current decorative funnel bars are attractive but do not demonstrate the product’s real depth.
17. Naming cleanup
Use these customer-facing names consistently:
Current mixed names
Proposed name
ONEVYRT OS / OneVYRT / ONE VYRT
ONEVYRT
Launch Studio
Home or Your Plan
Growth Program
Guided Plan
Business OS
Numbers
Acquisition OS
Execution
Funnel Studio
Studio
Business Intelligence
Business Plan
Model Centre
Model
Programme
Guided Plan
Start page
Your Plan
Golden funnel
Generic Starter Funnel
Internally, GEAR 2.0 can remain the simulation engine name.
Avoid putting “OS” after multiple separate features. ONEVYRT itself is the operating system.
18. Buttons and controls
Create one shared button system.
Desktop sizes
Small: 30–32px.
Default: 34–36px.
Important action: 38–40px.
Mobile sizes
Minimum: 44px.
Important action: 48px.
Button hierarchy
Primary
One per section or decision point.
Examples:
Continue.
Save.
Publish.
Create project.
Secondary
Supporting actions:
Preview.
Use example.
Duplicate.
Open report.
Tertiary
Low-emphasis actions:
Cancel.
Back.
Learn more.
Destructive
Delete.
Remove workspace.
Archive when consequential.
Use a red treatment and confirmation.
Icon buttons
Every icon button must have:
Accessible name.
Tooltip.
Visible focus.
Minimum mobile target.
Consistent icon style.
Disabled buttons
Explain why an action is disabled.
Example:
Add a funnel name before publishing.
Do not silently grey out an important button.
19. Forms
Create one shared field system.
Every field should have:
Visible label.
Optional or required status.
Help text where necessary.
Error message.
Focus state.
Disabled state.
Correct input type.
Saved or unsaved state when relevant.
Placeholders
Placeholders should be short and neutral.
Bad:
Coaches doing $5–20k/mo who want more booked calls
Better:
Example: independent coaches
Specific worked examples should remain inside expandable Example panels.
Validation
Validate when leaving a field or pressing Continue.
Do not show red errors before the user interacts.
Move focus to the first invalid field.
Announce errors to screen readers.
Preserve entered information after a server error.
20. Dialogs and confirmations
Replace all native window.prompt() and window.confirm() interactions.
Create accessible dialogs for:
New project.
Rename project.
Duplicate.
Delete.
Archive.
Add sequence.
Workspace changes.
Import confirmation.
Publish.
Disconnect integration.
Each dialog should:
Have a title.
Explain the consequence.
Trap focus.
Close with Escape.
Return focus to the opening control.
Have Cancel and clear action buttons.
Require typed confirmation only for irreversible destructive actions.
21. Icons and graphics
Preserve
Use the accepted simplified, hand-authored platform glyphs.
Replace
Remove interface emoji such as:
Gear emoji.
Credit-card emoji.
Graduation-cap emoji.
Bell emoji.
Robot emoji.
Compass emoji.
They render differently across operating systems and some appeared as empty boxes during testing.
Metric colours
Do not give every KPI a decorative colour.
Default KPIs should use normal text.
Use semantic colour only:
Green: healthy/positive.
Amber: caution.
Red: problem.
Blue: informational.
Purple: optional modelling/scenario context.
For example, “Revenue” does not always need green; revenue can be below target.
22. Accessibility programme
Application shell
Every private layout needs:
Skip to content
...
...
Headings
Exactly one visible h1 per page.
Logical h2 and h3 order.
Modal heading attached through aria-labelledby.
Navigation
Mobile labels must not use display:none without providing an accessible name.
Every navigation link requires a stable label.
Colour contrast
Replace deliberately low-contrast text and borders.
Suggested light tokens:
Primary text: #111827
Secondary text: #475569
Tertiary text: #64748b
Strong green button: around #087A55
App background: #F7F8FC
Default border: approximately #DDE3EB
White text on the current bright green should be checked carefully.
Keyboard
Verify:
Tab order.
Enter/Space activation.
Escape closes modal.
Arrow keys where relevant.
Command palette.
Canvas selection.
Inspector opening.
Focus restoration.
Status announcements
Use aria-live for:
Saved.
Published.
Import complete.
Error.
AI response ready.
Funnel score updated.
Acceptance standard
Key pages should have:
No critical Axe violations.
No serious Axe violations.
No unnamed buttons or selectors.
No keyboard traps.
No content available only through colour or hover.
23. Loading, empty and error states
Create shared components:
LoadingState
EmptyState
ErrorState
AuthenticationState
PermissionState
ConnectionState
Loading
Use skeletons matching the eventual layout.
Avoid large blank screens.
Empty
Every empty state should answer:
What is missing?
Why does it matter?
What should I do?
Is there an example?
Error
Show:
What failed.
Whether information was saved.
Retry action.
Support/request ID for server problems.
Authentication
Unauthenticated private routes should redirect to a consistent sign-in page with:
returnUrl=/requested-page
After sign-in, return the user to the requested page.
Do not show the complete application navigation above a small “Please sign in” card.
24. Design-system consolidation
The interface currently repeats page-level CSS and tokens.
Create shared components:
AppShell
PageHeader
SectionNav
Button
IconButton
Card
MetricCard
ScoreCard
Field
Select
Textarea
Tabs
Progress
Badge
EmptyState
StickyActionBar
Dialog
Toast
WorkedExample
AIStatus
ProjectPicker
Typography
Recommended compact scale:
Page title: 24–28px.
Section title: 18–20px.
Card title: 14–16px.
Body: 13–14px.
Help text: 12px.
Eyebrow: 10–11px.
Use weight and spacing for hierarchy instead of oversized headings.
Layout widths
General hub: 960–1040px.
Long form: 720–780px.
Dashboard: 1100–1180px.
Full canvas: full width.
Mobile side padding: 16–18px.
25. Technical restructuring
The 4,746-line Studio file should be divided without altering engine behaviour.
Proposed structure
studio/
StudioShell.tsx
StudioHeader.tsx
RealityLoopNav.tsx
ProjectLibrary.tsx
GuidedSetup.tsx
CanvasWorkspace.tsx
BlockLibrary.tsx
CanvasToolbar.tsx
Inspector.tsx
KpiBar.tsx
ProjectDialogs.tsx
ExportMenu.tsx
hooks/
useStudioProject.ts
useStudioHistory.ts
useStudioPersistence.ts
useStudioKeyboard.ts
useStudioActuals.ts
useStudioLayout.ts
The existing engine calls remain untouched.
State management
Separate state into domains:
Project document.
Canvas selection.
View/layout.
Persistence.
Authentication/workspace.
Dialogs.
AI.
Reports.
Transient UI state should not be mixed with persisted funnel data.
Navigation
Replace internal raw anchor navigation with Next.js Link where appropriate.
This prevents unnecessary full-page reloads and protects transient state.
Lint
Fix:
Missing react-hooks/exhaustive-deps plugin/rule.
Qualification Wizard unused expression.
Unused Studio imports and dead calculations.
Remaining warnings in manageable groups.
Target:
0 lint errors
0 new warnings
pnpm configuration
Move ignored package configuration to the supported pnpm configuration location.
Verify that:
Security overrides apply.
Approved build dependencies apply.
CI and local installation use the same settings.
Testing
Required CI sequence:
Install.
Typecheck.
Lint.
Engine tests.
Web unit tests.
Database integration tests.
Production build.
Playwright flows.
Accessibility smoke test.
Use an isolated Postgres database in CI so database-backed tests actually run.
26. Essential end-to-end tests
New user
Register.
Create workspace.
Select currency.
Complete Guided Setup.
Arrive at Step 1.
See no invented actual results.
Save.
Return and resume correctly.
Message to offer
Write Message.
Save.
Open Offer.
Verify Message context is available.
Build Offer.
Verify score and suggested next step.
Offer to Numbers
Enter an offer price.
Save.
Open Break-even.
Verify price and currency flow correctly.
Enter costs.
Verify calculation.
Funnel
Create funnel.
Add questions.
Configure outcomes.
Publish.
Open public link.
Submit qualification.
Verify lead appears.
Reality Loop
Create Plan.
Enter Actual.
Review variance.
Test a fix.
Record decision.
Confirm report updates.
Responsive
Test at:
320×568.
360×800.
390×844.
768×1024.
1280×800.
1440×1000.
No page-level horizontal overflow should exist.
27. Product analytics to add
Track the product flow without recording sensitive business content.
Events:
Account created.
Guided Setup started/completed.
Project created.
Message completed.
Offer completed.
Numbers completed.
Funnel created/published.
First lead.
First booking.
Actuals entered.
First decision.
User abandoned a step.
Error encountered.
This will reveal exactly where users become confused.
Home’s “next move” should be tested against actual completion behaviour.
28. Items to remove, merge or move
Remove
Duplicate authenticated Home.
Persistent Start / Run / Improve navigation.
Repeated next-action cards.
“Jump Anywhere” grid from Home.
UI emoji.
Hard-coded USD where workspace currency exists.
Unlabelled template assumptions.
Native prompt/confirm dialogs.
Page-specific duplicate design tokens.
Invisible mobile navigation scrolling.
Merge
/start and the Command Centre plan.
Business OS navigation into Numbers.
Acquisition OS navigation into Execution.
Programme/Growth Program into Guided Plan.
Account, billing and workspace controls into one account menu.
Move
Studio from authenticated / to /studio.
Campaign delivery to Execution.
Brand and creative preparation to Psychology.
Technical exports into Advanced Export.
Integrations into Account/Connections or Execution.
Full journey into an expandable plan view.
29. Implementation order
Phase 1: Trust and logic
Remove live-looking sample data.
Correct Step 1/Step 2 logic.
Correct empty scoring.
Standardise currency.
Make example mode explicit.
Fix Qualification Wizard error.
Phase 2: One product shell
Make Command Centre the only Home.
Move Studio route.
Add AppNav to all private pages.
Merge /start into Your Plan.
Establish route ownership.
Standardise ONEVYRT naming.
Phase 3: Home and onboarding
Redesign Home.
Reduce repeated next actions.
Improve project creation.
Add required validation to Guided Setup.
Establish one onboarding state machine.
Phase 4: Mobile and accessibility
Rebuild mobile navigation.
Convert Studio panels to drawers/bottom sheets.
Fix touch targets.
Add main landmarks and headings.
Fix accessible names and contrast.
Fix modal focus behaviour.
Phase 5: Visual system
Consolidate buttons, fields, cards and tokens.
Replace emoji.
Fix sticky bars.
Standardise metric colours.
Improve placeholders and examples.
Phase 6: Technical consolidation
Split the Studio component.
Remove unused/dead code.
Fix lint configuration.
Fix pnpm configuration.
Add database CI.
Add screenshot and accessibility regression tests.
Phase 7: Marketing and activation
Rewrite landing page.
Correct pricing actions.
Show actual ONEVYRT capabilities.
Improve Community starter state.
Add product-flow analytics.
30. Final acceptance checklist
The restructure is complete when:
ONEVYRT has one Home.
Every signed-in page uses one navigation system.
A blank workspace displays no invented business result.
New users begin at Step 1.
Examples are clearly labelled.
Offer and positioning display “Not started” when empty.
Workspace currency appears everywhere.
Campaign pages highlight the correct pillar.
No essential navigation label disappears on mobile.
Studio has no document overflow at 390px.
Touch controls reach 44px on mobile.
Sticky bars cover no fields or headings.
Every page has a main landmark and h1.
Every icon button has a name.
Key pages have no serious accessibility violations.
All UI emoji have been replaced.
Internal navigation uses client-side links.
Native prompts and confirms are gone.
Lint has zero errors.
Typecheck passes.
Production build passes.
All 316 engine tests continue to pass.
Database tests run against an isolated database.
Existing project files still open correctly.
Canvas drag/drop, templates, snapping, layout and exports still work.
Home displays one authoritative next move.
The complete journey is available without dominating Home.
Landing-page buttons perform exactly what they promise.
The central principle is: ONEVYRT should feel like one product, using one business truth, guiding the user through one clear next action.