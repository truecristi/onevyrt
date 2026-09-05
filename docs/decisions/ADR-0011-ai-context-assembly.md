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

The "Cost and latency tracking" Phase 6 slice (`ai_call_records`,
`ai-call-record-use-cases.ts`) is now the first place an AI call gets a
durable row - but that row is metadata only (actor, workspace,
provider/model, token counts, latency, an estimated cost), never the
actual prompt/response text. So the concrete question this ADR's
"retention" half asks - how long a request/response *envelope* persists,
who can read it, how it's exported/deleted - is still not decided,
because nothing in this codebase stores that envelope at all yet. Once
something does (e.g. a future audit/debugging need to see what a model
actually said), that slice inherits this open question rather than
re-deciding context assembly's already-settled half.

`ai_call_records` itself currently has no retention/deletion policy
either (rows accumulate indefinitely) - a smaller, separate gap from the
envelope question above, and one worth a real decision before this table
grows large in a real deployment, but not blocking anything this ADR
covers.

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
