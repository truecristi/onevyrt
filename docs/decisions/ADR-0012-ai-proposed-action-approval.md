# ADR-0012: Proposed-action approval and safe mutation

**Status:** Partially accepted (Phase 6 sixth slice - the artifact-proposal
pipeline is decided; task proposals reuse the same shape in a later
slice, and material-mutation-requires-confirmation for higher-stakes
categories - financial actuals, billing, membership, deletion,
published communications - is spec §7.2's own carve-out, not yet
exercised by anything this codebase has built)
**Date:** 2026-09-05

## Context

The propose -> validate -> user-review -> accept/edit/reject -> audited-apply pipeline for any AI action that would mutate business data.

Relevant specification sections: §7.2, §7.3, the README's proposed-action workflow diagram.

## Decision

`packages/domain/src/artifact-proposal-use-cases.ts` implements the
pipeline for the three artifact types that already have versioning
(offer, customer_profile, funnel_step - see schema.ts's
artifactProposals doc comment for why this stays scoped to the same
three rather than a fourth polymorphic surface):

1. **Propose**: an API route (`POST /api/workspaces/:workspaceId/
artifact-proposals`) loads the artifact's current state, asks a model
   for a `{patch, rationale}` envelope via the `propose_artifact_patch`
   prompt template, and hands the result to `createArtifactProposal`.
2. **Validate**: `createArtifactProposal` re-validates `patch` against
   that artifact type's own update-request Zod schema (the same one the
   human-facing PATCH route already uses) before ever storing it -
   §7.2's "the model returns JSON conforming to a versioned Zod schema.
   The server validates" made concrete, without inventing a second
   schema per artifact type.
3. **User-review**: the proposal is stored `pending`, listed via `GET
.../artifact-proposals`, with its `rationale` and the full patch
   visible for review before anyone acts on it - the "preview/diff" §7.2
   calls for.
4. **Accept/reject**: dedicated action routes (`POST .../accept`, `POST
.../reject`), not a generic status PATCH, since accepting has the
   real side effect of mutating the target artifact.
5. **Audited apply**: accepting calls that artifact type's own
   `updateOffer`/`updateCustomerProfile`/`updateFunnelStep` - the exact
   same domain function and `<artifact>.updated` audit-log entry a human
   editing the same field through the regular PATCH route would produce
   - then separately records `artifact_proposal.accepted` with who
     reviewed it and when. `promptTemplateKey`/`promptTemplateVersion`/
     `providerId`/`model` are recorded at proposal-creation time - §7.2's
     "records model/provider, prompt template version, user confirmation."

Accepting runs as two separate top-level transactions rather than one
(documented in `acceptArtifactProposal`'s own doc comment): this
codebase has no nested-transaction composition for calling one domain
use case's transaction from inside another's, and re-applying the same
validated patch on a retry is idempotent, so the narrow window between
the two writes is an accepted, documented tradeoff rather than a real
correctness gap.

### Not yet decided

- **Task proposals** (README's next AI coaching slice) - expected to
  reuse this same pipeline shape, not invent a new one, but that's a
  decision for the slice that actually builds it.
- Spec §7.2's explicit carve-out - "financial actuals, billing,
  membership, deletion and published communications never change solely
  from an AI response" - has nothing to decide yet, because nothing this
  codebase has built proposes changes to those categories. Whatever
  category adds that capability first is what actually has to reckon
  with it.

## Consequences

- A reviewer sees exactly what will change and why before it happens;
  nothing here lets a model mutate a workspace's data unattended.
- Every accepted proposal leaves the same audit trail as a manual edit,
  plus a second entry naming which proposal and which model produced it.

## Reversibility

High for the pipeline shape (an interface any future proposal type -
task proposals, sketch specifications - can adopt without touching this
one). N/A for the not-yet-decided carve-out above.

**Approvers:** Claude (autonomous build, per this repository's standing
delegation - see PR description for the slice that accepted this half of
the ADR)
