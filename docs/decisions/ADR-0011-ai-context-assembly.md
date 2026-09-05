# ADR-0011: AI context assembly, redaction and retention

**Status:** Partially accepted (Phase 6 third slice - assembly and
redaction decided; retention still proposed, see below)
**Date:** 2026-09-05

## Context

What business/curriculum context gets assembled into an AI request, what's redacted, and how long request/response envelopes are retained.

Relevant specification sections: §5.2, §7.2, §39.

## Decision

### Assembly and redaction (decided this slice)

`assembleWorkspaceContext` (`packages/domain/src/ai-context-use-cases.ts`)
implements §5.2's "policy-controlled context assembler selects the
minimum records permitted for the task": a call site passes an explicit
`ContextClass[]` (currently `business_profile`, `goals`, `assumptions`,
`decisions` - a seed set, extended in the same slice that starts
requesting a new class, same convention as everywhere else in this
codebase) and an optional per-class row cap (default 5) - it never pulls
a whole table.

"Data from another workspace are excluded by construction": this reuses
the exact same `requireWorkspaceMembership` + `eq(table.workspaceId,
input.workspaceId)` tenancy gate every other domain use case uses
(ADR-0003) - not a separate AI-specific access-control layer that could
drift out of sync with it.

Every call returns a `ContextManifestEntry[]` alongside the rendered
text: record type, record ID, the record's `updatedAt` as its version
marker (these tables carry no explicit version counter, unlike
`program_versions`/`formula_definitions`), a data classification, and
which fields were left out of the prompt text (e.g. an assumption's
`ownerId`, which identifies a person rather than describing the
business) - §5.2's "manifest of IDs, versions, data classifications and
redactions", and §28's "context manifests list every record ID/version
and redaction."

### Retention (still proposed)

Not decided yet: this slice assembles context and returns a manifest to
its caller, but nothing persists a request/response envelope anywhere -
that starts with the "Cost and latency tracking" Phase 6 slice, which is
the first place an AI call actually gets a durable row. Retention policy
(how long that row lives, who can read it, whether/how it's included in
data export or deletion) is deferred to that slice, which will either
accept this half of the ADR or split it into its own follow-up ADR if the
retention question turns out to need one.

## Consequences

- A prompt template (packages/ai's registry) declares which
  `ContextClass`es it's allowed to request; `assembleWorkspaceContext` is
  what actually fetches and formats them - the two stay decoupled, so
  adding a context class doesn't require touching every template.
- Nothing about context assembly changes if/when retention is decided -
  it operates on data already in Postgres and returns an in-memory
  result; it has no retention surface of its own.

## Reversibility

High for the assembly/redaction half - `ContextClass` is a small, additive
enum and each loader is independent. Retention remains undecided, so N/A
there.

**Approvers:** Claude (autonomous build, per this repository's standing
delegation - see PR description for the slice that accepted this half of
the ADR)
