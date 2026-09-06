# Phase 9 second security pass

Per the post-roadmap work list (item 3: "run a real external security
review"). **This is not that review, and it never could be** - "external"
means independent of the process that wrote the code, and this pass was
done by the same session that built the system it's reviewing. What
follows is a second, more adversarial internal pass, looking
specifically for vulnerability classes the [Phase 8 security
review](phase-8-security-review.md) didn't already cover (CSRF, rate
limiting, input validation, SQL injection, secrets, password/session
security, response headers), rather than repeating that ground. A real
external review remains outstanding before any real launch - see
ADR-0022.

## Method

Read the actual source for four classes the first pass didn't check:
impersonation (does any request ever let a caller act as a different
user than their own authenticated session?), outbound-request safety in
the AI gateway (SSRF, information disclosure through provider errors),
authorization on the AI-proposed-action accept/reject flow specifically
(a place where a stored value, not just live request data, drives a
mutation), and the completeness of the Phase 8 response-header set now
that a real deployment target exists (ADR-0021).

## Findings

### Fixed

- **No `Strict-Transport-Security` header** (`apps/web/next.config.js`).
  Not meaningful to set before Phase 8, when there was no real HTTPS
  deployment target to apply it to - now that ADR-0021 names Vercel
  (which terminates TLS by default), added
  `max-age=63072000; includeSubDomains`. Deliberately without `preload`:
  submitting a domain to browsers' HSTS preload list is a one-way
  decision this session shouldn't make unilaterally for
  `onevyrt.masteryresearch.com`, a domain it doesn't control DNS for.

### Confirmed already correct

- **No impersonation surface**: every route handler's `actorUserId`
  passed into a domain use-case traces back to `getCurrentUser()`'s
  server-verified session (`apps/web/lib/session.ts`), never to
  anything in the request body - checked by grepping every
  `actorUserId:` assignment across `apps/web/app/api` for one that
  _doesn't_ come from `user.id`/`session.userId`/`actor.id`; found none.
  `getCurrentUser()` itself resolves a hashed session token against the
  database and checks expiry (`verifySessionToken`,
  `packages/domain/src/auth-use-cases.ts`) - it's not a client-trusted
  cookie value.
- **AI gateway outbound requests are not SSRF-prone**: the real
  Anthropic adapter (`packages/ai/src/providers/anthropic.ts`) posts to
  a single hardcoded constant URL
  (`https://api.anthropic.com/v1/messages`) - never a caller- or
  database-supplied URL - so there's no path from any request input to
  an arbitrary outbound destination.
- **AI provider errors don't leak upstream response bodies to
  clients**: every route catching `AiProviderError` logs the real
  `error.message` (which can include the provider's raw response text)
  server-side only, and returns a fixed generic message
  (`"AI provider did not return a usable answer"`, HTTP 502) to the
  caller - checked across every route importing `AiProviderError`
  (`coaching/ask`, `artifact-proposals`, `task-proposals`,
  `sketch-specifications`, lesson `explain`).
- **The AI-proposed-artifact-patch accept flow is not exploitable via
  object-spread field injection**: `acceptArtifactProposal`
  (`artifact-proposal-use-cases.ts`) builds its call to `updateOffer`/
  `updateCustomerProfile`/`updateFunnelStep` as
  `{ workspaceId: input.workspaceId, actorUserId: input.actorUserId,
...patch }` - `patch` spread _after_ the trusted fields, which would
  let a proposal's stored `proposedPatch` override `workspaceId` or
  `actorUserId` with attacker-influenced values if the stored patch ever
  contained those keys. It can't: `proposedPatch` is written once, at
  proposal-creation time, only after
  `updateOfferRequestSchema`/equivalent's `.safeParse()` - a plain
  `z.object()` with no `workspaceId`/`actorUserId`/`*Id` fields defined
  and no `.passthrough()`, so Zod strips any such key before the patch
  is ever stored. Confirmed by reading the actual schema, not assumed.
  **Worth flagging as fragile, not wrong**: this safety currently
  depends on nobody ever adding a field named `workspaceId`,
  `actorUserId`, or an `*Id` ownership field to one of those three
  update-request schemas. A cheap, permanent hardening (not done in
  this pass, to keep this a review rather than a refactor) would be
  spreading `patch` _before_ the trusted fields instead of after, so
  the trusted values always win regardless of what a schema allows
  later - noted here for a future small PR rather than silently fixed
  inline.
- **Proposal accept/reject cannot cross workspaces**:
  `getPendingProposalOrThrow` scopes its lookup by both `proposalId`
  _and_ `workspaceId` in the same `WHERE` clause, so a proposal ID from
  a different workspace 404s (`ArtifactProposalNotFoundError`) rather
  than ever being visible or actionable cross-tenant.

## Not covered by this pass either

Same limitation as Phase 8's review, restated rather than repeated in
full: this is still a self-review, still by the same process that wrote
the code, still weaker than an independent audit at catching a
vulnerability class nobody on this side has thought to look for.
Untouched by both passes so far: the task-proposal accept flow's own
authorization (not re-checked here, since it follows the identical
shape already verified for artifact proposals), anything in
`packages/canvas`/sketch storage (both still architecturally
unstarted - ADR-0007/0008), and of course everything a real external
review would bring that two internal passes structurally cannot.

## Verification

- `pnpm -r typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter
@onevyrt/web build` after the `next.config.js` change - all pass (see
  this PR's commit for the exact run).
- Every claim above traces to a specific file and line read directly in
  this pass, not inferred from a comment or a prior document's summary.
