# ONEVYRT

**A measurable business-transformation operating system that turns learning into decisions, implementation, and verified results.**

> ONEVYRT is being rebuilt as a clean, TypeScript-first application. Existing versions are reference material for feature parity, business logic, calculations, content, and user workflows—not the architecture for the new system.

## Product vision

Most learning platforms stop after delivering information.

ONEVYRT connects:

1. Psychological readiness
2. Business education
3. Visual explanation
4. Personal reflection
5. Financial modeling
6. Decision-making
7. Practical implementation
8. AI-assisted coaching
9. Measurement
10. Continuous improvement

The product is not simply a course, calculator, AI chatbot, workbook, or dashboard. It combines these systems into one guided operating environment.

## The ONEVYRT transformation loop

Every major experience should support this loop:

```text
Regulate → Understand → See → Reflect → Model
     → Decide → Implement → Coach → Measure → Learn
```

A lesson is not complete because the user watched or read it.

A lesson becomes complete when the user:

* understands the principle;
* relates it to their business;
* models its numerical effect;
* makes a decision;
* creates an implementation artifact;
* performs the work;
* records evidence;
* measures the result;
* reflects on what was learned;
* chooses the next action.

## Primary navigation

The permanent product navigation is:

* **Today** — priorities, current state, recommended actions and active work
* **Learn** — lessons, explanations, examples, sketches and comprehension
* **Build** — offers, funnels, pages, scripts, plans and other business artifacts
* **Execute** — tasks, experiments, launches, outreach and implementation
* **Review** — scorecards, financial results, evidence, reflections and insights

## Guided business lifecycle

ONEVYRT guides users through seven connected stages:

1. **Define** — customer, market, problem, desired result and positioning
2. **Offer** — value proposition, offer architecture, pricing and risk reversal
3. **Numbers** — economics, conversion assumptions, targets and constraints
4. **Build** — funnel, pages, messages, assets and implementation plan
5. **Launch** — readiness, publishing, activation and initial execution
6. **Leads** — traffic, outreach, follow-up and pipeline management
7. **Improve** — measurement, diagnosis, experiments and iteration

The permanent navigation describes where work happens. The lifecycle describes how the business progresses.

## Core product capabilities

The rebuilt application must preserve and improve the valuable mechanics of the existing ONEVYRT application.

### Learning system

* Programs, modules, lessons and lesson blocks
* Structured learning paths
* Video, audio, text and interactive lessons
* Progress tracking
* Resume from the last meaningful position
* Knowledge checks
* Reflection prompts
* Exercises and assignments
* Completion evidence
* Lesson prerequisites
* Locked and unlocked progression
* Personal notes
* Bookmarks
* Search
* Recommended next lesson
* Application-oriented completion criteria

### Visual explanation system

Lessons may include:

* explanatory sketches;
* annotated diagrams;
* timelines;
* process maps;
* funnels;
* number flows;
* before-and-after comparisons;
* metaphors;
* visual frameworks;
* decision trees;
* state diagrams;
* interactive figures.

Two different visual systems are required:

* **Structured canvases** for editable business models and connected nodes
* **Freeform sketches** for teaching, annotation and visual explanation

Recommended tools:

* React Flow for structured canvases
* Excalidraw for freeform sketches

Visual content must be stored as editable structured data, not only as flattened screenshots.

### Psychology and state system

The application should help the user identify and work with:

* confusion;
* uncertainty;
* overwhelm;
* avoidance;
* fear;
* resistance;
* lack of confidence;
* decision fatigue;
* perfectionism;
* implementation friction.

State support must remain practical and non-clinical.

It may include:

* check-ins;
* readiness ratings;
* confidence ratings;
* emotional-state labels;
* short grounding exercises;
* implementation-intention prompts;
* friction diagnosis;
* obstacle planning;
* reflection;
* escalation messaging when appropriate.

ONEVYRT is not a medical, mental-health, diagnostic or emergency service.

### Business modeling and numbers

The application should support auditable calculations for:

* price;
* revenue;
* cost;
* gross profit;
* contribution margin;
* break-even point;
* customer acquisition cost;
* customer lifetime value;
* conversion rates;
* funnel stages;
* traffic requirements;
* lead requirements;
* sales requirements;
* target scenarios;
* best/base/worst cases;
* capacity;
* fulfillment constraints;
* cash requirements;
* offer economics;
* experiment outcomes.

Every important number must retain:

* its source;
* its unit;
* its currency where relevant;
* its time period;
* its formula version;
* whether it is observed, entered, imported, estimated or AI-suggested;
* the assumptions that produced it.

AI must never silently overwrite critical financial data.

### Offer and funnel building

Users should be able to build and revise:

* customer profiles;
* problem statements;
* desired outcomes;
* positioning statements;
* value propositions;
* offer components;
* bonuses;
* pricing;
* guarantees;
* risk reversal;
* objections;
* messages;
* hooks;
* stories;
* scripts;
* landing-page structures;
* funnel maps;
* follow-up sequences;
* launch plans;
* experiment plans.

Important business artifacts must be versioned.

Users must be able to compare changes and understand which version produced which result.

### Execution system

Learning must connect directly to implementation.

The execution system should include:

* projects;
* milestones;
* tasks;
* next actions;
* priorities;
* due dates;
* dependencies;
* blockers;
* checklists;
* experiments;
* evidence;
* completion history;
* review cycles.

Tasks should be created from lessons, decisions, business artifacts, coaching sessions or user input.

### Review and measurement

The Review area should answer:

* What changed?
* What was implemented?
* What evidence exists?
* Which numbers improved or declined?
* Which assumptions were correct?
* Where is the main constraint?
* What should happen next?

The system should support:

* scorecards;
* weekly reviews;
* experiment reviews;
* lesson-application reviews;
* financial reviews;
* funnel reviews;
* state and confidence trends;
* progress history;
* decision history;
* evidence inspection.

## AI coaching system

ONEVYRT uses AI as a context-aware coach, explainer and implementation assistant.

The preferred initial model may be Claude Sonnet 5, but the application must use a model-neutral AI gateway so providers and models can be changed without rebuilding product logic.

### AI responsibilities

AI may help the user:

* understand a lesson;
* receive a simpler explanation;
* see an analogy or metaphor;
* generate a visual-explanation specification;
* apply a principle to their business;
* identify missing information;
* examine assumptions;
* interpret business numbers;
* compare scenarios;
* diagnose a funnel;
* evaluate an offer;
* generate implementation options;
* draft an artifact;
* create a task plan;
* reflect on results;
* select the next useful action.

### AI boundaries

AI must not:

* directly modify critical business or financial records;
* invent facts about the user’s business;
* present estimates as observations;
* silently change formulas;
* provide clinical diagnoses;
* make irreversible decisions for the user;
* expose information across workspaces;
* execute external actions without explicit authorization.

### Typed AI outputs

Important AI responses must use validated schemas rather than unstructured text alone.

Examples include:

* coaching response;
* lesson explanation;
* assumption list;
* scenario proposal;
* artifact draft;
* task proposal;
* sketch specification;
* experiment proposal;
* review summary;
* risk notice.

The server must validate AI output before displaying or storing it.

### Proposed-action workflow

For consequential changes, AI follows this process:

```text
AI proposes change
        ↓
Application validates proposal
        ↓
User reviews assumptions and effects
        ↓
User accepts, edits or rejects
        ↓
Application records the decision
        ↓
Approved domain command is executed
        ↓
Audit event is created
```

## Architecture direction

The rebuilt system should use:

* TypeScript across the application and worker services
* Next.js App Router
* React
* PostgreSQL
* Drizzle ORM
* Zod validation
* pnpm workspaces
* Background workers for long-running jobs
* Vitest for unit and integration tests
* Playwright for end-to-end tests
* Object storage for uploaded assets and evidence
* A model-neutral AI provider gateway
* An event and audit system for consequential actions

Python may be used for isolated research or data-processing work when it is genuinely appropriate. It must not be used as a source-code generator, UI injector or replacement for maintainable product architecture.

## Target repository structure

```text
onevyrt/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   └── public/
│   └── worker/
├── packages/
│   ├── ai/
│   ├── analytics/
│   ├── auth/
│   ├── content/
│   ├── contracts/
│   ├── database/
│   ├── design-system/
│   ├── domain/
│   ├── observability/
│   ├── security/
│   └── testing/
├── docs/
│   ├── ONEVYRT_Deep_Product_Learning_AI_Implementation_Master_Spec.md
│   ├── architecture/
│   ├── decisions/
│   ├── parity/
│   └── runbooks/
├── tests/
│   ├── e2e/
│   ├── fixtures/
│   └── parity/
├── tooling/
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

This is the target structure. Some directories may not exist until their implementation phase begins.

## Architecture rules

1. Business logic belongs in domain packages, not page components.
2. Financial formulas must be deterministic, versioned and tested.
3. API input and output must use shared validated contracts.
4. Every record must be scoped to the correct user and workspace.
5. Authorization must be enforced on the server.
6. AI is accessed only through the AI gateway.
7. AI-generated consequential changes require user approval.
8. Long-running AI and content jobs must use background workers.
9. Important business artifacts must be versioned.
10. Consequential changes must create audit records.
11. Lessons must connect to reflection, modeling and implementation.
12. Features must include empty, loading, error, success and recovery states.
13. Accessibility and keyboard navigation are product requirements.
14. Secrets must never be committed to the repository.
15. No production code may depend on generated source injection.

## Source of truth

The detailed implementation contract is:

[`docs/ONEVYRT_Deep_Product_Learning_AI_Implementation_Master_Spec.md`](docs/ONEVYRT_Deep_Product_Learning_AI_Implementation_Master_Spec.md)

That document contains the full:

* product definition;
* existing-feature audit;
* parity requirements;
* domain model;
* user journeys;
* AI architecture;
* learning architecture;
* visual explanation system;
* psychology and state model;
* financial engine;
* security model;
* testing strategy;
* migration strategy;
* phased implementation plan;
* acceptance criteria.

When this README and the master specification appear to conflict, stop and resolve the difference explicitly. Do not silently select one interpretation.

## Legacy-system policy

Existing ONEVYRT implementations should initially be treated as read-only reference systems.

They may contain valuable:

* calculations;
* prompts;
* content;
* workflows;
* terminology;
* data;
* edge cases;
* user expectations.

They may also contain:

* duplicated logic;
* generated code;
* mixed responsibilities;
* insecure shortcuts;
* incomplete features;
* architectural debt.

The goal is behavioral parity where the behavior is valuable—not line-by-line reproduction of the legacy implementation.

Every legacy capability should receive a parity classification:

* `PRESERVE`
* `REBUILD`
* `IMPROVE`
* `MERGE`
* `DEFER`
* `REMOVE`

Every migrated feature should have a stable parity identifier and evidence showing whether it has been implemented and tested.

## Implementation strategy

Do not attempt to build the entire product in one AI prompt or one pull request.

### Phase 0 — Discovery and parity audit

* Inventory every legacy route, screen, component and service.
* Inventory lessons, media, prompts and exercises.
* Extract formulas and calculation rules.
* Identify authentication and tenancy behavior.
* Record integrations and environment requirements.
* Produce a parity matrix.
* Classify every capability.
* Identify unsupported assumptions and contradictions.

### Phase 1 — Foundation

* Create the TypeScript monorepo.
* Configure formatting, linting and type checking.
* Create the design-system foundation.
* Configure PostgreSQL and migrations.
* Add shared contracts.
* Add authentication and workspace isolation.
* Add testing infrastructure.
* Add observability and audit foundations.
* Add continuous integration.

### Phase 2 — Core user and business data

* Users and authentication
* Workspaces and membership
* Business profiles
* Goals
* Customer profiles
* Offers
* Business metrics
* Assumptions
* Decisions
* Tasks
* Evidence
* Audit records

### Phase 3 — Learning system

* Programs, modules and lessons
* Structured lesson blocks
* Progress tracking
* Resume behavior
* Notes and bookmarks
* Knowledge checks
* Reflection
* Lesson application
* Prerequisites
* Completion rules

### Phase 4 — Numbers and modeling

* Versioned formula library
* Scenario modeling
* Funnel mathematics
* Unit economics
* Financial dashboards
* Assumption provenance
* Comparison tools
* Calculation tests

### Phase 5 — Build and execution

* Offer builder
* Customer and positioning tools
* Funnel builder
* Artifact versioning
* Task and project system
* Experiment system
* Evidence collection
* Launch workflows

### Phase 6 — AI coaching

* Provider-neutral AI gateway
* Prompt and schema registry
* Context assembly
* Coaching interface
* Lesson explanations
* Artifact proposals
* Task proposals
* Sketch specifications
* Safety checks
* Cost and latency tracking
* Evaluation system

### Phase 7 — Review and intelligence

* Scorecards
* Weekly reviews
* Experiment analysis
* Constraint diagnosis
* Progress summaries
* Recommendation ranking
* Improvement loops

### Phase 8 — Migration and hardening

* Import legacy data
* Verify parity
* Run security reviews
* Test workspace isolation
* Test recovery and rollback
* Validate performance
* Conduct accessibility testing
* Complete launch readiness review

## Development prerequisites

Target development environment:

* Node.js 22 or newer
* pnpm 10 or newer
* PostgreSQL 16 or newer
* Docker or an equivalent local container environment
* Git

After the Phase 1 scaffold is implemented, the repository should provide these commands:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Until the scaffold exists, consult the master specification and the current `package.json` before running commands.

## Environment configuration

The repository must contain a safe `.env.example` documenting required variables without containing real credentials.

Possible variable groups include:

```text
DATABASE_URL
AUTH_SECRET
APP_URL
OBJECT_STORAGE_*
AI_PROVIDER
AI_MODEL
ANTHROPIC_API_KEY
OPENAI_API_KEY
OBSERVABILITY_*
EMAIL_*
```

Only variables used by implemented features should be added.

Never commit:

* API keys;
* database credentials;
* authentication secrets;
* private user data;
* production exports;
* raw coaching conversations containing personal information.

## Instructions for Codex and other AI development agents

Before changing code:

1. Read this README.
2. Read the relevant section of the master specification.
3. Inspect the affected implementation.
4. Check the parity matrix.
5. Identify the exact domain boundary.
6. Identify existing tests.
7. State assumptions when requirements are ambiguous.

While changing code:

* Work on one bounded vertical slice at a time.
* Preserve unrelated user changes.
* Do not generate or inject large amounts of source code through Python.
* Do not place business formulas inside UI components.
* Do not let routes contain domain logic.
* Reuse shared contracts and design-system components.
* Validate all external input.
* Scope every query by workspace.
* Require confirmation for consequential AI proposals.
* Add loading, empty, error and recovery behavior.
* Add tests for business rules and access control.
* Update parity status and documentation.

Before declaring work complete:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run relevant end-to-end tests when the changed feature has a user-facing workflow.

A task is not complete merely because the interface renders.

## Definition of done

A feature is complete only when:

* its requirements are linked to the master specification;
* its parity identifier is recorded;
* domain behavior is implemented;
* authorization is enforced;
* validation is implemented;
* loading and error states exist;
* accessibility is checked;
* telemetry is included where appropriate;
* unit or integration tests cover business rules;
* end-to-end behavior is tested when appropriate;
* documentation is updated;
* no secrets are exposed;
* the production build succeeds.

## Pull-request checklist

Every pull request should answer:

* What user problem does this solve?
* Which specification sections does it implement?
* Which parity identifiers does it affect?
* What domain rules changed?
* What data or migration changes are included?
* How was workspace isolation verified?
* What tests were added?
* What manual verification was performed?
* What risks or follow-up work remain?
* Are screenshots or recordings required?
* Does this change affect AI cost, latency or safety?
* Does this change affect financial calculations?
* Is rollback possible?

## Security principles

* Deny access by default.
* Enforce authorization server-side.
* Scope records by workspace.
* Use least-privilege credentials.
* Validate uploads and external input.
* Protect against prompt injection.
* Redact sensitive information from logs.
* Maintain audit trails.
* Support data export and deletion.
* Rate-limit expensive or sensitive operations.
* Require explicit approval before external or irreversible actions.

## Testing strategy

The application requires several test layers:

* Unit tests for formulas and domain rules
* Contract tests for schemas and APIs
* Integration tests for database behavior
* Authorization and workspace-isolation tests
* AI schema-validation tests
* Prompt regression evaluations
* Visual regression tests
* End-to-end tests for critical user journeys
* Migration and parity tests
* Accessibility tests
* Performance and reliability tests

Critical numerical calculations should use fixed fixtures with known expected results.

## Observability

Production behavior should be measurable through:

* structured logs;
* error tracking;
* request tracing;
* background-job status;
* AI latency;
* AI token usage;
* AI cost;
* schema-validation failures;
* model and prompt versions;
* product analytics;
* audit events;
* funnel and learning events.

Sensitive lesson reflections, coaching text and business data must not be placed in analytics payloads unnecessarily.

## Product success

Success is not measured only by:

* registrations;
* page views;
* lesson views;
* AI messages;
* time spent in the application.

ONEVYRT should primarily measure:

* meaningful lesson completion;
* quality of understanding;
* decisions made;
* implementation tasks completed;
* evidence submitted;
* experiments completed;
* improvement in business metrics;
* reduction of unresolved blockers;
* repeated review behavior;
* movement through the business lifecycle.

## Documentation

Architectural decisions should be stored in:

```text
docs/decisions/
```

Architecture documentation should be stored in:

```text
docs/architecture/
```

Feature-parity documentation should be stored in:

```text
docs/parity/
```

Operational procedures should be stored in:

```text
docs/runbooks/
```

Documentation must be updated in the same pull request as the behavior it describes.

## Licensing and ownership

Unless a separate `LICENSE` file states otherwise, this repository and its contents are proprietary. No open-source license or permission to copy, redistribute or create derivative works is granted automatically.

## Current status

ONEVYRT is in the architecture, audit and controlled-rebuild stage.

The immediate priorities are:

1. Commit the master specification.
2. Preserve the existing application as a reference.
3. Complete the feature and content parity inventory.
4. Establish the clean TypeScript foundation.
5. Implement and verify one vertical slice at a time.
6. Migrate only after replacement behavior has been tested.

Do not begin by recreating every screen.

Begin by establishing the contracts, domain model, security boundaries, calculation rules and measurable transformation loop that every screen depends on.
